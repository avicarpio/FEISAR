// FEISAR FX350 — anatomy figure. `node build.mjs` writes index.html (light theme, the site's);
// `--dark` writes index-dark.html; `--audit` proves the geometry (anatomy/kit/audit.mjs).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import { tubePieces, tubeSvg, crossingsOf } from "../kit/tube.mjs";
import * as A from "../kit/audit.mjs";
import { glCamera } from "../kit/gl.mjs";
import { glScript } from "../scripts/inline-kit.mjs";
import * as M from "./model.mjs";
import { loadCraft, boundsOf, imagesOf } from "./mesh.mjs";
import { sliceAt } from "./shell.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--dark") ? "dark" : "light";
const DEG = Math.PI / 180;

// ---------------------------------------------------------------- camera and world
const W = 1040;
const H = 700;
const AZIMUTH = 58;
const ELEVATION = 34;
const U = 0.02; // metres per world unit

const ZLAT = 1; // top of the track lattice
const ZB = 40; // keel underside at rest, on the cradles
const CRAFT_FLOOR = 30; // lowest point of the mesh at rest
const HALF = 22; // fuselage half-height
const ZK = ZB + HALF; // fuselage axis
const EMIT_FACE = ZLAT + M.SHIP.cradle / U; // emitter faces at rest: 0.66 m over the lattice
const HOVER_LIFT = (M.SHIP.hoverNom - M.SHIP.cradle) / U; // world units the field lifts the craft

const DECK = { x: -300, y: -132, w: 590, d: 264, r: 12 };
const DECK_H = 14;
const FOOT_H = 7;

const P = k.fitProjection(
  [...k.boxCorners(DECK, -DECK_H - FOOT_H, 0), [-330, 0, 110], [320, 0, 90], [-30, 0, 215], [-170, 150, 100], [-170, -150, 100]],
  W,
  H,
  { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION },
);
const V = G.viewOf(P);
const KS = G.scaleOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const Faded = (list, style) => k.fadedSvg(list, style);
const FADE = [0.04, 0.42];

// fuselage frame: s along +x, u = +y, v = +z
const FX = G.frameOf([0, 0, ZK], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
const UP = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const HEX = [
  [-30, -10],
  [-22, -HALF],
  [22, -HALF],
  [30, -10],
  [20, HALF],
  [-20, HALF],
];
const BULKHEADS = [-190, -140, -90, 10, 60, 110];
const BULK_T = 4;

// ---------------------------------------------------------------- assemblies
const PIECES = {
  stand: { name: "Västerås test bed", say: "", move: [0, 0, 0] },
  keel: { name: "Keel and airframe", say: "keel · carbon-ceramic monocoque · Västerås", move: [0, 0, 0] },
  nose: { name: "Nose cone", say: "nose cone · lidar and trim emitter · Gothenburg", move: [92, 0, 6] },
  canopy: { name: "Canopy", say: "canopy · Torino glass · Helsinki frame", move: [18, 0, 92] },
  cell: { name: "Pilot cell", say: "pilot cell · Lisbon", move: [0, 0, 40] },
  sensors: { name: "Nose sensors", say: "lidar head, trim emitter and ballast rail · Gothenburg", move: [26, 0, 0] },
  core: { name: "Tru-Fly stability core", say: "Tru-Fly core · 42,000 rpm flywheel", move: [0, 0, 30] },
  power: { name: "Field capacitor bank", say: `capacitor bank · ${M.CAPACITY_KWH.toFixed(1)} kWh · Brussels`, move: [0, 0, 28] },
  avionics: { name: "Armacall VII avionics", say: "Armacall VII · flight and weapons control · Warsaw", move: [0, 0, 26] },
  podL: { name: "Port side and pod", say: "port side and pod · Barcelona, Catalan Republic", move: [0, -96, 14] },
  podR: { name: "Starboard side and pod", say: "starboard side and pod · Stuttgart", move: [-10, 128, -18] },
  emitters: { name: "AG field emitters", say: `field emitters · 4 × ${M.SHIP.iNom} kA · Delft`, move: [0, 0, -12] },
  nacelle: { name: "Engine nacelle", say: "engine nacelle · Toulouse", move: [0, 0, 70] },
  thrust: { name: "Syrus plasma ramjet", say: `Syrus plasma ramjet · ${M.SHIP.thrustMax} kN · Toulouse`, move: [-34, 0, 0] },
  spine: { name: "Dorsal spine", say: "dorsal spine covers · carbon-ceramic · Västerås", move: [0, 0, 44] },
  plumbing: { name: "Coolant and harness", say: "coolant loop and harness", move: [0, 0, 0] },
};
const STAGGER = ["canopy", "spine", "nose", "nacelle", "podL", "podR", "cell", "sensors", "thrust", "emitters", "core", "power", "avionics", "plumbing", "keel", "stand"];
const SPRING = { stagger: 0.035, stiffness: 64, damping: 14.2, substeps: 4 };

const R = A.recorder(P, { order: STAGGER, spring: SPRING });
const { items, nameFor } = R;
const record = R.solid;
const rideOf = (piece, move) => (move ? (Object.keys(PIECES).find((id) => PIECES[id].move === move) ?? piece) : piece);

function put(piece, ref, svg, { bias = 0, move, ride, shapes = [], name, route, chunk } = {}) {
  R.put({ piece, ride: ride ?? rideOf(piece, move), at: ref, bias, svg, move: move ?? PIECES[piece].move, shapes, name: name ?? nameFor(`${piece}.item`), route, chunk });
}

function tubeItems(piece, route, r, { name, tone = "hi", bias = 0, move, maxLength, spacing, closed = false, owner, touch, bundle, limp = false, breaks = [], gaps = [], caps = true, ends = [true, true], rims, free = [false, false], rings } = {}) {
  const id = nameFor(name ?? `${piece}.tube`);
  R.route(id, route, r, { owner: owner ?? id, touch, bundle, limp, gaps, closed, ends, rims, free, piece, move: move ?? PIECES[piece].move, ride: rideOf(piece, move) });
  tubePieces(route, r, P, { maxLength, spacing, closed, breaks, gaps, caps, rings }).forEach((part, index) =>
    put(piece, part.mid, tubeSvg(part, { tone }), { bias, move, name: `${id}:${index}`, route: id, chunk: index, shapes: [A.tube(part.points, part.radii)] }),
  );
  return id;
}

function turned(piece, F, profile, style = {}, { extra = "", inner = "", bias = 0, move, rims, bevel = 0, steps, name, owner, smooth = profile.some((point) => point[2]) } = {}) {
  const paths = G.solidOf(profile, F, P, { bevel, smooth: smooth === true ? { rows: Math.max(...profile.map(([, r]) => r)) < 20 ? 3 : 5 } : smooth, ...(rims ? { rims } : {}), ...(steps ? { steps } : {}) });
  const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
  const id = nameFor(name ?? `${piece}.turned`);
  const shape = record(A.solid(F, profile, { name: id, owner, curve: smooth && !smooth.slope ? profile : undefined }));
  put(piece, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: "hi", ...style, inner: inner ? Ln(inner, { tone: "faint" }) : "" }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function discAt(piece, F, s0, s1, r, style = {}, { extra = "", bias = 0, move, name, owner, bevel = 0 } = {}) {
  const id = nameFor(name ?? `${piece}.disc`);
  const shape = record(A.disc(F, s0, s1, r, { name: id, owner }));
  put(piece, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.disc(s0, s1, r, F, P, { bevel }), { tone: "hi", ...style }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function ringAt(piece, F, s0, s1, rIn, rOut, style = {}, { extra = "", bias = 0, move, name, owner } = {}) {
  const id = nameFor(name ?? `${piece}.ring`);
  const shape = record(A.ring(F, s0, s1, rIn, rOut, { name: id, owner }));
  put(piece, G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), S(G.ringBand(s0, s1, rIn, rOut, F, P), { tone: "hi", ...style }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function prismAt(piece, F, poly, s0, s1, style = {}, { extra = "", inner = "", bias = 0, move, name, owner, at: ref } = {}) {
  const id = nameFor(name ?? `${piece}.prism`);
  const shape = record(A.prism(F, poly, s0, s1, { name: id, owner }));
  const cu = poly.reduce((sum, [x]) => sum + x, 0) / poly.length;
  const cv = poly.reduce((sum, [, y]) => sum + y, 0) / poly.length;
  const centre = ref ?? G.add3(G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)), G.add3(G.mul3(F.u, cu), G.mul3(F.v, cv)));
  put(piece, centre, S(G.prismOf(F, poly, s0, s1, P), { tone: "hi", ...style, inner }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function boxAt(piece, plan, z, h, style = {}, { extra = "", bias = 0, move, bevel = 0.5, steps = 3, name, owner } = {}) {
  const centre = [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2];
  const id = nameFor(name ?? `${piece}.box`);
  const shape = record(A.slab(plan, z, h, { name: id, owner }, steps));
  put(piece, centre, S(k.slabOf(plan, z, h, P, steps, bevel), { tone: "hi", ...style }) + extra, { bias, move, name: id, shapes: [shape] });
  return shape;
}

function ballAt(piece, centre, r, { move, tone = "mid", bias = 0, name, owner } = {}) {
  const id = nameFor(name ?? `${piece}.ball`);
  put(piece, centre, S(G.sphereOf(centre, r, P, { steps: G.stepsFor(r, 32) }), { tone }), { move, bias, name: id, shapes: [record(A.ball(centre, r, { name: id, owner }))] });
}

function flangeAt(piece, centre, axis, r, thick, { bolts = 8, tone = "hi", move, bias = 0, boltR, name, owner } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name ?? `${piece}.flange`);
  const towards = G.dot3(F.a, V) > 0 ? thick / 2 : -thick / 2;
  const face = Math.abs(G.dot3(F.a, V)) > 0.12 && bolts ? Dots(G.dotsOf(F, towards, boltR ?? r * 0.74, bolts, P, { all: true }), { size: 0.42, tone: "mid" }) : "";
  put(piece, centre, S(G.disc(-thick / 2, thick / 2, r, F, P), { tone }) + face, { bias, move, name: id, shapes: [record(A.disc(F, -thick / 2, thick / 2, r, { name: id, owner }))] });
}

function padOn(piece, host, point, outward, a, h, { move, name, tone = "hi", bias = 0.1, owner, ring = false } = {}) {
  const hosts = [host].flat();
  const inside = (p) => hosts.some((shape) => A.sdf(shape, p) < 0);
  const axis = G.unit3(outward);
  const F = G.frameAlong(point, axis);
  const start = (angle) => {
    let lo = -2.5 * a;
    let hi = h;
    if (!inside(G.pointOf(F, lo, a, angle))) return 0;
    for (let step = 0; step < 40; step++) {
      const mid = (lo + hi) / 2;
      if (inside(G.pointOf(F, mid, a, angle))) lo = mid;
      else hi = mid;
    }
    return hi;
  };
  const low = Math.min(...Array.from({ length: 48 }, (_, index) => start((index / 48) * Math.PI * 2)));
  const id = nameFor(name ?? `${piece}.pad`);
  const face = ring && G.dot3(axis, V) > 0.15 ? Ln(G.circleOf(F, h, a * 0.55, P, 16), { tone: "faint" }) : "";
  put(piece, G.add3(point, G.mul3(axis, h / 2)), S(G.saddleOf(F, a, start, h, P), { tone }) + face, { bias, move, name: id, shapes: [record(A.disc(F, low - 0.05, h, a, { name: id, owner, seated: true, cut: hosts }))] });
  return G.add3(point, G.mul3(axis, h));
}

function pipe(piece, control, r, { bend = 2.6, tone = "hi", flanges = [true, true], flangeR = 1.45, bands = [], move, bias = 0, maxLength = 22, spacing, name, touch, breaks = [], gaps: extra = [], free, rings } = {}) {
  const flangeRs = [flangeR].flat().length > 1 ? [flangeR].flat() : [flangeR, flangeR].flat();
  const line = G.fillet(control, Math.max(r * bend, 3), r > 3 ? 24 : 12, { P, tube: r });
  const total = G.pathLength(line);
  const collars = [];
  [[0, -1], [total, 1]].forEach(([along, sign], index) => {
    if (!flanges[index]) return;
    const thick = Math.max(0.9, r * 0.55);
    const tangent = G.tangentAlong(line, along);
    collars.push({ kind: "flange", centre: G.add3(G.pointAlong(line, along), G.mul3(tangent, (-sign * thick) / 2)), tangent, radius: r * flangeRs[index], thick, gap: sign < 0 ? [0, thick] : [total - thick, total] });
  });
  for (const share of bands) {
    const along = total * share;
    const thick = Math.max(0.8, r * 0.7);
    collars.push({ kind: "band", centre: G.pointAlong(line, along), tangent: G.tangentAlong(line, along), radius: r * 1.18, thick, gap: [along - thick / 2, along + thick / 2] });
  }
  const gaps = [...collars.map(({ gap }) => gap), ...extra];
  const owner = tubeItems(piece, line, r, { name: name ?? `${piece}.pipe`, tone, bias, move, maxLength, spacing: spacing ?? Math.max(0.8, Math.min(2.4, r * 0.18)), touch, gaps, breaks, free, rings, rims: flanges.map((flanged, index) => (flanged ? r * flangeRs[index] : r)) });
  for (const { kind, centre, tangent, radius, thick } of collars)
    flangeAt(piece, centre, tangent, radius, thick, { bolts: kind === "flange" && r > 3 ? 8 : 0, tone: kind === "flange" ? tone : "mid", move, bias, name: `${owner}.${kind}`, owner });
  line.owner = owner;
  return line;
}

const CABLES = [];
const CLAMP_HALF = 0.9;
function cable(piece, points, { move, bias = 0.2, r = 0.62, bend = 5, name, bundle, touch, clamps = [], shells = [false, false], free } = {}) {
  const route = G.fillet(points, bend, 12, { P, tube: r });
  CABLES.push({ piece, route });
  const total = G.pathLength(route);
  const SHELL = 2.2;
  const gaps = [...clamps.flatMap(({ centre, axis, radius }) => crossingsOf(route, centre, axis, radius).map((along) => [along - CLAMP_HALF - 0.05, along + CLAMP_HALF + 0.05])), ...(shells[0] ? [[0, SHELL]] : []), ...(shells[1] ? [[total - SHELL, total]] : [])];
  const id = tubeItems(piece, route, r, { name: name ?? `${piece}.cable`, tone: "mid", bias, move, maxLength: 14, spacing: 1, bundle, touch, gaps, free, limp: true, rims: shells.map((on) => (on ? r * 2 : r)) });
  [0, 1].forEach((index) => {
    const end = index ? route[route.length - 1] : route[0];
    if (!shells[index]) {
      put(piece, end, Dots([at(end)], { size: 0.5, tone: "hi" }), { bias: bias + 0.15, move, name: `${id}.end`, shapes: [A.ball(end, 0.5 / KS)] });
      return;
    }
    const tangent = G.tangentAlong(route, index ? total : 0);
    const F = G.frameAlong(end, tangent);
    const [s0, s1] = index ? [-SHELL, 0] : [0, SHELL];
    put(piece, G.add3(end, G.mul3(tangent, (s0 + s1) / 2)), S(G.disc(s0, s1, r * 2, F, P, { bevel: 0.25 }), { tone: "mid" }), { bias: bias + 0.1, move, name: `${id}.shell`, shapes: [record(A.disc(F, s0, s1, r * 2, { name: `${id}.shell`, owner: id }))] });
  });
  return route;
}

function clampAt(piece, centre, axis, r, { move, bias = 0.3, name = `${piece}.clamp`, bundle } = {}) {
  const F = G.frameAlong(centre, axis);
  const id = nameFor(name);
  put(piece, centre, S(G.disc(-CLAMP_HALF, CLAMP_HALF, r, F, P), { tone: "mid" }), { bias, move, name: id, shapes: [record(A.disc(F, -CLAMP_HALF, CLAMP_HALF, r, { name: id, anchor: false, bundle, fitting: true }))] });
  return { centre, axis, radius: r };
}

const ex = (s, y = 0, z = 0) => [s, y, ZK + z];

// ================================================================ STAND — Västerås Bay 4 test bed
const back = [];
const FRAME = { owner: "stand.frame" };
back.push(`<path class="iso-halo" d="${k.haloOf(DECK, -DECK_H - FOOT_H, DECK_H, P)}"/>`);
const FEET = [];
for (const x of [DECK.x + 22, DECK.x + DECK.w / 3, DECK.x + (2 * DECK.w) / 3, DECK.x + DECK.w - 22]) for (const y of [DECK.y + 22, DECK.y + DECK.d - 22]) FEET.push([x, y]);
FEET.sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [x, y] of FEET) {
  back.push(S(k.cylinder(x, y, 10, -DECK_H - FOOT_H, 2, P, 28), { tone: "lo" }));
  back.push(S(k.cylinder(x, y, 7.5, -DECK_H - FOOT_H + 2, FOOT_H - 2, P, 28), { tone: "mid" }));
}
back.push(S(k.slabOf(DECK, -DECK_H, DECK_H, P, 8, 1.6), { tone: "mid" }));
record(A.box([DECK.x, DECK.y, -DECK_H], [DECK.x + DECK.w, DECK.y + DECK.d, 0], { name: "stand.deck", ...FRAME }));
back.push(Ln(k.planOutline(k.insetPlan(DECK, 7), 0, P), { tone: "lo" }));
const DECK_SCREWS = k.corners(DECK, 15);
back.push(Ln(DECK_SCREWS.map(([x, y]) => k.ring(x, y, 3, 0, P, 18)).join(""), { tone: "lo" }));
back.push(Dots(DECK_SCREWS.map(([x, y]) => at([x, y, 0])), { size: 0.55 }));

// track lattice: the passive Halbach half of the lift, cast into the federal track
const LATTICE = { x: -280, y: -104, w: 540, d: 208, r: 4 };
back.push(S(k.slabOf(k.insetPlan(LATTICE, -3), -0.01, 0.02, P, 4), { tone: "lo", crease: "none", flat: true }));
const TILE_W = 54;
const TILE_D = 52;
const tiles = [];
for (let i = 0; i < 10; i++)
  for (let j = 0; j < 4; j++) {
    const tile = { x: LATTICE.x + i * TILE_W + 1.5, y: LATTICE.y + j * TILE_D + 1.5, w: TILE_W - 3, d: TILE_D - 3, r: 1.5 };
    tiles.push(tile);
  }
tiles.sort((a, b) => k.depthOf([a.x + a.w / 2, a.y + a.d / 2, 0], P) - k.depthOf([b.x + b.w / 2, b.y + b.d / 2, 0], P));
for (const tile of tiles) {
  back.push(S(k.slabOf(tile, 0, ZLAT, P, 2, 0), { tone: "mid", crease: "faint" }));
  const c = [tile.x + tile.w / 2, tile.y + tile.d / 2];
  // the Halbach magnetisation, engraved: a ring and an arrow pointing the way the field turns
  back.push(Ln(k.ring(c[0], c[1], 9, ZLAT, P, 24) + k.lineOnTop([c[0] - 9, c[1]], [c[0] + 9, c[1]], ZLAT, P), { tone: "faint" }));
  back.push(Dots(k.corners(tile, 4).map(([x, y]) => at([x, y, ZLAT])), { size: 0.4, tone: "lo" }));
}
record(A.box([LATTICE.x, LATTICE.y, 0], [LATTICE.x + LATTICE.w, LATTICE.y + LATTICE.d, ZLAT], { name: "stand.lattice", ...FRAME }));

// guard curbs with lattice-pitch ruler strips
for (const y of [LATTICE.y - 16, LATTICE.y + LATTICE.d + 6]) {
  const curb = { x: LATTICE.x, y, w: LATTICE.w, d: 10, r: 2 };
  back.push(S(k.slabOf(curb, 0, 6, P, 3, 0.6), { tone: "mid" }));
  record(A.box([curb.x, curb.y, 0], [curb.x + curb.w, curb.y + curb.d, 6], { name: "stand.curb", ...FRAME }));
  const strip = { x: curb.x + 6, y: curb.y + 2, w: curb.w - 12, d: 6, r: 1 };
  back.push(S(k.slabOf(strip, 6, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, TILE_W / 5, 5, strip.y + 0.8, 6.6, [1.8, 3.6], P);
  back.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  back.push(Dots([at([strip.x + 2, strip.y + 3, 6.6]), at([strip.x + strip.w - 2, strip.y + 3, 6.6])], { size: 0.45 }));
}

// label plate
const LABEL = { x: DECK.x + DECK.w - 36, y: LATTICE.y - 4, w: 22, d: 70, r: 1.5 };
back.push(S(k.slabOf(LABEL, 0, 1, P, 3), { tone: "mid" }));
back.push(Ln(k.planOutline(k.insetPlan(LABEL, 1.8), 1, P), { tone: "faint" }));
back.push(k.faceTextSvg(k.topMatrix([LABEL.x + 12, LABEL.y + LABEL.d - 6], 1, P, "y"), "FX350 · BAY 4", { size: 4.4, tone: "lo" }));
back.push(Ln([0, 1, 2].map((row) => k.onTop([[LABEL.x + 5 + row * 2.4, LABEL.y + 6], [LABEL.x + 5 + row * 2.4, LABEL.y + [30, 22, 26][row]]], 1, P)).join(""), { tone: "lo", free: true }));
back.push(Dots([at([LABEL.x + LABEL.w / 2, LABEL.y + 2.8, 1]), at([LABEL.x + LABEL.w / 2, LABEL.y + LABEL.d - 2.8, 1])], { size: 0.45 }));

// ================================================================ THE CRAFT — the real FX350 mesh (Nobby76, CC BY 4.0)
// Every triangle of the site's GLB, projected into this camera, shaded in the kit's four tones and
// depth-sorted; long triangles are subdivided so the painter's order stays true, and creases,
// silhouettes and open edges are drawn as lines in their own short, depth-sorted segments.
const SCALE = 480 / 8.2; // figure units per GLB unit: the craft is 9.6 m long
const RAW = loadCraft(join(HERE, "../../assets/models/feisar_fx350.glb"), { scale: SCALE });
const rawPoints = RAW.flatMap((part) => part.tris.flatMap((t) => t.p));
const rawBox = boundsOf(rawPoints);
const SHIFT = [-(rawBox.lo[0] + rawBox.hi[0]) / 2, 0, CRAFT_FLOOR - rawBox.lo[2]];
const CRAFT = RAW.map((part) => ({ ...part, tris: part.tris.map((t) => ({ ...t, p: t.p.map((p) => G.add3(p, SHIFT)) })) }));
const CRAFT_BOX = boundsOf(CRAFT.flatMap((part) => part.tris.flatMap((t) => t.p)));
// the livery: every face takes the colour of the model's own texture under it
const GLB = join(HERE, "../../assets/models/feisar_fx350.glb");
const TEX = join(HERE, ".tex");
mkdirSync(TEX, { recursive: true });
const IMAGES = imagesOf(GLB);
const imageFiles = IMAGES.map((image) => {
  const file = join(TEX, `src${image.index}.${image.mime.split("/")[1]}`);
  writeFileSync(file, image.bytes);
  return file;
});
execFileSync("python3", ["-I", join(HERE, "texture.py"), TEX, ...imageFiles]);
const TEXINFO = JSON.parse(readFileSync(join(TEX, "index.json"), "utf8"));
const PIXELS = TEXINFO.map((_, index) => readFileSync(join(TEX, `${index}.rgba`)));
function texel(image, [u, v]) {
  const { w, h } = TEXINFO[image];
  const x = Math.min(w - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * h)));
  const o = (y * w + x) * 4;
  const px = PIXELS[image];
  return [px[o], px[o + 1], px[o + 2], px[o + 3]];
}
function colourOf(tri, weights) {
  if (tri.image === null || tri.image === undefined || !tri.uv) return [200, 204, 210];
  const sum = [0, 0, 0];
  for (const [a, b, c] of weights) {
    const uv = [tri.uv[0][0] * a + tri.uv[1][0] * b + tri.uv[2][0] * c, tri.uv[0][1] * a + tri.uv[1][1] * b + tri.uv[2][1] * c];
    const t = texel(tri.image, uv);
    for (let i = 0; i < 3; i++) sum[i] += t[i];
  }
  return sum.map((v, i) => (v / weights.length) * (tri.factor?.[i] ?? 1));
}
const BRIGHT = [0.6, 0.72, 0.84, 0.93, 1.0];
const USED_IMAGES = new Set();
let CLIP_ID = 0;
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

// where a vertical line at (x, y) crosses the given reference parts: the z of every hit, ascending
function zHits(x, y, names = ["hull", "side_L", "side_R", "rear"]) {
  const hits = [];
  for (const part of CRAFT) {
    if (!names.includes(part.name)) continue;
    for (const { p: [a, b, c] } of part.tris) {
      const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
      if (Math.abs(d) < 1e-9) continue;
      const l1 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / d;
      const l2 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      hits.push(l1 * a[2] + l2 * b[2] + l3 * c[2]);
    }
  }
  return hits.sort((m, n) => m - n);
}

// ---------------------------------------------------------------- the livery, read off the reference
// each panel face takes the paint of the reference surface under it, snapped to the FEISAR palette
const PALETTE = { blue: [48, 144, 192], yellow: [240, 192, 10], white: [240, 240, 240], pale: [192, 236, 240], dark: [40, 44, 52], red: [220, 50, 50] };
const REF_TRIS = CRAFT.flatMap((part) => (part.name.startsWith("canopy") ? [] : part.tris));
function paintAt(c, n) {
  // a ray from outside the face, back along its normal, to the first reference face it meets
  const o = G.add3(c, G.mul3(n, 30));
  const d = G.mul3(n, -1);
  let best = null;
  for (const tri of REF_TRIS) {
    const [a, b, cc] = tri.p;
    const e1 = G.sub3(b, a);
    const e2 = G.sub3(cc, a);
    const h = G.cross3(d, e2);
    const det = G.dot3(e1, h);
    if (Math.abs(det) < 1e-9) continue;
    const s = G.sub3(o, a);
    const u = G.dot3(s, h) / det;
    if (u < 0 || u > 1) continue;
    const q = G.cross3(s, e1);
    const v = G.dot3(d, q) / det;
    if (v < 0 || u + v > 1) continue;
    const t = G.dot3(e2, q) / det;
    if (t < 0 || t > 60 || (best && t >= best.t)) continue;
    best = { t, tri, w: [1 - u - v, u, v] };
  }
  if (!best || best.tri.image === null || best.tri.image === undefined || !best.tri.uv) return "white";
  const rgb = colourOf(best.tri, [best.w]);
  let name = "white";
  let least = Infinity;
  for (const [id, ref] of Object.entries(PALETTE)) {
    const dist = (rgb[0] - ref[0]) ** 2 + (rgb[1] - ref[1]) ** 2 + (rgb[2] - ref[2]) ** 2;
    if (dist < least) (least = dist), (name = id);
  }
  return name;
}

// five samples over a face, the paint most of them see (ties go to the centre)
function paintOfQuad(quad, normal) {
  const c = centreOf(quad);
  const samples = [c, ...quad.map((corner) => G.lerp3(c, corner, 0.6))].map((p) => paintAt(p, normal));
  const count = {};
  for (const name of samples) count[name] = (count[name] ?? 0) + 1;
  return Object.keys(count).reduce((a, b) => (count[b] > count[a] || (count[b] === count[a] && b === samples[0]) ? b : a));
}

// ---------------------------------------------------------------- panels lofted between two rings
const LIGHT = G.lightOf(P);
const pathOf = (points) => "M" + points.map((p) => at(p).map((v) => v.toFixed(2)).join(" ")).join("L") + "Z";
const lineOf = (points) => "M" + points.map((p) => at(p).map((v) => v.toFixed(2)).join(" ")).join("L");
function quadNormal(corners, centre) {
  let n = [0, 0, 0];
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    n = G.add3(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
  }
  n = G.unit3(n);
  const mid = G.mul3(corners.reduce((sum, p) => G.add3(sum, p), [0, 0, 0]), 1 / corners.length);
  return G.dot3(n, G.sub3(mid, centre)) < 0 ? G.mul3(n, -1) : n;
}
const centreOf = (points) => G.mul3(points.reduce((sum, p) => G.add3(sum, p), [0, 0, 0]), 1 / points.length);
const shrink = (ring, by) => {
  const c = centreOf(ring);
  return ring.map((p) => {
    const d = G.sub3(p, c);
    const l = G.len3(d) || 1;
    return G.add3(c, G.mul3(d, Math.max(0.2, (l - by) / l)));
  });
};

/**
 * One panel bay between rings A and B (same count, convex, in planes across x). Faces are toned by the
 * light and painted from the reference livery; seams at both rings, creases between faces.
 * `paint`: "auto" (from the livery), a palette name, or null (bare kit tones).
 */
function panel(piece, A0, B0, { name, paint = "auto", glass = false, hollow = 0, floorOpen = true, tone = "mid", caps = [false, false], seams = [true, true], rivets = 0, bias = 0, owner, extra = "" } = {}) {
  const n = A0.length;
  const centre = centreOf([...A0, ...B0]);
  const faces = [];
  for (let j = 0; j < n; j++) {
    const corners = [A0[j], A0[(j + 1) % n], B0[(j + 1) % n], B0[j]];
    if (G.len3(G.sub3(corners[0], corners[1])) < 0.05 && G.len3(G.sub3(corners[2], corners[3])) < 0.05) {
      faces.push(null);
      continue;
    }
    faces.push({ corners, normal: quadNormal(corners, centre), j });
  }
  const capFaces = [[A0, 0], [B0, 1]].map(([ring, index]) => ({ corners: index ? [...ring] : [...ring].reverse(), normal: quadNormal(ring, centre), cap: index }));
  const shown = (face) => face && G.dot3(face.normal, V) > 1e-4;
  const parts = [];
  const projected = [...A0, ...B0].map((p) => at(p));
  const hull = G.hullOf(projected);
  const hullD = "M" + hull.map((q) => q.map((v) => v.toFixed(2)).join(" ")).join("L") + "Z";
  parts.push(`<path class="iso-fill" d="${hullD}"/>`);
  const draw = (face) => {
    const band = G.bandOf(G.dot3(face.normal, LIGHT));
    // long faces split along their width so a stripe of the livery can change paint within a face
    const [a0, a1, b1, b0] = face.corners;
    const width = Math.max(G.len3(G.sub3(a1, a0)), G.len3(G.sub3(b1, b0)));
    const cuts = face.cap !== undefined || glass || paint !== "auto" ? 1 : Math.max(1, Math.min(4, Math.round(width / 9)));
    for (let c = 0; c < cuts; c++) {
      const t0 = c / cuts;
      const t1 = (c + 1) / cuts;
      const quad = face.cap !== undefined ? face.corners : [G.lerp3(a0, a1, t0), G.lerp3(a0, a1, t1), G.lerp3(b0, b1, t1), G.lerp3(b0, b1, t0)];
      const colour = glass ? "glass" : paint === "auto" ? paintOfQuad(quad, face.normal) : paint;
      const cls = band === 4 ? "iso-top" : "iso-shade";
      parts.push(`<path class="${cls}" data-shade="${band}"${colour ? ` data-paint="${colour}"` : ""} d="${pathOf(quad)}"/>`);
    }
  };
  faces.forEach((face) => shown(face) && draw(face));
  capFaces.forEach((face, index) => caps[index] && shown(face) && draw(face));
  // creases where neighbouring faces turn, seams along the rings
  const lines = [];
  const seamLines = [];
  for (let j = 0; j < n; j++) {
    const f0 = faces[(j - 1 + n) % n];
    const f1 = faces[j];
    if (!f0 || !f1) continue;
    if ((shown(f0) || shown(f1)) && !(shown(f0) && shown(f1) ? false : true) && G.dot3(f0.normal, f1.normal) < Math.cos(16 * DEG)) lines.push(lineOf([A0[j], B0[j]]));
  }
  [[A0, 0], [B0, 1]].forEach(([ring, index]) => {
    if (!seams[index]) return;
    for (let j = 0; j < n; j++) if (shown(faces[j])) seamLines.push(lineOf([ring[j], ring[(j + 1) % n]]));
  });
  if (lines.length) parts.push(`<path class="iso-line iso-crease" data-tone="${glass ? "lo" : "faint"}" d="${lines.join("")}"/>`);
  if (seamLines.length) parts.push(`<path class="iso-line${glass ? " fx-bow" : ""}" data-tone="${glass ? "hi" : "lo"}" d="${seamLines.join("")}"/>`);
  if (rivets) {
    const dots = [];
    [[A0, 0], [B0, 1]].forEach(([ring, index]) => {
      if (!seams[index]) return;
      const inward = index ? -rivets : rivets;
      for (let j = 0; j < n; j++) {
        if (!shown(faces[j])) continue;
        const a = ring[j];
        const b = ring[(j + 1) % n];
        const len = G.len3(G.sub3(b, a));
        const count = Math.floor(len / 4.5);
        for (let r = 1; r < count; r++) dots.push(at(G.add3(G.lerp3(a, b, r / count), [inward, 0, 0])));
      }
    });
    if (dots.length) parts.push(Dots(dots, { size: 0.32, tone: "lo" }));
  }
  if (extra) parts.push(extra);
  parts.push(`<path class="iso-line iso-edge" data-tone="${tone}" d="${hullD}"/>`);
  const id = nameFor(name ?? `${piece}.panel`);
  // a hollow panel is a shell: its inside is cut away, open on the floor side and at every end but a
  // capped one that faces the viewer, so what it covers sits inside it rather than in its walls
  const inside = (ring, dx) => {
    const zLow = Math.min(...ring.map((p) => p[2]));
    return shrink(ring, hollow).map((p, i) => [p[0] + dx, p[1], floorOpen && ring[i][2] <= zLow + 0.01 ? zLow - 3 : p[2]]);
  };
  const facing = (index) => caps[index] && G.dot3(capFaces[index].normal, V) > 0;
  const cut = hollow ? A.loft(inside(A0, facing(0) ? hollow : -0.6), inside(B0, facing(1) ? -hollow : 0.6)) : null;
  const shape = A.loft(A0, B0, { name: id, owner, ...(cut ? { cut } : {}) });
  record(shape);
  put(piece, centre, `<g class="iso-solid fx-panel${glass ? " fx-glass" : ""}">${parts.join("")}</g>`, { bias, name: id, shapes: [shape] });
  return shape;
}

/** A ring (annulus, axis F.a) built of `count` convex wedges: anything it wraps can be painted in order. */
function segmentedRing(piece, F, s0, s1, rIn, rOut, count, { name, tone = "mid", extra = "", bias = 0 } = {}) {
  const section = (angle) => [[s0, rIn], [s0, rOut], [s1, rOut], [s1, rIn]].map(([s, r]) => G.pointOf(F, s, r, angle));
  const id = nameFor(name ?? `${piece}.ring`);
  for (let i = 0; i < count; i++) {
    const a0 = (i / count) * Math.PI * 2;
    const a1 = ((i + 1) / count) * Math.PI * 2;
    panel(piece, section(a0), section(a1), { name: `${id}:${i}`, paint: null, seams: [false, false], tone, owner: id, bias, extra: i === 0 ? extra : "" });
  }
  return id;
}

// ---------------------------------------------------------------- sections from the reference
const REF = Object.fromEntries(CRAFT.map((part) => [part.name, part.tris.map((t) => t.p)]));
const sliceOf = (names, x) => names.flatMap((name) => sliceAt(REF[name], x));
const BELLY = 53; // the reference belly
const FLOOR = 56; // top of the keel pan, where the systems bolt down
// half-width of a convex section at height z (symmetrised), or null above or below it
function widthAt(hull, z) {
  const ys = [];
  for (let j = 0; j < hull.length; j++) {
    const a = hull[j];
    const b = hull[(j + 1) % hull.length];
    if ((a[1] - z) * (b[1] - z) > 0 || a[1] === b[1]) continue;
    const t = (z - a[1]) / (b[1] - a[1]);
    ys.push(a[0] + t * (b[0] - a[0]));
  }
  if (ys.length < 2) return null;
  return (Math.max(...ys) - Math.min(...ys)) / 2;
}
const ring3 = (x, ring) => ring.map(([y, z]) => [x, y, z]);
// a symmetric ring from half-widths at given heights: up the starboard side, back down the port side
const sideRing = (rows) => [...rows.map(([w, z]) => [w, z]), ...[...rows].reverse().map(([w, z]) => [-w, z])];

// the port side panel at x: its top inner edge I, its lower tip T, a vertical inner edge and thickness t
const WING_T = 4.2;
function wingAt(x) {
  const points = sliceOf(["side_L"], x);
  if (points.length < 3) return null;
  const I = points.reduce((a, b) => (b[1] > a[1] ? b : a));
  const T = points.reduce((a, b) => (b[1] < a[1] ? b : a));
  const d = G.unit3([0, T[0] - I[0], T[1] - I[1]]);
  const n = [0, -d[2], d[1]]; // inward and down
  const lowI = [I[0] + n[1] * WING_T, I[1] + n[2] * WING_T];
  const lowT = [T[0] + n[1] * WING_T, T[1] + n[2] * WING_T];
  const s = (I[0] - lowI[0]) / (d[1] || 1e-9);
  const I2 = [I[0], lowI[1] + d[2] * s];
  return { I, T, I2, lowT, ring: [I, T, lowT, I2] };
}
// ================================================================ AIRFRAME — kit panels on the reference's lines
const range = (x0, x1, step) => {
  const out = [];
  for (let x = x0; x < x1 - 1e-6; x += step) out.push(x);
  out.push(x1);
  return out;
};
const mirror = (ring) => ring.map(([x, y, z]) => [x, -y, z]);
const between = (xs, fn) => xs.slice(0, -1).forEach((x, i) => fn(x, xs[i + 1], i, xs.length - 1));

// ---- keel pan (keel): the flat belly the cradles carry and the systems bolt to
function panWidth(x) {
  const low = sliceOf(["hull", "nose", "rear"], x).filter(([, z]) => z <= BELLY + 3);
  let w = low.length ? (Math.max(...low.map(([y]) => y)) - Math.min(...low.map(([y]) => y))) / 2 : 14;
  const wing = wingAt(x);
  if (wing) {
    // stop short of the side panel's inner face where that face comes down to the floor
    const [a, b] = [wing.I2, wing.lowT];
    for (const z of [BELLY, FLOOR])
      if ((a[1] - z) * (b[1] - z) <= 0 && a[1] !== b[1]) w = Math.min(w, Math.abs(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) - 0.4);
  }
  return x <= -64 ? Math.min(w, 30) : w;
}
const WING_X = range(-232, 92, 12);
const PAN_X = [...WING_X, ...range(92, 224, 16).slice(1)];
const panRing = (x) => {
  const w = panWidth(x);
  return ring3(x, sideRing([[w - 2.4, BELLY], [w, BELLY + 1.6], [w, FLOOR]]));
};
between(PAN_X, (x0, x1, i, last) => panel("keel", panRing(x0), panRing(x1), { name: "keel.pan", paint: null, caps: [i === 0, i === last - 1], rivets: 1.2 }));

const SKIN = { podL: [], podR: [] };
// ---- side panels (podL, podR): from the spine root down to the skid edge, one bay per station
between(WING_X, (x0, x1) => {
  const a = wingAt(x0);
  const b = wingAt(x1);
  if (!a || !b) return;
  SKIN.podL.push({ x0, x1, shape: panel("podL", ring3(x0, a.ring), ring3(x1, b.ring), { name: "podL.skin", rivets: 1 }) });
  SKIN.podR.push({ x0, x1, shape: panel("podR", mirror(ring3(x0, a.ring)), mirror(ring3(x1, b.ring)), { name: "podR.skin", rivets: 1 }) });
});

// ---- dorsal spine (spine): between the side panels' roots, over the rear bay and the forward bay
function spineRing(x) {
  const wing = wingAt(x);
  const bw = Math.abs(wing.I[0]) - 0.4;
  const hull = G.hullOf(sliceOf(["hull"], x).filter(([y, z]) => Math.abs(y) <= bw + 2 && z >= wing.I[1] - 1));
  const top = hull.length >= 3 ? Math.max(...hull.map(([, z]) => z)) : wing.I[1] + 2;
  const zt = Math.max(top, wing.I[1] + 2);
  const at = (z, fallback) => Math.min(bw, (hull.length >= 3 && widthAt(hull, z)) || fallback);
  const tw = at(zt - 1.2, bw * 0.6);
  const mid = at((wing.I[1] + zt) / 2, (bw + tw) / 2);
  return ring3(x, sideRing([[bw, wing.I2[1]], [bw, wing.I[1]], [Math.max(tw, Math.min(mid, bw)), (wing.I[1] + zt) / 2], [tw, zt]]));
}
for (const xs of [WING_X.filter((x) => x >= -160 && x <= -64), WING_X.filter((x) => x >= 20)]) between(xs, (x0, x1, i, last) => panel("spine", spineRing(x0), spineRing(x1), { name: "spine.cover", hollow: 1.4, caps: [i === 0, i === last - 1], rivets: 1 }));

// ---- canopy (canopy): Torino glass on the cockpit walls, bows at every station
function canopyRing(at) {
  // the rear bow stands on the side panels' roots, under the first full section of the glass
  const x = Math.max(at, -52);
  const wing = wingAt(at);
  const bw = Math.abs(wing.I[0]);
  const hull = G.hullOf(sliceOf(["canopy_glass", "canopy_frame"], x).filter(([, z]) => z >= wingAt(x).I[1] - 1));
  const zt = Math.max(...hull.map(([, z]) => z));
  const z0 = wing.I[1];
  const rows = [0, 0.4, 0.72, 0.92, 1].map((f) => {
    const z = z0 + (zt - z0) * f - (f === 1 ? 0.8 : 0);
    return [Math.min(bw, widthAt(hull, z) ?? bw * (1 - f * 0.6)), z0 + (zt - z0) * f];
  });
  rows[0][0] = bw;
  return ring3(at, sideRing(rows));
}
if (process.argv.includes("--rings")) for (const x of PAN_X) console.log("pan", x, panWidth(x).toFixed(1), JSON.stringify(wingAt(x)?.lowT?.map(Math.round)));
if (process.argv.includes("--rings")) process.exit(0);
between(WING_X.filter((x) => x >= -64 && x <= 20), (x0, x1, i, last) => panel("canopy", canopyRing(x0), canopyRing(x1), { name: "canopy.glass", glass: true, hollow: 0.8, caps: [i === 0, i === last - 1], tone: "hi" }));

// ---- nose cone (nose): the upper shell over the nose bay, from the floor to the ridge
function noseRing(x) {
  const hull = G.hullOf(sliceOf(["nose", "hull"], x).filter(([y]) => Math.abs(y) <= 30));
  const zt = Math.max(...hull.map(([, z]) => z));
  const w0 = Math.min(panWidth(x), widthAt(hull, FLOOR) ?? panWidth(x));
  const rows = [0, 0.55, 0.86, 1].map((f) => {
    const z = FLOOR + (zt - FLOOR) * f;
    return [f ? Math.min(w0, widthAt(hull, f === 1 ? z - 0.8 : z) ?? w0 * (1 - f * 0.5)) : w0, z];
  });
  return ring3(x, sideRing(rows));
}
const NOSE_X = range(92, 212, 12);
between(NOSE_X, (x0, x1, i, last) => panel("nose", noseRing(x0), noseRing(x1), { name: "nose.shell", hollow: 1.4, caps: [true, false], rivets: 1 }));
// the tip: the last ring closes on a short blunt cap round the pitot
const NOSE_END = noseRing(212);
const TIP = [232, 0, (FLOOR + Math.max(...NOSE_END.map(([, , z]) => z))) / 2 + 2];
panel("nose", NOSE_END, NOSE_END.map((p) => G.lerp3(p, TIP, 0.82).map((v, i) => (i === 0 ? TIP[0] : v))), { name: "nose.tip", caps: [false, true], rivets: 1 });

// ---- engine nacelle (nacelle): the Syrus housing at the tail, between the side panels
const TZ = 76; // Syrus axis
const nacelleHalf = (x) => Math.min(28, wingAt(x) ? Math.abs(wingAt(x).I[0]) : 28) - 0.5;
function nacelleRing(x) {
  const hull = G.hullOf(sliceOf(["hull", "rear"], x).filter(([y]) => Math.abs(y) <= 30));
  const zt = Math.max(TZ + 13, ...hull.map(([, z]) => z));
  const wing = wingAt(x);
  const bw = nacelleHalf(x);
  const rows = [0, 0.5, 0.88, 1].map((f) => {
    const z = FLOOR + (zt - FLOOR) * f;
    return [f < 0.6 ? bw : Math.min(bw, widthAt(hull, f === 1 ? z - 0.8 : z) ?? bw * 0.7), z];
  });
  return ring3(x, sideRing(rows));
}
const NAC_X = [-232, -220, -208, -196, -184, -172, -160];
between(NAC_X, (x0, x1, i, last) => panel("nacelle", nacelleRing(x0), nacelleRing(x1), { name: "nacelle.shell", hollow: 1.4, caps: [i === 0, i === last - 1], rivets: 1 }));

// ---- pitot probe on the nose tip (nose)
const PITOT = G.frameOf(TIP, [1, 0, 0], [0, 1, 0], [0, 0, 1]);
turned("nose", PITOT, [[0, 2.4], [1.6, 2.4], [1.6, 1], [10, 1], [10, 0.55], [15, 0.55]], { tone: "mid" }, { name: "nose.pitot" });

// a point on the outer face of a side panel at x, a share f of the way from the root to the tip
function onSide(x, f, side) {
  const w = wingAt(x);
  const y = w.I[0] + (w.T[0] - w.I[0]) * f;
  const z = w.I[1] + (w.T[1] - w.I[1]) * f;
  const d = G.unit3([0, w.T[0] - w.I[0], w.T[1] - w.I[1]]);
  const out = [0, d[2], -d[1]]; // away from the hull, up
  return { p: [x, -side * y, z], out: [0, -side * out[1], out[2]] };
}

const INTAKE_EXTRA = (F, p, out, fan) => `<path class="fx-void" d="${G.circleOf(F, 2.4, 10.4, P, 48)}"/>` + fan + Dots([at(G.add3(p, G.mul3(out, 2.4)))], { size: 0.6, tone: "hi" }) + Dots(G.dotsOf(F, 2.4, 12, 14, P, { all: true }), { size: 0.36 });
// ---- pod intakes (podL, podR): the Syrus ramjet breathes through one round intake on each side
for (const side of [-1, 1]) {
  const piece = side < 0 ? "podL" : "podR";
  const { p, out } = onSide(-150, 0.4, side);
  const F = G.frameAlong(p, out);
  const fan = Ln(G.spokesOf(F, 2.4, 2.6, 10.4, 15, P, { sweep: 0.55 }) + G.circleOf(F, 2.4, 2.6, P, 20) + G.circleOf(F, 2.4, 10.4, P, 48), { tone: "mid" });
  // the bezel is set into the skin: its shape runs into the panel and is cut by it
  const hosts = SKIN[piece].filter(({ x0, x1 }) => x1 > p[0] - 16 && x0 < p[0] + 16).map(({ shape }) => shape);
  const id = nameFor(`${piece}.intake`);
  put(piece, p, S(G.ringBand(0, 2.4, 10.4, 13.6, F, P), { tone: "mid" }) + INTAKE_EXTRA(F, p, out, fan), { name: id, shapes: [record(A.disc(F, -2, 2.4, 13.6, { name: id, seated: true, cut: hosts }))] });
}

// ---- airbrakes (podL, podR): a hinged flap on each side panel's trailing edge, as on every AG racer
for (const side of [-1, 1]) {
  const piece = side < 0 ? "podL" : "podR";
  const flapRing = (x) => {
    const a = onSide(x, 0.52, side);
    const b = onSide(x, 0.86, side);
    return [a.p, b.p, G.add3(b.p, G.mul3(b.out, 1.1)), G.add3(a.p, G.mul3(a.out, 1.1))];
  };
  const xs = [-224, -212, -200];
  between(xs, (x0, x1, i) => panel(piece, flapRing(x0), flapRing(x1), { name: `${piece}.airbrake`, paint: "dark", caps: [i === 0, i === 1], seams: [i === 0, true], tone: "mid" }));
  // the hinge along the flap's forward edge
  const h0 = onSide(-224, 0.45, side);
  const h1 = onSide(-200, 0.45, side);
  const lift = (q) => G.add3(q.p, G.mul3(q.out, 0.66));
  const F = G.frameAlong(lift(h0), G.unit3(G.sub3(lift(h1), lift(h0))));
  discAt(piece, F, 0, G.len3(G.sub3(lift(h1), lift(h0))), 0.6, { tone: "mid" }, { name: `${piece}.hinge`, bias: 0.3 });
}

// ================================================================ SYSTEMS — inside the real shell
// Everything below sits inside the mesh's own cavities (probed with zHits), so the assembled craft is
// exactly the original model; taking it apart opens the shell and shows what it carries.
const FLOOR_R = FLOOR;
const FLOOR_F = FLOOR;

// ---- field capacitor bank (power) — Brussels: four superconducting cells in a strapped rack
const CAP_X = [-140, -122];
const CAP_Y = [-7, 7];
const CAP_R = 6.2;
const CAP_Z0 = FLOOR_R + 4;
const CAP_Z1 = 90;
const rack = { x: -150, y: -14, w: 38, d: 28, r: 2 };
boxAt("power", rack, FLOOR_R, 4, { tone: "mid" }, { name: "power.rack", extra: Dots(k.corners(rack, 2.5).map(([x, y]) => at([x, y, FLOOR_R + 4])), { size: 0.4 }) });
const CELLS = [];
for (const x of CAP_X)
  for (const y of CAP_Y) {
    const F = G.frameOf([x, y, CAP_Z0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    turned("power", F, [[0, CAP_R], [CAP_Z1 - CAP_Z0 - 3, CAP_R], [CAP_Z1 - CAP_Z0 - 3, CAP_R - 1.4], [CAP_Z1 - CAP_Z0, CAP_R - 1.4]], { tone: "hi" }, {
      name: "power.cell",
      inner: [10, 20, CAP_Z1 - CAP_Z0 - 9].map((s) => G.arcOf(F, s, CAP_R, P)).join(""),
    });
    // terminal post on the cap
    discAt("power", G.frameOf([x + 2.4, y, CAP_Z1], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 2.4, 1.1, { tone: "mid" }, { name: "power.terminal" });
    CELLS.push([x, y]);
  }
// straps round the four cells and the bus bars that join them
for (const z of [68, 80]) boxAt("power", { x: -148, y: -14.2, w: 34, d: 1.2, r: 0.4 }, z, 2.4, { tone: "mid" }, { name: "power.strap", bevel: 0 });
for (const y of CAP_Y) boxAt("power", { x: CAP_X[0] + 2.4 - 3, y: y - 1.5, w: CAP_X[1] - CAP_X[0] + 6, d: 3, r: 0.8 }, CAP_Z1 + 2.4, 1.2, { tone: "mid" }, { name: "power.busbar", bevel: 0.3, extra: Dots(CAP_X.map((x) => at([x + 2.4, y, CAP_Z1 + 3.6])), { size: 0.42 }) });

// ---- Tru-Fly stability core (core) — a gimballed flywheel between two uprights
const GX = -90;
const GZ = 84;
boxAt("core", { x: GX - 16, y: -13, w: 32, d: 26, r: 2 }, FLOOR_R, 4, { tone: "mid" }, { name: "core.plinth", extra: Dots(k.corners({ x: GX - 16, y: -13, w: 32, d: 26, r: 2 }, 2.6).map(([x, y]) => at([x, y, FLOOR_R + 4])), { size: 0.42 }) });
for (const x of [GX - 15, GX + 12]) boxAt("core", { x, y: -3, w: 3, d: 6, r: 0.6 }, FLOOR_R + 4, GZ - FLOOR_R - 4 + 3, { tone: "mid" }, { name: "core.upright" });
// outer gimbal ring (axis y), pivoting on the uprights' pins (axis x)
const OUTER = G.frameOf([GX, 0, GZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
segmentedRing("core", OUTER, -1.6, 1.6, 10.2, 12, 24, { name: "core.outer-ring", tone: "hi" });
for (const sign of [-1, 1]) {
  const pin = G.frameOf([GX + sign * 15, 0, GZ], [sign, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("core", pin, 0, 1, 1.4, { tone: "mid" }, { name: "core.pivot" });
  // the inner ring's own pivots, top and bottom, into the outer ring
  discAt("core", G.frameOf([GX, 0, GZ + sign * 9.35], [0, 0, sign], [1, 0, 0], [0, 1, 0]), 0, 0.9, 0.9, { tone: "mid" }, { name: "core.inner-pivot" });
}
// inner ring (axis x) and the flywheel (axis z) with its drive motor
const INNER = G.frameOf([GX, 0, GZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
segmentedRing("core", INNER, -1.3, 1.3, 7.8, 9.4, 20, { name: "core.inner-ring", tone: "hi" });
const WHEEL = G.frameOf([GX, 0, GZ - 1.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("core", WHEEL, [[0, 6.6], [3.2, 6.6]], { tone: "hi" }, { name: "core.flywheel", extra: Faded(G.ribsOf(WHEEL, 0, 3.2, 6.6, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
discAt("core", G.frameOf([GX, 0, GZ + 1.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 2.4, 2.6, { tone: "mid" }, { name: "core.motor" });
// the flywheel's axle runs up from the motor and down from the wheel into the inner ring's bearings
discAt("core", G.frameOf([GX, 0, GZ + 4], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 3.82, 0.8, { tone: "mid" }, { name: "core.axle" });
discAt("core", G.frameOf([GX, 0, GZ - 1.6], [0, 0, -1], [1, 0, 0], [0, 1, 0]), 0, 6.22, 0.8, { tone: "mid" }, { name: "core.axle" });

// ---- Armacall VII avionics (avionics) — Warsaw: flight and weapons control in the forward bay
const AV = { x: 40, y: -11, w: 50, d: 22, r: 2 };
const AV_Z = FLOOR_F;
const AV_H = 16;
const vents = [];
for (let i = 0; i < 6; i++) vents.push(k.planOutline({ x: AV.x + 6 + i * 6.4, y: AV.y + 4, w: 2.4, d: 14, r: 1.1 }, AV_Z + AV_H, P, 2));
boxAt("avionics", AV, AV_Z, AV_H, { tone: "hi" }, { name: "avionics.chassis", bevel: 0.6, extra: Ln(vents.join(""), { tone: "lo" }) + Dots(k.corners(AV, 2.2).map(([x, y]) => at([x, y, AV_Z + AV_H])), { size: 0.42 }) });
// heat-sink fins over the processor end
for (let i = 0; i < 5; i++) boxAt("avionics", { x: AV.x + AV.w - 13 + i * 2.6, y: AV.y + 3, w: 1, d: 16, r: 0.3 }, AV_Z + AV_H, 4.2, { tone: "mid" }, { name: "avionics.fin", bevel: 0, steps: 2 });
// connector row on the aft face
const CONNECTORS = [];
for (let i = 0; i < 4; i++) {
  const y = AV.y + 4 + i * 4.6;
  const F = G.frameOf([AV.x, y, AV_Z + 8], [-1, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("avionics", F, 0, 2.2, 1.6, { tone: "mid" }, { name: "avionics.connector" });
  CONNECTORS.push(G.add3([AV.x, y, AV_Z + 8], [-2.2, 0, 0]));
}

// ---- nose bay (nose) — Gothenburg: lidar head, trim emitter, ballast rail
const LIDAR = G.frameOf([158, 0, 69], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
turned("sensors", LIDAR, [[0, 7.4], [4, 7.4], [4, 6], [9, 6], [9, 4.6], [11, 4.6]], { tone: "hi" }, { name: "sensors.lidar", extra: `<path class="fx-void" d="${G.circleOf(LIDAR, 11, 3.2, P, 24)}"/>` });
boxAt("sensors", { x: 159, y: -6, w: 9, d: 12, r: 1 }, FLOOR_F, 69 - 7.4 - FLOOR_F, { tone: "mid" }, { name: "nose.lidar-mount" });
const TRIM = G.frameOf([138, 0, FLOOR_F], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("sensors", TRIM, [[0, 9], [2, 9], [2, 7.6], [11, 7.6], [11, 5], [13, 5]], { tone: "hi" }, { name: "nose.trim-emitter", extra: Faded(G.ribsOf(TRIM, 2, 11, 7.6, 30, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
for (const y of [-10, 10]) {
  const F = G.frameOf([106, y, 61], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("sensors", F, 0, 20, 1.2, { tone: "mid" }, { name: "nose.ballast-rail" });
  boxAt("sensors", { x: 104, y: y - 2.5, w: 4, d: 5, r: 0.6 }, FLOOR_F, 61 - 1.2 - FLOOR_F, { tone: "mid" }, { name: "nose.rail-stand" });
}
boxAt("sensors", { x: 110, y: -12, w: 10, d: 24, r: 1.5 }, 61 + 1.2, 6, { tone: "hi" }, { name: "nose.ballast", bevel: 0.5, extra: Dots([-6, 0, 6].map((y) => at([115, y, 68.2])), { size: 0.42 }) });

// ---- AG field emitters ×4 (emitters) — Delft: inside the rear pods, faces flush with the pod bellies
const EMITTERS = [];
for (const side of [-1, 1])
  for (const x of [-182, -136]) {
    const y = side * 40.5;
    const face = BELLY + 0.6;
    const F = G.frameOf([x, y, face], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const h = 8;
    turned("emitters", F, [[0, 7], [1.4, 7], [1.4, 8.2], [h - 2, 8.2], [h - 2, 9.2], [h, 9.2]], { tone: "hi" }, {
      name: "emitters.coil",
      extra: Faded(G.ribsOf(F, 1.4, h - 2, 8.2, 38, P, { fade: [0.1, 0.55] }), { tone: "lo" }) + Dots(G.dotsOf(F, h, 8.4, 10, P, { all: true }), { size: 0.36 }),
    });
    discAt("emitters", G.frameOf([x, y, face + h], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 2.6, 3.4, { tone: "mid" }, { name: "emitters.terminal" });
    EMITTERS.push({ x, y, face, top: face + h + 2.6 });
    // the bracket that hangs the coil off the side of the keel pan
    // the brackets bear on the pan's top edge, or on the nacelle's side wall where it comes down to the pan
    const pan = x - 4 < NAC_X[NAC_X.length - 1] ? Math.max(nacelleHalf(x - 4), nacelleHalf(x + 4)) + 3.05 : panWidth(x);
    const y0 = side > 0 ? pan - 3 : -(Math.abs(y) - 9.2 + 0.2);
    const y1 = side > 0 ? Math.abs(y) - 9.2 + 0.2 : -(pan - 3);
    boxAt("keel", { x: x - 4, y: y0, w: 8, d: y1 - y0, r: 0.4 }, FLOOR, 5, { tone: "mid" }, { name: "keel.emitter-bracket", bevel: 0.2, steps: 2, extra: Dots([at([x - 2.4, (y0 + y1) / 2, FLOOR + 5]), at([x + 2.4, (y0 + y1) / 2, FLOOR + 5])], { size: 0.36 }) });
  }

// ---- Syrus plasma ramjet core (thrust) — Toulouse: inside the nacelle, exhausting aft
const TX0 = -162; // ramjet mount face
const TCORE = G.frameOf([TX0, 0, TZ], [-1, 0, 0], [0, 1, 0], [0, 0, -1]);
turned("thrust", TCORE, [[0, 10.5], [2.4, 10.5]], { tone: "mid" }, { name: "thrust.mount", extra: Dots(G.dotsOf(TCORE, 2.4, 9, 14, P, { fade: FADE }), { size: 0.36 }) });
turned("thrust", TCORE, [[2.4, 8.4], [14, 8.4]], { tone: "hi" }, { name: "thrust.compressor", extra: Faded(G.ribsOf(TCORE, 2.4, 14, 8.4, 34, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
const CHAMBER = turned("thrust", TCORE, [[14, 9.8], [28, 9.8]], { tone: "hi" }, { name: "thrust.chamber", inner: [19, 23].map((s) => G.arcOf(TCORE, s, 9.8, P)).join("") });
const tnoz = (s) => 7.6 + 2.2 * Math.pow(Math.max(0, (s - 28) / 16), 1.4);
const tnozSlope = (s) => (2.2 * 1.4 * Math.pow(Math.max(0, (s - 28) / 16), 0.4)) / 16;
turned("thrust", TCORE, [[28, 8.2], ...Array.from({ length: 9 }, (_, i) => [28 + 2 * i, tnoz(28 + 2 * i), i && i < 8 ? 1 : 0])], { tone: "hi" }, { name: "thrust.nozzle", smooth: { slope: tnozSlope, rows: 3 } });
for (const s of [31, 36]) segmentedRing("thrust", TCORE, s - 1, s + 1, tnoz(s + 1) + 0.05, tnoz(s + 1) + 2, 20, { name: "thrust.coil" });
// the tailpipe carries the jet from the magnetic nozzle out through the nacelle's tail cap
const TAIL_S = TX0 - NAC_X[0] + 2.6;
discAt("thrust", TCORE, 44, TAIL_S - 2.6, tnoz(44) + 1, { tone: "hi" }, { name: "thrust.tailpipe", extra: Faded(G.ribsOf(TCORE, 44, TAIL_S - 2.6, tnoz(44) + 1, 24, P, { fade: [0.1, 0.5], seams: true }), { tone: "lo" }) });
discAt("thrust", TCORE, TAIL_S - 2.6, TAIL_S, tnoz(44) + 2.4, { tone: "mid" }, { name: "thrust.exit-lip", bias: 0.6, extra: `<path class="fx-void" d="${G.circleOf(TCORE, TAIL_S, tnoz(44) - 0.1, P, 40)}"/>` + Dots(G.dotsOf(TCORE, TAIL_S, tnoz(44) + 1.3, 12, P, { all: true }), { size: 0.36 }) });

// ---- heat exchanger (plumbing): plasma-chamber coolant gives its heat to the capacitor cryo loop
const HX = { x: -194, y: -9, w: 22, d: 18, r: 1.5 };
boxAt("plumbing", HX, FLOOR_R, 4.6, { tone: "hi" }, { name: "plumbing.exchanger", bevel: 0.5, extra: Ln([0, 1, 2].map((i) => k.planOutline({ x: HX.x + 2 + i * 6.6, y: HX.y + 2.5, w: 4, d: 13, r: 1.4 }, FLOOR_R + 4.6, P, 2)).join(""), { tone: "lo" }) });
for (const y of [-4, 4]) {
  // from under the plasma chamber straight down onto the exchanger below it
  const skin = [-180 + y * 0.45, y, TZ - Math.sqrt(9.8 * 9.8 - y * y)];
  const top = padOn("thrust", CHAMBER, skin, [0, 0, -1], 1.5, 1.1, { name: "thrust.coolant-boss", tone: "mid" });
  pipe("plumbing", [top, [top[0], y, FLOOR_R + 4.6]], 1, { flanges: [false, true], flangeR: 1.35, name: "plumbing.coolant", free: [true, false], bend: 3 });
}

// ---- pilot cell (cell) — Lisbon: seat on rails, side consoles, yoke, binnacle, pedals
for (const y of [-11, 9]) boxAt("cell", { x: -46, y, w: 24, d: 2, r: 0.5 }, FLOOR, 6, { tone: "mid" }, { name: "cell.seat-rail", bevel: 0.2, steps: 2 });
const SEAT = { x: -44, y: -11, w: 20, d: 22, r: 2 };
boxAt("cell", SEAT, FLOOR + 6, 5, { tone: "hi" }, { name: "cell.seat-pan", bevel: 0.6, extra: Ln(k.planOutline(k.insetPlan(SEAT, 2.4), FLOOR + 11, P, 3), { tone: "faint" }) });
const BACK = G.frameOf([0, -10, 0], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
prismAt("cell", BACK, [[-44, FLOOR + 11], [-39, FLOOR + 11], [-46, 98], [-51, 98]], 0, 20, { tone: "hi" }, {
  name: "cell.seat-back",
  inner: Ln([-5, 5].map((y) => lineOf([[-44.2 + 0.1, y, FLOOR + 12], [-49.8, y, 96.5]].map(([x, yy, z]) => [x + 2.6, yy, z]))).join(""), { tone: "lo" }),
});
boxAt("cell", { x: -54, y: -7, w: 7, d: 14, r: 2 }, 98, 7, { tone: "hi" }, { name: "cell.headrest", bevel: 0.8 });
for (const side of [-1, 1]) {
  const plan = { x: -42, y: side < 0 ? -20 : 13, w: 28, d: 7, r: 1.2 };
  const switches = [0, 1, 2, 3, 4].map((i) => at([plan.x + 5 + i * 4.4, plan.y + 3.5, FLOOR + 12]));
  boxAt("cell", plan, FLOOR, 12, { tone: "mid" }, { name: "cell.console", bevel: 0.4, extra: Dots(switches, { size: 0.42, tone: "hi" }) + Ln(k.planOutline({ x: plan.x + 2, y: plan.y + 1.5, w: 2.6, d: 4, r: 0.6 }, FLOOR + 12, P, 2), { tone: "lo" }) });
}
const COLUMN = G.frameOf([-14, 0, FLOOR], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("cell", COLUMN, [[0, 2.6], [1, 2.6], [1, 1.1], [20, 1.1]], { tone: "mid" }, { name: "cell.column" });
boxAt("cell", { x: -15.6, y: -8, w: 3.2, d: 16, r: 1 }, FLOOR + 20, 2.6, { tone: "hi" }, { name: "cell.yoke", bevel: 0.4 });
for (const y of [-8, 8]) discAt("cell", G.frameOf([-14, y, FLOOR + 21.3], [0, Math.sign(y), 0], [1, 0, 0], [0, 0, 1]), 0, 3, 1.2, { tone: "mid" }, { name: "cell.grip" });
for (const y of [-14, 10]) boxAt("cell", { x: 6, y, w: 6, d: 4, r: 1 }, FLOOR, 24, { tone: "mid" }, { name: "cell.binnacle-stand" });
const BIN = { x: 2, y: -15, w: 14, d: 30, r: 2 };
boxAt("cell", BIN, FLOOR + 24, 7, { tone: "hi" }, {
  name: "cell.binnacle",
  bevel: 0.6,
  extra: Ln([-9, 0, 9].map((y) => k.planOutline({ x: BIN.x + 3, y: y - 3.6, w: 8, d: 7.2, r: 0.8 }, FLOOR + 31, P, 2)).join(""), { tone: "lo" }) + Dots([-9, 0, 9].map((y) => at([BIN.x + 12, y, FLOOR + 31])), { size: 0.4, tone: "hi" }),
});
for (const y of [-13, 9]) boxAt("cell", { x: 18, y, w: 4, d: 4, r: 0.8 }, FLOOR, 6, { tone: "mid" }, { name: "cell.pedal", bevel: 0.3, steps: 2 });

// ---- frames (keel): one aft of the pilot cell, one ahead of it; the harness runs under their webs
for (const [x, half] of [[-72, 16], [24, 13.6]]) {
  for (const side of [-1, 1]) boxAt("keel", { x, y: side < 0 ? -half - 2.4 : half, w: 2, d: 2.4, r: 0.4 }, FLOOR, 38, { tone: "mid" }, { name: "keel.frame-post", bevel: 0.2, steps: 2 });
  const web = { x, y: -half, w: 2, d: half * 2, r: 0.4 };
  const holes = [-half / 2, half / 2].map((y) => `<path class="fx-void" d="${pathOf(Array.from({ length: 20 }, (_, i) => [x + 2, y + Math.cos((i / 20) * Math.PI * 2) * half * 0.32, FLOOR + 27 + Math.sin((i / 20) * Math.PI * 2) * 6.5]))}"/>`).join("");
  boxAt("keel", web, FLOOR + 16, 22, { tone: "mid" }, { name: "keel.frame-web", bevel: 0.2, steps: 2, extra: holes + Dots([-half + 1.2, half - 1.2].flatMap((y) => [FLOOR + 18, FLOOR + 36].map((z) => at([x + 2, y, z]))), { size: 0.38 }) });
  boxAt("keel", { x, y: -half - 2.4, w: 2, d: half * 2 + 4.8, r: 0.4 }, FLOOR + 38, 2.4, { tone: "mid" }, { name: "keel.frame-beam", bevel: 0.2, steps: 2 });
}

// ---- power harness (plumbing): each capacitor cell feeds one emitter, in two lanes over the bank
const LANE_Z = [0, 0];
CELLS.forEach(([cx, cy], index) => {
  const side = Math.sign(cy);
  const emitter = EMITTERS.find((e) => Math.sign(e.y) === side && (cx < -132 ? e.x < -160 : e.x > -160));
  const wingHere = wingAt(emitter.x);
  const under = wingHere.I2[1] + ((Math.abs(emitter.y) - Math.abs(wingHere.I2[0])) / (Math.abs(wingHere.lowT[0]) - Math.abs(wingHere.I2[0]))) * (wingHere.lowT[1] - wingHere.I2[1]);
  const z = Math.min(under - 2.6, emitter.top + 5.2) - (cx < -132 ? 0 : 0);
  const start = [cx + 2.4, cy, CAP_Z1 + 3.6];
  const top = [emitter.x, emitter.y, emitter.top];
  // up off the terminal, across to the spine wall, down it to the pod lane, out to the emitter
  const over = 96.4 + (cx < -132 ? 0 : 2.2);
  const lane = z;
  cable("power", [start, [start[0], cy, over], [start[0], side * 17, over], [start[0], side * 17, lane], [start[0], emitter.y, lane], [emitter.x, emitter.y, lane], top], { name: "power.harness", shells: [false, true], free: [false, true], r: 0.7, bend: 3.2 });
});

// ---- data harness (plumbing): Armacall connectors aft under the cockpit to the core and the bank
const DATA_Z = FLOOR_F + 2.2;
cable("plumbing", [CONNECTORS[0], [CONNECTORS[0][0] - 4, CONNECTORS[0][1], CONNECTORS[0][2]], [CONNECTORS[0][0] - 4, CONNECTORS[0][1], DATA_Z], [GX + 16, CONNECTORS[0][1], DATA_Z]], { name: "plumbing.data-core", shells: [true, true], free: [true, true], r: 0.6, bend: 3 });
cable("plumbing", [CONNECTORS[1], [CONNECTORS[1][0] - 2.6, CONNECTORS[1][1], CONNECTORS[1][2]], [CONNECTORS[1][0] - 2.6, CONNECTORS[1][1], DATA_Z], [2, CONNECTORS[1][1], DATA_Z], [-1, 3.8, DATA_Z], [-62, 3.8, DATA_Z], [-66, 14.8, DATA_Z], [GX - 17, 14.8, DATA_Z], [GX - 19.5, 9, DATA_Z], [-112, 9, DATA_Z]], { name: "plumbing.data-bank", shells: [true, true], free: [true, true], r: 0.6, bend: 1.4 });
cable("plumbing", [CONNECTORS[3], [CONNECTORS[3][0] - 7.5, CONNECTORS[3][1], CONNECTORS[3][2]], [CONNECTORS[3][0] - 7.5, CONNECTORS[3][1], DATA_Z], [-8, CONNECTORS[3][1], DATA_Z], [-8, 16.5, DATA_Z], [-8, 16.5, FLOOR + 7], [-14, 16.5, FLOOR + 7]], { name: "plumbing.data-cell", shells: [true, true], free: [true, true], r: 0.6, bend: 3 });

// ================================================================ DOCKING CRADLES — under the real belly
// each saddle is cut to the height of the belly above it, so the craft rests on both
const CRADLES = [-148, 64];
for (const cx of CRADLES) {
  const top = BELLY;
  const base = { x: cx - 18, y: -26, w: 36, d: 52, r: 3 };
  boxAt("stand", base, ZLAT, 4, { tone: "mid" }, { name: "stand.cradle-base", owner: "stand.frame", extra: Dots(k.corners(base, 5).map(([x, y]) => at([x, y, ZLAT + 4])), { size: 0.45 }) });
  const post = { x: cx - 8, y: -8, w: 16, d: 16, r: 2 };
  boxAt("stand", post, ZLAT + 4, top - 6 - ZLAT - 4, { tone: "mid" }, { name: "stand.cradle-post", owner: "stand.frame" });
  const saddle = { x: cx - 13, y: -20, w: 26, d: 40, r: 2.5 };
  boxAt("stand", saddle, top - 6, 4.4, { tone: "mid" }, { name: "stand.cradle-saddle", owner: "stand.frame", bevel: 0.6 });
  const pad = { x: cx - 11, y: -18, w: 22, d: 36, r: 2 };
  boxAt("stand", pad, top - 1.6, 1.6, { tone: "lo" }, { name: "stand.cradle-pad", owner: "stand.frame", bevel: 0.3 });
}

// ================================================================ assemble the page
// settle the painter's keys; a hollow shell that still encloses its contents is in front of them
// wherever they overlap (only its outer faces are drawn), so those pairs get that one rule
const CONTENTS = [
  ["nose.shell", "sensors.*"], ["nose.shell", "nose.rail-stand"], ["nose.shell", "nose.ballast"], ["nose.shell", "nose.trim-emitter"], ["nose.shell", "nose.lidar-mount"],
  ["nacelle.shell", "thrust.*"], ["nacelle.shell", "plumbing.coolant"], ["nacelle.shell", "plumbing.exchanger"],
  ["spine.cover", "keel.frame-*"], ["spine.cover", "power.*"], ["spine.cover", "core.*"],
  ["canopy.glass", "cell.*"],
];
{
  const states = process.argv.includes("--fast") ? A.explodeStates(R.order, R.spring, { uniform: 4, stride: 16 }).depth : A.explodeStates(R.order, R.spring).depth;
  const all = R.items.slice();
  const overlaps = A.overlapsOf(all, P, { states, skip: A.sameRun });
  const like = (pattern, name) => (pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern || name.startsWith(pattern + "#") || name.startsWith(pattern + ":"));
  const shellOf = (a, b) => CONTENTS.find(([shell, inside]) => like(shell, a.name) && like(inside, b.name));
  for (const pair of overlaps.pairs) {
    const [a, b] = [all[pair.a], all[pair.b]];
    const which = shellOf(a, b) ? 0 : shellOf(b, a) ? 1 : -1;
    if (which < 0) continue;
    const shell = which === 0 ? a : b;
    if (A.shareOf(shell, pair.state) > 0.35) continue;
    const area = pair.front[0].area + pair.front[1].area;
    pair.front = pair.front.map((side, index) => ({ ...side, area: index === which ? area : 0 }));
  }
  const solved = A.orderKeys(all, overlaps);
  if (process.argv.includes("--keys")) console.log("rules", solved.rules, "dropped", solved.dropped.length, solved.dropped.slice(0, 30).map((r) => `${all[r.front].name}>${all[r.back].name}@${r.pair.state.label ?? r.pair.state}`).join(" "));
  all.forEach((item, index) => (item.key = solved.keys[index]));
  R.settled = { items: all, overlaps, solved, states };
}
const ALL = [...items];
ALL.sort((a, b) => a.key - b.key);
const groups = ALL.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}"${item.ride !== item.piece ? ` data-ride="${item.ride}"` : ""} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL_TEXT =
  "The FEISAR FX350 anti-gravity racing craft, built panel by panel in its livery, resting on two docking cradles over a section of federal track lattice in the Västerås test bay: a keel pan with two frames, side panels with round intakes and airbrakes, the dorsal spine covers, the canopy over the pilot cell, the nose cone with its lidar and trim emitter, four field emitters under the side panels, the capacitor bank, the Tru-Fly gyro, the Armacall avionics and the Syrus plasma ramjet in the nacelle.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "fx-back" });
const TEX_DEFS = [...USED_IMAGES].map((image) => `<image id="fx-tex${image}" width="1" height="1" preserveAspectRatio="none" href="data:image/webp;base64,${readFileSync(join(TEX, `emb${image}.webp`)).toString("base64")}"/>`).join("");
const texSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="fx-defs" width="0" height="0" aria-hidden="true"><defs>${TEX_DEFS}</defs></svg>`;
const frontSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fx-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="fx-craft">${groups.join("")}</g></svg>`;

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const ORDER = ["nose", "sensors", "canopy", "spine", "cell", "avionics", "core", "power", "emitters", "thrust", "nacelle", "podL", "podR", "keel", "plumbing"];
const DATA = {
  W,
  H,
  V,
  EX: unit([1, 0, 0]),
  EY: unit([0, 1, 0]),
  EZ: unit([0, 0, 1]),
  camera: glCamera(P),
  pieces: Object.fromEntries(Object.entries(PIECES).map(([id, piece]) => [id, { name: piece.name, say: piece.say }])),
  stagger: STAGGER,
  spring: SPRING,
  order: ORDER.filter((id) => items.some((item) => item.piece === id)),
  zlat: ZLAT,
  emitters: [...EMITTERS.map((e) => [e.x, e.y, e.face, 8.5]), [138, 0, BELLY, 8]],
  plume: [NAC_X[0] - 2.6, 0, TZ, 8.5],
  model: { iNom: M.SHIP.iNom, iLift: M.I_LIFTOFF, K: M.K, hoverNom: M.SHIP.hoverNom, cradle: M.SHIP.cradle, U, mass: M.MASS, rpm: M.SHIP.gyro.rpm, idle: 0.35, thrustMax: M.SHIP.thrustMax },
};
const PARTS = DATA.order.map((id, index) => `<button type="button" class="fx-part" data-part="${id}"><span class="fx-num">${String(index + 1).padStart(2, "0")}</span>${PIECES[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">FEISAR FX350 · anatomy</span><span class="iso-plate-corner" data-corner="readout" data-readout>${M.MASS.toLocaleString("en-US")} kg · docked</span></div>`;
const controls = `<div class="fx-controls"><button type="button" class="fx-engage" data-engage><span class="fx-lamp" aria-hidden="true"></span><span data-engage-label>Engage field</span></button><span class="fx-hint">Hover the craft to take it apart</span><span class="fx-live" aria-live="polite" data-live></span></div>`;
const stage = `<div class="fx-stage" tabindex="0" role="slider" aria-label="FEISAR FX350 on its test bed. Hover or use the arrow keys to take the craft apart assembly by assembly; press E or the button to engage the field, Escape to put it back together." aria-valuemin="0" aria-valuemax="${DATA.order.length}" aria-valuenow="0" aria-valuetext="Assembled, docked">${texSvg}${backSvg}<canvas class="fx-field" aria-hidden="true"></canvas>${frontSvg}</div>`;
const caption = `The FX350 is held up by its track, not by itself: four Delft field emitters drive a travelling field against the passive Halbach lattice cast into every federal track, and the repulsion falls off as e<sup>−2kh</sup> with the gap, so the craft settles where the lift equals its ${M.WEIGHT_KN.toFixed(1)} kN weight: ${(M.SHIP.hoverNom * 1000).toFixed(0)} mm at ${M.SHIP.iNom} kA, lifting off its cradles at ${M.I_LIFTOFF.toFixed(2)} kA. The Syrus plasma ramjet swallows air through both pod intakes, compresses it magnetically and heats it in an aneutronic p-¹¹B chamber; ${M.SHIP.thrustMax} kN against a ${M.SHIP.cdA} m² drag area gives ${Math.round(M.topSpeed(1)).toLocaleString("en-US")} km/h. The Tru-Fly core's flywheel stores ${Math.round(M.gyroL(1)).toLocaleString("en-US")} N·m·s of angular momentum against roll — the handling FEISAR is famous for.`;
const body = `<figure class="iso-figure fx"><div class="iso-plate">${corners}${stage}${controls}</div><figcaption class="iso-legend"><span class="fx-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure>`;

const CSS = readFileSync(join(HERE, "fx350.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "FEISAR FX350 · anatomy", theme: THEME, body: `<style>${CSS}</style>${body}`, script: glScript() + LIVE, width: 1080 });
const file = THEME === "dark" ? "index-dark.html" : "index.html";
writeFileSync(join(HERE, file), page);
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items`, 'craft box', CRAFT_BOX.lo.map(Math.round), CRAFT_BOX.hi.map(Math.round));

// hollow shells (nose, nacelle, spine covers, canopy) are drawn by their outer faces only, so whatever
// they enclose is always behind what is drawn of them; the audit's rays still meet their unseen back
// walls through the open joints between bays, so a shell and its own contents are excused from depth
// the power harness lies across the bank it comes from, and the two data looms leave the Armacall side by side
A.auditOrExit(R, P, { allow: CONTENTS, crowd: [["power.harness*", "power.cell*"], ["power.harness*", "power.strap*"], ["power.harness*", "plumbing.coolant*"], ["plumbing.data-cell", "plumbing.data-bank"]] });
