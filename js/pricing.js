/* ==========================================================================
   SENTRYX — pricing page renderer
   Reads window.SENTRYX_PRICING (data/pricing.js). Change prices there only.
   ========================================================================== */
(function () {
  "use strict";
  const grid = document.getElementById("price-grid");
  if (!grid || !window.SENTRYX_PRICING) return;
  const P = window.SENTRYX_PRICING;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const note = document.getElementById("pricing-note");
  if (note) note.textContent = P.note;

  grid.innerHTML = P.tiers.map((t) =>
    '<article class="card price-card' + (t.featured ? " is-featured" : "") + '" data-tilt="3">' +
      '<div class="card-glow" aria-hidden="true"></div>' +
      (t.featured ? '<span class="ribbon">Most requested</span>' : "") +
      "<h3>" + esc(t.name) + "</h3>" +
      '<p class="tagline">' + esc(t.tagline) + "</p>" +
      '<div class="price-amount">' +
        (t.from === null
          ? '<span class="from">Pricing</span>Custom'
          : '<span class="from">From</span>' + P.currency.replace("USD", "$") + t.from.toLocaleString("en-US") +
            (t.unit ? '<span class="unit"> ' + esc(t.unit) + "</span>" : "")) +
      "</div>" +
      (t.emergency ? '<p class="mono-label" style="color:var(--sev-critical)">Emergency rate for same-day start</p>' : "") +
      '<div class="price-specs">' +
        "<span>Scope · <b>" + esc(t.loc) + "</b></span>" +
        "<span>Timeline · <b>" + esc(t.timeline) + "</b></span>" +
        "<span>Team · <b>" + esc(t.researchers) + "</b></span>" +
      "</div>" +
      "<ul>" + t.includes.map((x) => "<li><span>" + esc(x) + "</span></li>").join("") + "</ul>" +
      '<div style="border-top:1px solid var(--line-2);padding-top:var(--s-4);margin-bottom:var(--s-4)">' +
        '<h4 class="mono-label" style="margin-bottom:8px">Deliverables</h4>' +
        '<p style="font-size:var(--text-sm);color:var(--ink-2);margin:0">' + t.deliverables.map(esc).join(" · ") + "</p>" +
      "</div>" +
      '<a class="btn ' + (t.featured ? "btn-primary" : "btn-ghost") + '" href="contact.html?service=' + encodeURIComponent(t.id) + '"><span>' + esc(t.cta) + "</span></a>" +
    "</article>").join("");

  const table = document.getElementById("cmp-table");
  if (table && P.comparison) {
    const ids = P.tiers.map((t) => t.id).filter((id) => P.comparison.cells[id]);
    table.innerHTML =
      "<thead><tr><th scope='col'>Included</th>" +
      ids.map((id) => "<th scope='col'>" + esc(P.tiers.find((t) => t.id === id).name) + "</th>").join("") +
      "</tr></thead><tbody>" +
      P.comparison.rows.map((row, i) =>
        "<tr><th scope='row'>" + esc(row) + "</th>" +
        ids.map((id) => "<td>" + esc(P.comparison.cells[id][i] || "–") + "</td>").join("") + "</tr>").join("") +
      "</tbody>";
  }
})();
