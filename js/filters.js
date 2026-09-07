/* ==========================================================================
   SENTRYX — generic filter bar + services / reports rendering
   Drives services.html (from data/services.js) and reports.html (data/reports.js).
   Also powers the reading progress bar and TOC highlighting on articles.
   ========================================================================== */
(function () {
  "use strict";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ------------------------------------------------------------ SERVICES */
  const svcRoot = document.getElementById("services-root");
  if (svcRoot && window.SENTRYX_SERVICES) {
    const S = window.SENTRYX_SERVICES;
    const bar = document.getElementById("svc-filters");
    const counts = {};
    S.items.forEach((it) => (counts[it.group] = (counts[it.group] || 0) + 1));

    bar.innerHTML =
      '<span class="filter-label">Filter</span>' +
      '<button class="chip-btn" type="button" data-g="all" aria-pressed="true">All <span class="count">' + S.items.length + "</span></button>" +
      S.groups.map((g) => '<button class="chip-btn" type="button" data-g="' + g.id + '" aria-pressed="false">' + esc(g.label) + ' <span class="count">' + (counts[g.id] || 0) + "</span></button>").join("") +
      '<button class="chip-btn" type="button" data-d="inhouse" aria-pressed="false" style="margin-left:auto">In-house only</button>';

    svcRoot.innerHTML = S.groups.map((g) => {
      const items = S.items.filter((it) => it.group === g.id);
      return '<section class="svc-group" data-group="' + g.id + '">' +
        "<h2>" + esc(g.label) + "</h2>" +
        '<p class="group-meta">' + items.length + " services · " + items.filter((i) => i.delivery === "inhouse").length + " in-house</p>" +
        '<div class="svc-list">' + items.map((it) =>
          '<article class="svc-item" data-delivery="' + it.delivery + '">' +
            '<div class="svc-top"><h3>' + (it.flagship ? '<a href="' + it.flagship + '" class="u-line" style="color:var(--ink-0)">' + esc(it.name) + "</a>" : esc(it.name)) + "</h3>" +
            '<span class="tag-delivery" data-delivery="' + it.delivery + '">' + (it.delivery === "inhouse" ? "In-house" : "With partners") + "</span></div>" +
            "<p>" + esc(it.desc) + "</p>" +
            (it.flagship ? '<div class="svc-foot"><a class="link-arrow" href="' + it.flagship + '">Service detail <svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></a></div>' : "") +
          "</article>").join("") +
        "</div></section>";
    }).join("");

    let group = "all", inhouseOnly = false;
    function apply() {
      let shown = 0;
      svcRoot.querySelectorAll(".svc-group").forEach((sec) => {
        let visible = 0;
        sec.querySelectorAll(".svc-item").forEach((it) => {
          const ok = (group === "all" || sec.dataset.group === group) && (!inhouseOnly || it.dataset.delivery === "inhouse");
          it.hidden = !ok; if (ok) visible++;
        });
        sec.hidden = visible === 0; shown += visible;
      });
      const empty = document.getElementById("svc-empty");
      if (empty) empty.hidden = shown > 0;
    }
    bar.addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.g) { group = b.dataset.g; bar.querySelectorAll("[data-g]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
      if (b.dataset.d) { inhouseOnly = !inhouseOnly; b.setAttribute("aria-pressed", String(inhouseOnly)); }
      apply();
    });
  }

  /* ------------------------------------------------------------- REPORTS */
  const repRoot = document.getElementById("reports-root");
  if (repRoot && window.SENTRYX_REPORTS) {
    const R = window.SENTRYX_REPORTS;
    const bar = document.getElementById("rep-filters");
    const chains = [...new Set(R.map((r) => r.chain))];
    const types = [...new Set(R.map((r) => r.type))];

    bar.innerHTML =
      '<span class="filter-label">Chain</span>' +
      '<button class="chip-btn" type="button" data-c="all" aria-pressed="true">All</button>' +
      chains.map((c) => '<button class="chip-btn" type="button" data-c="' + esc(c) + '" aria-pressed="false">' + esc(c) + "</button>").join("") +
      '<span class="filter-label" style="margin-left:12px">Type</span>' +
      '<button class="chip-btn" type="button" data-t="all" aria-pressed="true">All</button>' +
      types.map((t) => '<button class="chip-btn" type="button" data-t="' + esc(t) + '" aria-pressed="false">' + esc(t) + "</button>").join("") +
      '<span class="filter-label" style="margin-left:12px">Contains</span>' +
      ["critical", "high"].map((s) => '<button class="chip-btn" type="button" data-s="' + s + '" data-sev="' + s + '" aria-pressed="false">' + s[0].toUpperCase() + s.slice(1) + "</button>").join("");

    repRoot.innerHTML = R.map((r) => {
      const sev = ["critical", "high", "medium", "low", "info"].filter((s) => r.severities[s] > 0);
      return '<article class="card report-card" data-chain="' + esc(r.chain) + '" data-type="' + esc(r.type) + '" data-critical="' + (r.severities.critical > 0) + '" data-high="' + (r.severities.high > 0) + '">' +
        "<div>" +
          (r.illustrative ? '<span class="illustrative" style="margin-bottom:10px">Illustrative example — not a client engagement</span>' : "") +
          '<div class="post-meta" style="margin-top:' + (r.illustrative ? "10px" : "0") + '"><span>' + esc(r.date) + "</span><span>·</span><span>" + esc(r.chain) + "</span><span>·</span><span>" + esc(r.type) + "</span></div>" +
          "<h3 style='margin:10px 0 8px'>" + esc(r.title) + "</h3>" +
          "<p style='max-width:70ch'>" + esc(r.summary) + "</p>" +
          '<div class="rc-tags">' + r.tags.map((t) => '<span class="chip">' + esc(t) + "</span>").join("") + "</div>" +
        "</div>" +
        '<div style="display:grid;gap:12px;justify-items:end">' +
          '<div class="rc-sev">' + sev.map((s) => '<b data-sev="' + s + '">' + s[0].toUpperCase() + " " + r.severities[s] + "</b>").join("") + "</div>" +
          (r.url ? '<a class="btn btn-ghost btn-sm" href="' + esc(r.url) + '">Open report</a>' : "") +
          (r.repo ? '<a class="link-arrow" href="' + esc(r.repo) + '" rel="noopener" target="_blank">GitHub</a>' : "") +
        "</div></article>";
    }).join("");

    let chain = "all", type = "all", sevFilters = new Set();
    function apply() {
      let shown = 0;
      repRoot.querySelectorAll(".report-card").forEach((el) => {
        let ok = (chain === "all" || el.dataset.chain === chain) && (type === "all" || el.dataset.type === type);
        if (ok && sevFilters.size) ok = [...sevFilters].every((s) => el.dataset[s] === "true");
        el.hidden = !ok; if (ok) shown++;
      });
      document.getElementById("rep-empty").hidden = shown > 0;
    }
    bar.addEventListener("click", function (e) {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.c) { chain = b.dataset.c; bar.querySelectorAll("[data-c]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
      if (b.dataset.t) { type = b.dataset.t; bar.querySelectorAll("[data-t]").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }
      if (b.dataset.s) { const s = b.dataset.s; sevFilters.has(s) ? sevFilters.delete(s) : sevFilters.add(s); b.setAttribute("aria-pressed", String(sevFilters.has(s))); }
      apply();
    });
  }

  /* ----------------------------------------------------------- BLOG LIST */
  const blogRoot = document.getElementById("blog-root");
  if (blogRoot && window.SENTRYX_POSTS) {
    const P = window.SENTRYX_POSTS;
    const bar = document.getElementById("blog-filters");
    const tags = [...new Set(P.flatMap((p) => p.tags))];
    bar.innerHTML = '<span class="filter-label">Topic</span><button class="chip-btn" type="button" data-tag="all" aria-pressed="true">All <span class="count">' + P.length + "</span></button>" +
      tags.map((t) => '<button class="chip-btn" type="button" data-tag="' + esc(t) + '" aria-pressed="false">' + esc(t) + "</button>").join("");
    blogRoot.innerHTML = P.map((p, idx) =>
      '<a class="card card-link post-card' + (idx === 0 ? " is-feature card-accentline" : "") + '" href="' + esc(p.url) + '" data-tags="' + esc(p.tags.join("|")) + '" data-tilt="3">' +
        '<div class="card-glow" aria-hidden="true"></div>' +
        '<div class="post-meta"><span>' + esc(p.date) + "</span><span>·</span><span>" + p.readingTime + " min read</span></div>" +
        "<h3>" + esc(p.title) + "</h3><p>" + esc(p.excerpt) + "</p>" +
        '<div class="card-foot"><span class="chip">' + esc(p.tags[0]) + '</span><span class="link-arrow">Read <svg class="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span></div>' +
      "</a>").join("");
    bar.addEventListener("click", function (e) {
      const b = e.target.closest("[data-tag]"); if (!b) return;
      bar.querySelectorAll("[data-tag]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const t = b.dataset.tag; let shown = 0;
      blogRoot.querySelectorAll(".post-card").forEach((el) => {
        const ok = t === "all" || el.dataset.tags.split("|").indexOf(t) !== -1;
        el.hidden = !ok; if (ok) shown++;
      });
      document.getElementById("blog-empty").hidden = shown > 0;
    });
  }

  /* --------------------------------------------- ARTICLE: progress + TOC */
  const article = document.querySelector(".article-layout .prose") || document.querySelector("article.prose");
  if (article) {
    const bar = document.createElement("div");
    bar.className = "read-bar"; document.body.appendChild(bar);
    const toc = document.querySelector(".toc ul");
    const heads = Array.from(article.querySelectorAll("h2[id]"));
    if (toc && heads.length) {
      toc.innerHTML = heads.map((h) => '<li><a href="#' + h.id + '">' + h.textContent + "</a></li>").join("");
    }
    const links = toc ? Array.from(toc.querySelectorAll("a")) : [];
    const onScroll = () => {
      const r = article.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = Math.max(0, Math.min(1, (-r.top) / (total || 1)));
      bar.style.width = (p * 100).toFixed(2) + "%";
      let current = null;
      heads.forEach((h) => { if (h.getBoundingClientRect().top < 140) current = h.id; });
      links.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + current));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
})();
