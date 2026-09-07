/* ==========================================================================
   SENTRYX — researcher profiles
   Reads window.SENTRYX_TEAM (data/team.js). Add a `photo` path to replace the
   initials placeholder; add entries to `contests` when real handles exist.
   ========================================================================== */
(function () {
  "use strict";
  const root = document.getElementById("team-root");
  if (!root || !window.SENTRYX_TEAM) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const ICONS = {
    github: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.4-3.9-1.4-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.2 8.3L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1 2h6.8l4.7 6.2L18.9 2zm-1.1 18h1.8L7.3 3.9H5.4L17.8 20z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.4 20.4h-3.6v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9v5.7H9.3V9h3.4v1.6h.1c.5-.9 1.7-1.9 3.4-1.9 3.6 0 4.3 2.4 4.3 5.5v6.2zM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM7.1 20.4H3.5V9h3.6v11.4zM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 1 .8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7c0-.9-.8-1.7-1.8-1.7z"/></svg>'
  };

  root.innerHTML = window.SENTRYX_TEAM.map((m) =>
    '<article class="profile" id="' + m.id + '" data-reveal>' +
      "<div>" +
        '<div class="portrait">' + (m.photo
          ? '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '" loading="lazy" width="480" height="640">'
          : "<span>" + esc(m.initials) + "</span>") + "</div>" +
        '<div class="team-card" style="border:0;padding:0;background:none;box-shadow:none;margin-top:var(--s-4)">' +
          '<div class="socials">' + Object.keys(m.links).filter((k) => m.links[k]).map((k) =>
            '<a href="' + esc(m.links[k]) + '" rel="me noopener" target="_blank" aria-label="' + esc(m.name) + " on " + k + '">' + ICONS[k] + "</a>").join("") +
          "</div>" +
        "</div>" +
      "</div>" +
      "<div>" +
        '<p class="mono-label accent">' + esc(m.role) + "</p>" +
        "<h2>" + esc(m.name) + "</h2>" +
        '<p class="lede" style="margin-top:var(--s-4)">' + esc(m.bio) + "</p>" +
        '<div class="tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--s-5)">' +
          m.specialisations.map((s) => '<span class="chip">' + esc(s) + "</span>").join("") +
        "</div>" +
        '<div class="cols">' +
          "<div><h4>Focus areas</h4><ul>" + m.focus.map((f) => "<li>" + esc(f) + "</li>").join("") + "</ul></div>" +
          "<div><h4>Contest &amp; bounty handles</h4>" +
            (m.contests && m.contests.length
              ? "<ul>" + m.contests.map((c) => '<li><a href="' + esc(c.url) + '" rel="noopener" target="_blank">' + esc(c.platform) + " &middot; " + esc(c.handle) + "</a></li>").join("") + "</ul>"
              : "<p style='font-size:var(--text-sm);color:var(--ink-3)'>Placeholder &mdash; public handles are added here as profiles are linked. Nothing is listed until it can be verified.</p>") +
          "</div>" +
        "</div>" +
      "</div>" +
    "</article>").join("");
})();
