/* ==========================================================
   FEISAR — hero 3D (Three.js)
   A faceted single-hull FEISAR-style craft in a white studio,
   driven by a scroll-scrubbed camera story.
   ========================================================== */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.getElementById('three');
const hero = document.getElementById('hero');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const win = (v, a, b, f = .05) => smooth(a - f, a + f, v) * (1 - smooth(b - f, b + f, v));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xeef2f8, 16, 58);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), .03).texture;
scene.environmentIntensity = .45;

const camera = new THREE.PerspectiveCamera(32, 1, .1, 200);

/* ---------------- lights ---------------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c8e0, .4));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(6, 12, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
key.shadow.bias = -.0004;
key.shadow.radius = 6;
scene.add(key);
const rim = new THREE.DirectionalLight(0xbcd7ff, 1.2);
rim.position.set(-8, 4, -10);
scene.add(rim);

/* ---------------- ship (Blender-built FX350, see tools/build_feisar.py) ---------------- */
const shipRoot = new THREE.Group();
scene.add(shipRoot);
const ship = { group: new THREE.Group(), plumes: [] };
shipRoot.add(ship.group);

const decal = (text, w, h, { color, size = 150, font = 'Michroma, Arial Black, sans-serif', weight = '' }) => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const x = c.getContext('2d');
  x.fillStyle = color; x.font = `${weight} ${size}px ${font}`; x.textBaseline = 'middle';
  x.fillText(text, 8, c.height / 2 + 4);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({
    map: tex, transparent: true, roughness: .3, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
  }));
};
const place = (mesh, pos, normal, along) => {
  // orient a plane so its +Z faces `normal` and its +X runs along `along`
  const n = normal.clone().normalize(), xA = along.clone().normalize();
  const yA = new THREE.Vector3().crossVectors(n, xA).normalize();
  xA.crossVectors(yA, n).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, n));
  mesh.position.copy(pos).addScaledVector(n, .004);
  ship.group.add(mesh);
};

function dressShip() {
  ship.group.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (m.name === 'fsr_glass') { m.transparent = true; m.opacity = .78; m.envMapIntensity = 1.6; }
    if (m.name === 'fsr_engine' || m.name === 'fsr_field') { m.toneMapped = false; o.castShadow = false; }
  });
  // livery decals
  for (const s of [1, -1]) {
    const name = decal('feisar', 1.25, .15, { color: '#ffffff', size: 118 });
    place(name, new THREE.Vector3(s * .542, .07, 2.25), new THREE.Vector3(s * .966, .259, 0), new THREE.Vector3(0, 0, -s));
    const unity = decal('race for e-unity', 1.5, .1, { color: '#1d7fb4', size: 92, font: 'Saira, sans-serif', weight: 600 });
    place(unity, new THREE.Vector3(s * .3, .376, 1.0), new THREE.Vector3(0, 1, .05), new THREE.Vector3(0, 0, -s));
    const num = decal('350', .32, .16, { color: '#0a1530', size: 300 });
    place(num, new THREE.Vector3(s * .67, .0, -1.9), new THREE.Vector3(s * .95, .3, 0), new THREE.Vector3(0, 0, -s));
  }
  const top = decal('FEISAR', 1.4, .2, { color: '#3fb0e4', size: 160 });
  place(top, new THREE.Vector3(0, .296, 2.55), new THREE.Vector3(0, 1, .055), new THREE.Vector3(1, 0, 0));
  top.rotateZ(Math.PI / 2);

  // engine plumes
  const plume = (x, y, r, len) => {
    const g = new THREE.ConeGeometry(r, len, 24, 1, true);
    g.translate(0, len / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x59d2ff, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, -3.22);
    ship.group.add(m); ship.plumes.push(m);
  };
  plume(0, .06, .26, 2.2); plume(.76, .02, .09, 1.1); plume(-.76, .02, .09, 1.1);
}

new GLTFLoader().load('assets/models/feisar_fx350.glb', gltf => {
  ship.group.add(gltf.scene);
  dressShip();
}, undefined, err => console.error('FEISAR model failed to load', err));

/* ---------------- ground ---------------- */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ color: 0x0a2a6a, opacity: .16 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.25; ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(160, 80, 0x7aa0e0, 0xb9cbe8);
grid.position.y = -1.249;
grid.material.transparent = true; grid.material.opacity = .45;
scene.add(grid);
// AG field ring under ship
const fieldMat = new THREE.MeshBasicMaterial({ color: 0x00a3d9, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false });
const field = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.66, 96), fieldMat);
field.rotation.x = -Math.PI / 2; field.position.y = -1.24;
scene.add(field);
const field2 = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.42, 96, 1, 0, Math.PI * 1.4), fieldMat.clone());
field2.material.color.set(0x0047bb); field2.material.opacity = .4;
field2.rotation.x = -Math.PI / 2; field2.position.y = -1.24;
scene.add(field2);

/* ---------------- 12-star gate ---------------- */
const starShape = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .19 : .46;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
})();
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: .12, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 1 });
starGeo.center();
const starMat = new THREE.MeshPhysicalMaterial({ color: 0xffc400, metalness: .55, roughness: .22, clearcoat: 1 });
const gate = new THREE.Group();
for (let i = 0; i < 12; i++) {
  const a = i / 12 * Math.PI * 2;
  const m = new THREE.Mesh(starGeo, starMat);
  m.position.set(Math.cos(a) * 4.4, Math.sin(a) * 4.4, 0);
  m.castShadow = true;
  gate.add(m);
}
const gateRing = new THREE.Mesh(new THREE.TorusGeometry(4.4, .012, 8, 160), new THREE.MeshBasicMaterial({ color: 0x0047bb, transparent: true, opacity: .35 }));
gate.add(gateRing);
gate.position.set(0, 1.4, -11);
gate.scale.setScalar(1.25);
scene.add(gate);

/* ---------------- speed lines ---------------- */
const LINES = 160;
const lineGeo = new THREE.BoxGeometry(.018, .018, 1);
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
const lines = new THREE.InstancedMesh(lineGeo, lineMat, LINES);
const lineData = [];
const dummy = new THREE.Object3D();
const palette = [new THREE.Color(0x0047bb), new THREE.Color(0x00a3d9), new THREE.Color(0xffc400), new THREE.Color(0x7aa0e0)];
for (let i = 0; i < LINES; i++) {
  const a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 9;
  lineData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * .6 + 1, z: Math.random() * 80 - 40, len: 1.5 + Math.random() * 5, sp: .6 + Math.random() * .8 });
  lines.setColorAt(i, palette[i % palette.length]);
}
scene.add(lines);

/* ---------------- dust particles ---------------- */
const dustGeo = new THREE.BufferGeometry();
const DUST = 400, dpos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) { dpos[i * 3] = (Math.random() - .5) * 40; dpos[i * 3 + 1] = Math.random() * 12 - 1; dpos[i * 3 + 2] = (Math.random() - .5) * 60; }
dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x0047bb, size: .045, transparent: true, opacity: .45, depthWrite: false }));
scene.add(dust);

/* ---------------- scroll story ---------------- */
// camera keys: p, azimuth, elevation, distance, lookY, viewOffset (fraction of width)
const KEYS = [
  [0.00, .72, .2, 15, .3, -.2],
  [0.12, .9, .24, 14, .3, -.17],
  [0.22, 1.57, .06, 10.5, .35, -.02],
  [0.40, 1.75, .12, 10, .35, 0],
  [0.48, 2.45, .62, 13.5, .2, 0],
  [0.64, 2.75, .55, 13, .2, 0],
  [0.72, 3.14, .2, 14, -.2, 0],
  [1.00, 3.14, .16, 15, -.4, 0],
];
const sampleKeys = p => {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth(a[0], b[0], p);
  return a.slice(1).map((v, k) => lerp(v, b[k + 1], t));
};

const callouts = [...document.querySelectorAll('.callout')];
const anchors = [
  new THREE.Vector3(0, .8, -.9), new THREE.Vector3(0, .06, -3.2),
  new THREE.Vector3(.9, -.3, -2.9), new THREE.Vector3(.68, -.3, 1.6),
];
const calloutWin = [[.2, .4], [.25, .42], [.46, .56], [.56, .66]];
const stories = [...document.querySelectorAll('.story')];
const storyWin = [[.2, .42], [.46, .66], [.72, .94]];
const content = document.getElementById('heroContent');
const bgType = document.querySelector('.hero__bgtype');
const scrollHint = document.querySelector('.hero__scroll');
const roVel = document.getElementById('roVel'), roFld = document.getElementById('roFld'), roCam = document.getElementById('roCam');

let W = 0, H = 0;
const resize = () => {
  const r = canvas.getBoundingClientRect();
  W = r.width; H = r.height;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  camera.fov = W < 700 ? 44 : 32;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

let pSmooth = 0, lastY = scrollY, vel = 0, t = 0, last = performance.now();
const tmp = new THREE.Vector3();
const camNames = ['A-01 FRONT', 'B-02 PROFILE', 'C-03 AERIAL', 'D-04 CHASE'];

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  if (!visible || !W) return;
  t += dt;

  const r = hero.getBoundingClientRect();
  const total = hero.offsetHeight - innerHeight;
  const p = clamp(-r.top / (total || 1), 0, 1);
  pSmooth = lerp(pSmooth, p, 1 - Math.pow(.0005, dt));
  const P = pSmooth;
  vel = lerp(vel, Math.abs(scrollY - lastY) / Math.max(dt, .001), .1); lastY = scrollY;

  mouse.sx = lerp(mouse.sx, mouse.x, .05); mouse.sy = lerp(mouse.sy, mouse.y, .05);

  // camera
  const [az0, el, dist0, lookY, off] = sampleKeys(P);
  const dist = dist0 * (W < 700 ? 1.45 : 1);
  const az = az0 + mouse.sx * .25 * (1 - smooth(.7, .8, P));
  const elv = el + mouse.sy * .08;
  const launch = REDUCED ? 0 : smooth(.84, 1, P);
  camera.position.set(Math.sin(az) * Math.cos(elv) * dist, Math.sin(elv) * dist + lookY, Math.cos(az) * Math.cos(elv) * dist);
  camera.lookAt(0, lookY, 0);
  const wide = W > 900;
  camera.setViewOffset(W, H, (wide ? off : 0) * W, wide ? 0 : -H * .24 * (1 - smooth(.1, .2, P)), W, H);

  // ship motion
  const hover = Math.sin(t * 1.7) * .09;
  shipRoot.position.set(0, hover, launch * launch * 60);
  shipRoot.rotation.z = Math.sin(t * .9) * .03 - mouse.sx * .12 * (1 - launch);
  shipRoot.rotation.x = Math.sin(t * 1.3) * .015 - launch * .04;
  shipRoot.rotation.y = mouse.sx * .1 * (1 - smooth(.15, .25, P));

  const thrust = .45 + smooth(.66, .86, P) * .8 + Math.min(vel / 3000, .5);
  ship.plumes.forEach((pl, i) => {
    pl.material.opacity = (.14 + thrust * .16) * (.85 + Math.random() * .15);
    pl.scale.set(1, .6 + thrust * .9 + Math.random() * .08, 1);
  });

  field.scale.setScalar(1 + Math.sin(t * 2) * .03);
  field2.rotation.z = t * .4;
  fieldMat.opacity = .25 + Math.sin(t * 3) * .1;
  gate.rotation.z = t * .08;
  gate.children.forEach((s, i) => { if (s.geometry === starGeo) s.rotation.y = t * 1.2 + i; });

  // speed lines
  const speedAmt = REDUCED ? 0 : .12 + smooth(.62, .84, P) * .88 + Math.min(vel / 2500, .6);
  lineMat.opacity = Math.min(1, speedAmt) * .7;
  const sp = 12 + speedAmt * 90;
  for (let i = 0; i < LINES; i++) {
    const d = lineData[i];
    d.z -= sp * d.sp * dt;
    if (d.z < -40) d.z += 80;
    dummy.position.set(d.x, d.y, d.z);
    dummy.scale.set(1, 1, d.len * (1 + speedAmt * 3));
    dummy.updateMatrix();
    lines.setMatrixAt(i, dummy.matrix);
  }
  lines.instanceMatrix.needsUpdate = true;
  grid.position.z = -((t * (2 + speedAmt * 30)) % 2);
  dust.position.z = -((t * (1 + speedAmt * 20)) % 30);

  renderer.render(scene, camera);

  // HTML overlays
  content.style.opacity = 1 - smooth(.04, .13, P);
  content.style.transform = `translateY(${W > 900 ? -46 : 0}%) translateX(${-smooth(.04, .14, P) * 80}px)`;
  if (scrollHint) scrollHint.style.opacity = 1 - smooth(.01, .05, P);
  bgType.style.transform = `translateY(-50%) translateX(${-P * 30}vw)`;
  bgType.style.opacity = 1 - smooth(.6, .8, P) * .7;

  callouts.forEach((el, i) => {
    const o = win(P, calloutWin[i][0], calloutWin[i][1], .03);
    el.style.opacity = o;
    if (o < .01) return;
    tmp.copy(anchors[i]).applyMatrix4(ship.group.matrixWorld).project(camera);
    const x = (tmp.x * .5 + .5) * W, y = (-tmp.y * .5 + .5) * H;
    el.classList.toggle('flip', x > W * .55);
    el.style.transform = `translate(${x}px, ${y}px)`;
  });
  stories.forEach((el, i) => {
    const o = win(P, storyWin[i][0], storyWin[i][1], .035);
    el.style.opacity = o;
    el.style.transform = `translateY(${(1 - o) * 30}px)`;
  });

  if ((t * 10 | 0) % 2 === 0) {
    roVel.textContent = Math.round(380 + thrust * 520 + launch * 900 + Math.random() * 8);
    roFld.textContent = (99.9 + Math.random() * .099).toFixed(3);
    roCam.textContent = camNames[P < .18 ? 0 : P < .45 ? 1 : P < .7 ? 2 : 3].split(' ')[0];
  }
}
requestAnimationFrame(frame);
window.dispatchEvent(new Event('feisar:3d-ready'));
