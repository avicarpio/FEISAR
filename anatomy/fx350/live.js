const D = __DATA__;
// embedded in the FEISAR site: fill the frame, and hand the wheel to the page so its scenes move on
const EMBED = new URLSearchParams(location.search).has("embed");
if (EMBED) {
  document.body.classList.add("fx-embed");
  addEventListener("wheel", (event) => {
    event.preventDefault();
    if (event.fxZoom) return;
    parent.postMessage({ type: "fx-wheel", dy: Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX }, "*");
  }, { passive: false });
}
const root = document.querySelector(".fx");
const stage = root.querySelector(".fx-stage");
const craft = stage.querySelector(".fx-craft");
const live = root.querySelector("[data-live]");
const readout = root.querySelector("[data-readout]");
const engageButton = root.querySelector("[data-engage]");
const engageLabel = root.querySelector("[data-engage-label]");
const partButtons = [...root.querySelectorAll(".fx-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...craft.querySelectorAll(".it")].map((el) => ({
  el,
  piece: el.dataset.piece,
  ride: el.dataset.ride || el.dataset.piece,
  key: Number(el.dataset.k),
  m: el.dataset.m.split(",").map(Number),
  shown: "",
}));
for (const node of nodes) node.lift = node.m[0] * D.V[0] + node.m[1] * D.V[1] + node.m[2] * D.V[2];
let order = nodes.map((_, index) => index);
// the real mesh: whole-assembly layers moved by CSS transforms (composited, never repainted)
const layers = [...stage.querySelectorAll(".fx-layer")].map((el) => {
  const m = el.dataset.m.split(",").map(Number);
  return { el, piece: el.dataset.piece, front: el.dataset.side === "f", key: Number(el.dataset.k), m, lift: m[0] * D.V[0] + m[1] * D.V[1] + m[2] * D.V[2], shown: "" };
});
const frontSvg = stage.querySelector(".fx-front");
let layerOrder = "";

const IDS = Object.keys(D.pieces);
const STAGGER = D.stagger;
const SPRING = D.spring;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const fmt = (value, digits = 0) => value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

let clock = 0;
let apart = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let touring = !still.matches;
let tourClock = -1;
let idleTimer = 0;
let visible = false;
let frame = 0;
let last = 0;

// ---------------------------------------------------------------- the field, from the model
const Mo = D.model;
const field = { on: false, i: { x: 0, v: 0 }, spin: { x: 0, v: 0 }, throttle: { x: 0, v: 0 } };
const gapOf = (i) => (i <= 0 ? Mo.cradle : Math.max(Mo.cradle, Mo.hoverNom + Math.log(i / Mo.iNom) / Mo.K));
function ease(state, target, dt, seconds, calm) {
  if (calm) {
    state.x = target;
    state.v = 0;
    return false;
  }
  const w = 1 / seconds;
  for (let step = 0; step < 4; step++) {
    const h = dt / 4;
    state.v += (w * w * (target - state.x) - 2 * w * state.v) * h;
    state.x += state.v * h;
  }
  if (Math.abs(target - state.x) < 1e-4 && Math.abs(state.v) < 1e-4) {
    state.x = target;
    state.v = 0;
    return false;
  }
  return true;
}
function stepField(dt, calm) {
  const on = field.on;
  let moving = ease(field.i, on ? Mo.iNom : 0, dt, on ? 0.9 : 0.6, calm);
  moving = ease(field.spin, on ? 1 : 0, dt, on ? 1.4 : 2.2, calm) || moving;
  moving = ease(field.throttle, on ? Mo.idle : 0, dt, 1.1, calm) || moving;
  return moving;
}
const liftNow = () => (gapOf(field.i.x) - Mo.cradle) / Mo.U;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}
function fieldText() {
  const i = field.i.x;
  const gap = gapOf(i) * 1000;
  const rpm = Mo.rpm * field.spin.x;
  if (i < 0.02) return `${fmt(Mo.mass)} kg · docked`;
  if (i < Mo.iLift) return `${fmt(i, 2)} kA · on cradles · lift ${fmt((100 * (i / Mo.iLift) ** 2))}%`;
  return `${fmt(i, 2)} kA · hover ${fmt(gap)} mm · Tru-Fly ${fmt(rpm / 1000, 1)}k rpm`;
}
function describe() {
  const text = selected ? D.pieces[selected].say : field.on ? "field engaged" : apart ? `apart · ${D.order.length} assemblies` : "Assembled, docked";
  if (stage.getAttribute("aria-valuetext") !== text) stage.setAttribute("aria-valuetext", text);
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  if (on) stage.setAttribute("data-apart", "");
  else stage.removeAttribute("data-apart");
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? STAGGER : [...STAGGER].reverse()) {
    if (!piece[id]) continue;
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * SPRING.stagger) };
  }
  describe();
  run();
}

function select(id) {
  if (id === "stand") id = null;
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  for (const layer of layers) {
    if (id !== null && layer.piece === id) layer.el.setAttribute("data-on", "");
    else layer.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? D.order.indexOf(id) + 1 : 0));
  describe();
}

function steerSpring(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return false;
  }
  for (let index = 0; index < SPRING.substeps; index++) {
    const h = dt / SPRING.substeps;
    state.v += ((state.target - state.x) * SPRING.stiffness - state.v * SPRING.damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  const rise = liftNow();
  for (const node of nodes) {
    const share = piece[node.ride].x;
    const up = node.piece === "stand" ? 0 : rise;
    const mx = node.m[0] * share;
    const my = node.m[1] * share;
    const mz = node.m[2] * share + up;
    const tx = D.EX[0] * mx + D.EY[0] * my + D.EZ[0] * mz;
    const ty = D.EX[1] * mx + D.EY[1] * my + D.EZ[1] * mz;
    const text = Math.abs(tx) < 0.005 && Math.abs(ty) < 0.005 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
  // layers: px per viewBox unit, then back layers by depth, the systems, front layers by depth
  const px = stage.clientWidth / D.W || 1;
  for (const layer of layers) {
    const share = piece[layer.piece].x;
    const mx = layer.m[0] * share;
    const my = layer.m[1] * share;
    const mz = layer.m[2] * share + rise;
    const tx = (D.EX[0] * mx + D.EY[0] * my + D.EZ[0] * mz) * px;
    const ty = (D.EX[1] * mx + D.EY[1] * my + D.EZ[1] * mz) * px;
    const text = Math.abs(tx) < 0.01 && Math.abs(ty) < 0.01 ? "" : `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px)`;
    if (text !== layer.shown) {
      layer.shown = text;
      layer.el.style.transform = text;
    }
    layer.depth = layer.key + layer.lift * share;
  }
  const backs = layers.filter((layer) => !layer.front).sort((a, b) => a.depth - b.depth);
  const fronts = layers.filter((layer) => layer.front).sort((a, b) => a.depth - b.depth);
  const sequence = [...backs, null, ...fronts];
  const signature = sequence.map((layer) => (layer ? layer.el.dataset.piece + layer.el.dataset.side : "|")).join(",");
  if (signature !== layerOrder) {
    layerOrder = signature;
    const fragment = document.createDocumentFragment();
    for (const layer of sequence) fragment.appendChild(layer ? layer.el : frontSvg);
    stage.appendChild(fragment);
  }
  const keyOf = (node) => node.key + node.lift * piece[node.ride].x + (node.piece === "stand" ? 0 : rise * D.V[2]);
  const next = nodes.map((_, index) => index).sort((a, b) => keyOf(nodes[a]) - keyOf(nodes[b]));
  if (next.some((index, at) => index !== order[at])) {
    const fragment = document.createDocumentFragment();
    for (const index of next) fragment.appendChild(nodes[index].el);
    craft.appendChild(fragment);
    order = next;
  }
}

function setField(on) {
  if (field.on === on) return;
  field.on = on;
  engageButton.dataset.state = on ? "on" : "";
  engageLabel.textContent = on ? "Dock" : "Engage field";
  live.textContent = on ? "Field engaged: the craft lifts off its cradles" : "Field off: the craft settles on its cradles";
  describe();
  run();
}

const TOUR_STEP = 1.5;
function tourAt(time) {
  const apartFrom = 1.6;
  const listFrom = apartFrom + STAGGER.length * SPRING.stagger + 0.9;
  const listTo = listFrom + D.order.length * TOUR_STEP;
  const engage = listTo + 1.4;
  if (time < apartFrom) return { apart: false, part: null, field: false };
  if (time < listFrom) return { apart: true, part: null, field: false };
  if (time < listTo) return { apart: true, part: D.order[Math.floor((time - listFrom) / TOUR_STEP)], field: false };
  if (time < engage) return { apart: false, part: null, field: false };
  if (time < engage + 9) return { apart: false, part: null, field: true };
  return { apart: false, part: null, field: false, done: true };
}

function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || field.on) return quietTour();
    touring = !still.matches;
    tourClock = -0.6;
    run();
  }, 4200);
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "taking apart" : "closing up";
  if (apart) return `apart · ${D.order.length} assemblies`;
  return fieldText();
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    const step = tourAt(tourClock);
    if (step.done) tourClock = -2;
    setApart(step.apart);
    select(step.part);
    setField(step.field);
  }
  let moving = false;
  for (const id of IDS) if (steerSpring(piece[id], dt, calm)) moving = true;
  const fieldMoving = stepField(dt, calm);
  place();
  if (window.FX_FRAME) window.FX_FRAME({ dt, field, apart: piece });
  say(idleText());
  frame = visible && (moving || fieldMoving || touring || field.on) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it, .fx-layer") : null;
  return item ? item.dataset.piece : null;
}

// the craft comes apart only once the pointer has rested on it: a pass over it changes nothing
const INTENT = 700;
let intentTimer = 0;
let lastPoint = null;
stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" || pan) return;
  inside = true;
  lastPoint = { clientX: event.clientX, clientY: event.clientY };
  clearTimeout(leaveTimer);
  quietTour();
  if (field.on) return;
  if (!apart) {
    if (!intentTimer)
      intentTimer = setTimeout(() => {
        intentTimer = 0;
        if (!inside || field.on) return;
        setApart(true);
        if (lastPoint) select(pieceAt(lastPoint));
        run();
      }, INTENT);
    return;
  }
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(intentTimer);
  intentTimer = 0;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    setApart(false);
  }, 260);
});

stage.addEventListener("pointerup", (event) => {
  if (event.pointerType !== "touch" || field.on || moved || pinch || touches.size > 1) return;
  quietTour();
  const id = pieceAt(event);
  if (!id || id === "stand") {
    select(null);
    setApart(!apart);
  } else {
    setApart(true);
    select(id);
  }
  run();
});

engageButton.addEventListener("click", () => {
  quietTour();
  if (!field.on) {
    select(null);
    setApart(false);
  }
  setField(!field.on);
});

partButtons.forEach((button) => {
  const show = () => {
    if (field.on) setField(false);
    quietTour();
    clearTimeout(leaveTimer);
    setApart(true);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(false);
    }, 260);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("keydown", (event) => {
  const index = selected ? D.order.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(D.order.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = D.order.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    setField(false);
    select(null);
    setApart(false);
    run();
    return;
  } else if (event.key === "e" || event.key === "E" || event.key === "Enter") {
    event.preventDefault();
    quietTour();
    select(null);
    setApart(false);
    setField(!field.on);
    return;
  } else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    zoomBy(1.6, null, true);
    return;
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    zoomBy(1 / 1.6, null, true);
    return;
  } else if (event.key === "0") {
    event.preventDefault();
    zoomTo(1, 0, 0, true);
    return;
  } else if (event.key === " ") {
    event.preventDefault();
    quietTour();
    setField(false);
    setApart(!apart);
    if (!apart) select(null);
    run();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  setField(false);
  setApart(true);
  select(D.order[next]);
  run();
});

// ---------------------------------------------------------------- the field and the plume (WebGL)
// world space, in the figure's own camera: one glowing column per emitter from its face to the
// lattice, the light those columns lay on the tiles, and the Syrus exhaust leaving the nacelle.
// Light theme: the colour the paper should show is solved for its ink (anatomy webgl.md, 8.1).
const LIGHT_THEME = document.body.dataset.theme === "light" ? 1 : 0;
const EM = D.emitters.flat();
while (EM.length < 20) EM.push(0);
const FIELD_FRAG = `
uniform float uField, uThrust, uRise, uLight;
uniform vec4 uEm[5];
uniform vec4 uPl;
const float ZL = ${D.zlat.toFixed(2)};
vec4 over(vec4 top, vec4 under) { return top + under * (1. - top.a); }
vec4 inkFor(vec3 seen, float cover) { vec3 ab = 1. - seen; float a = max(max(ab.r, max(ab.g, ab.b)), cover); return vec4(vec3(a) - ab, a); }
vec3 paperOf(float e) {
  vec3 c = vec3(1.);
  c = mix(c, vec3(.85, .93, 1.), smoothstep(0., .12, e));
  c = mix(c, vec3(.16, .42, .94), smoothstep(.1, .5, e));
  c = mix(c, vec3(.2, .68, 1.), smoothstep(.45, .7, e));
  c = mix(c, vec3(.9, .98, 1.), smoothstep(.68, .95, e));
  return c;
}
void main() {
  vec2 vb = viewOf(gl_FragCoord.xy);
  vec3 p0 = rayOf(vb);
  vec3 V = towardViewer();
  vec3 fp = onFloor(vb, ZL);
  float column = 0.;
  float tint = 0.;
  for (int i = 0; i < 5; i++) {
    vec4 e = uEm[i];
    if (e.w <= 0.) continue;
    float face = e.z + uRise;
    vec2 vxy = V.xy;
    float tt = dot(e.xy - p0.xy, vxy) / dot(vxy, vxy);
    vec3 q = p0 + tt * V;
    float dist = length(q.xy - e.xy);
    float r = e.w;
    float body = exp(-dist * dist / (r * r * .45));
    float zw = window(q.z, ZL, face, 2.5);
    float bands = .72 + .28 * sin((q.z + uTime * 46.) * .5);
    column += body * zw * bands * (.5 + .5 * smoothstep(face, ZL, q.z));
    float fr = length(fp.xy - e.xy);
    tint += exp(-fr * fr / (r * r * 3.4));
  }
  // the Syrus exhaust: closest approach of the pixel's ray to the plume axis (along -x)
  vec3 A = vec3(-1., 0., 0.);
  vec3 pl = uPl.xyz + vec3(0., 0., uRise);
  vec3 w0 = p0 - pl;
  float b = dot(V, A);
  float d = dot(V, w0);
  float ee = dot(A, w0);
  float den = max(1e-4, 1. - b * b);
  float t = (b * ee - d) / den;
  float s = (ee - b * d) / den;
  float pd = length((p0 + t * V) - (pl + s * A));
  float pr = uPl.w * (1. + s / 70.);
  float along = window(s, 0., 150., 6.) * exp(-s / (60. + 70. * uThrust));
  float jet = exp(-pd * pd / (pr * pr * .5)) * along * (.8 + .2 * sin(s * .55 - uTime * 30.));
  float core = exp(-pd * pd / (pr * pr * .12)) * window(s, 0., 40., 8.);
  float e = 1. - exp(-2.3 * (column * uField * 1.1 + tint * uField * .32 + (jet * 1.1 + core * .8) * uThrust));
  vec4 lightInk = inkFor(paperOf(e), .52 * smoothstep(.62, .92, e));
  vec3 glow = vec3(.25, .62, 1.) * e + vec3(.8, .95, 1.) * smoothstep(.6, 1., e);
  vec4 darkInk = vec4(glow * e, e);
  vec4 ink = mix(darkInk, lightInk, uLight);
  ink.rgb = min(ink.rgb, vec3(ink.a));
  float n = (hash12(gl_FragCoord.xy + uTime) - .5) / 255.;
  ink += vec4(n) * smoothstep(0., 1.5 / 255., ink.a);
  gl_FragColor = clamp(ink, 0., 1.);
}`;
const fieldCanvas = stage.querySelector(".fx-field");
const fieldLayer = typeof glLayer === "function" && fieldCanvas ? glLayer({ canvas: fieldCanvas, fragment: FIELD_FRAG, view: [D.W, D.H], camera: D.camera, uniforms: ["uField", "uThrust", "uRise"], fixed: { uLight: LIGHT_THEME, uEm: EM, uPl: D.plume } }) : null;
let fieldShown = false;
window.FX_FRAME = ({ field: f }) => {
  if (!fieldLayer) return;
  const level = f.i.x / Mo.iNom;
  const thrust = f.throttle.x;
  if (level < 0.002 && thrust < 0.002) {
    if (fieldShown) fieldLayer.clear();
    fieldShown = false;
    return;
  }
  fieldShown = true;
  fieldLayer.draw({ uField: Math.min(1, level), uThrust: thrust, uRise: liftNow() }, still.matches ? 0.8 : clock);
};

// ---------------------------------------------------------------- zoom and pan, to see the parts up close
// the drawing is vector, so it stays sharp: pinch or Ctrl/⌘-scroll zooms at the pointer, double-click
// doubles, the buttons and + - 0 step; when zoomed, drag or scroll pans and the stage keeps the gestures
const zoomBox = stage.querySelector(".fx-zoom");
const ZOOM_MAX = 6;
const view = { s: 1, x: 0, y: 0 };
let pan = null;
let moved = false;
const touches = new Map();
let pinch = null;
function applyView(glide = false) {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  view.s = clamp(view.s, 1, ZOOM_MAX);
  view.x = clamp(view.x, w * (1 - view.s), 0);
  view.y = clamp(view.y, h * (1 - view.s), 0);
  zoomBox.classList.toggle("fx-glide", glide && !still.matches);
  zoomBox.style.transform = view.s > 1.001 ? `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(1)}px) scale(${view.s.toFixed(4)})` : "";
  if (view.s > 1.001) stage.setAttribute("data-zoomed", "");
  else stage.removeAttribute("data-zoomed");
}
function zoomTo(s, x, y, glide) {
  view.s = s;
  view.x = x;
  view.y = y;
  applyView(glide);
}
function zoomBy(factor, at, glide) {
  const r = stage.getBoundingClientRect();
  const cx = at ? at.clientX - r.left : r.width / 2;
  const cy = at ? at.clientY - r.top : r.height / 2;
  const s = clamp(view.s * factor, 1, ZOOM_MAX);
  const k = s / view.s;
  zoomTo(s, cx - (cx - view.x) * k, cy - (cy - view.y) * k, glide);
}
stage.addEventListener("wheel", (event) => {
  const zoom = event.ctrlKey || event.metaKey;
  if (!zoom && view.s <= 1.001) return; // the page scrolls (or, embedded, the site's scenes move on)
  event.preventDefault();
  event.fxZoom = true;
  if (zoom) zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0022)), event, false);
  else {
    view.x -= event.deltaX;
    view.y -= event.deltaY;
    applyView(false);
  }
}, { passive: false });
stage.addEventListener("dblclick", (event) => {
  if (event.target.closest("button")) return;
  event.preventDefault();
  if (view.s >= ZOOM_MAX - 0.01) zoomTo(1, 0, 0, true);
  else zoomBy(2, event, true);
});
stage.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  moved = false;
  if (event.pointerType === "touch") {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: view.s };
      pan = null;
      return;
    }
  }
  if (view.s <= 1.001 || (event.pointerType === "mouse" && event.button !== 0)) return;
  pan = { id: event.pointerId, x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener("pointermove", (event) => {
  if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    moved = true;
    zoomBy((pinch.s * (d / pinch.d)) / view.s, { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, false);
    return;
  }
  if (!pan || pan.id !== event.pointerId) return;
  const dx = event.clientX - pan.x;
  const dy = event.clientY - pan.y;
  if (!moved && Math.hypot(dx, dy) < 4) return;
  moved = true;
  stage.setAttribute("data-panning", "");
  view.x = pan.vx + dx;
  view.y = pan.vy + dy;
  applyView(false);
});
const endPointer = (event) => {
  touches.delete(event.pointerId);
  if (touches.size < 2) pinch = null;
  if (pan && pan.id === event.pointerId) {
    pan = null;
    stage.removeAttribute("data-panning");
  }
};
stage.addEventListener("pointerup", endPointer);
stage.addEventListener("pointercancel", endPointer);
root.querySelectorAll("[data-zoom]").forEach((button) =>
  button.addEventListener("click", () => {
    const kind = button.dataset.zoom;
    if (kind === "reset") zoomTo(1, 0, 0, true);
    else zoomBy(kind === "in" ? 1.6 : 1 / 1.6, null, true);
  }),
);
addEventListener("resize", () => applyView(false));

if (still.matches) touring = false;
const narrow = matchMedia("(hover: none), (max-width: 480px)");
const hint = root.querySelector(".fx-hint");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap to take apart" : "Hover the craft to take it apart");
wording();
narrow.addEventListener("change", wording);
window.addEventListener("resize", run);
place();
say(idleText());
