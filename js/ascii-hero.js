/* ==========================================================================
   SENTRYX hero: the logo diamond rendered in ASCII glyphs.
   Three.js renders a small shaded scene off screen; each pixel becomes a
   glyph on the visible canvas, tinted amber -> severity red. A scan band
   sweeps down and flips the glyphs it crosses to hex.
   - ~30fps, pauses off screen and in hidden tabs
   - prefers-reduced-motion: one static frame
   ========================================================================== */
import * as THREE from "three";

const out = document.querySelector("[data-ascii]");
if (out) init(out);

function init(out) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = out.getContext("2d");
  const RAMP = " .,:;-=+*x#%@";
  const HEX = "0123456789abcdef";
  const A = [255, 166, 26], B = [255, 51, 85]; // amber -> critical red

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); }
  catch (_) { out.closest(".hx-visual")?.classList.add("no-webgl"); return; }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 0.3, 6.6);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); rim.position.set(-4, -2, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(-2, -3, 6); scene.add(fill);

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, flatShading: true });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), mat);
  gem.scale.set(1, 1.35, 1);
  scene.add(gem);

  const ringMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.035, 8, 120), ringMat);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.02, 8, 120), ringMat);
  ring1.rotation.x = 1.25; ring2.rotation.x = 1.4; ring2.rotation.y = 0.5;
  scene.add(ring1, ring2);

  // hexagon frame behind, like the logo outline
  const hex = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.05, 4, 6), ringMat);
  hex.rotation.z = Math.PI / 6; hex.position.z = -1.2;
  scene.add(hex);

  let cols = 0, rows = 0, cw = 0, ch = 0, rt = null, buf = null, dpr = 1;

  function resize() {
    const r = out.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    out.width = Math.round(r.width * dpr); out.height = Math.round(r.height * dpr);
    const cell = r.width < 420 ? 6 : 7;            // CSS px per glyph column
    cw = cell * dpr; ch = cell * 1.6 * dpr;
    cols = Math.floor(out.width / cw); rows = Math.floor(out.height / ch);
    rt?.dispose();
    rt = new THREE.WebGLRenderTarget(cols, rows);
    buf = new Uint8Array(cols * rows * 4);
    camera.aspect = (cols * cw) / (rows * ch);
    camera.updateProjectionMatrix();
    ctx.font = `500 ${Math.round(ch * 0.82)}px "Geist Mono", ui-monospace, monospace`;
    ctx.textBaseline = "top";
  }
  new ResizeObserver(resize).observe(out);
  resize();

  let tx = 0, ty = 0;
  window.addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - 0.5) * 0.6; ty = (e.clientY / innerHeight - 0.5) * 0.4; }, { passive: true });

  // cursor lens: glyphs under the pointer decode to hex and burn white
  const frame = out.closest(".hx-visual");
  const cross = frame?.querySelector(".hx-cross");
  let mx = -999, my = -999, hover = 0, hoverTarget = 0, spin = 0;
  frame?.addEventListener("pointermove", (e) => {
    const r = out.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    mx = (px * dpr) / cw; my = (py * dpr) / ch; hoverTarget = 1;
    if (cross) { cross.style.left = px + "px"; cross.style.top = py + "px"; }
    frame.style.setProperty("--rx", ((py / r.height - 0.5) * -6).toFixed(2) + "deg");
    frame.style.setProperty("--ry", ((px / r.width - 0.5) * 6).toFixed(2) + "deg");
  });
  frame?.addEventListener("pointerleave", () => {
    hoverTarget = 0;
    if (cross) { cross.style.left = ""; cross.style.top = ""; }
    frame.style.setProperty("--rx", "0deg"); frame.style.setProperty("--ry", "0deg");
  });

  const statusEl = document.querySelector("[data-status]");
  const t0 = performance.now();
  let last = 0, running = false, raf = 0, lastHit = -1;

  function draw(now) {
    if (running) raf = requestAnimationFrame(draw);
    if (now - last < 33 && running) return;   // ~30fps
    last = now;
    if (!rt) return;
    const t = (now - t0) / 1000;

    hover += (hoverTarget - hover) * 0.12;
    spin += 0.017 * (1 + hover * 2.5);          // spins up while hovered
    gem.rotation.y = spin; gem.rotation.x = Math.sin(t * 0.35) * 0.25;
    ring1.rotation.z = t * 0.35; ring2.rotation.z = -t * 0.25;
    hex.rotation.y = Math.sin(t * 0.3) * 0.2 + tx * 0.5;
    scene.rotation.y += (tx - scene.rotation.y) * 0.05;
    scene.rotation.x += (ty - scene.rotation.x) * 0.05;

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, cols, rows, buf);
    renderer.setRenderTarget(null);

    // scan band: sweeps top -> bottom every 4s
    const scanRow = ((t % 4) / 4) * (rows + 16) - 8;
    const cycle = Math.floor(t / 4);
    if (statusEl && cycle !== lastHit && scanRow > rows * 0.5) {
      lastHit = cycle;
      statusEl.textContent = "Exploitable";
      statusEl.parentElement.classList.remove("blink"); void statusEl.offsetWidth; statusEl.parentElement.classList.add("blink");
    }

    ctx.clearRect(0, 0, out.width, out.height);
    for (let y = 0; y < rows; y++) {
      const srcY = rows - 1 - y;               // GL rows are bottom-up
      const k = y / rows;
      const cr = A[0] + (B[0] - A[0]) * k, cg = A[1] + (B[1] - A[1]) * k, cb = A[2] + (B[2] - A[2]) * k;
      const band = Math.max(0, 1 - Math.abs(y - scanRow) / 3);
      for (let x = 0; x < cols; x++) {
        const i = (srcY * cols + x) * 4;
        const lum = (buf[i] * 0.3 + buf[i + 1] * 0.59 + buf[i + 2] * 0.11) / 255;
        let g;
        // cursor lens
        if (hover > 0.05) {
          const dx = x - mx, dy = (y - my) * 1.6, d = Math.sqrt(dx * dx + dy * dy);
          const R = 9;
          if (d < R) {
            const k = (1 - d / R) * hover;
            if (Math.random() < 0.35 + k * 0.5) {
              g = HEX[(Math.random() * 16) | 0];
              const w = Math.min(1, k * 1.4 + lum * 0.4);
              ctx.fillStyle = `rgba(${(cr + (255 - cr) * w)|0},${(cg + (255 - cg) * w)|0},${(cb + (255 - cb) * w)|0},${Math.min(1, 0.35 + k + lum)})`;
              ctx.fillText(g, x * cw, y * ch);
              continue;
            }
          }
        }
        if (lum < 0.04) {
          // faint background noise so the frame reads as a screen
          if (((x * 73856093) ^ (y * 19349663) ^ (cycle * 83492791)) % 97 !== 0 && band < 0.5) continue;
          g = band > 0.5 ? HEX[(x + y + cycle) & 15] : ".";
          ctx.fillStyle = `rgba(${cr|0},${cg|0},${cb|0},${0.18 + band * 0.5})`;
        } else {
          g = band > 0.3 ? HEX[(x * 7 + y * 3 + ((t * 20) | 0)) & 15] : RAMP[Math.min(RAMP.length - 1, (lum * RAMP.length) | 0)];
          const a = Math.min(1, 0.25 + lum * 1.1 + band * 0.6);
          const w = band * 0.7;                  // scan band pushes toward white
          ctx.fillStyle = `rgba(${(cr + (255 - cr) * w)|0},${(cg + (255 - cg) * w)|0},${(cb + (255 - cb) * w)|0},${a})`;
        }
        ctx.fillText(g, x * cw, y * ch);
      }
    }
  }

  function start() { if (running || reduced) return; running = true; raf = requestAnimationFrame(draw); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (reduced) { draw(performance.now()); return; }
  new IntersectionObserver((en) => (en[0].isIntersecting ? start() : stop()), { threshold: 0.05 }).observe(out);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  // fonts load after first paint; re-measure once they're ready
  document.fonts?.ready.then(resize);
}
