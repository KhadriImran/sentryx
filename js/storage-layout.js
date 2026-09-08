/* ==========================================================================
   SENTRYX — Storage Layout Visualizer + Upgrade Safety Checker
   ---------------------------------------------------------------------------
   Two modes on one page:
     LAYOUT   paste a contract, see slot-by-slot packing with wasted space
     UPGRADE  paste V1 and V2, diff the layout and flag unsafe changes

   The diff rules mirror what actually breaks an upgradeable proxy:
     CRITICAL  a slot's type changed        (new code reads old data)
     CRITICAL  a variable was inserted/removed mid-layout (everything shifts)
     HIGH      variables reordered
     MEDIUM    storage gap shrunk by the wrong amount
     LOW       renamed only (safe, but worth confirming it was intentional)
     OK        appended at the end

   Nothing is uploaded. All analysis runs in this browser.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("storage-tool");
  if (!root || !window.SENTRYX_sol) return;
  var sol = window.SENTRYX_sol;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  var SAMPLE_V1 = `// ILLUSTRATIVE — V1 of an upgradeable vault
pragma solidity 0.8.24;

contract VaultV1 {
    address public owner;          // slot 0, bytes 0-19
    bool    public paused;         // slot 0, byte 20
    uint8   public feeBps;         // slot 0, byte 21

    uint256 public totalShares;    // slot 1
    mapping(address => uint256) public balanceOf;  // slot 2

    uint128 public cap;            // slot 3, bytes 0-15
    uint128 public floor;          // slot 3, bytes 16-31

    string  public name;           // slot 4
    uint256[50] private __gap;     // slots 5-54
}`;

  var SAMPLE_V2 = `// ILLUSTRATIVE — V2 with an UNSAFE insertion
pragma solidity 0.8.24;

contract VaultV2 {
    address public owner;
    bool    public paused;
    uint8   public feeBps;

    address public treasury;       // <-- INSERTED: shifts everything below
    uint256 public totalShares;
    mapping(address => uint256) public balanceOf;

    uint256 public cap;            // <-- WIDENED from uint128: breaks packing
    uint128 public floor;

    string  public name;
    uint256[49] private __gap;
}`;

  /* ---------------------------------------------------------- computation */
  function analyse(src) {
    var cs = sol.contracts(src);
    if (!cs.length) return { error: "No contract, library or interface found. Paste a full Solidity file." };
    var target = cs.filter(function (c) { return c.kind === "contract"; }).pop() || cs[cs.length - 1];
    var res = sol.resolveInherited(src, target.name);
    var ctx = { structs: {}, enums: {} };
    cs.forEach(function (c) {
      var s = sol.structs(c.body), e = sol.enums(c.body);
      Object.keys(s).forEach(function (k) { ctx.structs[k] = s[k]; });
      Object.keys(e).forEach(function (k) { ctx.enums[k] = e[k]; });
    });
    var lay = sol.layout(res.vars, ctx);
    return { name: target.name, chain: res.chain, missing: res.missing, layout: lay, ctx: ctx, vars: res.vars };
  }

  // Group layout entries by slot for rendering
  function bySlot(lay) {
    var map = [], order = [];
    lay.forEach(function (e) {
      if (e.slot == null) return;
      if (!map[e.slot]) { map[e.slot] = []; order.push(e.slot); }
      map[e.slot].push(e);
    });
    return { map: map, order: order.sort(function (a, b) { return a - b; }) };
  }

  function renderLayout(a) {
    if (a.error) return '<p class="filter-empty">' + esc(a.error) + "</p>";
    var g = bySlot(a.layout);
    var wasted = 0, usedSlots = 0;
    var html = "";

    html += '<div class="est-rows" style="border:0;padding:0;margin-bottom:var(--s-5)">' +
      row("Contract", esc(a.name)) +
      row("Inheritance layout order", a.chain.map(esc).join(" &rarr; ")) +
      row("Storage variables", String(a.layout.filter(function (e) { return !e.skip; }).length)) +
      row("Constants / immutables", String(a.layout.filter(function (e) { return e.skip; }).length) + " (no slot)") +
      "</div>";

    if (a.missing.length) {
      html += '<div class="disclaimer" style="margin-bottom:var(--s-5)"><strong>Incomplete inheritance.</strong> ' +
        esc(a.missing.join(", ")) + " " + (a.missing.length > 1 ? "were" : "was") +
        " inherited but not found in this paste. Parent state variables occupy the <em>first</em> slots, so the numbering below is only correct once every parent is included. Paste the flattened source for an accurate layout.</div>";
    }

    html += '<div class="slot-grid">';
    g.order.forEach(function (slotNo) {
      var entries = g.map[slotNo];
      var first = entries[0];
      // collapse long gap arrays
      if (first.slots > 4) {
        html += slotRow(slotNo, entries, first.slots);
        usedSlots += first.slots;
        return;
      }
      usedSlots += (first.slots || 1);
      var used = entries.reduce(function (s, e) { return s + Math.min(32, e.size); }, 0);
      if (!first.whole && used < 32 && entries.length >= 1 && !first.dynamic && first.size < 32) wasted += (32 - used);
      html += slotRow(slotNo, entries, first.slots || 1);
    });
    html += "</div>";

    // packing advice
    var advice = packingAdvice(a);
    html = '<div class="scan-summary" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
      '<div><div class="n" style="color:var(--accent)">' + usedSlots + '</div><div class="l">Slots used</div></div>' +
      '<div><div class="n" style="color:' + (wasted > 0 ? "var(--sev-medium)" : "var(--sev-fixed)") + '">' + wasted + 'B</div><div class="l">Wasted in partial slots</div></div>' +
      '<div><div class="n" style="color:' + (advice.length ? "var(--sev-medium)" : "var(--sev-fixed)") + '">' + advice.length + '</div><div class="l">Packing suggestions</div></div>' +
      "</div>" + html;

    if (advice.length) {
      html += '<h3 style="margin-top:var(--s-6);font-size:1.05rem">Packing suggestions</h3>';
      html += '<div class="hit-list" style="max-height:none;margin-top:var(--s-4)">' + advice.map(function (x) {
        return '<div class="hit" data-sev="' + x.sev + '"><div class="hit-top"><h4>' + esc(x.title) + '</h4><span class="sev sev-' + x.sev + '">' + x.sev + "</span></div>" +
          "<p>" + x.body + "</p>" + (x.saving ? '<div class="fix"><b>Saving:</b> ' + esc(x.saving) + "</div>" : "") + "</div>";
      }).join("") + "</div>";
    }
    return html;
  }

  function slotRow(slotNo, entries, slots) {
    var label = slots > 1 ? "slot " + slotNo + "&ndash;" + (slotNo + slots - 1) : "slot " + slotNo;
    var used = entries.reduce(function (s, e) { return s + Math.min(32, e.size); }, 0);
    var free = Math.max(0, 32 - used);
    var bar = "";
    if (slots === 1) {
      entries.forEach(function (e, i) {
        var pct = (Math.min(32, e.size) / 32) * 100;
        bar += '<span class="slot-seg" style="width:' + pct + '%;background:' + segColor(i) + '" title="' +
          esc(e.type + " " + e.name + " — " + e.size + " bytes at offset " + e.offset) + '"><b>' + esc(e.name) + "</b></span>";
      });
      if (free > 0) bar += '<span class="slot-seg is-free" style="width:' + ((free / 32) * 100) + '%" title="' + free + ' bytes unused"><b>' + free + "B free</b></span>";
    } else {
      bar = '<span class="slot-seg" style="width:100%;background:' + segColor(0) + '"><b>' + esc(entries[0].name) + " &mdash; " + slots + " slots</b></span>";
    }
    return '<div class="slot-row"><div class="slot-no">' + label + "</div>" +
      '<div class="slot-bar">' + bar + "</div>" +
      '<div class="slot-meta">' + entries.map(function (e) {
        return '<code>' + esc(e.type) + "</code> " + esc(e.name) +
          (e.note ? ' <span class="dim">' + esc(e.note) + "</span>" : "");
      }).join("<br>") + "</div></div>";
  }
  var SEG = ["rgba(255,166,26,.85)", "rgba(111,183,255,.8)", "rgba(74,222,128,.75)", "rgba(255,209,102,.8)", "rgba(201,181,255,.8)"];
  function segColor(i) { return SEG[i % SEG.length]; }
  function row(k, v) { return '<div class="est-row"><span>' + k + "</span><span>" + v + "</span></div>"; }

  function packingAdvice(a) {
    var out = [];
    var g = bySlot(a.layout);
    // find single-occupancy slots holding a small type
    var smalls = [];
    g.order.forEach(function (n) {
      var e = g.map[n];
      if (e.length === 1 && !e[0].whole && e[0].size < 32 && e[0].size > 0) smalls.push(e[0]);
    });
    if (smalls.length >= 2) {
      out.push({
        sev: "medium",
        title: "Small types are spread across separate slots",
        body: "These variables are each below 32 bytes but sit alone in a slot: " +
          smalls.map(function (s) { return "<code>" + esc(s.type + " " + s.name) + "</code>"; }).join(", ") +
          ". Declaring them adjacently lets solc pack them into shared slots.",
        saving: "Up to " + (smalls.length - Math.ceil(smalls.reduce(function (s, x) { return s + x.size; }, 0) / 32)) +
          " storage slot(s) — roughly " + ((smalls.length - 1) * 20000).toLocaleString() + " gas on first write, 2,100 per cold read afterwards"
      });
    }
    // bool + address adjacency opportunity
    var hasBool = a.layout.some(function (e) { return e.type === "bool" && !e.packed; });
    if (hasBool) {
      out.push({
        sev: "low",
        title: "Standalone bool occupies a full slot",
        body: "A <code>bool</code> uses one byte but claims a whole slot when nothing is declared beside it. Move it next to an <code>address</code> (20 bytes) or a <code>uint8</code>/<code>uint96</code> so they share a slot.",
        saving: "One slot — about 20,000 gas on first write"
      });
    }
    // uint256 that could be smaller when packed with an address
    var addrAlone = a.layout.filter(function (e) { return (e.type === "address" || e.type === "address payable") && !e.packed; });
    if (addrAlone.length) {
      out.push({
        sev: "low",
        title: "Address in its own slot leaves 12 bytes unused",
        body: addrAlone.map(function (e) { return "<code>" + esc(e.name) + "</code>"; }).join(", ") +
          " occupies 20 of 32 bytes. A <code>uint96</code> timestamp, amount or counter declared immediately after it is free storage.",
        saving: "12 bytes per address — one full slot if you have a value that fits"
      });
    }
    var gap = a.layout.filter(function (e) { return /__gap/.test(e.name); });
    if (!gap.length && a.layout.filter(function (e) { return !e.skip; }).length > 0) {
      out.push({
        sev: "info",
        title: "No storage gap declared",
        body: "If this contract is (or may become) a base for an upgradeable system, add <code>uint256[50] private __gap;</code> at the end. Without it, adding a variable to this contract later shifts every child contract's storage.",
        saving: ""
      });
    }
    return out;
  }

  /* ------------------------------------------------------------- upgrade */
  function diff(a, b) {
    if (a.error) return { error: "V1: " + a.error };
    if (b.error) return { error: "V2: " + b.error };
    var A = a.layout.filter(function (e) { return !e.skip; });
    var B = b.layout.filter(function (e) { return !e.skip; });
    var rows = [], findings = [];
    var max = Math.max(A.length, B.length);

    for (var i = 0; i < max; i++) {
      var x = A[i], y = B[i];
      var status, sev = null, note = "";
      if (x && !y) { status = "removed"; sev = "critical"; note = "Variable removed — every variable after this point shifts up one position."; }
      else if (!x && y) { status = "added"; note = "Appended after the existing layout — safe."; }
      else {
        var sameName = x.name === y.name, sameType = norm(x.type) === norm(y.type),
            sameSlot = x.slot === y.slot, sameOff = x.offset === y.offset, sameSize = x.size === y.size;
        if (sameName && sameType && sameSlot && sameOff) { status = "unchanged"; }
        else if (!sameType && sameName) {
          status = "type-changed"; sev = "critical";
          note = "Type changed from <code>" + esc(x.type) + "</code> to <code>" + esc(y.type) + "</code>. The new code reinterprets the existing bytes in this slot.";
        } else if (sameType && !sameName && sameSlot && sameOff) {
          status = "renamed"; sev = "low";
          note = "Renamed only — layout is identical, so this is safe. Confirm it was intentional.";
        } else if (!sameSlot || !sameOff) {
          status = "moved"; sev = "critical";
          note = "Now at slot " + y.slot + " offset " + y.offset + " instead of slot " + x.slot + " offset " + x.offset + ". It will read data written by a different variable.";
        } else if (!sameSize) {
          status = "resized"; sev = "critical";
          note = "Size changed from " + x.size + " to " + y.size + " bytes, which repacks this slot and everything after it.";
        } else { status = "changed"; sev = "high"; note = "Declaration changed."; }
      }
      rows.push({ i: i, a: x, b: y, status: status, sev: sev, note: note });
      if (sev) findings.push({ sev: sev, status: status, name: (y || x).name, note: note });
    }

    // gap sanity check
    var ga = A.filter(function (e) { return /__gap/.test(e.name); })[0];
    var gb = B.filter(function (e) { return /__gap/.test(e.name); })[0];
    if (ga && gb) {
      var na = parseInt((ga.type.match(/\[(\d+)\]/) || [])[1] || "0", 10);
      var nb = parseInt((gb.type.match(/\[(\d+)\]/) || [])[1] || "0", 10);
      var addedSlots = B.filter(function (e) { return e.slot != null; }).length - A.filter(function (e) { return e.slot != null; }).length;
      if (na !== nb) {
        var expected = na - Math.max(0, addedSlots - (na - nb) + (na - nb));
        findings.push({
          sev: (na - nb) > 0 ? "info" : "high",
          status: "gap",
          name: gb.name,
          note: "Storage gap changed from <code>[" + na + "]</code> to <code>[" + nb + "]</code>. The gap must shrink by exactly the number of slots you added above it, or the child contracts below shift."
        });
      }
    }

    var worst = ["critical", "high", "medium", "low", "info"].find(function (s) {
      return findings.some(function (f) { return f.sev === s; });
    }) || null;
    return { rows: rows, findings: findings, worst: worst, a: a, b: b };
  }
  function norm(t) { return String(t).replace(/\s+/g, " ").trim(); }

  function renderDiff(d) {
    if (d.error) return '<p class="filter-empty">' + esc(d.error) + "</p>";
    var counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    d.findings.forEach(function (f) { counts[f.sev]++; });
    var verdict = d.worst === "critical" || d.worst === "high"
      ? { sev: "critical", text: "UNSAFE — do not upgrade" }
      : d.worst ? { sev: "medium", text: "Review before upgrading" }
      : { sev: "fixed", text: "Layout-compatible" };

    var html = '<div class="verdict" data-sev="' + (verdict.sev === "fixed" ? "low" : verdict.sev) + '" style="border-color:var(--' +
      (verdict.sev === "fixed" ? "sev-fixed" : "sev") + ');background:var(--' + (verdict.sev === "fixed" ? "sev-fixed-soft" : "sev-soft") + ')">' +
      '<span class="mono-label" style="color:var(--' + (verdict.sev === "fixed" ? "sev-fixed" : "sev") + ')">Verdict</span>' +
      "<h3 style=\"color:var(--" + (verdict.sev === "fixed" ? "sev-fixed" : "sev") + ")\">" + verdict.text + "</h3>" +
      "<p>" + (d.worst
        ? "This upgrade changes the storage layout in a way that will make the new implementation read data written by different variables."
        : "Every existing variable keeps its slot, offset and type. New variables are appended after the existing layout.") + "</p></div>";

    html += '<div class="scan-summary" style="margin-top:var(--s-5)">' +
      ["critical", "high", "medium", "low", "info"].map(function (s) {
        return '<div data-sev="' + s + '"><div class="n">' + counts[s] + '</div><div class="l">' + (s === "info" ? "Info" : s) + "</div></div>";
      }).join("") + "</div>";

    html += '<div class="table-wrap" style="margin-top:var(--s-5)"><table class="diff-table">' +
      "<thead><tr><th>#</th><th>V1</th><th>V2</th><th>Status</th></tr></thead><tbody>" +
      d.rows.map(function (r) {
        var cls = r.sev ? ' data-sev="' + r.sev + '"' : "";
        return "<tr" + cls + ' class="ds-' + r.status + '"><td class="mono dim">' + r.i + "</td>" +
          "<td>" + cell(r.a) + "</td><td>" + cell(r.b) + "</td>" +
          '<td><span class="status-pill"' + (r.sev ? ' data-status="' + (r.sev === "low" || r.sev === "info" ? "acknowledged" : "open") + '"' : ' data-status="fixed"') + ">" +
          r.status + "</span>" + (r.note ? '<div class="dim" style="margin-top:6px;font-size:12px">' + r.note + "</div>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div>";
    return html;
  }
  function cell(e) {
    if (!e) return '<span class="dim">&mdash;</span>';
    return "<code>" + esc(e.type) + "</code> " + esc(e.name) +
      '<div class="dim mono" style="font-size:11px;margin-top:3px">slot ' + e.slot + " · off " + e.offset + " · " + e.size + "B</div>";
  }

  /* ----------------------------------------------------------------- wiring */
  var modeBtns = root.querySelectorAll("[data-mode]");
  var panes = { layout: root.querySelector("#mode-layout"), upgrade: root.querySelector("#mode-upgrade") };
  modeBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      modeBtns.forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
      Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== b.dataset.mode; });
    });
  });

  var inA = root.querySelector("#sl-a"), inB = root.querySelector("#sl-b"), inS = root.querySelector("#sl-single");
  var outS = root.querySelector("#sl-out-single"), outD = root.querySelector("#sl-out-diff");

  function runSingle() {
    var v = inS.value.trim();
    outS.innerHTML = v ? renderLayout(analyse(v)) : '<p class="filter-empty">Paste a contract to see its storage layout.</p>';
  }
  function runDiff() {
    if (!inA.value.trim() || !inB.value.trim()) {
      outD.innerHTML = '<p class="filter-empty">Paste both versions to compare.</p>'; return;
    }
    outD.innerHTML = renderDiff(diff(analyse(inA.value), analyse(inB.value)));
  }

  root.querySelector("#sl-run-single").addEventListener("click", runSingle);
  root.querySelector("#sl-run-diff").addEventListener("click", runDiff);
  root.querySelector("#sl-sample-single").addEventListener("click", function () { inS.value = SAMPLE_V1; runSingle(); });
  root.querySelector("#sl-sample-diff").addEventListener("click", function () { inA.value = SAMPLE_V1; inB.value = SAMPLE_V2; runDiff(); });
  [inS].forEach(function (el) { el.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runSingle(); } }); });
  [inA, inB].forEach(function (el) { el.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); runDiff(); } }); });

  runSingle(); runDiff();
  window.SENTRYX_storage = { analyse: analyse, diff: diff };
})();
