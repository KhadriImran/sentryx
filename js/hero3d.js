/* ==========================================================================
   SENTRYX hero scene (Three.js)
   The brand hexagon as a contract block. A scan ring sweeps through it; when
   it passes a finding, the finding lights up in its severity color and the
   matching row in the findings register flashes.
   - Pauses when off screen or tab hidden
   - prefers-reduced-motion: one static frame, all findings lit
   ========================================================================== */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const mount = document.querySelector("[data-hero3d]");
if (mount) init(mount);

function init(mount) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AMBER = new THREE.Color("#ffa61a");
  const INK = new THREE.Color("#8f8d85");
  const SEV = { critical: new THREE.Color("#ff3355"), high: new THREE.Color("#ff6a2b"), medium: new THREE.Color("#ffd166") };

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (_) { mount.classList.add("no-webgl"); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // bloom output is opaque, so paint the page color and feather the edges in CSS
  scene.background = new THREE.Color("#08090b");
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.4, 11.5);
  camera.lookAt(0, -0.2, 0);

  const rig = new THREE.Group();          // mouse parallax
  const block = new THREE.Group();        // slow rotation
  rig.add(block); scene.add(rig);
  block.rotation.x = 0.18;

  const R = 1.7, H = 2.6;

  /* ---------- hex prism shell ---------- */
  const shellGeo = new THREE.CylinderGeometry(R, R, H, 6, 1, true);
  const shell = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.CylinderGeometry(R, R, H, 6)),
    new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.85 })
  );
  block.add(shell);
  // faint glass faces
  block.add(new THREE.Mesh(shellGeo, new THREE.MeshBasicMaterial({ color: 0xffa61a, transparent: true, opacity: 0.025, side: THREE.DoubleSide, depthWrite: false })));

  /* ---------- storage-slot rings ---------- */
  const ringMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.22 });
  const hexRing = (r) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); }
    return new THREE.BufferGeometry().setFromPoints(pts);
  };
  for (let i = 1; i < 8; i++) {
    const ring = new THREE.Line(hexRing(R * 0.98), ringMat);
    ring.position.y = -H / 2 + (i / 8) * H;
    block.add(ring);
  }

  /* ---------- core (the logo diamond) ---------- */
  const core = new THREE.Group();
  core.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshBasicMaterial({ color: AMBER })));
  const coreCage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.7)), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.35 }));
  core.add(coreCage);
  block.add(core);

  /* ---------- code particles inside the block ---------- */
  const N = window.innerWidth < 600 ? 900 : 1400;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), base = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    // random point inside the hexagon (rejection sample on a disc)
    let x, z; do { x = (Math.random() * 2 - 1) * R; z = (Math.random() * 2 - 1) * R; } while (!inHex(x, z, R * 0.94));
    pos[i * 3] = x; pos[i * 3 + 1] = (Math.random() - 0.5) * H * 0.96; pos[i * 3 + 2] = z;
    base[i] = 0.18 + Math.random() * 0.22;
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = base[i];
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.032, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  block.add(particles);

  /* ---------- findings ---------- */
  const findings = [
    { id: "C-01", sev: "critical", p: new THREE.Vector3(0.75, 0.75, 0.55) },
    { id: "H-01", sev: "high", p: new THREE.Vector3(-0.85, -0.05, 0.35) },
    { id: "M-01", sev: "medium", p: new THREE.Vector3(0.35, -0.85, -0.75) }
  ].map((f) => {
    const g = new THREE.Group(); g.position.copy(f.p);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: SEV[f.sev], transparent: true, opacity: 0.15 }));
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.185, 32), new THREE.MeshBasicMaterial({ color: SEV[f.sev], transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    g.add(dot, halo); block.add(g);
    // a leader line from the finding out past the shell, like a redline callout
    const out = f.p.clone().setY(0).normalize().multiplyScalar(R + 0.75).setY(f.p.y + 0.25);
    const leader = new THREE.Line(new THREE.BufferGeometry().setFromPoints([f.p, out]), new THREE.LineBasicMaterial({ color: SEV[f.sev], transparent: true, opacity: 0 }));
    block.add(leader);
    // finding ID label at the end of the callout
    const label = makeLabel(f.id, "#" + SEV[f.sev].getHexString());
    label.position.copy(out).add(new THREE.Vector3(0, 0.14, 0));
    block.add(label);
    return { ...f, dot, halo, leader, label, lit: 0, hit: false };
  });

  /* ---------- scan ring ---------- */
  const scan = new THREE.Group();
  scan.add(new THREE.Line(hexRing(R * 1.04), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 1 })));
  const scanPlane = new THREE.Mesh(new THREE.CircleGeometry(R * 1.02, 6), new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false }));
  scanPlane.rotation.x = -Math.PI / 2; scanPlane.rotation.z = Math.PI / 6;
  scan.add(scanPlane);
  // afterglow: fading rings trailing above the scan line
  const trail = [0.07, 0.14, 0.22, 0.32].map((dy, i) => {
    const t = new THREE.Line(hexRing(R * 1.02), new THREE.LineBasicMaterial({ color: AMBER, transparent: true, opacity: 0.45 - i * 0.1 }));
    t.position.y = dy; scan.add(t); return t;
  });
  block.add(scan);

  /* ---------- outer orbit: a tilted ring with nodes, like a radar sweep ---------- */
  const orbit = new THREE.Group();
  const orbitPts = [];
  for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; orbitPts.push(new THREE.Vector3(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1)); }
  const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPts), new THREE.LineDashedMaterial({ color: INK, transparent: true, opacity: 0.35, dashSize: 0.08, gapSize: 0.1 }));
  orbitLine.computeLineDistances();
  orbit.add(orbitLine);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(i === 0 ? 0.07 : 0.04), new THREE.MeshBasicMaterial({ color: i === 0 ? AMBER : INK }));
    node.position.set(Math.cos(a) * 3.1, 0, Math.sin(a) * 3.1);
    orbit.add(node);
  }
  orbit.rotation.x = 0.32; orbit.rotation.z = -0.12;
  rig.add(orbit);

  /* ---------- ground grid (fades out) ---------- */
  const grid = new THREE.PolarGridHelper(4.2, 6, 6, 64, 0x2a2a2a, 0x1c1c1c);
  grid.position.y = -H / 2 - 0.9; grid.material.transparent = true; grid.material.opacity = 0.5;
  rig.add(grid);

  /* ---------- post: soft bloom ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.45, 0.35);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- sizing ---------- */
  const resize = () => {
    const w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.position.z = w < 520 ? 12 : 9.6;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(mount);
  resize();

  /* ---------- pointer parallax ---------- */
  let tx = 0, ty = 0;
  window.addEventListener("pointermove", (e) => { tx = (e.clientX / innerWidth - 0.5) * 0.35; ty = (e.clientY / innerHeight - 0.5) * 0.2; }, { passive: true });

  /* ---------- register sync ---------- */
  const rows = new Map([...document.querySelectorAll(".register-row[data-id]")].map((r) => [r.dataset.id, r]));
  const flash = (id) => { const r = rows.get(id); if (!r) return; r.classList.remove("is-hit"); void r.offsetWidth; r.classList.add("is-hit"); };

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  const CYCLE = 6;            // seconds per sweep (down then idle)
  let prevY = H / 2, running = false, raf = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    block.rotation.y = t * 0.12;
    orbit.rotation.y = -t * 0.18;
    core.rotation.y = -t * 0.6; core.rotation.x = Math.sin(t * 0.4) * 0.3;
    coreCage.rotation.y = t * 0.25;
    rig.rotation.y += (tx - rig.rotation.y) * 0.04;
    rig.rotation.x += (ty - rig.rotation.x) * 0.04;

    // scan: sweep top -> bottom over 70% of the cycle, then rest below
    const phase = (t % CYCLE) / CYCLE;
    const k = Math.min(phase / 0.7, 1);
    const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const y = H / 2 + 0.05 - ease * (H + 0.1);
    scan.position.y = y;
    scan.visible = k < 1;
    if (phase < 0.02) findings.forEach((f) => (f.hit = false));

    // particles brighten near the scan line
    const c = pGeo.attributes.color.array;
    for (let i = 0; i < N; i++) {
      const d = Math.abs(pos[i * 3 + 1] - y);
      const glow = scan.visible ? Math.max(0, 1 - d / 0.18) : 0;
      const b = base[i];
      c[i * 3] = b + glow * (1.0 - b);
      c[i * 3 + 1] = b + glow * (0.65 - b);
      c[i * 3 + 2] = b + glow * (0.1 - b);
    }
    pGeo.attributes.color.needsUpdate = true;

    // findings: triggered when the ring crosses them
    findings.forEach((f) => {
      if (!f.hit && scan.visible && prevY >= f.p.y && y < f.p.y) { f.hit = true; f.lit = 1; flash(f.id); }
      f.lit = Math.max(0.35, f.lit - dt * 0.25);
      const pulse = f.hit ? 0.5 + 0.5 * Math.sin(t * 4) : 0;
      f.dot.material.opacity = f.hit ? 1 : 0.15;
      f.dot.scale.setScalar(1 + (f.hit ? 0.25 * pulse : 0));
      f.halo.material.opacity = f.hit ? 0.25 + 0.55 * (1 - pulse) * f.lit : 0;
      f.halo.scale.setScalar(1 + pulse * 0.9);
      f.halo.lookAt(camera.position);
      f.leader.material.opacity = f.hit ? 0.7 * f.lit + 0.2 : 0;
      f.label.material.opacity = f.hit ? Math.min(1, 0.6 + f.lit) : 0;
    });
    prevY = y;

    composer.render();
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() { if (running || reduced) return; running = true; clock.getDelta(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }

  if (reduced) {
    // one composed still: all findings lit, scan parked mid-block
    findings.forEach((f) => { f.hit = true; f.lit = 1; });
    block.rotation.y = 0.5; scan.position.y = 0.2;
    frame();
    return;
  }

  new IntersectionObserver((en) => (en[0].isIntersecting ? start() : stop()), { threshold: 0.05 }).observe(mount);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  mount.classList.add("is-live");
}

function makeLabel(text, color) {
  const c = document.createElement("canvas"); c.width = 256; c.height = 96;
  const g = c.getContext("2d");
  g.font = "500 44px 'JetBrains Mono', ui-monospace, monospace";
  g.textBaseline = "middle";
  const w = g.measureText(text).width + 36;
  g.fillStyle = "rgba(8,9,11,0.85)"; g.strokeStyle = color; g.lineWidth = 3;
  g.beginPath(); g.roundRect(4, 14, w, 68, 10); g.fill(); g.stroke();
  g.fillStyle = color; g.fillText(text, 22, 49);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false }));
  s.scale.set(0.8, 0.3, 1);
  s.center.set(0.1, 0.5);
  return s;
}

function inHex(x, z, r) {
  // hexagon matching CylinderGeometry(…, 6): vertices on the z axis, flat sides at x = ±r·cos30°
  const ax = Math.abs(x), az = Math.abs(z), a = r * 0.866;
  return ax <= a && ax * 0.5 + az * 0.866 <= a;
}
