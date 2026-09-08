/* ==========================================================================
   SENTRYX — Web3 unit & encoding utilities
   Wei/gwei/ether, hex/decimal, bytes32 <-> string, EIP-55 checksum,
   function selectors and keccak256. All BigInt-based, no precision loss.
   Runs entirely in the browser.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("util-tool");
  if (!root) return;
  var K = window.SENTRYX_keccak;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var $ = function (s) { return root.querySelector(s); };

  /* ------------------------------------------------- unit conversion */
  var UNITS = [
    { name: "wei", dec: 0 }, { name: "kwei", dec: 3 }, { name: "mwei", dec: 6 },
    { name: "gwei", dec: 9 }, { name: "szabo", dec: 12 }, { name: "finney", dec: 15 },
    { name: "ether", dec: 18 }
  ];

  // Parse a decimal string into wei (BigInt) given the unit's decimals.
  function toWei(value, dec) {
    var s = String(value).trim().replace(/,/g, "");
    if (!s || !/^\d*\.?\d*$/.test(s)) return null;
    var parts = s.split(".");
    var whole = parts[0] || "0";
    var frac = (parts[1] || "").slice(0, dec);
    while (frac.length < dec) frac += "0";
    try { return BigInt(whole) * (10n ** BigInt(dec)) + BigInt(frac || "0"); }
    catch (e) { return null; }
  }
  function fromWei(wei, dec) {
    if (dec === 0) return wei.toString();
    var base = 10n ** BigInt(dec);
    var whole = wei / base, frac = wei % base;
    if (frac === 0n) return whole.toString();
    var f = frac.toString().padStart(dec, "0").replace(/0+$/, "");
    return whole.toString() + "." + f;
  }

  var unitInputs = {};
  function buildUnits() {
    var wrap = $("#u-units");
    wrap.innerHTML = UNITS.map(function (u) {
      return '<div class="field"><label for="u-' + u.name + '">' + u.name +
        ' <span class="dim mono" style="font-weight:400">10^' + u.dec + '</span></label>' +
        '<input class="input mono" id="u-' + u.name + '" inputmode="decimal" autocomplete="off" placeholder="0"></div>';
    }).join("");
    UNITS.forEach(function (u) {
      var el = $("#u-" + u.name);
      unitInputs[u.name] = el;
      el.addEventListener("input", function () {
        var wei = toWei(el.value, u.dec);
        UNITS.forEach(function (o) {
          if (o.name === u.name) return;
          unitInputs[o.name].value = (wei === null || el.value.trim() === "") ? "" : fromWei(wei, o.dec);
        });
      });
    });
  }

  /* ------------------------------------------------------ number bases */
  function buildBases() {
    var dec = $("#b-dec"), hex = $("#b-hex"), bin = $("#b-bin"), out = $("#b-out");
    function show(v) {
      if (v === null) { out.innerHTML = ""; return; }
      var bits = v === 0n ? 1 : v.toString(2).length;
      var fits = [8, 16, 32, 64, 96, 128, 160, 256].filter(function (n) { return bits <= n; })[0];
      out.innerHTML = '<div class="est-rows" style="border:0;padding:0">' +
        rowu("Bits required", String(bits)) +
        rowu("Smallest uint", fits ? "uint" + fits : "exceeds uint256") +
        rowu("Padded bytes32", "0x" + v.toString(16).padStart(64, "0")) +
        (v <= 115792089237316195423570985008687907853269984665640564039457584007913129639935n
          ? "" : rowu("Warning", "Exceeds uint256 max")) +
        "</div>";
    }
    function sync(src) {
      var v = null;
      try {
        if (src === "dec" && dec.value.trim()) v = BigInt(dec.value.trim().replace(/[, _]/g, ""));
        else if (src === "hex" && hex.value.trim()) v = BigInt(hex.value.trim().replace(/\s/g, "").replace(/^0x/i, "0x") .replace(/^(?!0x)/, "0x"));
        else if (src === "bin" && bin.value.trim()) v = BigInt("0b" + bin.value.trim().replace(/[\s_]/g, ""));
      } catch (e) { v = null; }
      if (v === null) { if (src !== "dec") dec.value = ""; if (src !== "hex") hex.value = ""; if (src !== "bin") bin.value = ""; show(null); return; }
      if (src !== "dec") dec.value = v.toString();
      if (src !== "hex") hex.value = "0x" + v.toString(16);
      if (src !== "bin") bin.value = v.toString(2);
      show(v);
    }
    dec.addEventListener("input", function () { sync("dec"); });
    hex.addEventListener("input", function () { sync("hex"); });
    bin.addEventListener("input", function () { sync("bin"); });
  }
  function rowu(k, v) { return '<div class="est-row"><span>' + k + '</span><span class="mono" style="word-break:break-all">' + esc(v) + "</span></div>"; }

  /* --------------------------------------------------- bytes32 / string */
  function buildBytes() {
    var str = $("#by-str"), hex = $("#by-hex"), out = $("#by-out");
    function fromString() {
      var s = str.value;
      var bytes = new TextEncoder().encode(s);
      if (bytes.length > 32) {
        out.innerHTML = '<div class="disclaimer">That is ' + bytes.length + ' bytes. bytes32 holds at most 32 — longer values need <code>string</code> or <code>bytes</code>, which are stored dynamically.</div>';
        hex.value = "";
        return;
      }
      var h = "0x";
      for (var i = 0; i < 32; i++) h += (i < bytes.length ? bytes[i] : 0).toString(16).padStart(2, "0");
      hex.value = h;
      out.innerHTML = '<div class="est-rows" style="border:0;padding:0">' +
        rowu("UTF-8 length", bytes.length + " bytes") +
        rowu("Right-padded bytes32", h) +
        rowu("keccak256 of the string", K ? K.utf8(s) : "—") + "</div>";
    }
    function fromHex() {
      var h = hex.value.trim().replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]*$/.test(h)) { out.innerHTML = '<div class="disclaimer">Not valid hex.</div>'; return; }
      var bytes = [];
      for (var i = 0; i + 1 < h.length; i += 2) bytes.push(parseInt(h.substr(i, 2), 16));
      while (bytes.length && bytes[bytes.length - 1] === 0) bytes.pop();
      var s = new TextDecoder().decode(new Uint8Array(bytes));
      str.value = s;
      out.innerHTML = '<div class="est-rows" style="border:0;padding:0">' +
        rowu("Decoded (trailing zeros stripped)", s || "(empty)") +
        rowu("Byte length", bytes.length + " bytes") + "</div>";
    }
    str.addEventListener("input", fromString);
    hex.addEventListener("input", fromHex);
  }

  /* --------------------------------------------------- address checksum */
  function buildAddress() {
    var inp = $("#ad-in"), out = $("#ad-out");
    inp.addEventListener("input", function () {
      var v = inp.value.trim();
      if (!v) { out.innerHTML = ""; return; }
      var bare = v.replace(/^0x/i, "");
      if (!/^[0-9a-fA-F]{40}$/.test(bare)) {
        out.innerHTML = '<div class="disclaimer"><strong>Not a valid address.</strong> An Ethereum address is 40 hex characters (20 bytes), optionally prefixed with 0x. You entered ' + bare.length + " character" + (bare.length === 1 ? "" : "s") + ".</div>";
        return;
      }
      var checksummed = K.toChecksum(bare);
      var valid = K.isChecksumValid(v);
      var status = valid === null
        ? { sev: "info", text: "No checksum present (all one case) — cannot be verified, but the format is valid." }
        : valid
          ? { sev: "fixed", text: "Valid EIP-55 checksum. The capitalisation matches." }
          : { sev: "critical", text: "CHECKSUM MISMATCH. The capitalisation does not match this address — it may have been altered or mistyped. Do not send funds." };
      out.innerHTML =
        '<div class="hit" data-sev="' + (status.sev === "fixed" ? "low" : status.sev) + '" style="border-left-color:var(--' +
          (status.sev === "fixed" ? "sev-fixed" : "sev") + ')"><div class="hit-top"><h4>' +
          (status.sev === "fixed" ? "Checksum valid" : status.sev === "critical" ? "Checksum invalid" : "No checksum") +
          '</h4><span class="sev sev-' + (status.sev === "fixed" ? "info" : status.sev) + '">' +
          (status.sev === "fixed" ? "OK" : status.sev) + "</span></div><p>" + esc(status.text) + "</p></div>" +
        '<div class="est-rows" style="border:0;padding:0;margin-top:var(--s-4)">' +
          rowu("EIP-55 checksummed", checksummed) +
          rowu("Lowercase", "0x" + bare.toLowerCase()) +
          rowu("As bytes32 (left-padded)", "0x" + bare.toLowerCase().padStart(64, "0")) +
        "</div>";
    });
  }

  /* ------------------------------------------------ selectors + keccak */
  function buildSelector() {
    var inp = $("#se-in"), out = $("#se-out");
    function run() {
      var lines = inp.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) { out.innerHTML = ""; return; }
      var seen = {}, collisions = [];
      var rows = lines.map(function (sig) {
        var normalised = sig.replace(/\s+/g, "")
          .replace(/^function/, "")
          .replace(/(external|public|internal|private|view|pure|payable|returns\(.*\)|;)/g, "");
        var sel = K.selector(normalised);
        if (seen[sel] && seen[sel] !== normalised) collisions.push(sel);
        seen[sel] = normalised;
        return { sig: normalised, sel: sel, full: K.utf8(normalised) };
      });
      out.innerHTML =
        (collisions.length ? '<div class="hit" data-sev="critical" style="margin-bottom:var(--s-4)"><div class="hit-top"><h4>Selector collision</h4><span class="sev sev-critical">critical</span></div><p>Two different signatures produce the same 4-byte selector: <code>' + collisions.join(", ") + '</code>. In a proxy this shadows a function; in a diamond it makes the routing table ambiguous.</p></div>' : "") +
        '<div class="table-wrap"><table class="cmp-table" style="min-width:520px"><thead><tr><th>Signature</th><th>Selector</th><th>keccak256</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return "<tr><th scope='row'><code>" + esc(r.sig) + "</code></th>" +
            '<td><code style="color:var(--accent)">' + r.sel + "</code></td>" +
            '<td class="mono dim" style="font-size:11px;word-break:break-all">' + r.full + "</td></tr>";
        }).join("") + "</tbody></table></div>";
    }
    inp.addEventListener("input", run);
    run();
  }

  /* ------------------------------------------------------------- keccak */
  function buildKeccak() {
    var inp = $("#kc-in"), out = $("#kc-out");
    inp.addEventListener("input", function () {
      var v = inp.value;
      if (!v) { out.innerHTML = ""; return; }
      var isHex = /^0x[0-9a-fA-F]*$/.test(v.trim()) && v.trim().length % 2 === 0;
      var digestUtf8 = K.utf8(v);
      var html = '<div class="est-rows" style="border:0;padding:0">' + rowu("keccak256(utf8 bytes)", digestUtf8);
      if (isHex) {
        var h = v.trim().slice(2), bytes = [];
        for (var i = 0; i + 1 < h.length; i += 2) bytes.push(parseInt(h.substr(i, 2), 16));
        html += rowu("keccak256(raw hex bytes)", K.hex(new Uint8Array(bytes)));
      }
      html += rowu("First 4 bytes (selector)", digestUtf8.slice(0, 10)) + "</div>";
      out.innerHTML = html;
    });
  }

  buildUnits(); buildBases(); buildBytes(); buildAddress(); buildSelector(); buildKeccak();

  // tab switching between utility panels
  var tabs = root.querySelectorAll("[data-util]");
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      tabs.forEach(function (x) { x.setAttribute("aria-selected", String(x === t)); });
      root.querySelectorAll("[data-util-pane]").forEach(function (p) {
        p.hidden = p.dataset.utilPane !== t.dataset.util;
      });
    });
  });
})();
