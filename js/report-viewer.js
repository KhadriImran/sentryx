/* ==========================================================================
   SENTRYX — Report Viewer + Severity Explorer
   Renders window.SENTRYX_SAMPLE_REPORT (data/findings.js) with severity
   filters, expandable findings, vulnerable/fixed diff views and PoC snippets.
   Highlighting is a small hand-written Solidity tokeniser — no CDN needed.
   ========================================================================== */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ------------------------------------------------ Solidity highlighter */
  const KEYWORDS = /\b(pragma|solidity|contract|library|interface|function|modifier|constructor|receive|fallback|returns?|memory|storage|calldata|external|public|internal|private|view|pure|payable|immutable|constant|require|revert|assert|emit|event|error|if|else|for|while|do|break|continue|new|delete|try|catch|using|is|import|abstract|virtual|override|unchecked|assembly|mapping|struct|enum|indexed|anonymous)\b/g;
  const TYPES = /\b(uint\d*|int\d*|address|bool|string|bytes\d*|byte)\b/g;
  function hi(code) {
    let out = esc(code);
    // Protect comments and strings with a sentinel the source can never contain,
    // highlight the rest, then restore them. \u0000 is used deliberately.
    const S = "\u0000";
    const comments = [];
    out = out.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, function (m) {
      comments.push(m); return S + "C" + (comments.length - 1) + S;
    });
    const strings = [];
    out = out.replace(/(&quot;[^\n]*?&quot;|"[^"\n]*"|'[^'\n]*')/g, function (m) {
      strings.push(m); return S + "T" + (strings.length - 1) + S;
    });
    out = out.replace(KEYWORDS, '<span style="color:#ffa61a">$1</span>');
    out = out.replace(TYPES, '<span style="color:#6fb7ff">$1</span>');
    out = out.replace(/\b(\d[\d_]*(e\d+)?)\b/g, '<span style="color:#c9b5ff">$1</span>');
    out = out.replace(new RegExp(S + "T(\\d+)" + S, "g"), function (_, i) {
      return '<span style="color:#9ee6b4">' + strings[i] + "</span>";
    });
    out = out.replace(new RegExp(S + "C(\\d+)" + S, "g"), function (_, i) {
      return '<span style="color:#8f8d85">' + comments[i] + "</span>";
    });
    return out;
  }

  /* ----------------------------------------------------- Report viewer */
  const rv = document.getElementById("report-viewer");
  if (rv && window.SENTRYX_SAMPLE_REPORT) {
    const R = window.SENTRYX_SAMPLE_REPORT;
    const list = rv.querySelector("#rv-findings");
    const meta = rv.querySelector("#rv-meta");
    const filters = rv.querySelector("#rv-filters");
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    R.findings.forEach((f) => counts[f.severity]++);

    meta.innerHTML = [
      ["Report ID", R.id], ["Chain", R.chain], ["Type", R.type],
      ["Lines of code", String(R.loc)], ["Review", R.reviewers],
      ["Review window", R.dates.start + " → " + R.dates.end], ["Fixes verified", R.dates.verified]
    ].map(([k, v]) => '<div><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + "</div></div>").join("");

    filters.innerHTML =
      '<span class="filter-label">Severity</span>' +
      '<button class="chip-btn" type="button" data-f="all" aria-pressed="true">All <span class="count">' + R.findings.length + "</span></button>" +
      ["critical", "high", "medium", "low", "info"].map((s) =>
        '<button class="chip-btn" type="button" data-f="' + s + '" data-sev="' + s + '" aria-pressed="false">' +
        (s === "info" ? "Informational" : s[0].toUpperCase() + s.slice(1)) + ' <span class="count">' + counts[s] + "</span></button>").join("") +
      '<button class="chip-btn" type="button" id="rv-expand" style="margin-left:auto">Expand all</button>';

    list.innerHTML = R.findings.map((f, i) => {
      const hasCode = f.vulnerable || f.fixed || f.poc;
      const tabs = [];
      if (f.vulnerable) tabs.push(["vuln", "Vulnerable", f.vulnerable]);
      if (f.fixed) tabs.push(["fixed", "Fixed", f.fixed]);
      if (f.poc) tabs.push(["poc", "PoC (Foundry)", f.poc]);
      return '<article class="finding" data-sev="' + f.severity + '" data-severity="' + f.severity + '">' +
        '<button class="finding-head" type="button" aria-expanded="false" aria-controls="fb-' + i + '">' +
          '<span class="fid">' + esc(f.id) + "</span>" +
          '<span class="sev sev-' + f.severity + '">' + (f.severity === "info" ? "Info" : f.severity) + "</span>" +
          '<span class="ftitle">' + esc(f.title) + "</span>" +
          '<span style="display:flex;gap:10px;align-items:center"><span class="status-pill" data-status="' + f.status + '">' + f.status + "</span>" +
          '<span class="fchevron"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg></span></span>' +
        "</button>" +
        '<div class="finding-body" id="fb-' + i + '"><div><div class="finding-inner">' +
          '<div class="finding-grid">' +
            "<div><h5>Location</h5><p class='mono' style='font-size:12px'>" + esc(f.location) + "</p></div>" +
            "<div><h5>Impact</h5><p>" + esc(f.impact) + "</p></div>" +
            "<div><h5>Likelihood</h5><p>" + esc(f.likelihood) + "</p></div>" +
          "</div>" +
          "<div><h5>Description</h5><p>" + esc(f.description) + "</p></div>" +
          "<div><h5>Recommendation</h5><p>" + esc(f.recommendation) + "</p></div>" +
          (hasCode ?
            '<div><div class="diff-tabs" role="tablist" aria-label="Code for ' + esc(f.id) + '">' +
              tabs.map(([k, label], ti) => '<button role="tab" id="t-' + i + "-" + k + '" aria-controls="p-' + i + "-" + k + '" aria-selected="' + (ti === 0) + '"' + (ti ? ' tabindex="-1"' : "") + ">" + label + "</button>").join("") +
            "</div>" +
            tabs.map(([k, , code], ti) => '<pre class="code tab-panel" id="p-' + i + "-" + k + '" role="tabpanel" aria-labelledby="t-' + i + "-" + k + '"' + (ti ? " hidden" : "") + "><code>" + hi(code) + "</code></pre>").join("") +
            "</div>" : "") +
          "<div><h5>Verification</h5><p>" + esc(f.verification) + "</p></div>" +
        "</div></div></div></article>";
    }).join("");

    // expand / collapse
    list.querySelectorAll(".finding-head").forEach((btn) => {
      btn.addEventListener("click", function () {
        const body = document.getElementById(btn.getAttribute("aria-controls"));
        const open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        body.classList.toggle("is-open", !open);
      });
    });
    // tabs inside findings
    list.querySelectorAll('[role="tablist"]').forEach((tl) => {
      const tabs = Array.from(tl.querySelectorAll('[role="tab"]'));
      const act = (t) => tabs.forEach((x) => {
        const sel = x === t; x.setAttribute("aria-selected", String(sel)); x.tabIndex = sel ? 0 : -1;
        const p = document.getElementById(x.getAttribute("aria-controls")); if (p) p.hidden = !sel;
      });
      tabs.forEach((t, i) => {
        t.addEventListener("click", () => act(t));
        t.addEventListener("keydown", (e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault(); const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); act(n);
          }
        });
      });
    });
    // filters
    filters.addEventListener("click", function (e) {
      const b = e.target.closest("[data-f]"); if (!b) return;
      filters.querySelectorAll("[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const f = b.dataset.f;
      let shown = 0;
      list.querySelectorAll(".finding").forEach((el) => {
        const ok = f === "all" || el.dataset.severity === f;
        el.hidden = !ok; if (ok) shown++;
      });
      const empty = rv.querySelector("#rv-empty");
      if (empty) empty.hidden = shown > 0;
    });
    const expandBtn = filters.querySelector("#rv-expand");
    expandBtn.addEventListener("click", function () {
      const expand = expandBtn.textContent.trim() === "Expand all";
      list.querySelectorAll(".finding-head").forEach((btn) => {
        btn.setAttribute("aria-expanded", String(expand));
        document.getElementById(btn.getAttribute("aria-controls")).classList.toggle("is-open", expand);
      });
      expandBtn.textContent = expand ? "Collapse all" : "Expand all";
    });
  }

  /* -------------------------------------------------- Severity explorer */
  const se = document.getElementById("severity-explorer");
  if (se && window.SENTRYX_SEVERITY) {
    const D = window.SENTRYX_SEVERITY;
    const keys = ["critical", "high", "medium", "low", "info"];
    const nav = se.querySelector("#se-nav"), pane = se.querySelector("#se-pane");
    nav.innerHTML = keys.map((k) =>
      '<button type="button" data-k="' + k + '" data-sev="' + k + '" role="tab" aria-selected="' + (k === "critical") + '" aria-controls="se-pane">' +
      '<span class="c">' + D[k].code + '</span><span class="n">' + D[k].label + "</span></button>").join("");
    function show(k) {
      const d = D[k];
      nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.k === k)));
      pane.dataset.sev = k;
      pane.innerHTML =
        '<span class="mono-label" style="color:var(--sev)">' + d.code + "</span>" +
        "<h3>" + d.label + "</h3>" +
        '<p class="lede" style="font-size:var(--text-base);margin-top:var(--s-3)">' + esc(d.definition) + "</p>" +
        '<div class="cols"><div><h4>Example finding classes</h4><ul>' + d.examples.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div>" +
        "<div><h4>Typical remediation</h4><ul>" + d.remediation.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></div></div>";
    }
    nav.addEventListener("click", function (e) { const b = e.target.closest("[data-k]"); if (b) show(b.dataset.k); });
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const cur = keys.indexOf(se.querySelector("#se-pane").dataset.sev || "critical");
      const next = keys[(cur + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
      show(next); nav.querySelector('[data-k="' + next + '"]').focus();
    });
    show(location.hash === "#severity" ? "critical" : "critical");
  }
})();
