/* ==========================================================================
   SENTRYX — glossary renderer
   Groups window.SENTRYX_GLOSSARY alphabetically, builds the A–Z index and a
   live filter, and links each term to the article or tool that covers it.
   ========================================================================== */
(function () {
  "use strict";
  var root = document.getElementById("glossary-root");
  if (!root || !window.SENTRYX_GLOSSARY) return;
  var G = window.SENTRYX_GLOSSARY.slice().sort(function (a, b) {
    return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
  });
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var slug = function (s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };

  // A "see also" target becomes a readable label
  var LABELS = {
    "process.html": "Our methodology",
    "services/invariant-fuzz-testing.html": "Invariant &amp; fuzz testing",
    "services/defi-protocol-audit.html": "DeFi protocol review",
    "services/smart-contract-security-audit.html": "Smart contract audit",
    "blog/reentrancy-attacks-explained.html": "Reentrancy explained",
    "blog/oracle-manipulation-attacks.html": "Oracle manipulation",
    "blog/access-control-failures.html": "Access control failures",
    "blog/erc4626-inflation-and-rounding.html": "Share inflation &amp; rounding",
    "blog/mev-and-front-running-defi.html": "MEV &amp; front-running",
    "blog/upgradeable-proxy-security.html": "Upgradeable contract security",
    "tools/access-control-matrix.html": "Access control matrix",
    "tools/storage-layout-visualizer.html": "Storage layout visualizer",
    "tools/proxy-detector.html": "Proxy detector",
    "tools/gas-optimization-analyzer.html": "Gas analyser",
    "tools/severity-explorer.html": "Severity explorer",
    "tools/sample-audit-report.html": "Sample report",
    "tools/web3-unit-converter.html": "Unit converter",
    "tools/ai-deep-scan.html": "AI deep scan"
  };

  var letters = {};
  G.forEach(function (e) {
    var L = e.term[0].toUpperCase();
    (letters[L] = letters[L] || []).push(e);
  });
  var order = Object.keys(letters).sort();

  // A–Z index
  var idx = document.getElementById("gloss-index");
  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  idx.innerHTML = ALPHA.map(function (L) {
    return letters[L] ? '<a href="#letter-' + L + '">' + L + "</a>" : "<span>" + L + "</span>";
  }).join("");

  root.innerHTML = order.map(function (L) {
    return '<section class="gloss-group" id="letter-' + L + '">' +
      "<h2>" + L + "</h2>" +
      '<div class="gloss-list">' + letters[L].map(function (e) {
        var see = (e.see || []).map(function (href) {
          return '<a href="' + (href.indexOf("http") === 0 ? href : "" + href) + '">' + (LABELS[href] || href) + "</a>";
        }).join(" &middot; ");
        return '<article class="gloss-item" id="' + slug(e.term) + '" data-term="' +
          esc((e.term + " " + (e.aka || "") + " " + (e.tags || []).join(" ")).toLowerCase()) + '">' +
          "<h3>" + esc(e.term) +
          (e.aka ? ' <span class="dim" style="font-weight:400;font-size:0.85em">also: ' + esc(e.aka) + "</span>" : "") +
          (e.tags && e.tags.length ? ' <span class="chip" style="font-size:9px">' + esc(e.tags[0]) + "</span>" : "") +
          "</h3><p>" + esc(e.def) + "</p>" +
          (see ? '<div class="gloss-see">Read more: ' + see + "</div>" : "") +
          "</article>";
      }).join("") + "</div></section>";
  }).join("");

  // live filter
  var search = document.getElementById("gloss-search");
  var empty = document.getElementById("gloss-empty");
  var count = document.getElementById("gloss-count");
  if (count) count.textContent = G.length + " terms";
  if (search) {
    search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      root.querySelectorAll(".gloss-group").forEach(function (sec) {
        var visible = 0;
        sec.querySelectorAll(".gloss-item").forEach(function (it) {
          var ok = !q || it.dataset.term.indexOf(q) !== -1 || it.textContent.toLowerCase().indexOf(q) !== -1;
          it.hidden = !ok; if (ok) visible++;
        });
        sec.hidden = visible === 0; shown += visible;
      });
      if (empty) empty.hidden = shown > 0;
      if (count) count.textContent = q ? shown + " of " + G.length + " terms" : G.length + " terms";
    });
  }
})();
