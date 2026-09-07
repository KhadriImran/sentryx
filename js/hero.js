/* ==========================================================================
   SENTRYX hero — "live threat mesh"
   A drifting network of contract nodes. Edges form by proximity and rewire
   as nodes move. Random nodes flip to a vulnerable state (red pulse), packets
   propagate along their edges, then the node is patched (amber ring) and
   settles. The pointer repels nodes and lights nearby edges amber.
   Pure Canvas 2D, no dependencies. Budgeted for 60fps on mid-range Android:
   node count scales with viewport, DPR is capped, edges are batched into a
   few alpha buckets, and the loop idles when hidden/off-screen/low battery.
   ========================================================================== */
(function () {
  "use strict";
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });
  const ENV = window.SENTRYX_ENV || { reduced: false };
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ACCENT = [255, 166, 26], CRIT = [255, 51, 85], INK = [243, 241, 234], OK = [74, 222, 128];
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

  let W = 0, H = 0, DPR = 1, nodes = [], edges = [], packets = [], rings = [];
  let pointer = { x: -9999, y: -9999, active: false, t: 0 };
  let running = false, raf = 0, last = 0, inView = true, frame = 0;
  let LINK = 150, COUNT = 90, REPEL = 170;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const mobile = r.width < 720;
    DPR = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Density-scaled population
    const area = W * H;
    COUNT = Math.round(Math.min(120, Math.max(36, area / (mobile ? 11000 : 14000))));
    LINK = mobile ? 115 : Math.min(170, Math.max(120, W / 9));
    REPEL = mobile ? 120 : 170;
    if (nodes.length === 0) seed(); else adjustPopulation();
  }

  function makeNode() {
    const hub = Math.random() < 0.12;
    return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: hub ? 3.2 : 1.6 + Math.random() * 1.2, hub, state: 0, st: 0, phase: Math.random() * Math.PI * 2 };
  }
  function seed() { nodes = []; for (let i = 0; i < COUNT; i++) nodes.push(makeNode()); }
  function adjustPopulation() {
    while (nodes.length < COUNT) nodes.push(makeNode());
    if (nodes.length > COUNT) nodes.length = COUNT;
    nodes.forEach((n) => { n.x = Math.min(W, Math.max(0, n.x)); n.y = Math.min(H, Math.max(0, n.y)); });
  }

  /* -------------------------------------------------------------- physics */
  function step(dt) {
    frame++;
    const t = performance.now() / 1000;
    // Virtual pointer drifts when no real pointer is active (keeps mobile alive)
    let px = pointer.x, py = pointer.y;
    if (!pointer.active) { px = W * (0.5 + 0.32 * Math.sin(t * 0.23)); py = H * (0.5 + 0.28 * Math.cos(t * 0.17)); }
    const r2 = REPEL * REPEL;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      // gentle organic drift
      n.vx += Math.sin(t * 0.6 + n.phase) * 0.0025; n.vy += Math.cos(t * 0.5 + n.phase * 1.3) * 0.0025;
      // pointer repulsion
      const dx = n.x - px, dy = n.y - py, d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 0.01) { const d = Math.sqrt(d2); const f = (1 - d / REPEL) * (pointer.active ? 0.09 : 0.035); n.vx += (dx / d) * f; n.vy += (dy / d) * f; }
      // damping + speed cap
      n.vx *= 0.985; n.vy *= 0.985;
      const sp = Math.hypot(n.vx, n.vy); const cap = n.hub ? 0.35 : 0.6; if (sp > cap) { n.vx = (n.vx / sp) * cap; n.vy = (n.vy / sp) * cap; }
      n.x += n.vx * dt; n.y += n.vy * dt;
      // soft wrap
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
      // state machine: 0 normal, 1 vulnerable, 2 patched
      if (n.state) { n.st -= dt / 60; if (n.st <= 0) { if (n.state === 1) { n.state = 2; n.st = 1.6; rings.push({ x: n.x, y: n.y, r: 4, a: 1, c: OK }); } else { n.state = 0; } } }
    }
    // Edges by proximity (O(n^2), n <= 120)
    edges.length = 0; const L2 = LINK * LINK;
    for (let i = 0; i < nodes.length; i++) { const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) { const b = nodes[j]; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < L2) edges.push({ a, b, w: 1 - Math.sqrt(d2) / LINK }); } }
    // Random vulnerability events
    if (frame % 90 === 0 && Math.random() < 0.7) { const n = nodes[(Math.random() * nodes.length) | 0]; if (!n.state) { n.state = 1; n.st = 2.2; rings.push({ x: n.x, y: n.y, r: 3, a: 1, c: CRIT });
      // emit packets along its edges
      edges.filter((e) => e.a === n || e.b === n).slice(0, 4).forEach((e) => packets.push({ e, from: e.a === n ? "a" : "b", p: 0, c: CRIT, s: 0.9 + Math.random() * 0.5 })); } }
    // Ambient packets from pointer-neighbourhood
    if (frame % 22 === 0 && edges.length) { const e = edges[(Math.random() * edges.length) | 0]; packets.push({ e, from: Math.random() < 0.5 ? "a" : "b", p: 0, c: ACCENT, s: 0.7 + Math.random() * 0.6 }); }
    for (let i = packets.length - 1; i >= 0; i--) { const k = packets[i]; k.p += 0.012 * k.s * dt; if (k.p >= 1) { packets.splice(i, 1); } }
    if (packets.length > 40) packets.splice(0, packets.length - 40);
    for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.r += 1.1 * dt; g.a -= 0.018 * dt; if (g.a <= 0) rings.splice(i, 1); }
    return { px, py };
  }

  /* --------------------------------------------------------------- render */
  function draw(px, py) {
    ctx.clearRect(0, 0, W, H);
    // edges bucketed by alpha (cheap strokeStyle churn)
    const buckets = [[], [], [], []], hot = [];
    const hotR2 = REPEL * 1.35 * REPEL * 1.35;
    for (let i = 0; i < edges.length; i++) { const e = edges[i];
      const mx = (e.a.x + e.b.x) * 0.5, my = (e.a.y + e.b.y) * 0.5; const dx = mx - px, dy = my - py;
      if (e.a.state === 1 || e.b.state === 1) { hot.push({ e, c: CRIT, a: 0.7 }); continue; }
      if (dx * dx + dy * dy < hotR2) { hot.push({ e, c: ACCENT, a: Math.min(0.85, e.w * 0.9 + 0.2) }); continue; }
      buckets[Math.min(3, (e.w * 4) | 0)].push(e); }
    ctx.lineWidth = 1;
    const alphas = [0.07, 0.13, 0.2, 0.3];
    for (let b = 0; b < 4; b++) { if (!buckets[b].length) continue; ctx.strokeStyle = rgba(INK, alphas[b]); ctx.beginPath(); for (const e of buckets[b]) { ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); } ctx.stroke(); }
    for (const h of hot) { ctx.strokeStyle = rgba(h.c, h.a); ctx.beginPath(); ctx.moveTo(h.e.a.x, h.e.a.y); ctx.lineTo(h.e.b.x, h.e.b.y); ctx.stroke(); }
    // packets
    for (const k of packets) { const A = k.from === "a" ? k.e.a : k.e.b, B = k.from === "a" ? k.e.b : k.e.a; const x = A.x + (B.x - A.x) * k.p, y = A.y + (B.y - A.y) * k.p;
      ctx.fillStyle = rgba(k.c, 0.95); ctx.beginPath(); ctx.arc(x, y, 1.8, 0, 6.283); ctx.fill();
      ctx.strokeStyle = rgba(k.c, 0.35); ctx.beginPath(); ctx.moveTo(A.x + (B.x - A.x) * Math.max(0, k.p - 0.12), A.y + (B.y - A.y) * Math.max(0, k.p - 0.12)); ctx.lineTo(x, y); ctx.stroke(); }
    // rings
    for (const g of rings) { ctx.strokeStyle = rgba(g.c, g.a * 0.8); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, 6.283); ctx.stroke(); }
    ctx.lineWidth = 1;
    // nodes: rotated squares (sigil-like), hubs larger with halo
    for (const n of nodes) {
      const dx = n.x - px, dy = n.y - py; const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (REPEL * 1.35));
      let c = INK, a = 0.55 + near * 0.45, r = n.r;
      if (n.state === 1) { c = CRIT; a = 0.85 + 0.15 * Math.sin(performance.now() / 70); r = n.r + 1.5; }
      else if (n.state === 2) { c = OK; a = 0.9; }
      else if (near > 0.15) { c = ACCENT; }
      if (n.hub || n.state) { ctx.fillStyle = rgba(c, a * 0.12); ctx.beginPath(); ctx.arc(n.x, n.y, r * 4, 0, 6.283); ctx.fill(); }
      ctx.fillStyle = rgba(c, a);
      ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(0.785); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore();
    }
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(2.5, (now - last) / 16.667 || 1); last = now;
    const p = step(dt); draw(p.px, p.py);
    raf = requestAnimationFrame(loop);
  }
  function start() { if (running || reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function decide() { const ok = inView && !document.hidden && !(ENV.lowPower); ok ? start() : stop(); }

  /* ---------------------------------------------------------------- input */
  const hero = canvas.closest(".hero") || canvas.parentElement;
  const setPointer = (cx, cy) => { const r = canvas.getBoundingClientRect(); pointer.x = cx - r.left; pointer.y = cy - r.top; pointer.active = true; pointer.t = performance.now(); };
  hero.addEventListener("mousemove", (e) => setPointer(e.clientX, e.clientY), { passive: true });
  hero.addEventListener("mouseleave", () => { pointer.active = false; });
  hero.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); }, { passive: true });
  hero.addEventListener("touchend", () => { setTimeout(() => { pointer.active = false; }, 600); }, { passive: true });

  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 120); }, { passive: true });
  document.addEventListener("visibilitychange", decide);
  document.addEventListener("sentryx:power", decide);
  if ("IntersectionObserver" in window) { new IntersectionObserver((en) => { inView = en[0].isIntersecting; decide(); }, { threshold: 0.02 }).observe(canvas); }

  resize();
  if (reduced) { // one static frame
    for (let i = 0; i < 120; i++) step(1); draw(-9999, -9999);
  } else { decide(); }
})();
