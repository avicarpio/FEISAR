/* ==========================================================
   FEISAR — WebGL world
   One fixed canvas behind the interface. The scene controller in main.js publishes
   window.FEISAR_STAGE = { zone, p, boost, drag, kick }; scenes marked [data-zone]
   drive it: "hero" (studio + scroll story), "track" (an AG circuit)
   and "eng" (exploded engineering view).
   ========================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { applyLivery } from './livery.js';

const canvas = document.getElementById('gl');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const win = (v, a, b, f = .05) => smooth(a - f, a + f, v) * (1 - smooth(b - f, b + f, v));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}
const DPR = Math.min(devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, .1, 900);
scene.add(camera);

/* ---------------- studio environment (lightformers) ---------------- */
function studioEnv() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x9aa6b8, side: THREE.BackSide })));
  const former = (w, h, k, pos, look, tint = [1, 1, 1]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); env.add(m);
  };
  former(14, 10, 3.2, [0, 9, 0], [0, 0, 0]);
  former(1.2, 14, 7, [-9, 3, 0], [0, 0, 0]);
  former(1.2, 14, 7, [9, 3, 0], [0, 0, 0]);
  former(16, 1, 5, [0, 3, 10], [0, 0, 0]);
  former(16, 1.6, 3, [0, 2, -10], [0, 0, 0], [.6, .8, 1.3]);
  former(6, 2, 1.6, [6, -2, -6], [0, 0, 0], [1.2, 1, .4]);
  const pm = new THREE.PMREMGenerator(renderer);
  return pm.fromScene(env, .02).texture;
}
scene.environment = studioEnv();
scene.environmentIntensity = .8;

/* ---------------- sky ---------------- */
const skyU = { top: { value: new THREE.Color(0xf7f9fc) }, bottom: { value: new THREE.Color(0xd9e3f0) }, horizon: { value: new THREE.Color(0xffffff) } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform vec3 top, bottom, horizon; varying vec3 vP;
    void main(){ float h = vP.y; vec3 c = h > 0. ? mix(horizon, top, smoothstep(0., .6, h)) : mix(horizon, bottom, smoothstep(0., .3, -h));
    gl_FragColor = vec4(c, 1.); }`,
}));
camera.add(sky);
scene.fog = new THREE.Fog(0xeef2f8, 18, 70);

/* ---------------- lights ---------------- */
scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c8e0, .22));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(6, 12, 8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 50 });
key.shadow.bias = -.0004; key.shadow.radius = 6;
scene.add(key, key.target);

/* ---------------- post-processing ---------------- */
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const gtao = new GTAOPass(scene, camera, 1, 1);
gtao.output = GTAOPass.OUTPUT.Default;
gtao.blendIntensity = .9;
gtao.updateGtaoMaterial({ radius: .35, distanceExponent: 1.5, thickness: 1, scale: 1.2, samples: 12 });
composer.addPass(gtao);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .38, .4, 1.15);
composer.addPass(bloom);
const fx = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: .002 }, uBlur: { value: 0 }, uVig: { value: .25 }, uFlash: { value: 0 }, uGrain: { value: .025 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAberr, uBlur, uVig, uFlash, uGrain; varying vec2 vUv;
    float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - .5; vec3 c = vec3(0.);
      for (int i = 0; i < 10; i++) c += texture2D(tDiffuse, vUv - d * uBlur * float(i) / 9.).rgb;
      c /= 10.;
      vec2 ab = d * uAberr * smoothstep(.05, .5, length(d));
      c.r = mix(c.r, texture2D(tDiffuse, vUv + ab).r, .85);
      c.b = mix(c.b, texture2D(tDiffuse, vUv - ab).b, .85);
      c *= 1. - uVig * dot(d, d) * 1.8;
      c += (rnd(vUv * 900. + uTime) - .5) * uGrain;
      c = mix(c, vec3(1.6), uFlash);
      gl_FragColor = vec4(c, 1.);
    }`,
});
composer.addPass(fx);
composer.addPass(new OutputPass());

/* ---------------- studio set (hero + engineering) ---------------- */
const studio = new THREE.Group();
scene.add(studio);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.ShadowMaterial({ color: 0x0a2a6a, opacity: .18 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.3; ground.receiveShadow = true;
const grid = new THREE.GridHelper(200, 100, 0x7aa0e0, 0xbccde8);
grid.position.y = -1.299; grid.material.transparent = true; grid.material.opacity = .45;
const glowColor = (r, g, b) => new THREE.Color(r, g, b);
const fieldMat = new THREE.MeshBasicMaterial({ color: glowColor(.2, .9, 1.6), transparent: true, opacity: .5, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
const field = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.74, 128), fieldMat);
field.rotation.x = -Math.PI / 2; field.position.y = -1.29;
const field2 = new THREE.Mesh(new THREE.RingGeometry(3.6, 3.62, 128, 1, 0, Math.PI * 1.3), new THREE.MeshBasicMaterial({ color: 0x0047bb, transparent: true, opacity: .45, side: THREE.DoubleSide, depthWrite: false }));
field2.rotation.x = -Math.PI / 2; field2.position.y = -1.29;
studio.add(ground, grid, field, field2);

// 12-star gate
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .19 : .46; i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: .12, bevelEnabled: true, bevelThickness: .04, bevelSize: .03, bevelSegments: 2 });
starGeo.center();
const starMat = new THREE.MeshPhysicalMaterial({ color: 0xffc400, metalness: .6, roughness: .18, clearcoat: 1, emissive: 0xffb000, emissiveIntensity: .15 });
const makeGate = (R = 4.4) => {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, m = new THREE.Mesh(starGeo, starMat);
    m.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); m.castShadow = true; g.add(m);
  }
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R, .015, 8, 200), new THREE.MeshBasicMaterial({ color: glowColor(.3, .7, 2), toneMapped: false })));
  return g;
};
const gate = makeGate();
gate.position.set(0, 1.4, 18); gate.scale.setScalar(1.3);
studio.add(gate);

// dust
const DUST = 500, dpos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) { dpos[i * 3] = (Math.random() - .5) * 50; dpos[i * 3 + 1] = Math.random() * 14 - 1.2; dpos[i * 3 + 2] = (Math.random() - .5) * 70; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x0047bb, size: .04, transparent: true, opacity: .4, depthWrite: false }));
studio.add(dust);

/* ---------------- speed lines (world space, along z) ---------------- */
const LINES = 180;
const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(.016, .016, 1), lineMat, LINES);
lines.frustumCulled = false;
const lineData = [];
const pal = [glowColor(0, .28, .9), glowColor(.1, .8, 1.4), glowColor(1.4, 1, .1), glowColor(.4, .6, 1)];
for (let i = 0; i < LINES; i++) {
  const a = Math.random() * Math.PI * 2, r = 2.4 + Math.random() * 10;
  lineData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * .55 + 1, z: Math.random() * 90 - 45, len: 1.5 + Math.random() * 5, sp: .6 + Math.random() * .8 });
  lines.setColorAt(i, pal[i % pal.length]);
}
scene.add(lines);
const dummy = new THREE.Object3D();

/* ---------------- ship ---------------- */
const shipRoot = new THREE.Group();
const ship = new THREE.Group();
shipRoot.add(ship);
scene.add(shipRoot);
const REVEAL = { value: 6 }, WIRE_ALL = { value: 0 }, TIME = { value: 0 };
const parts = [];          // { node, base, off }
const airbrakes = {};
const plumes = [];
const anchors = {};        // ship-local label anchors
let shipReady = false;

const wireMat = new THREE.ShaderMaterial({
  uniforms: { uReveal: REVEAL, uAll: WIRE_ALL, uTime: TIME },
  transparent: true, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec3 vW; void main(){ vW = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform float uReveal, uAll, uTime; varying vec3 vW;
    void main(){ float hidden = step(vW.z, uReveal); float a = max(hidden * .95, uAll);
      if (a < .01) discard;
      gl_FragColor = vec4(.1, 1.1, 2.2, a * (.7 + .3 * sin(uTime * 30. + vW.z * 12.))); }`,
});

function patchReveal(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uReveal = REVEAL;
    sh.vertexShader = 'varying vec3 vRevealW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vRevealW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'uniform float uReveal; varying vec3 vRevealW;\n' + sh.fragmentShader
      .replace('void main() {', 'void main() {\n if (vRevealW.z < uReveal) discard;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(.25, .9, 1.6) * 5. * (1. - smoothstep(0., .22, vRevealW.z - uReveal));');
    // inside faces of the hull panels (seen once the craft is exploded): plain dark composite, no livery
    if (m.name === 'Body') sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n if (!gl_FrontFacing) diffuseColor.rgb = vec3(.1, .11, .12);');
  };
  m.customProgramCacheKey = () => 'reveal' + (m.name === 'Body' ? '-body' : '');
  m.needsUpdate = true;
}

// exploded-view offsets by part name
const EXPLODE = [
  [/^canopy_glass/, [0, 1.7, .3]], [/^canopy_frame/, [0, 1.25, .3]], [/^cockpit/, [0, .75, .6]],
  [/^nose/, [0, .1, 1.5]], [/^side_R/, [1.9, .1, -.4]], [/^side_L/, [-1.9, .1, -.4]],
  [/^rear/, [0, .3, -2.4]], [/^glow/, [0, -1.4, 0]],
];

new GLTFLoader().load('assets/models/feisar_fx350.glb', async gltf => {
  const root = gltf.scene;
  await applyLivery(root, renderer);
  ship.add(root);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  [...root.children].forEach(node => {
    const rule = EXPLODE.find(([re]) => re.test(node.name));
    parts.push({ node, base: node.position.clone(), off: new THREE.Vector3(...(rule ? rule[1] : [0, 0, 0])) });
    if (/^airbrake_/.test(node.name)) { airbrakes[node.name.slice(-1)] = node; node.userData.q0 = node.quaternion.clone(); }
    box.setFromObject(node);
    anchors[node.name] = box.getCenter(new THREE.Vector3());
  });
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (/engine|field/.test(m.name)) { m.toneMapped = false; m.emissiveIntensity = 2.2; o.castShadow = false; }
    if (m.name === 'fsr_glass') { m.envMapIntensity = 2; }
    if (m.name === 'Body') { m.envMapIntensity = .55; }          // satin livery: keep the colours saturated
    if (m.name === 'Glass') { m.envMapIntensity = 1.6; }
    patchReveal(m);
    const w = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 32), wireMat);
    w.renderOrder = 2; o.add(w);
  });
  // engine plumes
  // engine exhaust: two nested additive cones per nozzle (soft sheath + white-hot core) with a shader that fades
  // along the length and towards the silhouette, plus travelling shock bands and flicker
  const plume = (x, y, r, len) => {
    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2; group.position.set(x, y, x === 0 ? -2.8 : -3.24);
    const layer = (rad, l, core) => {
      const g = new THREE.CylinderGeometry(rad * .18, rad, l, 40, 24, true); g.translate(0, l / 2, 0);
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { uTime: TIME, uPower: { value: 0 }, uCore: { value: core }, uSeed: { value: Math.random() * 10 } },
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform float uTime, uPower, uCore, uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
          void main(){
            float along = clamp(vUv.y, 0., 1.);                    // 0 at the nozzle, 1 at the tip
            float facing = clamp(abs(dot(normalize(vN), normalize(vV))), 0., 1.);  // 1 through the middle, 0 at the silhouette
            float body = pow(facing, mix(1.6, 3.5, uCore)) * pow(1. - along, mix(1.4, 2.6, uCore));
            float shock = .78 + .22 * sin(along * 46. - uTime * 38. + uSeed);
            float flick = .9 + .1 * sin(uTime * 61. + uSeed * 3.) * sin(uTime * 23. + uSeed);
            float a = body * shock * flick * uPower * smoothstep(0., .04, along);
            // light theme: painted as saturated electric blue (additive light would vanish on white);
            // the HDR core feeds the bloom pass for the glow
            vec3 deep = vec3(.02, .22, .95), elec = vec3(.15, .62, 1.35), hot = vec3(.9, 1.5, 2.6);
            vec3 col = mix(deep, elec, smoothstep(.0, .75, (1. - along) * facing));
            col = mix(col, hot, uCore * pow(facing, 3.) * pow(1. - along, 2.));
            a = clamp(a, 0., 1.);                                  // never NaN/Inf: bloom would smear it into black blocks
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      }));
      m.renderOrder = 3;
      group.add(m);
      return m;
    };
    const sheath = layer(r, len, 0), core = layer(r * .5, len * .62, 1);
    // the old code drives material.opacity / scale; keep that API on the group
    group.material = { opacity: 0 };
    group.userData.layers = [[sheath, 1.8], [core, 3.2]];
    ship.add(group); plumes.push(group);
  };
  plume(0, .43, .22, 2.6); plume(.92, .15, .2, 2.2); plume(-.92, .15, .2, 2.2);
  shipReady = true;
  if (window.FEISAR_IGNITED) ignite();
  window.dispatchEvent(new Event('feisar:model-ready'));
  // build and precompile the test circuit in idle time: doing it on the first jump to the track
  // froze the main thread for ~200 ms mid-warp, so the transition bars vanished in one hard cut
  (window.requestIdleCallback || (f => setTimeout(f, 400)))(async () => {
    if (track) return;
    track = buildTrack();
    track.g.visible = true;
    let compiled = null;
    try { compiled = renderer.compileAsync(scene, camera); } catch { /* compile lazily instead */ }   // collects programs synchronously
    track.g.visible = prevZone === 'track';                                                          // so it never shows on the hero
    try { await compiled; } catch { /* ignore */ }
  }, { timeout: 3000 });
}, undefined, err => console.error('FEISAR model failed to load', err));

// reveal scan frame
const scanGroup = new THREE.Group();
const scanFrame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.6, 2.1, .001)), new THREE.LineBasicMaterial({ color: glowColor(.3, 1.4, 2.6), toneMapped: false, transparent: true }));
const scanFill = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.1), new THREE.MeshBasicMaterial({ color: 0x00a3d9, transparent: true, opacity: .05, depthWrite: false, side: THREE.DoubleSide }));
scanGroup.add(scanFrame, scanFill); scanGroup.position.y = .3; scanGroup.visible = false;
scene.add(scanGroup);

/* ---------------- AG track (built on first visit) ---------------- */
let track = null;
function buildTrack() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, r = 120 + 34 * Math.sin(3 * a) + 12 * Math.cos(5 * a);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 14 * Math.sin(2 * a + .5) + 6 * Math.sin(5 * a), Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const N = 1800, L = curve.getLength();
  const P = [], T = [], R = [], U = [];
  for (let i = 0; i <= N; i++) { P.push(curve.getPointAt(i / N % 1)); T.push(curve.getTangentAt(i / N % 1)); }
  for (let i = 0; i <= N; i++) {
    const t0 = T[(i - 6 + N) % N], t1 = T[(i + 6) % N];
    const turn = new THREE.Vector3().crossVectors(t0, t1).y;
    const bank = clamp(turn * 4, -.32, .32);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), T[i]).normalize();
    const up = new THREE.Vector3().crossVectors(T[i], right).normalize();
    right.applyAxisAngle(T[i], bank); up.applyAxisAngle(T[i], bank);
    R.push(right); U.push(up);
  }
  const W = 3.4;
  const ribbon = (fn, uvx) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const [a, b] = fn(i);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const v = i / N * L / 10;
      uv.push(uvx[0], v, uvx[1], v);
      if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };
  // road texture
  const tc = document.createElement('canvas'); tc.width = 512; tc.height = 1024;
  const x = tc.getContext('2d');
  x.fillStyle = '#f2f5fa'; x.fillRect(0, 0, 512, 1024);
  x.fillStyle = '#e3e9f2'; for (let k = 0; k < 8; k++) x.fillRect(0, k * 128, 512, 2);
  x.fillStyle = '#0047bb'; x.fillRect(14, 0, 10, 1024); x.fillRect(488, 0, 10, 1024);
  for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#ffcc00' : '#0a1530'; x.fillRect(0, k * 128, 12, 128); x.fillRect(500, k * 128, 12, 128); }
  x.fillStyle = 'rgba(0,71,187,.35)'; for (let k = 0; k < 4; k++) { x.fillRect(170, k * 256, 4, 140); x.fillRect(338, k * 256, 4, 140); }
  x.fillStyle = 'rgba(10,21,48,.5)'; x.font = '500 34px "JetBrains Mono", monospace'; x.save(); x.translate(256, 900); x.rotate(-Math.PI / 2); x.textAlign = 'center'; x.fillText('FEISAR · E-UNITY', 0, 12); x.restore();
  const roadTex = new THREE.CanvasTexture(tc); roadTex.colorSpace = THREE.SRGBColorSpace; roadTex.wrapT = THREE.RepeatWrapping; roadTex.anisotropy = 8;
  const road = new THREE.Mesh(ribbon(i => [P[i].clone().addScaledVector(R[i], -W), P[i].clone().addScaledVector(R[i], W)], [0, 1]),
    new THREE.MeshPhysicalMaterial({ map: roadTex, roughness: .35, clearcoat: .6, side: THREE.DoubleSide }));
  road.receiveShadow = true;
  const under = new THREE.Mesh(ribbon(i => [P[i].clone().addScaledVector(R[i], -W * .8).addScaledVector(U[i], -.6), P[i].clone().addScaledVector(R[i], W * .8).addScaledVector(U[i], -.6)], [0, 1]),
    new THREE.MeshStandardMaterial({ color: 0xc7d3e4, roughness: .6, side: THREE.DoubleSide }));
  const wallMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .35, roughness: .05, transmission: 0, side: THREE.DoubleSide, depthWrite: false });
  const lightMat = new THREE.MeshBasicMaterial({ color: glowColor(.2, .9, 2.2), side: THREE.DoubleSide, toneMapped: false });
  const lightMat2 = new THREE.MeshBasicMaterial({ color: glowColor(2, 1.5, .2), side: THREE.DoubleSide, toneMapped: false });
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(ribbon(i => [P[i].clone().addScaledVector(R[i], s * W), P[i].clone().addScaledVector(R[i], s * W).addScaledVector(U[i], .9)], [0, 1]), wallMat));
    g.add(new THREE.Mesh(ribbon(i => [P[i].clone().addScaledVector(R[i], s * W).addScaledVector(U[i], .86), P[i].clone().addScaledVector(R[i], s * W).addScaledVector(U[i], .96)], [0, 1]), s < 0 ? lightMat : lightMat2));
  }
  g.add(road, under);

  // speed pads
  const pc = document.createElement('canvas'); pc.width = 256; pc.height = 512;
  const px = pc.getContext('2d');
  px.fillStyle = '#ffcc00';
  for (let k = 0; k < 3; k++) { const y = 60 + k * 150; px.beginPath(); px.moveTo(28, y + 110); px.lineTo(128, y); px.lineTo(228, y + 110); px.lineTo(190, y + 110); px.lineTo(128, y + 52); px.lineTo(66, y + 110); px.fill(); }
  const padTex = new THREE.CanvasTexture(pc);
  const padMat = new THREE.MeshBasicMaterial({ map: padTex, color: glowColor(2.2, 1.7, .5), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const padGeo = new THREE.PlaneGeometry(2.2, 3.6);
  const m4 = new THREE.Matrix4();
  for (let i = 40; i < N; i += 110) {
    const pad = new THREE.Mesh(padGeo, padMat);
    m4.makeBasis(R[i], T[i], U[i]); pad.quaternion.setFromRotationMatrix(m4);
    pad.position.copy(P[i]).addScaledVector(U[i], .02);
    g.add(pad);
  }
  // arches with banners
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 128;
  const bx = bc.getContext('2d'); bx.fillStyle = '#0047bb'; bx.fillRect(0, 0, 1024, 128);
  bx.fillStyle = '#ffcc00'; bx.fillRect(0, 0, 1024, 8); bx.fillRect(0, 120, 1024, 8);
  bx.fillStyle = '#ffffff'; bx.font = '64px Michroma, sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText('FEISAR · STRENGTH IN UNITY', 512, 68);
  const bannerTex = new THREE.CanvasTexture(bc); bannerTex.colorSpace = THREE.SRGBColorSpace;
  const archMat = new THREE.MeshPhysicalMaterial({ color: 0xf2f5fa, roughness: .25, clearcoat: 1 });
  for (let i = 150; i < N; i += 260) {
    const a = new THREE.Group();
    m4.makeBasis(R[i], U[i], T[i]); a.quaternion.setFromRotationMatrix(m4); a.position.copy(P[i]);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.35, 4.6, .35), archMat); p.position.set(s * (W + .5), 2.3, 0); a.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * W + 1.4, .9, .3), [archMat, archMat, archMat, archMat, new THREE.MeshBasicMaterial({ map: bannerTex }), new THREE.MeshBasicMaterial({ map: bannerTex })]);
    beam.position.y = 4.4; a.add(beam);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2 * W + 1.4, .05, .32), lightMat); strip.position.y = 3.92; a.add(strip);
    g.add(a);
  }
  // star gates
  for (const i of [520, 1100, 1560]) {
    const sg = makeGate(5.6);
    m4.makeBasis(R[i], U[i], T[i]); sg.quaternion.setFromRotationMatrix(m4); sg.position.copy(P[i]).addScaledVector(U[i], 1.8);
    g.add(sg);
  }
  // distant towers
  const TW = 160, tg = new THREE.BoxGeometry(1, 1, 1);
  const towers = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0xf4f7fb, roughness: .4, metalness: .1 }), TW);
  for (let k = 0; k < TW; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() < .4 ? 15 + Math.random() * 40 : 215 + Math.random() * 140;
    const h = 30 + Math.random() * 110, w = 4 + Math.random() * 10;
    dummy.position.set(Math.cos(a) * r, h / 2 - 60, Math.sin(a) * r); dummy.scale.set(w, h, w); dummy.rotation.y = Math.random(); dummy.updateMatrix();
    towers.setMatrixAt(k, dummy.matrix);
  }
  g.add(towers);
  // tower beacons
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(.6, 8, 6), new THREE.MeshBasicMaterial({ color: glowColor(2, .3, .3), toneMapped: false }), TW);
  const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
  for (let k = 0; k < TW; k++) { towers.getMatrixAt(k, tmpM); tmpM.decompose(tmpP, tmpQ, tmpS); dummy.position.set(tmpP.x, tmpP.y + tmpS.y / 2 + .6, tmpP.z); dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); beacons.setMatrixAt(k, dummy.matrix); }
  g.add(beacons);

  g.visible = false;
  scene.add(g);
  return { g, P, T, R, U, N, L };
}

/* ---------------- DOM hooks ---------------- */
const zones = [...document.querySelectorAll('[data-zone]')];
const callouts = [...document.querySelectorAll('.callout')];
const calloutAnch = [new THREE.Vector3(0, 1.15, .6), new THREE.Vector3(0, .43, -2.8), new THREE.Vector3(1.6, -.1, -2.4), new THREE.Vector3(0, -.42, 1.8)];
const calloutWin = [[.2, .4], [.25, .42], [.46, .56], [.56, .66]];
const stories = [...document.querySelectorAll('.story')];
const storyWin = [[.2, .42], [.46, .66], [.72, .94]];
const heroContent = document.getElementById('heroContent');
const bgType = document.querySelector('.hero__bgtype');
const scrollHint = document.querySelector('.hero__scroll');
const roVel = document.getElementById('roVel'), roFld = document.getElementById('roFld'), roCam = document.getElementById('roCam');
const tWords = [...document.querySelectorAll('.tword')];
const tkTime = document.getElementById('tkTime'), tkSpeed = document.getElementById('tkSpeed'), tkBar = document.getElementById('tkBar');
const engLabels = [...document.querySelectorAll('.eng-label')];
const engLines = document.querySelector('.eng-lines');
const engIntro = document.querySelector('.eng__intro');

/* ---------------- sizing / input ---------------- */
let W = 0, H = 0;
const resize = () => {
  W = innerWidth; H = innerHeight;
  renderer.setSize(W, H, false);
  composer.setSize(W, H);
  gtao.setSize(W * DPR, H * DPR);
  bloom.resolution.set(W, H);
  camera.aspect = W / H; camera.updateProjectionMatrix();
};
addEventListener('resize', resize); resize();

const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; });

/* ---------------- ignition ---------------- */
let igniteT = -1, igniteAt = 0;
// the reveal plays once both the interface has opened and the craft is loaded, whichever comes last
const ignite = () => { if (igniteT >= 0 || !shipReady) return; igniteT = 0; igniteAt = performance.now(); if (REDUCED) { REVEAL.value = -1e3; revealDone = true; } };
addEventListener('feisar:ignite', ignite);

/* ---------------- hero camera keys ---------------- */
const KEYS = [
  [0.00, .72, .2, 15, .3, -.2], [0.12, .9, .24, 14, .3, -.17], [0.22, 1.57, .06, 10.5, .35, -.02], [0.40, 1.75, .12, 10, .35, 0],
  [0.48, 2.45, .62, 13.5, .2, 0], [0.64, 2.75, .55, 13, .2, 0], [0.72, 3.14, .2, 14, -.2, 0], [1.00, 3.14, .16, 15, -.4, 0],
];
const sampleKeys = p => {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const a = KEYS[i], b = KEYS[i + 1], t = smooth(a[0], b[0], p);
  return a.slice(1).map((v, k) => lerp(v, b[k + 1], t));
};
const camNames = ['A-01', 'B-02', 'C-03', 'D-04'];

/* ---------------- frame ---------------- */
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camTarget = new THREE.Vector3(), camPos = new THREE.Vector3(), camUp = new THREE.Vector3(0, 1, 0);
let idleT = 0, idleMix = 0, revealDone = false;
let prevZoneFrames = 0, last = performance.now(), t = 0, vel = 0, prevZone = null, trackS = 0, trackSpeed = 0, flash = 0, warp = 0, lastKick = 0;
const ST = window.FEISAR_STAGE || (window.FEISAR_STAGE = { zone: null, p: 0, boost: 0, drag: 0, kick: 0 });
const pSm = {};


const qHinge = new THREE.Quaternion(), xAxis = new THREE.Vector3(1, 0, 0);
function setBrakes(l, r) {
  for (const [k, v] of [['L', l], ['R', r]]) {
    const n = airbrakes[k]; if (!n) continue;
    n.userData.a = lerp(n.userData.a || 0, v * .9, .15);
    n.quaternion.copy(n.userData.q0).multiply(qHinge.setFromAxisAngle(xAxis, n.userData.a));
  }
}

function explode(e) {
  for (const pt of parts) pt.node.position.copy(pt.base).addScaledVector(pt.off, e * 1.35);
}

function project(v) {
  tmp.copy(v).project(camera);
  return [(tmp.x * .5 + .5) * W, (-tmp.y * .5 + .5) * H, tmp.z];
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, .05); last = now;
  t += dt; TIME.value = t;
  vel = lerp(vel, ST.boost * 2600, .08);
  if (ST.kick !== lastKick) { lastKick = ST.kick; flash = Math.max(flash, .5); warp = 1; }   // scene jump
  warp = Math.max(0, warp - dt * 1.6);
  mouse.sx = lerp(mouse.sx, mouse.x, .06); mouse.sy = lerp(mouse.sy, mouse.y, .06);

  // ignition reveal
  if (igniteT >= 0 && !revealDone) {
    igniteT = (now - igniteAt) / 1000;
    const k = smooth(.15, 2.9, igniteT);
    REVEAL.value = lerp(5.6, -3.9, k);
    scanGroup.visible = k > 0 && k < 1;
    scanGroup.position.z = REVEAL.value;
    if (igniteT < .25) flash = Math.max(flash, 1 - igniteT / .25);
    if (k >= 1) { REVEAL.value = -1e3; scanGroup.visible = false; revealDone = true; }
  }
  flash = Math.max(0, flash - dt * 2.2);

  // launch scene at rest: the craft alternates between solid and holographic wireframe with the scan sweep;
  // as soon as the cinematic starts (scroll / hold) it returns to solid and stays solid
  if (revealDone && shipReady) {
    const idle = ST.zone === 'hero' && ST.idle && !REDUCED;
    idleT = idle ? idleT + dt : 0;
    const c = idleT % 9, target = idle && c > 3.6 && c < 6.8 ? 1 : 0;
    idleMix += clamp(target - idleMix, -dt / (idle ? 1.2 : .35), dt / 1.2);
    if (idleMix > .001) {
      REVEAL.value = lerp(-3.9, 5.6, idleMix);
      scanGroup.visible = idleMix < .999; scanGroup.position.z = REVEAL.value;
    } else if (REVEAL.value > -1e2) { REVEAL.value = -1e3; scanGroup.visible = false; idleMix = 0; }
  }

  // the active zone comes from the scene controller
  const name = ST.zone;
  canvas.style.opacity = name ? 1 : 0;
  if (!name || !shipReady) return;
  const p = ST.p;
  if (name !== prevZone) pSm[name] = p;
  pSm[name] = lerp(pSm[name], p, 1 - Math.pow(.004, dt));
  const P = pSm[name];
  const wide = W > 900;

  if (name !== prevZone) {
    studio.visible = name !== 'track';
    if (name === 'track' && !track) track = buildTrack();
    if (track) track.g.visible = name === 'track';
    gate.visible = name === 'hero';
    lines.visible = true;
    camera.up.set(0, 1, 0);
    shipRoot.position.set(0, 0, 0); shipRoot.quaternion.identity();
    if (name !== 'eng') explode(0);
    scene.fog.near = name === 'track' ? 40 : 18; scene.fog.far = name === 'track' ? 340 : 70;
    scene.fog.color.set(name === 'track' ? 0xe9eff7 : 0xeef2f8);
    skyU.bottom.value.set(name === 'track' ? 0xc9d8ec : 0xd9e3f0);
    prevZone = name; prevZoneFrames = 0;
  }

  let speedAmt = 0, blur = 0, aberr = .0015, audioSpeed = .2;

  if (name === 'hero') {
    const [az0, el, d0, lookY, off] = sampleKeys(P);
    const dist = d0 * (W < 700 ? 1.45 : 1);
    const launch = REDUCED ? 0 : smooth(.84, 1, P);
    const az = az0 + mouse.sx * .25 * (1 - smooth(.7, .8, P));
    const elv = el + mouse.sy * .08;
    camera.fov = W < 700 ? 44 : 32;
    camera.position.set(Math.sin(az) * Math.cos(elv) * dist, Math.sin(elv) * dist + lookY, Math.cos(az) * Math.cos(elv) * dist);
    camera.lookAt(0, lookY, 0);
    camera.setViewOffset(W, H, (wide ? off : 0) * W, wide ? 0 : -H * .24 * (1 - smooth(.1, .2, P)), W, H);
    camera.updateProjectionMatrix();
    shipRoot.position.set(0, Math.sin(t * 1.7) * .09, launch * launch * 70);
    shipRoot.rotation.set(Math.sin(t * 1.3) * .015 - launch * .04, mouse.sx * .1 * (1 - smooth(.15, .25, P)), Math.sin(t * .9) * .03 - mouse.sx * .14 * (1 - launch));
    setBrakes(mouse.sx < -.12 ? .9 : 0, mouse.sx > .12 ? .9 : 0);
    const thrust = .45 + smooth(.66, .86, P) * .8 + Math.min(vel / 3000, .5);
    plumes.forEach(pl => { pl.material.opacity = (.16 + thrust * .18) * (.85 + Math.random() * .15); pl.scale.set(1, .5 + thrust * .9, 1); });
    speedAmt = REDUCED ? 0 : .1 + smooth(.62, .84, P) * .9 + Math.min(vel / 2500, .6);
    blur = launch * .04; aberr = .0005 + speedAmt * .0012;
    audioSpeed = .2 + thrust * .35 + launch * .4;
    field.scale.setScalar(1 + Math.sin(t * 2) * .03); field2.rotation.z = t * .4;
    gate.rotation.z = t * .1;
    gate.children.forEach((s, i) => { if (s.geometry === starGeo) s.rotation.y = t * 1.2 + i; });
    grid.position.z = -((t * (2 + speedAmt * 30)) % 2);
    dust.position.z = -((t * (1 + speedAmt * 20)) % 35);
    updateLines(speedAmt, dt, false);

    heroContent.style.opacity = 1 - smooth(.04, .13, P);
    heroContent.style.transform = `translateY(${wide ? -46 : 0}%) translateX(${-smooth(.04, .14, P) * 80}px)`;
    if (scrollHint) scrollHint.style.opacity = 1 - smooth(.01, .05, P);
    bgType.style.transform = `translateY(-50%) translateX(${-P * 30}vw)`;
    callouts.forEach((el, i) => {
      const o = win(P, calloutWin[i][0], calloutWin[i][1], .03);
      el.style.opacity = o;
      if (o < .01) return;
      tmp2.copy(calloutAnch[i]).applyMatrix4(ship.matrixWorld);
      const [x, y] = project(tmp2);
      el.classList.toggle('flip', x > W * .55);
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    stories.forEach((el, i) => { const o = win(P, storyWin[i][0], storyWin[i][1], .035); el.style.opacity = o; el.style.transform = `translateY(${(1 - o) * 30}px)`; });
    if ((t * 10 | 0) % 2 === 0) {
      roVel.textContent = Math.round(380 + thrust * 520 + launch * 900 + Math.random() * 8);
      roFld.textContent = (99.9 + Math.random() * .099).toFixed(3);
      roCam.textContent = camNames[P < .18 ? 0 : P < .45 ? 1 : P < .7 ? 2 : 3];
    }
  }

  if (name === 'track' && track) {
    const { P: TP, T: TT, R: TR, U: TU, N } = track;
    // the craft laps the circuit on its own; holding the pointer / space boosts it
    trackSpeed = lerp(trackSpeed, .55 + ST.boost * .9, 1 - Math.pow(.15, dt));
    trackS += dt * trackSpeed * .028;
    const s = ((trackS % 1) + 1) % 1, fi = s * N, i0 = Math.floor(fi), i1 = (i0 + 1) % N, f = fi - i0;
    const pos = TP[i0].clone().lerp(TP[i1], f), tan = TT[i0].clone().lerp(TT[i1], f).normalize();
    const right = TR[i0].clone().lerp(TR[i1], f).normalize(), up = TU[i0].clone().lerp(TU[i1], f).normalize();
    const sway = Math.sin(t * .8) * 1.1;
    pos.addScaledVector(up, .8 + Math.sin(t * 2.3) * .05).addScaledVector(right, sway);
    const m4 = new THREE.Matrix4().makeBasis(right, up, tan);
    shipRoot.position.copy(pos);
    shipRoot.quaternion.setFromRotationMatrix(m4);
    shipRoot.rotateZ(-Math.cos(t * .8) * .18);
    const back = (i0 - 27 + N) % N;
    camPos.copy(TP[back]).addScaledVector(TU[back], 3.1).addScaledVector(TR[back], sway * .6);
    camera.position.copy(camPos);
    camTarget.copy(pos).addScaledVector(tan, 6).addScaledVector(up, .2);
    camUp.copy(up).lerp(tmp.set(0, 1, 0), .4).normalize();
    camera.up.copy(camUp);
    camera.lookAt(camTarget);
    camera.fov = (W < 700 ? 66 : 50) + Math.min(trackSpeed, 1.5) * 8;
    camera.clearViewOffset(); camera.updateProjectionMatrix();
    const turn = TT[(i0 + 10) % N].clone().cross(TT[i0]).y;
    setBrakes(turn > .002 ? .9 : 0, turn < -.002 ? .9 : 0);
    plumes.forEach(pl => { pl.material.opacity = .4 * (.85 + Math.random() * .15); pl.scale.set(1, 1.4 + Math.random() * .2, 1); });
    speedAmt = .6 + Math.min(trackSpeed, 1) * .4;
    blur = .012 + Math.min(trackSpeed, 1.2) * .025; aberr = .0003 + speedAmt * .0004;
    audioSpeed = .55 + Math.min(trackSpeed, 1) * .45;
    updateLines(speedAmt, dt, true);
    tWords.forEach((el, i) => {
      const a = i / tWords.length, b = (i + 1) / tWords.length, k = clamp((P - a) / (b - a), 0, 1);
      el.style.opacity = Math.sin(k * Math.PI) ** .7;
      el.style.transform = `translate(-50%, -50%) scale(${.4 + k * k * 3.2})`;
      el.style.filter = `blur(${Math.max(0, k - .7) * 20}px)`;
    });
    const lap = 38.2 + P * 41 + (t % 100) * .01;
    tkTime.textContent = `0${Math.floor(lap / 60)}:${(lap % 60).toFixed(2).padStart(5, '0')}`;
    tkSpeed.textContent = String(Math.round(820 + Math.min(trackSpeed, 1.4) * 560 + Math.random() * 6)).padStart(4, '0');
    tkBar.style.transform = `scaleX(${clamp(.4 + trackSpeed * .5, 0, 1)})`;
  }

  if (name === 'eng') {
    const e = smooth(.1, .38, P) * (1 - smooth(.86, .98, P));
    explode(e);
    WIRE_ALL.value = e * .55;
    const az = -.5 - P * 1.1 + mouse.sx * .3 + ST.drag, el = .5 + mouse.sy * .1, dist = 27 * (W < 700 ? 1.45 : 1);
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist + .4, Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(0, .5, -.4);
    camera.fov = W < 700 ? 44 : 32;
    camera.setViewOffset(W, H, wide ? -W * .05 : 0, wide ? -H * .04 : -H * .12, W, H);
    camera.updateProjectionMatrix();
    shipRoot.position.set(0, Math.sin(t * 1.5) * .06, 0);
    shipRoot.rotation.set(0, 0, 0);
    setBrakes(e * 1.1, e * 1.1);
    plumes.forEach(pl => { pl.material.opacity = .12 * (1 - e); });
    field2.rotation.z = t * .3;
    updateLines(.08, dt, false);
    ship.updateMatrixWorld(true);
    const [cx, cy] = project(tmp.set(0, .3, -.4).applyMatrix4(ship.matrixWorld));
    // technical-drawing callouts: labels stacked in two columns either side of the craft, leader lines to the parts
    const items = [];
    engLabels.forEach((lab, i) => {
      const part = parts.find(pt => pt.node.name === lab.dataset.part);
      if (!part) return;
      tmp2.copy(anchors[part.node.name]).addScaledVector(part.off, e * 1.35).applyMatrix4(ship.matrixWorld);
      const [x, y] = project(tmp2);
      // one shared timing (symmetric when scrolling back up): lines draw first, then the labels fade in
      const o = smooth(.3, .42, P) * (1 - smooth(.76, .84, P));
      items.push({ lab, x, y, o });
    });
    [...items].sort((a, b) => a.x - b.x).forEach((it, k) => { it.left = k < Math.floor(items.length / 2); });
    const colW = Math.min(W * .27, 420), gap = 58, svgParts = [];
    if (!wide) items.forEach(it => {                  // phones: numbered markers on the parts, no columns
      it.lab.classList.remove('flip');
      it.lab.style.opacity = smooth(.55, 1, it.o);
      it.lab.style.transform = `translate(${it.x}px, ${it.y}px)`;
    });
    for (const left of wide ? [true, false] : []) {
      const col = items.filter(it => it.left === left).sort((a, b) => a.y - b.y);
      const floor = left && wide ? engIntro.getBoundingClientRect().bottom + 50 : H * .2;
      const top = Math.max(floor, cy - (col.length - 1) * gap / 2 - 40);
      col.forEach((it, k) => { it.ly = Math.max(it.y, top + k * gap); });
      for (let k = col.length - 2; k >= 0; k--) col[k].ly = Math.min(col[k].ly, col[k + 1].ly - gap);
      col.forEach(it => {
        const lx = left ? Math.max(260, cx - colW) : Math.min(W - 280, cx + colW);
        const ex = lx + (left ? 34 : -34);
        it.lab.classList.toggle('flip', left);
        it.lab.style.opacity = smooth(.55, 1, it.o);
        it.lab.style.transform = `translate(${lx + (left ? -6 : 6)}px, ${it.ly}px)`;
        if (it.o > .02) {
          const len = Math.hypot(ex - it.x, it.ly - it.y) + Math.abs(lx - ex);
          svgParts.push(`<g opacity="${Math.min(1, it.o * 1.4).toFixed(3)}"><path d="M${it.x.toFixed(1)},${it.y.toFixed(1)} L${ex.toFixed(1)},${it.ly.toFixed(1)} L${lx.toFixed(1)},${it.ly.toFixed(1)}" stroke-dasharray="${len.toFixed(0)}" stroke-dashoffset="${((1 - it.o) * len).toFixed(0)}"/>` +
            `<circle class="halo" cx="${it.x.toFixed(1)}" cy="${it.y.toFixed(1)}" r="${((9 + Math.sin(t * 3 + it.x) * 2) * it.o).toFixed(1)}"/><circle cx="${it.x.toFixed(1)}" cy="${it.y.toFixed(1)}" r="${(3.5 * it.o).toFixed(2)}"/></g>`);
        }
      });
    }
    engLines.innerHTML = svgParts.join('');
  } else WIRE_ALL.value = 0;

  // post fx
  fx.uniforms.uTime.value = t;
  fx.uniforms.uBlur.value = REDUCED ? 0 : blur + warp * warp * .09;
  aberr += warp * .006;
  fx.uniforms.uAberr.value = REDUCED ? 0 : aberr;
  fx.uniforms.uFlash.value = flash;

  key.position.copy(shipRoot.position).add(tmp.set(6, 12, 8));
  key.target.position.copy(shipRoot.position);
  for (const pl of plumes) for (const [m, k] of pl.userData.layers) m.material.uniforms.uPower.value = pl.material.opacity * k;
  composer.render();
}

function updateLines(amt, dt, camSpace) {
  lineMat.opacity = Math.min(1, amt) * .8;
  const sp = 12 + amt * 110;
  if (camSpace) {
    lines.position.copy(camera.position); lines.quaternion.copy(camera.quaternion);
  } else { lines.position.set(0, 0, 0); lines.quaternion.identity(); }
  for (let i = 0; i < LINES; i++) {
    const d = lineData[i];
    d.z += (camSpace ? 1 : -1) * sp * d.sp * dt;
    if (camSpace) { if (d.z > 2) d.z -= 90; } else if (d.z < -45) d.z += 90;
    dummy.position.set(d.x, d.y - (camSpace ? 1 : 0), d.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, d.len * (1 + amt * 4));
    dummy.updateMatrix(); lines.setMatrixAt(i, dummy.matrix);
  }
  lines.instanceMatrix.needsUpdate = true;
}

requestAnimationFrame(frame);
