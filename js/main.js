/* ==========================================================================
   SENTRYX — shared behaviour (every page loads this, deferred)
   Modules: env, veil, header, cursor, magnetic, reveal, scramble, counters,
   typewriter, tilt, marquee, accordion, tabs, process scroll, stats, transitions
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ env */
  const ENV = {
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    finePointer: window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    touch: "ontouchstart" in window || navigator.maxTouchPoints > 0,
    saveData: !!(navigator.connection && navigator.connection.saveData),
    lowPower: false
  };
  window.SENTRYX_ENV = ENV;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const ready = (fn) => (document.readyState !== "loading" ? fn() : document.addEventListener("DOMContentLoaded", fn));

  if (ENV.reduced) document.body.classList.add("reduced-motion");

  // Battery-saver heuristic: if the Battery API is available and the device is
  // discharging below 20%, tell canvas modules to idle (they read ENV.lowPower).
  if (navigator.getBattery) {
    navigator.getBattery().then((b) => {
      const update = () => { ENV.lowPower = !b.charging && b.level < 0.2; document.dispatchEvent(new CustomEvent("sentryx:power")); };
      update(); b.addEventListener("levelchange", update); b.addEventListener("chargingchange", update);
    }).catch(() => {});
  }

  /* ----------------------------------------------------------- page veil */
  ready(() => {
    // Fonts may still be loading; don't hold the reveal for more than ~250ms.
    const go = () => requestAnimationFrame(() => document.body.classList.add("is-ready"));
    if (document.fonts && document.fonts.ready) Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 250))]).then(go);
    else go();
  });

  /* -------------------------------------------------------------- header */
  ready(() => {
    const header = $(".site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });

    const toggle = $(".nav-toggle"), nav = $(".nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(open));
        nav.classList.toggle("is-open", open);
        document.body.classList.toggle("nav-open", open);
      });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) toggle.click(); });
    }
    // Mark current page
    const here = location.pathname.replace(/\/$/, "/index.html");
    $$(".nav a").forEach((a) => { try { const u = new URL(a.getAttribute("href"), location.href); const p = u.pathname.replace(/\/$/, "/index.html"); if (p === here || (p.endsWith("/services.html") && here.includes("/services/"))) a.setAttribute("aria-current", "page"); } catch (_) {} });
    // Footer year
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });

  /* --------------------------------------------------------------- cursor */
  ready(() => {
    if (!ENV.finePointer || ENV.reduced) return;
    const dot = document.createElement("div"); dot.className = "cursor is-hidden";
    const glow = document.createElement("div"); glow.className = "cursor-glow";
    document.body.append(glow, dot); document.body.classList.add("has-cursor");
    let x = innerWidth / 2, y = innerHeight / 2, gx = x, gy = y, raf;
    const tick = () => { gx += (x - gx) * 0.12; gy += (y - gy) * 0.12; glow.style.transform = `translate(${gx - 260}px, ${gy - 260}px)`; raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x - 5}px, ${y - 5}px)`; dot.classList.remove("is-hidden"); }, { passive: true });
    document.addEventListener("mouseleave", () => dot.classList.add("is-hidden"));
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest("a, button, [role=button], label, .sev-cell, .tab");
      const txt = e.target.closest("input, textarea, [contenteditable]");
      dot.classList.toggle("is-hover", !!t); dot.classList.toggle("is-text", !!txt);
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else tick(); });
  });

  /* ------------------------------------------------------------- magnetic */
  ready(() => {
    if (!ENV.finePointer || ENV.reduced) return;
    $$("[data-magnetic]").forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  });

  /* --------------------------------------------------------------- reveal */
  ready(() => {
    const els = $$("[data-reveal], [data-reveal-stagger]");
    if (!els.length) return;
    if (ENV.reduced || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => io.observe(el));
  });

  /* ------------------------------------------------- scramble / decrypt text */
  const GLYPHS = "!<>-_\\/[]{}—=+*^?#01";
  function scramble(el, opts) {
    const final = el.dataset.scrambleText || el.textContent;
    el.dataset.scrambleText = final;
    if (ENV.reduced) { el.textContent = final; return; }
    const dur = (opts && opts.duration) || 900, start = performance.now();
    const len = final.length; const order = [...Array(len).keys()].sort(() => Math.random() - 0.5);
    el.setAttribute("aria-label", final);
    const frame = (now) => {
      const p = Math.min(1, (now - start) / dur); const settled = Math.floor(p * len);
      let out = "";
      for (let i = 0; i < len; i++) {
        const ch = final[i];
        if (ch === " " || ch === "\n") { out += ch; continue; }
        out += order.indexOf(i) < settled ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
    };
    requestAnimationFrame(frame);
  }
  window.SENTRYX_scramble = scramble;
  ready(() => {
    const els = $$("[data-scramble]");
    if (!els.length) return;
    if (ENV.reduced) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { setTimeout(() => scramble(en.target, { duration: parseInt(en.target.dataset.scramble) || 900 }), parseInt(en.target.dataset.scrambleDelay) || 0); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    els.forEach((el) => io.observe(el));
    // hover re-scramble for short labels
    $$("[data-scramble-hover]").forEach((el) => el.addEventListener("mouseenter", () => scramble(el, { duration: 500 })));
  });

  /* ------------------------------------------------------------- counters */
  ready(() => {
    const els = $$("[data-count]");
    if (!els.length) return;
    const run = (el) => {
      const target = parseFloat(el.dataset.count); const dec = parseInt(el.dataset.decimals || "0");
      if (isNaN(target)) return;
      if (ENV.reduced) { el.textContent = target.toLocaleString(undefined, { maximumFractionDigits: dec }); return; }
      const dur = 1400, start = performance.now();
      const step = (now) => { const p = Math.min(1, (now - start) / dur); const e = 1 - Math.pow(1 - p, 3); el.textContent = (target * e).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } }), { threshold: 0.5 });
    els.forEach((el) => io.observe(el));
  });

  /* ----------------------------------------------------------- typewriter */
  // <div data-typewriter> containing a <template> of HTML lines; each top-level
  // child of the template is typed in order (text typed char-by-char, tags kept).
  ready(() => {
    $$("[data-typewriter]").forEach((box) => {
      const tpl = $("template", box); if (!tpl) return;
      const lines = Array.from(tpl.content.children);
      const speed = parseInt(box.dataset.typewriter) || 14;
      const out = document.createElement("div"); tpl.parentElement.appendChild(out);
      const caret = document.createElement("span"); caret.className = "caret";
      if (ENV.reduced) { lines.forEach((l) => out.appendChild(l.cloneNode(true))); return; }
      let li = 0, started = false;
      const typeLine = () => {
        if (li >= lines.length) { caret.remove(); box.dispatchEvent(new CustomEvent("typewriter:done")); return; }
        const src = lines[li++]; const el = src.cloneNode(false); out.appendChild(el); el.appendChild(caret);
        const pause = parseInt(src.dataset.pause || "0");
        // Walk source nodes; type text nodes character by character
        const nodes = Array.from(src.childNodes); let ni = 0;
        const next = () => {
          if (ni >= nodes.length) { setTimeout(typeLine, 80 + pause); return; }
          const n = nodes[ni++];
          if (n.nodeType === 3) {
            const text = n.textContent; let ci = 0; const tn = document.createTextNode(""); el.insertBefore(tn, caret);
            const tick = () => { tn.textContent = text.slice(0, ++ci); if (ci < text.length) setTimeout(tick, speed + Math.random() * speed); else next(); };
            tick();
          } else { const c = n.cloneNode(false); el.insertBefore(c, caret); const text = n.textContent; let ci = 0;
            const tick = () => { c.textContent = text.slice(0, ++ci); if (ci < text.length) setTimeout(tick, speed + Math.random() * speed); else next(); };
            tick(); }
        };
        next();
      };
      const io = new IntersectionObserver((en) => { if (en[0].isIntersecting && !started) { started = true; setTimeout(typeLine, parseInt(box.dataset.delay || "400")); io.disconnect(); } }, { threshold: 0.3 });
      io.observe(box);
    });
  });

  /* ------------------------------------------------------------------ tilt */
  ready(() => {
    if (!ENV.finePointer || ENV.reduced) return;
    $$("[data-tilt]").forEach((card) => {
      const max = parseFloat(card.dataset.tilt) || 6;
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", (px * 100).toFixed(1) + "%"); card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
        card.style.transform = `perspective(900px) rotateX(${((0.5 - py) * max).toFixed(2)}deg) rotateY(${((px - 0.5) * max).toFixed(2)}deg) translateY(-2px)`;
      });
      card.addEventListener("mouseleave", () => { card.style.transform = ""; });
    });
    // Glow tracking on cards without tilt
    $$(".card-glow").forEach((g) => { const card = g.parentElement; if (card.hasAttribute("data-tilt")) return;
      card.addEventListener("mousemove", (e) => { const r = card.getBoundingClientRect(); card.style.setProperty("--mx", ((e.clientX - r.left) / r.width * 100).toFixed(1) + "%"); card.style.setProperty("--my", ((e.clientY - r.top) / r.height * 100).toFixed(1) + "%"); }); });
  });

  /* --------------------------------------------------------------- marquee */
  ready(() => {
    $$(".marquee-track").forEach((track) => { const g = $(".marquee-group", track); if (g && track.children.length === 1) track.appendChild(g.cloneNode(true)).setAttribute("aria-hidden", "true"); });
  });

  /* ------------------------------------------------------------- accordion */
  ready(() => {
    $$(".accordion").forEach((acc) => {
      $$(".acc-trigger", acc).forEach((btn) => {
        btn.addEventListener("click", () => {
          const panel = document.getElementById(btn.getAttribute("aria-controls"));
          const open = btn.getAttribute("aria-expanded") === "true";
          if (acc.dataset.single !== "false") $$(".acc-trigger", acc).forEach((b) => { if (b !== btn) { b.setAttribute("aria-expanded", "false"); const p = document.getElementById(b.getAttribute("aria-controls")); p && p.classList.remove("is-open"); } });
          btn.setAttribute("aria-expanded", String(!open)); panel && panel.classList.toggle("is-open", !open);
        });
      });
    });
  });

  /* ------------------------------------------------------------------ tabs */
  ready(() => {
    $$("[role=tablist]").forEach((list) => {
      const tabs = $$("[role=tab]", list);
      const activate = (tab) => { tabs.forEach((t) => { const sel = t === tab; t.setAttribute("aria-selected", String(sel)); t.tabIndex = sel ? 0 : -1; const p = document.getElementById(t.getAttribute("aria-controls")); if (p) p.hidden = !sel; }); };
      tabs.forEach((t, i) => { t.addEventListener("click", () => activate(t)); t.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); activate(n); } }); });
    });
  });

  /* -------------------------------------------- process: pinned horizontal */
  ready(() => {
    const section = $(".process"); if (!section) return;
    const track = $(".process-track", section); const steps = $$(".process-step", track); const bar = $(".process-progress i", section);
    if (!track) return;
    const setActive = (i) => steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    setActive(0);
    const desktop = window.matchMedia("(min-width: 1024px)").matches;
    if (desktop && !ENV.reduced && window.gsap && window.ScrollTrigger) {
      gsap.registerPlugin(ScrollTrigger);
      const dist = () => track.scrollWidth - window.innerWidth;
      gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: {
          trigger: section, start: "top top", end: () => "+=" + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (st) => { if (bar) bar.style.width = (st.progress * 100).toFixed(1) + "%"; setActive(Math.min(steps.length - 1, Math.round(st.progress * (steps.length - 1)))); }
        }
      });
    } else {
      // Touch / narrow: native swipe carousel; progress bar follows scrollLeft
      track.addEventListener("scroll", () => { const max = track.scrollWidth - track.clientWidth; const p = max ? track.scrollLeft / max : 0; if (bar) bar.style.width = (p * 100).toFixed(1) + "%"; setActive(Math.min(steps.length - 1, Math.round(p * (steps.length - 1)))); }, { passive: true });
    }
  });

  /* ------------------------------------------------- stats from data file */
  ready(() => {
    const band = $("[data-stats]"); if (!band || !window.SENTRYX_STATS) return;
    const S = window.SENTRYX_STATS;
    band.innerHTML = S.items.map((it) => {
      const ph = it.value === null || it.value === undefined;
      const val = ph ? `<span class="stat-value">${it.placeholder || "—"}</span>` : `<span class="stat-value"><span data-count="${it.value}" data-decimals="${it.decimals || 0}">0</span>${it.unit ? `<span class="unit">${it.unit}</span>` : ""}</span>`;
      return `<div class="stat${ph ? " is-placeholder" : ""}"><div>${val}</div><div class="stat-label">${it.label}</div>${it.note ? `<div class="stat-note">${it.note}</div>` : ""}</div>`;
    }).join("");
    // Re-arm counters for injected nodes
    $$("[data-count]", band).forEach((el) => { const target = parseFloat(el.dataset.count); const dec = parseInt(el.dataset.decimals || "0");
      const io = new IntersectionObserver((en) => { if (!en[0].isIntersecting) return; io.disconnect(); if (ENV.reduced) { el.textContent = target.toLocaleString(); return; }
        const start = performance.now(); const step = (now) => { const p = Math.min(1, (now - start) / 1400); const e = 1 - Math.pow(1 - p, 3); el.textContent = (target * e).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec }); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }, { threshold: 0.5 }); io.observe(el); });
  });

  /* ------------------------------------------------------ severity band */
  ready(() => {
    const band = $(".sev-band"); if (!band) return;
    const cells = $$(".sev-cell", band); const detail = $("[data-sev-detail]");
    const D = window.SENTRYX_SEVERITY || {};
    const show = (key) => {
      cells.forEach((c) => c.classList.toggle("is-active", c.dataset.sev === key));
      if (!detail || !D[key]) return;
      const d = D[key];
      detail.dataset.sev = key;
      detail.innerHTML = `<div><h4>Definition</h4><p class="muted" style="font-size:var(--text-sm)">${d.definition}</p></div><div><h4>Example classes</h4><ul>${d.examples.map((e) => `<li>${e}</li>`).join("")}</ul></div><div><h4>Typical remediation</h4><ul>${d.remediation.map((e) => `<li>${e}</li>`).join("")}</ul></div>`;
    };
    cells.forEach((c) => c.addEventListener("click", () => show(c.dataset.sev)));
    show(band.dataset.default || "critical");
  });

  /* ----------------------------------------------------- page transitions */
  ready(() => {
    if (ENV.reduced) return;
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]"); if (!a) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || a.target === "_blank" || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      let url; try { url = new URL(href, location.href); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault(); document.body.classList.add("is-leaving");
      setTimeout(() => { location.href = url.href; }, 360);
    });
    window.addEventListener("pageshow", (e) => { if (e.persisted) document.body.classList.remove("is-leaving"); });
  });

  /* ---------------------------------------------- 100vh fix (iOS Safari) */
  const setVH = () => document.documentElement.style.setProperty("--vh", window.innerHeight * 0.01 + "px");
  setVH(); window.addEventListener("resize", setVH, { passive: true });
})();
