// Bean's World — the 3D meadow (a small, cozy toy diorama).
// Loaded only when the "3D" tab is opened. It reads the SAME world.json and the SAME mind (mind.js),
// so Bean is doing exactly what the storybook says he is doing.
//
// Adding a new place or built feature? Give it a model in buildPlaces() (search for "PLACE MODELS")
// and, if it is a built feature, add it to FEATURE_MODELS. Positions come from world.json `places`.
import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { stateAt, positionOnSegment, duskAmount } from './mind.js';

// ---------- layout: storybook x/y (0-1) -> ground plane ----------
const SX = 16, SZ = 14;               // storybook width/depth in 3D units
const RX = 9.6, RZ = 7.8;             // the island is a soft ellipse
const BEAN_H = 0.62;                  // Bean is small: about the height of the easel stool
const EYE_H = 1.0;                    // Explore: eye height of a small visitor
const toXZ = (p) => ({ x: (p.x - 0.5) * SX, z: (p.y - 0.58) * SZ });

const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const ell = (x, z) => Math.sqrt((x / RX) ** 2 + (z / RZ) ** 2);

// Soft, calm palette (matches the painted meadow)
const C = {
  grass: '#b4bd8c', grass2: '#c2c592', grassDeep: '#97a46f', soil: '#9c7a5c', soilDark: '#7d624b', earth: '#b89a78',
  cream: '#ece0c6', oat: '#d9c9a8', stone: '#c4bba8', stone2: '#ada592', moss: '#8e9d68', moss2: '#9aab72',
  door: '#7f957a', wood: '#a3815f', woodDark: '#866a50', bark: '#8b6f57', leaf: '#8ea271', leaf2: '#9db07d', leaf3: '#82966a',
  terracotta: '#c0826a', terracotta2: '#b07359', blue: '#9fb5bf', blueDeep: '#8aa3b0', lily: '#8fa877',
  rose: '#d8a59a', honey: '#d4b36f', lavender: '#a99bbb', white: '#f1ebdc', peach: '#e3b08f', snail: '#c9a27e', snailBody: '#cbbf9f',
};

// ---------- time of day palettes ----------
const PAL = {
  day:   { sky: '#dde3d6', hemiSky: '#f6efdc', hemiGround: '#a8a07c', hemiI: 1.75, sun: '#fff1da', sunI: 1.5, sunPos: [-7, 13, 9], bean: '#ffffff', fogNear: 34, fogFar: 70 },
  dusk:  { sky: '#d6bfc2', hemiSky: '#eccbbd', hemiGround: '#958a98', hemiI: 1.45, sun: '#f2b48e', sunI: 1.0, sunPos: [-11, 6, 4], bean: '#f1ddd2', fogNear: 30, fogFar: 64 },
  night: { sky: '#34405a', hemiSky: '#8ea0c8', hemiGround: '#4c566f', hemiI: 1.2, sun: '#c2cdeb', sunI: 0.55, sunPos: [7, 12, -4], bean: '#b9bfd2', fogNear: 28, fogFar: 60 },
};

export async function mount3D(api) {
  const root = api.root;
  const stage = root.querySelector('#stage3d');
  const world = api.world;
  // render-loop flags (declared early: textures may finish loading while the scene is still being built)
  let active = false, dirty = true, raf = 0;
  const failed = () => { stage.dataset.state = 'failed'; return { ok: false, setActive() {} }; };

  // ---------- renderer ----------
  const canvas = document.createElement('canvas');
  canvas.className = 'canvas3d';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('aria-label', "Pinto Bean's meadow in 3D");
  let renderer;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return failed();
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch (e) {
    return failed();
  }
  stage.prepend(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.autoClear = false;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const skyColor = new THREE.Color(PAL.day.sky);
  scene.fog = new THREE.Fog(PAL.day.sky, 34, 70);
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 200);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(PAL.day.hemiSky, PAL.day.hemiGround, PAL.day.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PAL.day.sun, PAL.day.sunI);
  sun.position.set(...PAL.day.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4;
  if ('intensity' in sun.shadow) sun.shadow.intensity = 0.55;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- helpers ----------
  const matCache = new Map();
  const mat = (hex, extra) => {
    const key = hex + (extra ? JSON.stringify(extra) : '');
    if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color: hex, ...extra }));
    return matCache.get(key);
  };
  const mesh = (geo, m, { cast = true, receive = true } = {}) => {
    const o = new THREE.Mesh(geo, typeof m === 'string' ? mat(m) : m);
    o.castShadow = cast; o.receiveShadow = receive;
    return o;
  };
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const radialTex = (inner, outer) => canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const rng = (() => { let a = 12345; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();

  // ---------- places from world.json ----------
  const P = {};
  for (const p of world.places || []) P[p.id] = toXZ(p);
  const fallback = (id, x, y) => { if (!P[id]) P[id] = toXZ({ x, y }); };
  fallback('home', 0.149, 0.434); fallback('tree', 0.366, 0.403); fallback('hill', 0.594, 0.211); fallback('pond', 0.655, 0.538);
  fallback('bakery', 0.876, 0.509); fallback('garden', 0.283, 0.85); fallback('easel', 0.526, 0.85); fallback('music', 0.83, 0.885);
  fallback('swing', 0.465, 0.385);

  // Where each model sits, relative to the spot where Bean stands in the storybook.
  const L = {
    cottage: { x: P.home.x - 0.1, z: P.home.z - 1.8 },
    trunk: { x: P.tree.x - 0.3, z: P.tree.z - 1.15 },
    hill: { x: P.hill.x + 0.4, z: P.hill.z - 0.65 },
    pond: { x: P.pond.x + 0.45, z: P.pond.z - 1.35, rx: 1.75, rz: 0.95 },
    bakery: { x: P.bakery.x + 0.95, z: P.bakery.z - 1.35 },
    garden: { x: P.garden.x - 1.75, z: P.garden.z - 0.45 },
    easel: { x: P.easel.x - 0.7, z: P.easel.z - 0.5 },
    music: { x: P.music.x + 0.45, z: P.music.z - 0.35 },
  };

  // ---------- ground height: soft hills, flat where things stand ----------
  const HILLS = [
    { x: L.hill.x, z: L.hill.z, h: 2.1, s: 2.1 },
    { x: -2.6, z: -6.4, h: 0.9, s: 1.7 },
    { x: 6.6, z: -5.2, h: 0.8, s: 1.6 },
    { x: -8.0, z: 0.8, h: 0.35, s: 1.4 },
    { x: 2.6, z: 6.4, h: 0.25, s: 1.7 },
    { x: -1.6, z: 1.2, h: 0.14, s: 1.6 },
  ];
  const FLAT = [
    { x: L.cottage.x, z: L.cottage.z, r: 2.4 }, { x: L.trunk.x, z: L.trunk.z, r: 1.8 }, { x: L.pond.x, z: L.pond.z, r: 2.6 },
    { x: L.bakery.x, z: L.bakery.z, r: 2.3 }, { x: L.garden.x, z: L.garden.z, r: 2.4 }, { x: L.easel.x, z: L.easel.z, r: 1.6 },
    { x: L.music.x, z: L.music.z, r: 2.0 }, { x: P.swing.x, z: P.swing.z, r: 1.2 },
  ];
  function groundY(x, z) {
    let h = 0;
    for (const k of HILLS) h += k.h * Math.exp(-((x - k.x) ** 2 + (z - k.z) ** 2) / (2 * k.s * k.s));
    let flat = 1;
    for (const f of FLAT) flat = Math.min(flat, smooth(f.r * 0.55, f.r, Math.hypot(x - f.x, z - f.z)));
    h *= 0.15 + 0.85 * flat;
    const r = ell(x, z);
    h *= 1 - smooth(0.78, 1.0, r);
    h -= 0.55 * smooth(0.88, 1.0, r) ** 1.6; // rounded edge
    return h;
  }

  // ---------- the island ----------
  {
    const NR = 46, NS = 144;
    const pos = [], col = [], idx = [];
    const cA = new THREE.Color(C.grass), cB = new THREE.Color(C.grass2), cD = new THREE.Color(C.grassDeep), tmp = new THREE.Color();
    for (let i = 0; i <= NR; i++) {
      const r = i / NR;
      for (let j = 0; j < NS; j++) {
        const a = (j / NS) * Math.PI * 2;
        const x = Math.cos(a) * RX * r, z = Math.sin(a) * RZ * r;
        pos.push(x, groundY(x, z), z);
        const n = 0.5 + 0.25 * Math.sin(x * 0.9 + Math.sin(z * 0.7)) + 0.25 * Math.sin(z * 1.3 - x * 0.4);
        tmp.copy(cA).lerp(cB, n * 0.75).lerp(cD, smooth(0.86, 1, r) * 0.6);
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (let i = 0; i < NR; i++) for (let j = 0; j < NS; j++) {
      const a = i * NS + j, b = i * NS + ((j + 1) % NS), c = (i + 1) * NS + j, d = (i + 1) * NS + ((j + 1) % NS);
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const top = mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }), { cast: false });
    scene.add(top);
    // soft earthy base under the grass, like a toy diorama
    const prof = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(1 - 0.18 * t * t, -0.5 - 1.0 * t)); }
    prof.push(new THREE.Vector2(0.7, -1.62), new THREE.Vector2(0.0, -1.7));
    const base = mesh(new THREE.LatheGeometry(prof, NS), C.earth, { cast: false });
    base.scale.set(RX, 1, RZ);
    scene.add(base);
    const rim = mesh(new THREE.TorusGeometry(1, 0.045, 8, NS), C.grassDeep, { cast: false });
    rim.rotation.x = Math.PI / 2; rim.scale.set(RX * 0.995, RZ * 0.995, 1); rim.position.y = -0.53;
    scene.add(rim);
  }

  const place = (o, x, z, yOff = 0) => { o.position.set(x, groundY(x, z) + yOff, z); scene.add(o); return o; };
  const blob = (r, color, sy = 1, detail = 1) => { const m = mesh(new THREE.IcosahedronGeometry(r, detail), color); m.scale.y = sy; return m; };

  // ======================= PLACE MODELS =======================
  // Each block builds one place from simple rounded shapes. New places go here too.

  // --- Bean's round cottage (back-left) ---
  const cottage = new THREE.Group();
  const windowGlass = new THREE.MeshLambertMaterial({ color: C.blueDeep, emissive: new THREE.Color('#ffcf8f'), emissiveIntensity: 0 });
  let chimneyTop;
  {
    const R = 1.5, H = 1.55;
    const body = mesh(new THREE.CylinderGeometry(R, R * 1.04, H, 40), C.cream);
    body.position.y = H / 2; cottage.add(body);
    const roof = mesh(new THREE.SphereGeometry(R * 1.2, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), C.moss);
    roof.scale.y = 0.72; roof.position.y = H - 0.05; cottage.add(roof);
    const lip = mesh(new THREE.TorusGeometry(R * 1.17, 0.13, 10, 40), C.moss2);
    lip.rotation.x = Math.PI / 2; lip.position.y = H - 0.02; cottage.add(lip);
    for (let i = 0; i < 7; i++) { // a few tiny flowers in the mossy roof
      const a = rng() * Math.PI * 2, rr = 0.5 + rng() * 1.0;
      const y = H - 0.05 + Math.sqrt(Math.max(0, 1 - (rr / (R * 1.2)) ** 2)) * R * 1.2 * 0.72;
      const f = blob(0.05, i % 3 ? C.white : C.rose, 1, 0); f.position.set(Math.cos(a) * rr, y + 0.02, Math.sin(a) * rr); cottage.add(f);
    }
    const chim = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.8, 14), C.stone);
    chim.position.set(-0.55, H + 0.75, -0.35); cottage.add(chim);
    chimneyTop = chim.position.clone().setY(H + 1.15);
    // round-top green door (faces the front)
    const ds = new THREE.Shape(); const dw = 0.36, dh = 0.72;
    ds.moveTo(-dw, 0); ds.lineTo(-dw, dh); ds.absarc(0, dh, dw, Math.PI, 0, true); ds.lineTo(dw, 0); ds.lineTo(-dw, 0);
    const door = mesh(new THREE.ExtrudeGeometry(ds, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 16 }), C.door);
    const da = 0.22;
    door.position.set(Math.sin(da) * (R - 0.02), 0.02, Math.cos(da) * (R - 0.02)); door.rotation.y = da; cottage.add(door);
    const frame = mesh(new THREE.TorusGeometry(dw + 0.02, 0.05, 8, 24, Math.PI), C.oat);
    frame.position.set(Math.sin(da) * (R + 0.06), 0.02 + dh, Math.cos(da) * (R + 0.06)); frame.rotation.y = da; cottage.add(frame);
    const knob = mesh(new THREE.SphereGeometry(0.04, 8, 6), C.honey);
    knob.position.set(Math.sin(da + 0.14) * (R + 0.1), 0.5, Math.cos(da + 0.14) * (R + 0.1)); cottage.add(knob);
    // round window (left of the door)
    const wa = -0.55;
    const glass = mesh(new THREE.CircleGeometry(0.3, 28), windowGlass, { cast: false });
    glass.position.set(Math.sin(wa) * (R + 0.02), 0.95, Math.cos(wa) * (R + 0.02)); glass.rotation.y = wa; cottage.add(glass);
    const wf = mesh(new THREE.TorusGeometry(0.31, 0.06, 8, 28), C.oat);
    wf.position.copy(glass.position); wf.rotation.y = wa; cottage.add(wf);
    const bar = mesh(new THREE.BoxGeometry(0.6, 0.035, 0.03), C.oat); bar.position.copy(glass.position); bar.rotation.y = wa; cottage.add(bar);
    const bar2 = mesh(new THREE.BoxGeometry(0.035, 0.6, 0.03), C.oat); bar2.position.copy(glass.position); bar2.rotation.y = wa; cottage.add(bar2);
    cottage.userData.windowPos = glass.position.clone();
    cottage.userData.windowAngle = wa;
    // flower pots by the door
    for (const [ang, c] of [[0.75, C.rose], [-0.95, C.white]]) {
      const pot = mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 12), C.terracotta);
      pot.position.set(Math.sin(ang) * (R + 0.25), 0.11, Math.cos(ang) * (R + 0.25)); cottage.add(pot);
      const fl = blob(0.16, C.leaf2, 0.8); fl.position.set(pot.position.x, 0.32, pot.position.z); cottage.add(fl);
      const fh = blob(0.06, c, 1, 0); fh.position.set(pot.position.x + 0.05, 0.42, pot.position.z + 0.06); cottage.add(fh);
    }
  }
  place(cottage, L.cottage.x, L.cottage.z, -0.04);
  cottage.rotation.y = 0.12;
  cottage.updateMatrixWorld(true);
  // stepping stones from the door
  for (let i = 0; i < 4; i++) {
    const s = mesh(new THREE.CylinderGeometry(0.22 - i * 0.01, 0.24, 0.06, 12), i % 2 ? C.stone : C.oat, { cast: false });
    s.scale.z = 0.75; place(s, P.home.x + 0.25 + i * 0.42, P.home.z + 0.35 + i * 0.38, 0.0);
  }

  // window glow (only at night when Bean is home)
  const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,214,150,0.9)', 'rgba(255,200,130,0)'), transparent: true, depthWrite: false, opacity: 0 }));
  glowSprite.scale.set(1.3, 1.3, 1);
  {
    const wp = cottage.localToWorld(cottage.userData.windowPos.clone());
    const out = new THREE.Vector3(Math.sin(cottage.userData.windowAngle + cottage.rotation.y), 0, Math.cos(cottage.userData.windowAngle + cottage.rotation.y)).multiplyScalar(0.15);
    glowSprite.position.copy(wp).add(out);
  }
  scene.add(glowSprite);

  // "z z" over the roof while Bean sleeps or naps
  await document.fonts?.load?.('italic 600 96px Fraunces').catch(() => {});
  const zTexDay = canvasTex(256, 128, (g) => zDraw(g, '#5c5043', 'rgba(245,238,223,0.85)'));
  const zTexNight = canvasTex(256, 128, (g) => zDraw(g, '#f2e7d2', 'rgba(30,36,52,0.45)'));
  function zDraw(g, fill, halo) {
    g.font = "italic 700 150px Fraunces, Georgia, serif"; g.textBaseline = 'alphabetic';
    g.shadowColor = halo; g.shadowBlur = 8; g.fillStyle = fill;
    g.fillText('z', 18, 122); g.font = "italic 700 104px Fraunces, Georgia, serif"; g.fillText('z', 138, 70);
  }
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexNight, transparent: true, depthWrite: false, fog: false }));
  zzz.scale.set(2.4, 1.2, 1); zzz.visible = false;
  zzz.position.copy(cottage.localToWorld(new THREE.Vector3(1.0, 3.75, 0.45)));
  scene.add(zzz);

  // --- the big tree (back-center-left) with a reading nook ---
  const tree = new THREE.Group();
  const BRANCH_Y = 3.05;
  {
    const trunk = mesh(new THREE.CylinderGeometry(0.42, 0.72, 3.4, 18), C.bark);
    trunk.position.y = 1.7; tree.add(trunk);
    for (let i = 0; i < 5; i++) { // chunky roots
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const r = blob(0.32, C.bark, 0.45); r.scale.x = 1.5; r.rotation.y = -a;
      r.position.set(Math.cos(a) * 0.65, 0.08, Math.sin(a) * 0.65); tree.add(r);
    }
    const canopy = [[0, 4.6, 0, 1.75], [-1.3, 4.1, 0.2, 1.3], [1.35, 4.2, 0.5, 1.35], [0.3, 4.0, 1.1, 1.2], [-0.4, 4.2, -1.0, 1.25], [0.6, 5.3, -0.2, 1.1], [2.15, 3.95, 0.75, 0.85]];
    canopy.forEach(([x, y, z, r], i) => { const b = blob(r, [C.leaf, C.leaf2, C.leaf3][i % 3], 0.82, 2); b.position.set(x, y, z); tree.add(b); });
  }
  place(tree, L.trunk.x, L.trunk.z, -0.05);
  // branch reaching right toward the swing
  const swingTop = new THREE.Vector3(P.swing.x, 0, P.swing.z);
  {
    const from = new THREE.Vector3(L.trunk.x + 0.25, groundY(L.trunk.x, L.trunk.z) + BRANCH_Y - 0.25, L.trunk.z);
    const to = new THREE.Vector3(P.swing.x + 0.55, groundY(L.trunk.x, L.trunk.z) + BRANCH_Y + 0.05, P.swing.z);
    const len = from.distanceTo(to);
    const br = mesh(new THREE.CylinderGeometry(0.11, 0.2, len, 10), C.bark);
    br.position.copy(from).add(to).multiplyScalar(0.5);
    br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    scene.add(br);
    swingTop.y = groundY(L.trunk.x, L.trunk.z) + BRANCH_Y - 0.08;
  }
  // reading nook: little bench + lantern + books
  {
    const nook = new THREE.Group();
    const seat = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.36), C.wood); seat.position.y = 0.34; nook.add(seat);
    for (const sx of [-0.36, 0.36]) { const leg = mesh(new THREE.BoxGeometry(0.07, 0.34, 0.3), C.woodDark); leg.position.set(sx, 0.17, 0); nook.add(leg); }
    const cushion = blob(0.17, C.oat, 0.45); cushion.scale.x = 1.6; cushion.position.set(-0.1, 0.43, 0); nook.add(cushion);
    const books = mesh(new THREE.BoxGeometry(0.22, 0.12, 0.16), C.terracotta2); books.position.set(0.68, 0.06, 0.1); nook.add(books);
    const book2 = mesh(new THREE.BoxGeometry(0.2, 0.06, 0.15), C.blueDeep); book2.position.set(0.68, 0.15, 0.1); nook.add(book2);
    place(nook, P.tree.x - 0.75, P.tree.z - 0.35);
    nook.rotation.y = 0.15;
    const lan = new THREE.Group();
    const lb = mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), C.woodDark); lb.position.y = 0.11; lan.add(lb);
    const lg = mesh(new THREE.BoxGeometry(0.11, 0.14, 0.17), C.honey); lg.position.y = 0.12; lan.add(lg);
    place(lan, P.tree.x - 1.4, P.tree.z - 0.25);
  }

  // --- the swing (a built feature: appears once Bean has finished building it) ---
  const swing = new THREE.Group();
  const PLANK_Y = 0.42;
  {
    const ropeLen = swingTop.y - (groundY(P.swing.x, P.swing.z) + PLANK_Y);
    for (const sx of [-0.27, 0.27]) {
      const rope = mesh(new THREE.CylinderGeometry(0.018, 0.018, ropeLen, 6), C.oat);
      rope.position.set(sx, -ropeLen / 2, 0); swing.add(rope);
    }
    const plank = mesh(new THREE.BoxGeometry(0.72, 0.06, 0.26), C.wood);
    plank.position.y = -ropeLen; swing.add(plank);
    swing.userData.seat = new THREE.Vector3(0, -ropeLen + 0.03, 0.02);
    swing.position.copy(swingTop);
    scene.add(swing);
  }
  const FEATURE_MODELS = { swing };

  // --- the stargazing hill (back-center-right): a little rock and a blanket at the top ---
  {
    const r = blob(0.28, C.stone, 0.55); place(r, P.hill.x + 0.7, P.hill.z - 0.3, 0.05);
  }

  // --- the pond (center-right) ---
  const pondY = groundY(L.pond.x, L.pond.z) + 0.03;
  {
    const water = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshLambertMaterial({ color: C.blue }), { cast: false });
    water.rotation.x = -Math.PI / 2; water.scale.set(L.pond.rx, L.pond.rz, 1);
    water.position.set(L.pond.x, pondY, L.pond.z); scene.add(water);
    const edge = mesh(new THREE.TorusGeometry(1, 0.06, 6, 48), C.oat, { cast: false });
    edge.rotation.x = -Math.PI / 2; edge.scale.set(L.pond.rx + 0.03, L.pond.rz + 0.03, 1); edge.position.set(L.pond.x, pondY - 0.01, L.pond.z); scene.add(edge);
    for (let i = 0; i < 13; i++) { // stones around
      const a = (i / 13) * Math.PI * 2 + rng() * 0.3;
      if (Math.sin(a) > 0.55 && Math.cos(a) < 0) continue; // leave a gap at the front-left where Bean stands
      const s = blob(0.12 + rng() * 0.1, i % 3 ? C.stone : C.stone2, 0.6, 0);
      s.position.set(L.pond.x + Math.cos(a) * (L.pond.rx + 0.18), pondY, L.pond.z + Math.sin(a) * (L.pond.rz + 0.16)); scene.add(s);
    }
    for (const [dx, dz, r] of [[-0.5, -0.2, 0.17], [0.3, 0.25, 0.14], [0.75, -0.3, 0.16], [-0.1, 0.45, 0.12], [1.0, 0.2, 0.11]]) {
      const pad = mesh(new THREE.CircleGeometry(r, 18, 0.3, Math.PI * 1.8), C.lily, { cast: false });
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = rng() * 6; pad.position.set(L.pond.x + dx, pondY + 0.012, L.pond.z + dz); scene.add(pad);
    }
    const lotus = blob(0.05, C.rose, 0.8, 0); lotus.position.set(L.pond.x + 0.3, pondY + 0.05, L.pond.z + 0.25); scene.add(lotus);
    for (let i = 0; i < 7; i++) { // soft rounded reed tufts at the back
      const a = Math.PI * (1.12 + i * 0.12);
      const g = new THREE.Group();
      for (let k = 0; k < 3; k++) { const h = 0.18 + rng() * 0.16; const c = mesh(new THREE.CapsuleGeometry(0.045, h, 3, 8), k % 2 ? C.leaf3 : C.leaf2); c.position.set((k - 1) * 0.08, h / 2 + 0.04, (rng() - 0.5) * 0.08); c.rotation.z = (k - 1) * 0.22; g.add(c); }
      g.position.set(L.pond.x + Math.cos(a) * (L.pond.rx + 0.32), pondY - 0.02, L.pond.z + Math.sin(a) * (L.pond.rz + 0.3)); scene.add(g);
    }
  }

  // --- the bakery (right) ---
  const BAKERY_ROT = -0.45;
  {
    const b = new THREE.Group();
    const W = 2.0, H = 1.55, D = 1.6;
    const body = mesh(new THREE.BoxGeometry(W, H, D), C.cream); body.position.y = H / 2; b.add(body);
    const roof = mesh(new THREE.ConeGeometry(1.0, 0.95, 4, 1), C.terracotta);
    roof.rotation.y = Math.PI / 4; roof.scale.set(W * 0.78, 1, D * 0.78); roof.position.y = H + 0.46; b.add(roof);
    const eave = mesh(new THREE.BoxGeometry(W + 0.24, 0.08, D + 0.24), C.terracotta2); eave.position.y = H + 0.02; b.add(eave);
    const chim = mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), C.stone); chim.position.set(0.5, H + 0.75, -0.3); b.add(chim);
    // window counter with loaves
    const opening = mesh(new THREE.BoxGeometry(1.0, 0.6, 0.04), C.woodDark); opening.position.set(-0.15, 0.95, D / 2 + 0.005); b.add(opening);
    const counter = mesh(new THREE.BoxGeometry(1.15, 0.07, 0.3), C.wood); counter.position.set(-0.15, 0.66, D / 2 + 0.12); b.add(counter);
    for (let i = 0; i < 4; i++) { const loaf = mesh(new THREE.CapsuleGeometry(0.07, 0.1, 4, 8), C.honey); loaf.rotation.z = Math.PI / 2; loaf.position.set(-0.5 + i * 0.23, 0.74, D / 2 + 0.13); b.add(loaf); }
    const shelf = mesh(new THREE.BoxGeometry(0.9, 0.04, 0.02), C.wood); shelf.position.set(-0.15, 1.05, D / 2 + 0.03); b.add(shelf);
    for (let i = 0; i < 3; i++) { const bun = blob(0.07, C.peach, 0.7, 1); bun.position.set(-0.45 + i * 0.3, 1.12, D / 2 + 0.04); b.add(bun); }
    // striped soft awning
    const stripe = canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#efe4cf' : '#c48a70'; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); } });
    const awn = mesh(new THREE.BoxGeometry(1.3, 0.04, 0.55), new THREE.MeshLambertMaterial({ map: stripe }));
    awn.position.set(-0.15, 1.36, D / 2 + 0.25); awn.rotation.x = 0.38; b.add(awn);
    const dr = mesh(new THREE.BoxGeometry(0.42, 0.85, 0.04), C.door); dr.position.set(0.68, 0.43, D / 2 + 0.01); b.add(dr);
    const stool = mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.32, 10), C.wood); stool.position.set(0.4, 0.16, D / 2 + 0.5); b.add(stool);
    place(b, L.bakery.x, L.bakery.z, -0.03);
    b.rotation.y = BAKERY_ROT;
  }

  // --- the vegetable garden (front-left) ---
  {
    const gd = new THREE.Group();
    for (const [bz, n] of [[-0.55, 6], [0.55, 6]]) {
      const bed = mesh(new THREE.BoxGeometry(2.7, 0.2, 0.8), C.soil); bed.position.set(0, 0.1, bz); gd.add(bed);
      const rim = mesh(new THREE.BoxGeometry(2.82, 0.12, 0.92), C.woodDark); rim.position.set(0, 0.06, bz); gd.add(rim);
      for (let i = 0; i < n; i++) {
        const lettuce = blob(0.2 + (i % 2) * 0.03, i % 3 === 1 ? C.leaf3 : C.leaf2, 0.7, 1);
        lettuce.position.set(-1.1 + i * 0.44, 0.3, bz + (i % 2 ? 0.1 : -0.1)); gd.add(lettuce);
      }
    }
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.ConeGeometry(0.05, 0.16, 6), C.terracotta); c.rotation.x = Math.PI; c.position.set(-1.0 + i * 0.6, 0.27, 0.0); gd.add(c); }
    // little wooden fence around the back and left
    const posts = [];
    for (let i = 0; i <= 6; i++) posts.push([-1.7 + i * 0.6, -1.25]);
    for (let i = 1; i <= 4; i++) posts.push([-1.7, -1.25 + i * 0.6]);
    for (let i = 0; i <= 2; i++) posts.push([1.9, -1.25 + i * 0.6]);
    for (const [x, z] of posts) { const p = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 6), C.wood); p.position.set(x, 0.3, z); gd.add(p); }
    const rail = (x1, z1, x2, z2, y) => { const len = Math.hypot(x2 - x1, z2 - z1); const r = mesh(new THREE.BoxGeometry(len, 0.04, 0.04), C.wood); r.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); r.rotation.y = -Math.atan2(z2 - z1, x2 - x1); gd.add(r); };
    for (const y of [0.22, 0.45]) { rail(-1.7, -1.25, 1.9, -1.25, y); rail(-1.7, -1.25, -1.7, 1.15, y); rail(1.9, -1.25, 1.9, -0.05, y); }
    // watering can
    const can = mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.26, 12), '#a7b1b0'); can.position.set(1.55, 0.13, 1.1); gd.add(can);
    const spout = mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), '#a7b1b0'); spout.position.set(1.75, 0.2, 1.1); spout.rotation.z = -0.9; gd.add(spout);
    place(gd, L.garden.x, L.garden.z, 0);
    gd.rotation.y = 0.05;
  }

  // --- the easel, stool and paint box (front-center) ---
  {
    const e = new THREE.Group();
    const leg = (x, z, rx, rz, h) => { const l = mesh(new THREE.BoxGeometry(0.06, h, 0.06), C.wood); l.position.set(x, h / 2 - 0.03, z); l.rotation.set(rx, 0, rz); e.add(l); };
    leg(-0.32, 0, 0.0, -0.12, 1.55); leg(0.32, 0, 0.0, 0.12, 1.55); leg(0, -0.35, 0.33, 0, 1.5);
    const ledge = mesh(new THREE.BoxGeometry(0.85, 0.05, 0.14), C.wood); ledge.position.set(0, 0.62, 0.05); e.add(ledge);
    // the canvas shows Bean's latest painting
    const latest = (world.paintings || []).slice(-1)[0];
    const cmat = new THREE.MeshLambertMaterial({ color: '#f1e8d6' });
    if (latest?.image) new THREE.TextureLoader().load(latest.image, (t) => { t.colorSpace = THREE.SRGBColorSpace; cmat.map = t; cmat.color.set('#ffffff'); cmat.needsUpdate = true; requestRender(); });
    const cv = mesh(new THREE.BoxGeometry(0.78, 0.66, 0.04), [mat('#efe5d2'), mat('#efe5d2'), mat('#efe5d2'), mat('#efe5d2'), cmat, mat('#e3d8c2')]);
    cv.position.set(0, 1.0, 0.07); cv.rotation.x = -0.08; e.add(cv);
    place(e, L.easel.x, L.easel.z, 0);
    e.rotation.y = 0.15;
    const st = new THREE.Group();
    const seat = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14), C.wood); seat.position.y = 0.52; st.add(seat);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; const l = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 6), C.woodDark); l.position.set(Math.cos(a) * 0.15, 0.26, Math.sin(a) * 0.15); st.add(l); }
    const box = mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), C.woodDark); box.position.y = 0.61; st.add(box);
    ['#c48a70', '#9fb5bf', '#d4b36f', '#8ea271'].forEach((c, i) => { const d = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 10), c, { cast: false }); d.position.set(-0.11 + i * 0.075, 0.67, 0.03); st.add(d); });
    const jar = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 10), '#b9c6c9'); jar.position.set(0.11, 0.72, -0.05); st.add(jar);
    for (const dx of [-0.02, 0.02]) { const br = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 5), C.woodDark); br.position.set(0.11 + dx, 0.82, -0.05); br.rotation.z = dx * 6; st.add(br); }
    place(st, L.easel.x - 0.8, L.easel.z + 0.15, 0);
    for (const [dx, dz] of [[0.55, 0.45], [0.8, 0.2]]) { const s = blob(0.13, C.stone, 0.55, 0); place(s, L.easel.x + dx, L.easel.z + dz, 0.02); }
  }

  // --- the music corner: striped awning, rug, xylophone, cushion (front-right) ---
  {
    const m = new THREE.Group();
    const W = 2.1, D = 1.5, H = 1.55;
    for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) {
      const p = mesh(new THREE.CylinderGeometry(0.05, 0.06, H, 7), C.wood); p.position.set(x, H / 2, z); m.add(p);
    }
    const stripes = canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? '#eee6d4' : '#a7bac2'; g.fillRect((i * w) / 10, 0, w / 10 + 1, h); } });
    const cg = new THREE.PlaneGeometry(W + 0.3, D + 0.2, 12, 6);
    const pa = cg.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); pa.setZ(i, -0.18 * Math.cos((y / (D + 0.2)) * Math.PI)); }
    cg.computeVertexNormals();
    const canopy = mesh(cg, new THREE.MeshLambertMaterial({ map: stripes, side: THREE.DoubleSide }));
    canopy.rotation.x = -Math.PI / 2; canopy.position.y = H + 0.05; m.add(canopy);
    const val = canvasTex(256, 32, (g, w, h) => { g.fillStyle = '#a7bac2'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc((i + 0.5) * w / 10, 0, w / 20, 0, Math.PI); g.fill(); } });
    const vm = new THREE.MeshLambertMaterial({ map: val, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    for (const z of [-D / 2 - 0.1, D / 2 + 0.1]) { const v = mesh(new THREE.PlaneGeometry(W + 0.3, 0.18), vm, { cast: false }); v.position.set(0, H - 0.05, z); m.add(v); }
    const rugTex = canvasTex(256, 192, (g, w, h) => {
      g.fillStyle = '#c4876e'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8d5bb'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
      g.strokeStyle = '#9fb5bf'; g.lineWidth = 4; g.strokeRect(30, 30, w - 60, h - 60);
      g.fillStyle = '#e8d5bb'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(60 + i * 34, h / 2, 6, 0, Math.PI * 2); g.fill(); }
    });
    const rug = mesh(new THREE.BoxGeometry(1.7, 0.03, 1.2), [mat(C.terracotta2), mat(C.terracotta2), new THREE.MeshLambertMaterial({ map: rugTex }), mat(C.terracotta2), mat(C.terracotta2), mat(C.terracotta2)], { cast: false });
    rug.position.y = 0.02; m.add(rug);
    const xb = mesh(new THREE.BoxGeometry(0.85, 0.08, 0.36), C.woodDark); xb.position.set(-0.05, 0.08, -0.05); m.add(xb);
    ['#9fb5bf', '#8ea271', '#d4b36f', '#c48a70', '#c99aa3', '#a99bbb'].forEach((c, i) => {
      const bar = mesh(new THREE.BoxGeometry(0.1, 0.035, 0.34 - i * 0.03), c); bar.position.set(-0.32 + i * 0.13, 0.14, -0.05); m.add(bar);
    });
    for (const dx of [-0.15, 0.1]) { const mal = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), C.wood); mal.rotation.z = Math.PI / 2; mal.rotation.y = dx * 2; mal.position.set(dx, 0.06, 0.28); m.add(mal); const hd = blob(0.035, C.honey, 1, 0); hd.position.set(dx + 0.17, 0.06, 0.28); m.add(hd); }
    const cush = blob(0.3, '#a8b8bd', 0.45, 2); cush.scale.x = 1.25; cush.position.set(0.55, 0.13, -0.3); m.add(cush);
    const basket = mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.18, 10), C.oat); basket.position.set(-W / 2, 1.05, -D / 2 + 0.05); m.add(basket);
    place(m, L.music.x, L.music.z, 0);
    m.rotation.y = -0.08;
  }

  // --- soft background trees and bushes around the edge ---
  for (const [x, z, s] of [[-8.0, -3.0, 1.0], [-6.6, -5.6, 0.85], [4.6, -6.6, 0.9], [8.4, -1.0, 0.8], [-8.6, 2.6, 0.7], [8.0, 3.6, 0.65]]) {
    const t = new THREE.Group();
    const tr = mesh(new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.0 * s, 8), C.bark); tr.position.y = 0.5 * s; t.add(tr);
    const cp = blob(0.85 * s, [C.leaf3, C.leaf, C.leaf2][Math.floor(rng() * 3)], 0.95, 1); cp.position.y = 1.45 * s; t.add(cp);
    place(t, x, z, -0.05);
  }
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2, r = 0.8 + rng() * 0.08;
    const x = Math.cos(a) * RX * r, z = Math.sin(a) * RZ * r;
    if (z > 3 && Math.abs(x) < 4) continue; // keep the front open
    const b = blob(0.3 + rng() * 0.25, rng() > 0.5 ? C.leaf2 : C.leaf3, 0.7, 1); place(b, x, z, 0.05);
  }

  // --- flowers, rocks and snails ---
  {
    const avoid = [...Object.values(P), ...FLAT];
    const ok = (x, z) => ell(x, z) < 0.86 && avoid.every((p) => Math.hypot(x - p.x, z - p.z) > (p.r ? p.r * 0.8 : 0.7))
      && (((x - L.pond.x) / (L.pond.rx + 0.3)) ** 2 + ((z - L.pond.z) / (L.pond.rz + 0.3)) ** 2 > 1);
    const colors = [C.white, C.white, C.lavender, C.peach, C.rose, C.honey];
    const geo = new THREE.IcosahedronGeometry(0.05, 1);
    const N = 150;
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), N);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let n = 0, tries = 0;
    while (n < N && tries < 4000) {
      tries++;
      const cx = (rng() - 0.5) * RX * 2, cz = (rng() - 0.5) * RZ * 2;
      if (!ok(cx, cz)) continue;
      const c = colors[Math.floor(rng() * colors.length)];
      for (let k = 0; k < 3 && n < N; k++) {
        const x = cx + (rng() - 0.5) * 0.5, z = cz + (rng() - 0.5) * 0.5;
        m4.makeTranslation(x, groundY(x, z) + 0.06, z); inst.setMatrixAt(n, m4); inst.setColorAt(n, col.set(c)); n++;
      }
    }
    inst.count = n; inst.receiveShadow = true;
    scene.add(inst);
    for (let i = 0; i < 9; i++) {
      let x, z, t = 0; do { x = (rng() - 0.5) * RX * 1.8; z = (rng() - 0.5) * RZ * 1.8; t++; } while (!ok(x, z) && t < 200);
      const s = blob(0.12 + rng() * 0.16, rng() > 0.5 ? C.stone : C.stone2, 0.55, 0); s.rotation.y = rng() * 6; place(s, x, z, 0.02);
    }
    const snail = (x, z, rot) => {
      const g = new THREE.Group();
      const body = mesh(new THREE.CapsuleGeometry(0.035, 0.16, 4, 8), C.snailBody); body.rotation.z = Math.PI / 2; body.position.y = 0.035; g.add(body);
      const shell = mesh(new THREE.TorusGeometry(0.06, 0.04, 8, 16), C.snail); shell.position.set(-0.02, 0.1, 0); g.add(shell);
      const core = blob(0.05, '#b98e6b', 1, 1); core.position.set(-0.02, 0.1, 0); core.scale.z = 0.8; g.add(core);
      for (const dz of [-0.015, 0.015]) { const ant = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 4), C.snailBody); ant.position.set(0.12, 0.09, dz); ant.rotation.z = -0.4; g.add(ant); }
      g.rotation.y = rot; place(g, x, z, 0);
    };
    snail(L.garden.x + 1.2, L.garden.z + 1.35, 0.4);
    snail(L.easel.x + 2.2, L.easel.z + 0.55, -2.4);
    snail(L.music.x - 0.4, L.music.z + 1.25, 2.8);
  }

  // ---------- night sky: a soft moon and a few dim stars ----------
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(246,238,214,1)'); gr.addColorStop(0.32, 'rgba(240,232,208,1)'); gr.addColorStop(0.42, 'rgba(240,232,208,0.18)'); gr.addColorStop(1, 'rgba(240,232,208,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }), transparent: true, depthWrite: false, fog: false, opacity: 0 }));
  // The sky is a calm painted backdrop drawn behind the diorama (it doesn't swing around when you look about).
  const skyScene = new THREE.Scene();
  const skyCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  moon.scale.set(0.34, 0.34, 1); skyScene.add(moon);
  const starSeeds = Array.from({ length: 34 }, () => [rng() * 2 - 1, 0.25 + rng() * 0.72]);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(starSeeds.length * 3), 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#efe6cf', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  skyScene.add(stars);
  function layoutSky(aspect) {
    skyCam.left = -aspect; skyCam.right = aspect; skyCam.updateProjectionMatrix();
    moon.position.set(aspect * 0.78, 0.7, 0);
    const pa = starGeo.attributes.position;
    starSeeds.forEach(([x, y], i) => pa.setXYZ(i, x * aspect, y, 0));
    pa.needsUpdate = true;
  }

  // ---------- Bean: the exact painted art, as a camera-facing sprite ----------
  const texLoader = new THREE.TextureLoader();
  const loadTex = (url) => new Promise((res) => texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t); }, undefined, () => res(null)));
  const [texOpen, texClosed] = await Promise.all([loadTex('assets/bean-open.webp?v=3'), loadTex('assets/bean-closed.webp?v=3')]);
  const beanMat = new THREE.SpriteMaterial({ map: texOpen, transparent: true, alphaTest: 0.35, fog: false });
  const bean = new THREE.Sprite(beanMat);
  bean.center.set(0.5, 0.015);
  const BEAN_W = BEAN_H * (394 / 500);
  bean.scale.set(BEAN_W, BEAN_H, 1);
  bean.renderOrder = 2;
  scene.add(bean);
  const beanShadow = new THREE.Mesh(new THREE.CircleGeometry(0.26, 24), new THREE.MeshBasicMaterial({ map: radialTex('rgba(50,42,28,0.55)', 'rgba(50,42,28,0)'), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  beanShadow.rotation.x = -Math.PI / 2; beanShadow.scale.set(1, 0.7, 1);
  scene.add(beanShadow);

  // ---------- collisions (Explore visitor + keeping Bean out of the pond/walls) ----------
  const OBST = [
    { x: L.cottage.x, z: L.cottage.z, r: 1.62 },
    { x: L.bakery.x, z: L.bakery.z, r: 1.3 },
    { x: L.trunk.x, z: L.trunk.z, r: 0.8 },
    { x: L.easel.x, z: L.easel.z, r: 0.45 },
    { x: L.easel.x - 0.8, z: L.easel.z + 0.15, r: 0.3 },
    { x: L.music.x - 0.05, z: L.music.z - 0.05, r: 0.5 },
  ];
  const GARDEN_BOX = { x: L.garden.x + 0.1, z: L.garden.z - 0.05, hx: 1.85, hz: 1.3 };
  function pushOut(p, rad, { garden = true } = {}) {
    for (const o of OBST) {
      const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), min = o.r + rad;
      if (d < min) { const k = d > 1e-4 ? min / d : 1; p.x = o.x + dx * k; p.z = o.z + (d > 1e-4 ? dz * k : min); }
    }
    { // pond (ellipse)
      const ax = L.pond.rx + rad + 0.1, az = L.pond.rz + rad + 0.1;
      const dx = p.x - L.pond.x, dz = p.z - L.pond.z, e = Math.sqrt((dx / ax) ** 2 + (dz / az) ** 2);
      if (e < 1) { const k = e > 1e-4 ? 1 / e : 1; p.x = L.pond.x + dx * k; p.z = L.pond.z + (e > 1e-4 ? dz * k : az); }
    }
    if (garden) { // garden (box)
      const g = GARDEN_BOX, dx = p.x - g.x, dz = p.z - g.z, ox = g.hx + rad - Math.abs(dx), oz = g.hz + rad - Math.abs(dz);
      if (ox > 0 && oz > 0) { if (ox < oz) p.x += Math.sign(dx || 1) * ox; else p.z += Math.sign(dz || 1) * oz; }
    }
    { // soft island edge
      const e = ell(p.x, p.z), lim = 0.86;
      if (e > lim) { p.x *= lim / e; p.z *= lim / e; }
    }
    return p;
  }

  // ======================= live state =======================
  const still = () => api.isStill();
  let state = null;
  let lastCaption = '';
  const look = { cur: null, target: null };
  const beanPos = new THREE.Vector3(P.home.x, 0, P.home.z);
  let beanVisible = true, beanInside = false, onSwing = false;
  let skyNight = 0;

  function lerpPal(a, b, k) {
    const o = {};
    for (const key of Object.keys(a)) {
      const va = a[key], vb = b[key];
      if (typeof va === 'number') o[key] = va + (vb - va) * k;
      else if (Array.isArray(va)) o[key] = va.map((v, i) => v + (vb[i] - v) * k);
      else o[key] = new THREE.Color(va).lerp(new THREE.Color(vb), k);
    }
    return o;
  }
  // dusk = 0..1 from mind.js; night depth = was it already dusk a while ago (and still dusk a while from now)?
  function lightTarget(clock) {
    const d = duskAmount(clock);
    const n = Math.min(duskAmount({ ...clock, minutes: clock.minutes - 75 }), duskAmount({ ...clock, minutes: clock.minutes + 75 }));
    return { pal: lerpPal(lerpPal(PAL.day, PAL.dusk, d), PAL.night, n), night: Math.max(n, d > 0.5 ? (d - 0.5) * 2 * 0.6 : 0), dusk: d };
  }
  function applyLook(L2) {
    skyColor.copy(L2.pal.sky);
    scene.fog.color.copy(L2.pal.sky); scene.fog.near = L2.pal.fogNear; scene.fog.far = L2.pal.fogFar;
    hemi.color.copy(L2.pal.hemiSky); hemi.groundColor.copy(L2.pal.hemiGround); hemi.intensity = L2.pal.hemiI;
    sun.color.copy(L2.pal.sun); sun.intensity = L2.pal.sunI; sun.position.set(...L2.pal.sunPos);
    beanMat.color.copy(L2.pal.bean);
    moon.material.opacity = Math.min(1, L2.night * 1.1) * 0.9;
    stars.material.opacity = L2.night * 0.55;
    skyNight = L2.night;
  }
  function blendLook(a, b, k) {
    return { pal: lerpPal(a.pal, b.pal, k), night: a.night + (b.night - a.night) * k, dusk: a.dusk + (b.dusk - a.dusk) * k };
  }
  const copyLook = (x) => ({ pal: lerpPal(x.pal, x.pal, 0), night: x.night, dusk: x.dusk });

  function isInside(s) { return !!s && (s.sleeping || (s.activity?.place === 'home' && !s.walking)); }
  function featureBuilt(f, clock, s) {
    let built = clock.date > f.built_on;
    if (clock.date === f.built_on) {
      const segs = s.plan.segments.filter((g) => g.activity.id === f.built_by_activity);
      built = segs.length ? clock.minutes >= segs[segs.length - 1].end : clock.date >= f.built_on;
    }
    return built;
  }

  // Once a second: what is Bean doing? (same mind, same clock as the storybook)
  function think() {
    const clock = api.nowClock();
    const s = stateAt(world, clock);
    state = s;
    look.target = lightTarget(clock);
    if (!look.cur || still()) look.cur = copyLook(look.target);
    for (const f of world.features || []) {
      const m = FEATURE_MODELS[f.id];
      if (m) { const b = featureBuilt(f, clock, s); if (m.visible !== b) { m.visible = b; dirty = true; } }
    }
    beanInside = isInside(s);
    const dozing = s.sleeping || (beanInside && s.activity?.id === 'nap_in_bed');
    if (zzz.visible !== dozing) { zzz.visible = dozing; dirty = true; }
    if (s.caption !== lastCaption) {
      lastCaption = s.caption;
      canvas.setAttribute('aria-label', `Pinto Bean's meadow in 3D. ${s.caption}`);
      dirty = true;
    }
    updateBean(clock);
  }

  function updateBean(clock = api.nowClock()) {
    const s = state; if (!s) return;
    let x = s.position.x, y = s.position.y;
    let walking = false;
    if (!s.sleeping && s.segment) {
      if (still()) { x = s.segment.place.x; y = s.segment.place.y; }
      else { const p = positionOnSegment(s.segment, clock.minutes); x = p.x; y = p.y; walking = p.walking; }
    }
    const w = toXZ({ x, y });
    onSwing = !!(s.activity?.id === 'swing_gently' && !walking && swing.visible);
    if (!onSwing && !beanInside) pushOut(w, 0.16, { garden: false });
    beanPos.set(w.x, groundY(w.x, w.z), w.z);
    beanVisible = !beanInside;
    bean.userData.walking = walking;
  }

  // ---------- camera: overview (orbit) and Explore (walk) ----------
  const controls = new OrbitControls(camera, canvas);
  Object.assign(controls, {
    enableDamping: true, dampingFactor: 0.07, rotateSpeed: 0.35, zoomSpeed: 0.5, enablePan: false,
    minPolarAngle: 0.38, maxPolarAngle: 1.22, minDistance: 5, maxDistance: 34,
    minAzimuthAngle: -1.35, maxAzimuthAngle: 1.35,
  });
  controls.addEventListener('change', () => { dirty = true; });
  const FOV_OVERVIEW = 34, FOV_EXPLORE = 52;
  const setFov = (f) => { if (f && camera.fov !== f) { camera.fov = f; camera.updateProjectionMatrix(); } };
  const HOME_TARGET = new THREE.Vector3(0.2, 1.0, 0.9);
  function defaultDistance() {
    const a = camera.aspect || 1.6;
    return 25.5 * Math.max(1, Math.pow(1.7 / a, 0.55));
  }
  function overviewPose() {
    const d = defaultDistance(), polar = 0.92;
    return { pos: HOME_TARGET.clone().add(new THREE.Vector3(0, Math.cos(polar) * d, Math.sin(polar) * d)), target: HOME_TARGET.clone(), fov: FOV_OVERVIEW };
  }

  let mode = 'overview'; // 'overview' | 'explore'
  let follow = false;
  let flight = null;      // {from, to, fromT, toT, t, dur, then}
  const lookAtNow = new THREE.Vector3();
  const visitor = { x: 0, z: 6.2, yaw: 0, pitch: -0.1, v: 0, turnV: 0, yawGoal: null };
  const input = { fwd: 0, turn: 0, keys: new Set(), pad: new Set() };

  function visitorPose() {
    const y = groundY(visitor.x, visitor.z) + EYE_H;
    const pos = new THREE.Vector3(visitor.x, y, visitor.z);
    const dir = new THREE.Vector3(-Math.sin(visitor.yaw) * Math.cos(visitor.pitch), Math.sin(visitor.pitch), -Math.cos(visitor.yaw) * Math.cos(visitor.pitch));
    return { pos, target: pos.clone().add(dir.multiplyScalar(4)), fov: FOV_EXPLORE };
  }
  function currentLookTarget() {
    if (mode === 'explore') return visitorPose().target;
    return controls.target.clone();
  }
  function flyTo(to, dur = 1.6, then) {
    const from = { pos: camera.position.clone(), target: flight ? lookAtNow.clone() : currentLookTarget(), fov: camera.fov };
    if (still() || dur <= 0) { setFov(to.fov); camera.position.copy(to.pos); camera.lookAt(to.target); lookAtNow.copy(to.target); flight = null; then && then(); requestRender(); return; }
    flight = { from, to, t: 0, dur, then };
    requestRender();
  }
  const easeInOut = (t) => t * t * (3 - 2 * t);

  function setMode(next) {
    if (next === mode) return;
    mode = next;
    input.keys.clear(); input.pad.clear(); visitor.v = 0; visitor.turnV = 0; visitor.yawGoal = null;
    if (mode === 'explore') {
      follow = false;
      controls.enabled = false;
      // start at the front of the meadow, looking in, a few steps from the middle
      visitor.x = 0.8; visitor.z = 6.0; visitor.yaw = 0; visitor.pitch = -0.08;
      pushOut(visitor, 0.35);
      flyTo(visitorPose(), 1.8);
      showMsg('Walk with the arrows. Drag to look around.', 6000);
    } else {
      const pose = overviewPose();
      flyTo(pose, 1.8, () => { controls.target.copy(pose.target); controls.enabled = true; controls.update(); });
      showMsg('', 0);
    }
    syncButtons();
  }

  // ---------- messages over the canvas (Where's Bean, near Bean) ----------
  const msgEl = root.querySelector('#explore-msg');
  let tempMsg = '', tempUntil = 0, shownMsg = null;
  function showMsg(text, ms) { tempMsg = text; tempUntil = text ? performance.now() + ms : 0; refreshMsg(); wake(); }
  function nearBean() {
    if (mode !== 'explore' || !beanVisible) return false;
    return Math.hypot(visitor.x - beanPos.x, visitor.z - beanPos.z) < 2.8;
  }
  function refreshMsg() {
    const now = performance.now();
    let text = '';
    if (tempMsg && now < tempUntil) text = tempMsg;
    else if (nearBean() && state) text = state.caption;
    if (text !== shownMsg) {
      shownMsg = text;
      if (text) msgEl.textContent = text;
      msgEl.classList.toggle('is-on', !!text);
    }
  }

  // ---------- Where's Bean? ----------
  function findBean() {
    if (!state) return;
    if (beanInside) {
      showMsg(state.sleeping || state.activity?.id === 'nap_in_bed' ? 'Pinto Bean is inside his house, resting.' : 'Pinto Bean is inside his house.', 6000);
      requestRender();
      return;
    }
    const bx = onSwing ? swing.position.x : beanPos.x, bz = onSwing ? swing.position.z : beanPos.z;
    if (mode === 'explore') {
      const yaw = Math.atan2(-(bx - visitor.x), -(bz - visitor.z));
      const by = (onSwing ? bean.position.y : beanPos.y) + BEAN_H * 0.5;
      const dist = Math.max(0.5, Math.hypot(bx - visitor.x, bz - visitor.z));
      visitor.pitch = Math.max(-0.45, Math.min(0.3, Math.atan2(by - (groundY(visitor.x, visitor.z) + EYE_H), dist) + 0.06));
      if (still()) { visitor.yaw = yaw; visitor.yawGoal = null; }
      else { let d = yaw - visitor.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); visitor.yawGoal = visitor.yaw + d; }
      showMsg(`There he is. ${state.caption}`, 6000);
    } else {
      follow = false; syncButtons();
      const target = new THREE.Vector3(bx, beanPos.y + 0.4, bz);
      const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(9);
      const pos = target.clone().add(offset);
      pos.y = Math.max(pos.y, target.y + 3);
      controls.enabled = false;
      flyTo({ pos, target, fov: FOV_OVERVIEW }, 2.2, () => { controls.target.copy(target); controls.enabled = true; controls.update(); });
    }
    requestRender();
  }

  // ---------- buttons ----------
  const exploreBtn = root.querySelector('#explore-btn');
  const followBtn = root.querySelector('#follow-btn');
  const resetBtn = root.querySelector('#reset-btn');
  const findBtn = root.querySelector('#find-btn');
  const pad = root.querySelector('#walk-pad');
  function syncButtons() {
    const ex = mode === 'explore';
    exploreBtn.setAttribute('aria-pressed', String(ex));
    root.querySelector('#explore-label').innerHTML = ex ? '<span class="long">Back to overview</span><span class="short">Overview</span>' : 'Explore';
    followBtn.setAttribute('aria-pressed', String(follow));
    followBtn.hidden = ex; resetBtn.hidden = ex;
    pad.hidden = !ex;
    stage.classList.toggle('is-exploring', ex);
  }
  exploreBtn.addEventListener('click', () => setMode(mode === 'explore' ? 'overview' : 'explore'));
  followBtn.addEventListener('click', () => { follow = !follow; syncButtons(); requestRender(); });
  resetBtn.addEventListener('click', () => {
    follow = false; syncButtons();
    const pose = overviewPose();
    controls.enabled = false;
    flyTo(pose, 1.8, () => { controls.target.copy(pose.target); controls.enabled = true; controls.update(); });
  });
  findBtn.addEventListener('click', findBean);

  // walk pad: press and hold
  pad.querySelectorAll('[data-move]').forEach((b) => {
    const k = b.dataset.move;
    const on = (e) => { e.preventDefault(); input.pad.add(k); b.classList.add('is-down'); try { b.setPointerCapture(e.pointerId); } catch {} wake(); };
    const off = () => { input.pad.delete(k); b.classList.remove('is-down'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    // keyboard on the pad buttons: Enter/Space takes one small step
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.pad.add(k); wake(); } });
    b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') input.pad.delete(k); });
    b.addEventListener('blur', off);
  });
  const KEYMAP = { ArrowUp: 'forward', KeyW: 'forward', ArrowDown: 'back', KeyS: 'back', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const dialogOpen = () => !!document.querySelector('dialog[open]');
  window.addEventListener('keydown', (e) => {
    if (!active || mode !== 'explore' || dialogOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = KEYMAP[e.code]; if (!k) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    e.preventDefault(); input.keys.add(k); wake();
  });
  window.addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input.keys.delete(k); });
  window.addEventListener('blur', () => { input.keys.clear(); input.pad.clear(); });

  // drag to look (Explore) and tap the cottage to peek inside (both modes)
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  function hitCottage(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObject(cottage, true).length > 0;
  }
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId }; if (mode === 'explore') { try { canvas.setPointerCapture(e.pointerId); } catch {} } });
  canvas.addEventListener('pointermove', (e) => {
    if (down && mode === 'explore' && !flight) {
      visitor.yaw += (e.clientX - down.lx) * 0.0035;
      visitor.pitch = Math.max(-0.45, Math.min(0.3, visitor.pitch + (e.clientY - down.ly) * 0.0025));
      visitor.yawGoal = null;
      down.lx = e.clientX; down.ly = e.clientY; dirty = true;
    } else if (!down && e.pointerType === 'mouse') {
      canvas.style.cursor = hitCottage(e) ? 'pointer' : (mode === 'explore' ? 'grab' : '');
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && hitCottage(e)) api.openHouse();
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { down = null; });

  // ---------- size ----------
  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    layoutSky(w / h);
    controls.maxDistance = Math.max(34, defaultDistance() * 1.3);
    dirty = true;
  }
  new ResizeObserver(() => { resize(); if (active) wake(); }).observe(stage);

  function draw() {
    renderer.setClearColor(skyColor, 1);
    renderer.clear();
    if (skyNight > 0.01) renderer.render(skyScene, skyCam);
    renderer.clearDepth();
    renderer.render(scene, camera);
  }

  // ---------- the loop: ~30 fps while something moves, otherwise only when needed ----------
  let lastFrame = 0, lastThink = 0;
  const t0 = performance.now();
  let nextBlink = 4000 + Math.random() * 4000, blinkUntil = 0;
  function requestRender() { dirty = true; wake(); }
  function wake() { if (active && !raf && !document.hidden) raf = requestAnimationFrame(loop); }

  function stepExplore(dt) {
    const want = (input.keys.has('forward') || input.pad.has('forward') ? 1 : 0) - (input.keys.has('back') || input.pad.has('back') ? 1 : 0);
    const turn = (input.keys.has('left') || input.pad.has('left') ? 1 : 0) - (input.keys.has('right') || input.pad.has('right') ? 1 : 0);
    const MAX_V = 1.1, MAX_T = 0.65; // slow walk (units/s), slow turn (rad/s)
    const ka = 1 - Math.exp(-dt * 2.6);
    visitor.v += (want * MAX_V - visitor.v) * ka;
    visitor.turnV += (turn * MAX_T - visitor.turnV) * ka;
    if (Math.abs(visitor.v) < 0.003 && !want) visitor.v = 0;
    if (Math.abs(visitor.turnV) < 0.002 && !turn) visitor.turnV = 0;
    if (turn) visitor.yawGoal = null;
    visitor.yaw += visitor.turnV * dt;
    if (visitor.yawGoal !== null) {
      const d = visitor.yawGoal - visitor.yaw;
      visitor.yaw += d * (1 - Math.exp(-dt * 1.8));
      if (Math.abs(d) < 0.002) { visitor.yaw = visitor.yawGoal; visitor.yawGoal = null; }
    }
    if (visitor.v) {
      visitor.x += -Math.sin(visitor.yaw) * visitor.v * dt;
      visitor.z += -Math.cos(visitor.yaw) * visitor.v * dt;
      pushOut(visitor, 0.35);
      if (beanVisible && !onSwing) { // don't walk through Bean
        const dx = visitor.x - beanPos.x, dz = visitor.z - beanPos.z, d = Math.hypot(dx, dz);
        if (d < 1.4 && d > 1e-4) { visitor.x = beanPos.x + (dx / d) * 1.4; visitor.z = beanPos.z + (dz / d) * 1.4; }
      }
    }
    const pose = visitorPose();
    camera.position.copy(pose.pos); camera.lookAt(pose.target); lookAtNow.copy(pose.target);
    return !!(visitor.v || visitor.turnV || visitor.yawGoal !== null || want || turn);
  }

  function loop(now) {
    raf = 0;
    if (!active || document.hidden) return;
    raf = requestAnimationFrame(loop);
    if (now - lastFrame < 1000 / 30 - 2) return;
    const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    let moving = false;

    if (now - lastThink > 1000) { lastThink = now; think(); }
    else if (state && bean.userData.walking && !still()) { updateBean(); moving = true; }

    // slow day/dusk/night transition (instant when Still)
    if (look.cur && look.target) {
      if (still()) look.cur = copyLook(look.target);
      else {
        const k = 1 - Math.exp(-dt / 2.2);
        const before = look.cur.night + look.cur.dusk + look.cur.pal.sunI;
        look.cur = blendLook(look.cur, look.target, k);
        if (Math.abs(look.cur.night + look.cur.dusk + look.cur.pal.sunI - before) > 1e-4) moving = true;
      }
      applyLook(look.cur);
    }

    // Bean: position, blink, breath, swing
    const tsec = (now - t0) / 1000;
    const calm = still();
    let sway = 0;
    if (onSwing && !calm) sway = 0.07 * Math.sin((tsec * Math.PI * 2) / 5.5);
    if (swing.rotation.x !== sway) { swing.rotation.x = sway; }
    bean.visible = beanVisible; beanShadow.visible = beanVisible && !onSwing;
    if (beanVisible) {
      if (onSwing) {
        swing.updateMatrixWorld();
        const seat = swing.localToWorld(swing.userData.seat.clone());
        bean.position.copy(seat);
      } else bean.position.copy(beanPos);
      beanShadow.position.set(beanPos.x, beanPos.y + 0.012, beanPos.z);
      let open = true;
      if (state?.sleeping) open = false;
      else if (!calm) {
        if (now - t0 > nextBlink) { blinkUntil = now + 260; nextBlink = now - t0 + 11000 + (Math.random() - 0.5) * 2000; }
        if (now < blinkUntil) open = false;
      }
      const tex = open ? texOpen : texClosed || texOpen;
      if (beanMat.map !== tex) { beanMat.map = tex; beanMat.needsUpdate = true; dirty = true; }
      const br = calm ? 0 : Math.sin((tsec * Math.PI * 2) / 6);
      bean.scale.set(BEAN_W * (1 + 0.006 * br), BEAN_H * (1 + 0.016 * br), 1);
      if (!calm) moving = true;
    }

    // window glow at night while Bean is home
    const glow = beanInside ? Math.min(1, skyNight * 1.4) : 0;
    windowGlass.emissiveIntensity = glow * 0.85;
    glowSprite.material.opacity = glow * 0.55;
    zzz.material.map = skyNight > 0.3 ? zTexNight : zTexDay;

    // camera
    if (flight) {
      flight.t += dt;
      const k = easeInOut(Math.min(1, flight.t / flight.dur));
      camera.position.lerpVectors(flight.from.pos, flight.to.pos, k);
      lookAtNow.lerpVectors(flight.from.target, flight.to.target, k);
      if (flight.to.fov) setFov(flight.from.fov + (flight.to.fov - flight.from.fov) * k);
      camera.lookAt(lookAtNow);
      moving = true;
      if (flight.t >= flight.dur) { const f = flight; flight = null; f.then && f.then(); }
    } else if (mode === 'explore') {
      if (stepExplore(dt)) moving = true;
    } else {
      if (follow && beanVisible) {
        const goal = (onSwing ? bean.position.clone() : beanPos.clone()).add(new THREE.Vector3(0, 0.4, 0));
        const k = calm ? 1 : 1 - Math.exp(-dt * 0.9);
        const delta = goal.sub(controls.target).multiplyScalar(k);
        controls.target.add(delta); camera.position.add(delta);
        const off = camera.position.clone().sub(controls.target), dist = off.length();
        if (dist > 10.5) camera.position.copy(controls.target).add(off.multiplyScalar((dist + (10.5 - dist) * k) / dist));
        if (delta.lengthSq() > 1e-7 || dist > 10.55) moving = true;
      }
      controls.enableDamping = !calm;
      if (controls.update()) moving = true;
    }

    refreshMsg();
    if (tempMsg && now < tempUntil + 50) moving = true;

    if (moving || dirty) { draw(); dirty = false; }
    else if (calm) { cancelAnimationFrame(raf); raf = 0; } // fully idle and Still: stop until something happens
  }

  // Still turns on/off from the side panel
  document.addEventListener('bean:still', () => { if (still()) { flight && flyTo(flight.to, 0, flight.then); } think(); requestRender(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { think(); requestRender(); } });
  controls.addEventListener('start', wake);
  canvas.addEventListener('pointerdown', wake);
  canvas.addEventListener('wheel', wake, { passive: true });
  // keep thinking once a minute even when Still and idle
  setInterval(() => { if (active && !document.hidden) { think(); requestRender(); } }, 30000);

  // ---------- start ----------
  resize();
  {
    const pose = overviewPose();
    camera.position.copy(pose.pos); controls.target.copy(pose.target); controls.update();
  }
  think();
  look.cur = copyLook(look.target); applyLook(look.cur);
  syncButtons();
  draw();

  // testing hook
  window.__bean3d = { cottageScreen() { const v = new THREE.Vector3(); cottage.getWorldPosition(v); v.y += 1.0; v.project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }, get mode() { return mode; }, get visitor() { return { ...visitor }; }, get bean() { return { x: beanPos.x, z: beanPos.z, visible: beanVisible, onSwing }; }, camera, renderer };

  return {
    ok: true,
    setActive(on) {
      active = on;
      if (on) { resize(); think(); requestRender(); }
      else { input.keys.clear(); input.pad.clear(); if (raf) cancelAnimationFrame(raf); raf = 0; }
    },
  };
}
