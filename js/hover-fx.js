/* ==========================================================================
   SENTRYX hover effects (all pages)
   - Text decode: nav links, buttons and HUD labels scramble then resolve
     (only text nodes are touched, icons inside stay)
   - Spotlight: cards and rows track the pointer with an amber glow
   Fine pointers only; off for prefers-reduced-motion.
   ========================================================================== */
(() => {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!fine || reduced) return;

  const GLYPHS = "0123456789abcdef#%&@$<>/[]";
  const busy = new WeakSet();

  function textNodes(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.data.trim() ? 1 : 2) });
    const list = []; let n; while ((n = w.nextNode())) list.push(n); return list;
  }

  function decode(el, dur = 420) {
    if (busy.has(el)) return;
    const nodes = textNodes(el); if (!nodes.length) return;
    busy.add(el);
    const finals = nodes.map((n) => n.data);
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      nodes.forEach((n, j) => {
        const f = finals[j]; let s = "";
        const settled = Math.floor(p * f.length);
        for (let i = 0; i < f.length; i++) {
          const ch = f[i];
          s += i < settled || ch === " " || ch === "·" ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        n.data = s;
      });
      if (p < 1) requestAnimationFrame(step);
      else { nodes.forEach((n, j) => (n.data = finals[j])); busy.delete(el); }
    };
    requestAnimationFrame(step);
    // safety: never leave text scrambled if frames stall (background tab)
    setTimeout(() => { if (busy.has(el)) { nodes.forEach((n, j) => (n.data = finals[j])); busy.delete(el); } }, dur + 150);
  }

  const DECODE = ".nav a, .hx-btn, .btn, .link-arrow, .hx-label, .eyebrow, .hx-topbar, .card .card-index, .vuln-item .vuln-id, .diff-tabs button, .footer-grid a";
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest(DECODE);
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    // keep layout stable while glyphs swap
    if (!el.style.minWidth && getComputedStyle(el).display !== "inline") el.style.minWidth = el.getBoundingClientRect().width + "px";
    decode(el);
  });

  const SPOT = ".card, .vuln-item, .process-step, .acc-item, .sev-cell, .hx-visual";
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest(SPOT); if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", (e.clientX - r.left) + "px");
    el.style.setProperty("--my", (e.clientY - r.top) + "px");
  }, { passive: true });
})();
