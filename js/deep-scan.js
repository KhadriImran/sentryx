/* ==========================================================================
   SENTRYX — AI Deep Scan
   ---------------------------------------------------------------------------
   Runs every local analyser in one pass (pattern pre-check, gas, access
   control, storage layout), merges the results into a single prioritised
   report, and then — if an endpoint is configured — sends the source to an
   LLM-backed reviewer for the reasoning that pattern matching cannot do.

   The local pass ALWAYS runs. With no backend the tool is still useful; the
   AI layer is clearly marked as unavailable rather than silently skipped.

   BACKEND WIRING
     const AI_ENDPOINT = "/.netlify/functions/deep-scan";   // Netlify
     const AI_ENDPOINT = "/api/deep-scan";                  // Vercel

   Request (POST JSON):
     { "source": "<solidity>", "context": { "localFindings": [...] },
       "source_meta": { "loc": 1184, "contracts": 3 } }
   Response (JSON):
     { "ok": true,
       "findings": [ { "severity": "critical|high|medium|low|info",
                       "title": "...", "location": "...",
                       "description": "...", "recommendation": "...",
                       "confidence": "high|medium|low" } ],
       "summary": "..." }

   NEVER put an LLM API key in this file — it is public. The included
   serverless function keeps the key server-side.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("deep-tool");
  if (!root) return;

  /* ================================================== CONFIGURATION ===== */
  var AI_ENDPOINT = "";          // <-- set to enable the AI layer
  var AI_TIMEOUT = 45000;

  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var SEV_ORDER = ["critical", "high", "medium", "low", "info"];

  var input = root.querySelector("#ds-input");
  var out = root.querySelector("#ds-out");
  var statusEl = root.querySelector("#ds-status");
  var aiBadge = root.querySelector("#ds-ai-badge");

  if (aiBadge) {
    aiBadge.textContent = AI_ENDPOINT ? "AI layer: connected" : "AI layer: not configured";
    aiBadge.className = "chip" + (AI_ENDPOINT ? " chip-dot" : "");
  }

  // Anything the source fetch tool handed over
  try {
    var pending = sessionStorage.getItem("sentryx.pendingSource");
    if (pending) { input.value = pending; sessionStorage.removeItem("sentryx.pendingSource"); }
  } catch (e) {}

  /* ------------------------------------------------------- local passes */
  function runLocal(src) {
    var findings = [], modules = [];

    // 1. Pattern pre-check
    if (window.SENTRYX_precheck) {
      var hits = window.SENTRYX_precheck.scan(src);
      modules.push({ name: "Pattern pre-check", count: hits.length, ok: true });
      hits.forEach(function (h) {
        findings.push({
          source: "pattern", id: h.rule.id, severity: h.rule.sev, title: h.rule.title,
          location: "line " + h.line, snippet: h.snippet,
          description: h.rule.desc, recommendation: h.rule.fix, confidence: "pattern match"
        });
      });
    }

    // 2. Access control
    if (window.SENTRYX_acl) {
      var acl = window.SENTRYX_acl.analyse(src);
      if (!acl.error) {
        var open = acl.rows.filter(function (r) { return r.risk === "critical"; });
        modules.push({ name: "Access control matrix", count: open.length, ok: true });
        open.forEach(function (r) {
          findings.push({
            source: "access", id: "AC-" + r.name, severity: "critical",
            title: "Unguarded privileged function: " + r.name,
            location: r.contract + " line " + r.line,
            description: "This function changes protocol state and has no recognised access-control modifier or in-body authorisation check. If nothing enforces authorisation elsewhere, any address can call it.",
            recommendation: "Add an explicit modifier (onlyOwner / onlyRole) or an in-body require on msg.sender.",
            confidence: "high"
          });
        });
        var txo = acl.rows.filter(function (r) { return r.roles.some(function (x) { return /tx\.origin/.test(x); }); });
        txo.forEach(function (r) {
          findings.push({
            source: "access", id: "AC-ORIGIN", severity: "critical",
            title: "tx.origin authorisation in " + r.name,
            location: r.contract + " line " + r.line,
            description: "tx.origin is the EOA that started the transaction, not the caller. Any contract the privileged user interacts with can act with their authority.",
            recommendation: "Authorise on msg.sender.", confidence: "high"
          });
        });
      }
    }

    // 3. Gas
    if (window.SENTRYX_gas) {
      var gas = window.SENTRYX_gas.analyse(src);
      if (!gas.error) {
        modules.push({ name: "Gas analyser", count: gas.hits.length, ok: true });
        gas.hits.filter(function (h) { return h.rule.alsoSecurity || h.rule.sev === "high"; }).forEach(function (h) {
          findings.push({
            source: "gas", id: h.rule.id, severity: h.rule.alsoSecurity ? "high" : "low",
            title: h.rule.title, location: "line " + h.line, snippet: h.snippet,
            description: h.rule.why.replace(/<[^>]+>/g, ""), recommendation: h.rule.fix.replace(/<[^>]+>/g, ""),
            confidence: "pattern match"
          });
        });
      }
    }

    // 4. Storage layout
    if (window.SENTRYX_storage) {
      var st = window.SENTRYX_storage.analyse(src);
      if (!st.error) {
        modules.push({ name: "Storage layout", count: st.layout.filter(function (e) { return !e.skip; }).length, ok: true });
        if (st.missing && st.missing.length) {
          findings.push({
            source: "storage", id: "ST-INHERIT", severity: "info",
            title: "Inheritance incomplete for layout analysis",
            location: st.name,
            description: "These base contracts were referenced but not present in the paste: " + st.missing.join(", ") + ". Parent state variables occupy the first storage slots, so any layout conclusion here is provisional.",
            recommendation: "Paste the flattened source for an accurate storage layout.", confidence: "high"
          });
        }
      }
    }

    findings.sort(function (a, b) { return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity); });
    return { findings: findings, modules: modules };
  }

  /* ------------------------------------------------------------ AI pass */
  function runAI(src, local) {
    if (!AI_ENDPOINT) return Promise.resolve({ configured: false });
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, AI_TIMEOUT);
    return fetch(AI_ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({
        source: src,
        context: { localFindings: local.findings.map(function (f) { return { id: f.id, severity: f.severity, title: f.title }; }) },
        source_meta: { loc: src.split("\n").length }
      })
    }).then(function (r) { clearTimeout(timer); return r.json(); })
      .then(function (j) {
        if (!j || j.ok === false) throw new Error(j && j.error ? j.error : "The analysis service returned an error");
        return { configured: true, findings: j.findings || [], summary: j.summary || "" };
      })
      .catch(function (e) { clearTimeout(timer); return { configured: true, error: e.message || "request failed" }; });
  }

  /* --------------------------------------------------------------- render */
  function render(local, ai) {
    var all = local.findings.slice();
    if (ai && ai.findings) {
      ai.findings.forEach(function (f) {
        all.push({
          source: "ai", id: f.id || "AI", severity: (f.severity || "info").toLowerCase(),
          title: f.title || "Untitled finding", location: f.location || "",
          description: f.description || "", recommendation: f.recommendation || "",
          confidence: f.confidence || "unverified"
        });
      });
      all.sort(function (a, b) { return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity); });
    }
    var counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    all.forEach(function (f) { if (counts[f.severity] != null) counts[f.severity]++; });

    var html = '<div class="scan-summary">' + SEV_ORDER.map(function (s) {
      return '<div data-sev="' + s + '"><div class="n">' + counts[s] + '</div><div class="l">' + (s === "info" ? "Info" : s) + "</div></div>";
    }).join("") + "</div>";

    html += '<div class="est-rows" style="border:0;padding:0;margin:var(--s-4) 0">' +
      local.modules.map(function (m) {
        return '<div class="est-row"><span>' + esc(m.name) + "</span><span>" + m.count + " result" + (m.count === 1 ? "" : "s") + "</span></div>";
      }).join("") +
      '<div class="est-row"><span>AI reasoning layer</span><span>' +
        (!ai || !ai.configured ? '<span style="color:var(--ink-3)">not configured</span>'
          : ai.error ? '<span style="color:var(--sev-high)">unavailable — ' + esc(ai.error) + "</span>"
          : '<span style="color:var(--sev-fixed)">' + (ai.findings || []).length + " finding" + ((ai.findings || []).length === 1 ? "" : "s") + "</span>") +
      "</span></div></div>";

    if (ai && ai.summary) {
      html += '<div class="callout" data-sev="info" style="--sev:var(--cold);--sev-soft:var(--cold-soft)"><span class="mono-label">AI summary</span>' + esc(ai.summary) + "</div>";
    }

    if (!ai || !ai.configured) {
      html += '<div class="disclaimer" style="margin:var(--s-4) 0"><strong>AI layer not configured.</strong> ' +
        "The deterministic analysers above ran in full. To add the reasoning layer, set <code>AI_ENDPOINT</code> in <code>js/deep-scan.js</code> and deploy the included serverless function &mdash; see the README.</div>";
    }

    html += '<div class="hit-list" style="max-height:none;margin-top:var(--s-4)">';
    if (!all.length) {
      html += '<div class="hit" data-sev="info"><div class="hit-top"><h4>Nothing matched</h4><span class="sev sev-info">Info</span></div>' +
        "<p>No analyser produced a finding. That is not a clean bill of health &mdash; economic design, cross-contract state assumptions and specification mismatches are invisible to every tool on this page.</p></div>";
    } else {
      html += all.map(function (f) {
        var badge = f.source === "ai" ? "AI" : f.source === "access" ? "ACL" : f.source === "gas" ? "GAS" : f.source === "storage" ? "STORAGE" : "PATTERN";
        return '<div class="hit" data-sev="' + f.severity + '">' +
          '<div class="hit-top"><h4>' + esc(f.title) + "</h4>" +
          '<span style="display:flex;gap:6px;align-items:center"><span class="chip" style="font-size:9px">' + badge + '</span>' +
          '<span class="sev sev-' + f.severity + '">' + f.severity + "</span></span></div>" +
          '<div class="hit-line">' + esc(f.id) + (f.location ? " · " + esc(f.location) : "") +
            (f.confidence ? ' · confidence: ' + esc(f.confidence) : "") + "</div>" +
          (f.snippet ? "<pre>" + esc(f.snippet) + "</pre>" : "") +
          (f.description ? "<p style='margin-top:10px'>" + esc(f.description) + "</p>" : "") +
          (f.recommendation ? '<div class="fix"><b>Remediation:</b> ' + esc(f.recommendation) + "</div>" : "") +
          "</div>";
      }).join("");
    }
    html += "</div>";
    out.innerHTML = html;
  }

  /* ---------------------------------------------------------------- run */
  function run() {
    var src = input.value.trim();
    if (!src) { out.innerHTML = '<p class="filter-empty">Paste a contract to run every analyser at once.</p>'; statusEl.textContent = ""; return; }
    statusEl.innerHTML = '<span class="sx-typing"><i></i><i></i><i></i></span> Running local analysers…';
    var local = runLocal(src);
    render(local, null);
    if (!AI_ENDPOINT) { statusEl.textContent = ""; return; }
    statusEl.innerHTML = '<span class="sx-typing"><i></i><i></i><i></i></span> Querying the AI reasoning layer…';
    runAI(src, local).then(function (ai) {
      statusEl.textContent = "";
      render(local, ai);
    });
  }

  root.querySelector("#ds-run").addEventListener("click", run);
  root.querySelector("#ds-clear").addEventListener("click", function () { input.value = ""; run(); input.focus(); });
  root.querySelector("#ds-sample").addEventListener("click", function () {
    input.value = `// ILLUSTRATIVE — multiple issue classes in one contract
pragma solidity ^0.8.0;

interface IPair { function getReserves() external view returns (uint112,uint112,uint32); }

contract DeepVault {
    address public owner;
    address public keeper;
    uint256 public totalShares;
    uint256 public rewardRate;
    address[] public depositors;
    mapping(address => uint256) public balanceOf;
    IPair public pair;

    modifier onlyOwner() { require(msg.sender == owner, "Only the contract owner can perform this action"); _; }

    constructor(address _owner) { owner = _owner; rewardRate = 100; }

    function setKeeper(address k) external { keeper = k; }

    function price() public view returns (uint256) {
        (uint112 r0, uint112 r1, ) = pair.getReserves();
        return uint256(r1) * 1e18 / uint256(r0);
    }

    function deposit() external payable {
        uint256 shares = totalShares == 0 ? msg.value : msg.value * totalShares / address(this).balance;
        balanceOf[msg.sender] += shares;
        totalShares += shares;
        depositors.push(msg.sender);
    }

    function withdraw(uint256 shares) external {
        require(balanceOf[msg.sender] >= shares, "insufficient balance for this withdrawal");
        uint256 amount = shares * address(this).balance / totalShares;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balanceOf[msg.sender] -= shares;
        totalShares -= shares;
    }

    function distribute() external {
        for (uint256 i = 0; i < depositors.length; i++) {
            balanceOf[depositors[i]] += rewardRate;
        }
    }

    function emergencyDrain(address to) external {
        require(tx.origin == owner, "not owner");
        payable(to).transfer(address(this).balance);
    }
}`;
    run();
  });
  input.addEventListener("keydown", function (e) { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); } });
  run();
})();
