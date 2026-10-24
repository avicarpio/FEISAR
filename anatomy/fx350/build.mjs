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
  cell: { name: "Pilot cell", say: "pilot cell · Lisbon", move: [20, 0, 46] },
  sensors: { name: "Nose sensors", say: "lidar head, trim emitter and ballast rail · Gothenburg", move: [26, 0, 0] },
  core: { name: "Tru-Fly stability core", say: "Tru-Fly core · 42,000 rpm flywheel", move: [0, 0, 30] },
  power: { name: "Field capacitor bank", say: `capacitor bank · ${M.CAPACITY_KWH.toFixed(1)} kWh · Brussels`, move: [0, 0, 28] },
  avionics: { name: "Armacall VII avionics", say: "Armacall VII · flight and weapons control · Warsaw", move: [0, 0, 26] },
  podL: { name: "Port side and pod", say: "port side and pod · Barcelona, Catalan Republic", move: [0, -96, 14] },
  podR: { name: "Starboard side and pod", say: "starboard side and pod · Stuttgart", move: [-10, 128, -18] },
  emitters: { name: "AG field emitters", say: `field emitters · 4 × ${M.SHIP.iNom} kA · Delft`, move: [0, 0, -12] },
  nacelle: { name: "Engine nacelle", say: "engine nacelle · Toulouse", move: [-118, 0, 30] },
  thrust: { name: "Syrus plasma ramjet", say: `Syrus plasma ramjet · ${M.SHIP.thrustMax} kN · Toulouse`, move: [-34, 0, 0] },
  ducts: { name: "Intake ducts", say: "intake ducts · pods to compressor", move: [-50, 0, 34] },
  plumbing: { name: "Coolant and harness", say: "coolant loop and harness", move: [0, 0, 0] },
};
const STAGGER = ["canopy", "nose", "nacelle", "podL", "podR", "cell", "sensors", "thrust", "emitters", "core", "power", "avionics", "plumbing", "keel", "stand"];
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
  back.push(Ln(k.ring(c[0], c[1], 9, ZLAT, P, 24) + k.lineOnTop([c[0] - 14, c[1]], [c[0] + 14, c[1]], ZLAT, P), { tone: "faint" }));
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
// the texture is mapped onto each face exactly: a flat triangle projects affinely, so one matrix takes
// its UV corners to its screen corners; the kit's tone is laid over it as a translucent shade
function faceSvg(tri, t, bright, weights) {
  const screen = t.map((p) => at(p));
  const shade = (1 - bright) * 0.92;
  if (tri.image === null || tri.image === undefined || !tri.uv) {
    const fill = hex(colourOf(tri, weights).map((v) => v * bright));
    return `<path class="fx-tri" fill="${fill}" stroke="${fill}" d="M${screen.map((q) => q.map((v) => v.toFixed(2)).join(" ")).join("L")}Z"/>`;
  }
  USED_IMAGES.add(tri.image);
  // the whole original triangle's UV map (sub-triangles share its plane, so the same matrix)
  const S0 = tri.p.map((p) => at(p));
  const [u0, u1, u2] = tri.uv;
  const du1 = [u1[0] - u0[0], u1[1] - u0[1]];
  const du2 = [u2[0] - u0[0], u2[1] - u0[1]];
  const ds1 = [S0[1][0] - S0[0][0], S0[1][1] - S0[0][1]];
  const ds2 = [S0[2][0] - S0[0][0], S0[2][1] - S0[0][1]];
  const det = du1[0] * du2[1] - du2[0] * du1[1];
  // inflate the clip a hair so neighbouring faces overlap instead of leaving an anti-aliased seam
  const c = screen.reduce((acc, q) => [acc[0] + q[0] / 3, acc[1] + q[1] / 3], [0, 0]);
  const grow = screen.map((q) => {
    const d = Math.hypot(q[0] - c[0], q[1] - c[1]) || 1;
    return [q[0] + ((q[0] - c[0]) / d) * 0.35, q[1] + ((q[1] - c[1]) / d) * 0.35];
  });
  const tri2d = `M${screen.map((q) => q.map((v) => v.toFixed(2)).join(" ")).join("L")}Z`;
  const clip = `M${grow.map((q) => q.map((v) => v.toFixed(2)).join(" ")).join("L")}Z`;
  if (Math.abs(det) < 1e-9) {
    const fill = hex(colourOf(tri, weights).map((v) => v * bright));
    return `<path class="fx-tri" fill="${fill}" stroke="${fill}" d="${tri2d}"/>`;
  }
  const a = (ds1[0] * du2[1] - ds2[0] * du1[1]) / det;
  const cc = (ds2[0] * du1[0] - ds1[0] * du2[0]) / det;
  const b = (ds1[1] * du2[1] - ds2[1] * du1[1]) / det;
  const d = (ds2[1] * du1[0] - ds1[1] * du2[0]) / det;
  const e = S0[0][0] - a * u0[0] - cc * u0[1];
  const f = S0[0][1] - b * u0[0] - d * u0[1];
  const id = `fxc${CLIP_ID++}`;
  const m = [a, b, cc, d, e, f].map((v) => +v.toFixed(3)).join(" ");
  return `<clipPath id="${id}"><path d="${clip}"/></clipPath><g clip-path="url(#${id})"><use href="#fx-tex${tri.image}" transform="matrix(${m})"/></g>${shade > 0.004 ? `<path class="fx-shade" fill-opacity="${shade.toFixed(3)}" d="${tri2d}"/>` : ""}`;
}
const hex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

const PART_PIECE = { hull: "keel", glow: "keel", nose: "nose", canopy_glass: "canopy", canopy_frame: "canopy", cockpit: "cell", side_L: "podL", side_R: "podR", rear: "nacelle" };

// where a vertical line at (x, y) crosses the given mesh parts: the z of every hit, ascending
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
const bellyAt = (x, y) => zHits(x, y)[0];

const MESH_ITEMS = [];
const LIGHT = G.lightOf(P);
const keyOf = (p) => G.dot3(p, V);
const normalOf = ([a, b, c]) => G.unit3(G.cross3(G.sub3(b, a), G.sub3(c, a)));
const pathOf = (points) => "M" + points.map((p) => at(p).map((v) => v.toFixed(2)).join(" ")).join("L") + "Z";
const lineOf = (a, b) => `M${at(a).map((v) => v.toFixed(2)).join(" ")}L${at(b).map((v) => v.toFixed(2)).join(" ")}`;
// split a triangle until its longest edge is under `most`; each piece keeps its barycentric corners
function split(tri, most, bary = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
  const [a, b, c] = tri;
  const lengths = [G.len3(G.sub3(b, a)), G.len3(G.sub3(c, b)), G.len3(G.sub3(a, c))];
  if (Math.max(...lengths) <= most) return [{ p: tri, bary }];
  const mid = (x, y) => x.map((v, i) => (v + y[i]) / 2);
  const ab = G.lerp3(a, b, 0.5);
  const bc = G.lerp3(b, c, 0.5);
  const ca = G.lerp3(c, a, 0.5);
  const [A0, B0, C0] = bary;
  const AB = mid(A0, B0);
  const BC = mid(B0, C0);
  const CA = mid(C0, A0);
  return [
    split([a, ab, ca], most, [A0, AB, CA]),
    split([ab, b, bc], most, [AB, B0, BC]),
    split([ca, bc, c], most, [CA, BC, C0]),
    split([ab, bc, ca], most, [AB, BC, CA]),
  ].flat();
}
for (const part of CRAFT) {
  const piece = PART_PIECE[part.name] ?? "keel";
  const glass = part.name === "canopy_glass";
  // faces
  for (const tri of part.tris) {
    const n = normalOf(tri.p);
    const front = G.dot3(n, V) >= 0;
    const seen = front ? n : G.mul3(n, -1);
    const band = G.bandOf(G.dot3(seen, LIGHT));
    const bright = front ? BRIGHT[band] : BRIGHT[0] * 0.82; // the inside of a shell is in its own shade
    for (const { p: t, bary } of split(tri.p, 30)) {
      const centre = G.mul3(G.add3(G.add3(t[0], t[1]), t[2]), 1 / 3);
      const weights = [bary[0], bary[1], bary[2]].map((_, i) => bary.reduce((acc, corner, j) => acc.map((v, n) => v + corner[n] * (j === i ? 0.5 : 0.25)), [0, 0, 0]));
      weights.push(bary.reduce((acc, corner) => acc.map((v, n) => v + corner[n] / 3), [0, 0, 0]));
      const ghost = (part.name === "hull" || part.name === "glow") && centre[2] > 60 && centre[0] > -204 && centre[0] < 100 ? " fx-ghost" : "";
      MESH_ITEMS.push({ piece, front, key: keyOf(centre) - (front ? 0 : 0.02), svg: ghost ? `<g class="fx-ghost">${faceSvg(tri, t, bright, weights)}</g>` : faceSvg(tri, t, bright, weights), part: part.name });
    }
  }
  // edges: creases over 28°, silhouettes and open edges
  const edges = new Map();
  const id = (p) => p.map((v) => v.toFixed(2)).join(",");
  part.tris.forEach((tri, index) => {
    for (let e = 0; e < 3; e++) {
      const a = tri.p[e];
      const b = tri.p[(e + 1) % 3];
      const keyAB = [id(a), id(b)].sort().join("|");
      if (!edges.has(keyAB)) edges.set(keyAB, { a, b, faces: [] });
      edges.get(keyAB).faces.push(index);
    }
  });
  for (const { a, b, faces } of edges.values()) {
    const normals = faces.map((index) => normalOf(part.tris[index].p));
    let tone = null;
    if (normals.length === 1) tone = "mid";
    else {
      const facing = normals.map((n) => G.dot3(n, V) >= 0);
      if (facing.some((f) => f) && facing.some((f) => !f)) tone = "hi";
      else if (G.dot3(normals[0], normals[1]) < Math.cos(28 * DEG)) tone = "lo";
    }
    if (!tone) continue;
    const front = normals.some((n) => G.dot3(n, V) >= 0);
    const length = G.len3(G.sub3(b, a));
    const count = Math.max(1, Math.ceil(length / 16));
    for (let i = 0; i < count; i++) {
      const p0 = G.lerp3(a, b, i / count);
      const p1 = G.lerp3(a, b, (i + 1) / count);
      MESH_ITEMS.push({ piece, front, key: keyOf(G.lerp3(p0, p1, 0.5)) + 1.2, svg: `<path class="iso-line fx-edge" data-tone="${tone}" d="${lineOf(p0, p1)}"/>`, part: part.name });
    }
  }
}

// ================================================================ SYSTEMS — inside the real shell
// Everything below sits inside the mesh's own cavities (probed with zHits), so the assembled craft is
// exactly the original model; taking it apart opens the shell and shows what it carries.
const FLOOR_R = 56; // top of the keel floor in the rear spine bay
const FLOOR_F = 55; // and in the forward bay and the nose

// ---- keel floor plates the systems bolt to (keel)
for (const [x0, x1, floor] of [[-200, -76, FLOOR_R], [36, 96, FLOOR_F], [102, 196, FLOOR_F]]) {
  const plan = { x: x0, y: -13, w: x1 - x0, d: 26, r: 2 };
  boxAt("keel", plan, floor - 1.6, 1.6, { tone: "lo" }, { name: "keel.deck-plate", bevel: 0.3, extra: Ln(k.planOutline(k.insetPlan(plan, 2.4), floor, P, 2), { tone: "faint" }) + Dots(k.corners(plan, 3).map(([x, y]) => at([x, y, floor])), { size: 0.4 }) });
}

// ---- field capacitor bank (power) — Brussels: four superconducting cells in a strapped rack
const CAP_X = [-140, -122];
const CAP_Y = [-7, 7];
const CAP_R = 6.2;
const CAP_Z0 = FLOOR_R + 2;
const CAP_Z1 = 90;
const rack = { x: -150, y: -14, w: 38, d: 28, r: 2 };
boxAt("power", rack, FLOOR_R, 2, { tone: "mid" }, { name: "power.rack", extra: Dots(k.corners(rack, 2.5).map(([x, y]) => at([x, y, FLOOR_R + 2])), { size: 0.4 }) });
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
for (const y of CAP_Y) boxAt("power", { x: CAP_X[0] - 1, y: y - 1.5, w: CAP_X[1] - CAP_X[0] + 2, d: 3, r: 0.8 }, CAP_Z1 + 0.01, 1.6, { tone: "mid" }, { name: "power.busbar", bevel: 0.3 });

// ---- Tru-Fly stability core (core) — a gimballed flywheel between two uprights
const GX = -92;
const GZ = 84;
boxAt("core", { x: GX - 16, y: -13, w: 32, d: 26, r: 2 }, FLOOR_R, 4, { tone: "mid" }, { name: "core.plinth", extra: Dots(k.corners({ x: GX - 16, y: -13, w: 32, d: 26, r: 2 }, 2.6).map(([x, y]) => at([x, y, FLOOR_R + 4])), { size: 0.42 }) });
for (const x of [GX - 15, GX + 12]) boxAt("core", { x, y: -3, w: 3, d: 6, r: 0.6 }, FLOOR_R + 4, GZ - FLOOR_R - 4 + 3, { tone: "mid" }, { name: "core.upright" });
// outer gimbal ring (axis y), pivoting on the uprights' pins (axis x)
const OUTER = G.frameOf([GX, 0, GZ], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
ringAt("core", OUTER, -1.6, 1.6, 10.2, 12, { tone: "hi" }, { name: "core.outer-ring" });
for (const sign of [-1, 1]) {
  const pin = G.frameOf([GX + sign * 12, 0, GZ], [sign, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("core", pin, 0, 1.6, 1.4, { tone: "mid" }, { name: "core.pivot" });
}
// inner ring (axis x) and the flywheel (axis z) with its drive motor
const INNER = G.frameOf([GX, 0, GZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
ringAt("core", INNER, -1.3, 1.3, 7.8, 9.4, { tone: "hi" }, { name: "core.inner-ring" });
const WHEEL = G.frameOf([GX, 0, GZ - 1.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("core", WHEEL, [[0, 6.6], [3.2, 6.6]], { tone: "hi" }, { name: "core.flywheel", extra: Faded(G.ribsOf(WHEEL, 0, 3.2, 6.6, 36, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
discAt("core", G.frameOf([GX, 0, GZ + 1.6], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 2.4, 2.6, { tone: "mid" }, { name: "core.motor" });

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
const LIDAR = G.frameOf([178, 0, 69], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
turned("sensors", LIDAR, [[0, 7.4], [4, 7.4], [4, 6], [9, 6], [9, 4.6], [11, 4.6]], { tone: "hi" }, { name: "sensors.lidar", extra: `<path class="fx-void" d="${G.circleOf(LIDAR, 11, 3.2, P, 24)}"/>` });
boxAt("sensors", { x: 162, y: -6, w: 12, d: 12, r: 1 }, FLOOR_F, 69 - 7.4 - FLOOR_F, { tone: "mid" }, { name: "nose.lidar-mount" });
const TRIM = G.frameOf([138, 0, FLOOR_F], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
turned("sensors", TRIM, [[0, 9], [2, 9], [2, 7.6], [11, 7.6], [11, 5], [13, 5]], { tone: "hi" }, { name: "nose.trim-emitter", extra: Faded(G.ribsOf(TRIM, 2, 11, 7.6, 30, P, { fade: [0.1, 0.55] }), { tone: "lo" }) });
for (const y of [-10, 10]) {
  const F = G.frameOf([106, y, 61], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  discAt("sensors", F, 0, 20, 1.2, { tone: "mid" }, { name: "nose.ballast-rail" });
  boxAt("sensors", { x: 104, y: y - 2.5, w: 4, d: 5, r: 0.6 }, FLOOR_F, 61 + 1.2 - FLOOR_F, { tone: "mid" }, { name: "nose.rail-stand" });
}
boxAt("sensors", { x: 110, y: -12, w: 10, d: 24, r: 1.5 }, 58, 8, { tone: "hi" }, { name: "nose.ballast", bevel: 0.5 });

// ---- AG field emitters ×4 (emitters) — Delft: inside the rear pods, faces flush with the pod bellies
const EMITTERS = [];
for (const side of [-1, 1])
  for (const x of [-182, -124]) {
    const y = side * 48;
    const face = bellyAt(x, y) + 0.6;
    const F = G.frameOf([x, y, face], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const h = 15;
    turned("emitters", F, [[0, 9], [1.6, 9], [1.6, 10.6], [h - 2.4, 10.6], [h - 2.4, 12.2], [h, 12.2]], { tone: "hi" }, {
      name: "emitters.coil",
      extra: Faded(G.ribsOf(F, 1.6, h - 2.4, 10.6, 44, P, { fade: [0.1, 0.55] }), { tone: "lo" }) + Dots(G.dotsOf(F, h, 11, 12, P, { all: true }), { size: 0.38 }),
    });
    discAt("emitters", G.frameOf([x, y, face + h], [0, 0, 1], [1, 0, 0], [0, 1, 0]), 0, 2.6, 4.2, { tone: "mid" }, { name: "emitters.terminal" });
    EMITTERS.push({ x, y, face, top: face + h + 2.6 });
  }

// ---- Syrus plasma ramjet core (thrust) — Toulouse: inside the nacelle, exhausting aft
const TCORE = G.frameOf([-160, 0, 86], [-1, 0, 0], [0, 1, 0], [0, 0, -1]);
turned("thrust", TCORE, [[0, 10.5], [2.4, 10.5]], { tone: "mid" }, { name: "thrust.mount", extra: Dots(G.dotsOf(TCORE, 2.4, 9, 14, P, { fade: FADE }), { size: 0.36 }) });
turned("thrust", TCORE, [[2.4, 8.4], [14, 8.4]], { tone: "hi" }, { name: "thrust.compressor", extra: Faded(G.ribsOf(TCORE, 2.4, 14, 8.4, 34, P, { fade: [0.1, 0.55], seams: true }), { tone: "lo" }) });
turned("thrust", TCORE, [[14, 9.8], [28, 9.8]], { tone: "hi" }, { name: "thrust.chamber", inner: [19, 23].map((s) => G.arcOf(TCORE, s, 9.8, P)).join("") });
const tnoz = (s) => 7.6 + 2.2 * Math.pow(Math.max(0, (s - 28) / 16), 1.4);
const tnozSlope = (s) => (2.2 * 1.4 * Math.pow(Math.max(0, (s - 28) / 16), 0.4)) / 16;
turned("thrust", TCORE, [[28, 8.2], ...Array.from({ length: 9 }, (_, i) => [28 + 2 * i, tnoz(28 + 2 * i), i && i < 8 ? 1 : 0])], { tone: "hi" }, { name: "thrust.nozzle", smooth: { slope: tnozSlope, rows: 3 } });
for (const s of [31, 36]) ringAt("thrust", TCORE, s - 1, s + 1, tnoz(s) - 0.2, tnoz(s) + 1.8, { tone: "mid" }, { name: "thrust.coil" });

// ---- heat exchanger (plumbing): plasma-chamber coolant gives its heat to the capacitor cryo loop
const HX = { x: -194, y: -9, w: 22, d: 18, r: 1.5 };
boxAt("plumbing", HX, FLOOR_R - 1.6, 12, { tone: "hi" }, { name: "plumbing.exchanger", bevel: 0.5, extra: Ln([0, 1, 2].map((i) => k.planOutline({ x: HX.x + 2 + i * 6.6, y: HX.y + 2.5, w: 4, d: 13, r: 1.4 }, FLOOR_R + 10.4, P, 2)).join(""), { tone: "lo" }) });
for (const y of [-4, 4]) {
  // from under the plasma chamber straight down onto the exchanger below it
  const top = [-181 + y * 0.8, y, 86 - 9.8];
  pipe("plumbing", [top, [top[0], y, FLOOR_R + 10.4]], 1.3, { flanges: [false, true], flangeR: 1.6, name: "plumbing.coolant", free: [true, false], bend: 3 });
}

// ---- power harness (plumbing): each capacitor cell feeds one emitter, in two lanes over the bank
const LANE_Z = [76.5, 79];
CELLS.forEach(([cx, cy], index) => {
  const side = Math.sign(cy);
  const emitter = EMITTERS.find((e) => Math.sign(e.y) === side && (cx < -132 ? e.x < -150 : e.x > -150));
  const z = LANE_Z[cx < -132 ? 0 : 1];
  const start = [cx + 2.4, cy, 92.4];
  const top = [emitter.x, emitter.y, emitter.top];
  // up off the terminal, across to the spine wall, down it to the pod lane, out to the emitter
  const over = 95 + (cx < -132 ? 0 : 2.6);
  const lane = z;
  cable("plumbing", [start, [start[0], cy, over], [start[0], side * 15, over], [start[0], side * 15, lane], [emitter.x, side * 15, lane], [emitter.x, emitter.y, lane], top], { name: "plumbing.power", shells: [false, true], free: [false, true], r: 0.7, bend: 3.2 });
});

// ---- data harness (plumbing): Armacall connectors aft under the cockpit to the core and the bank
const DATA_Z = FLOOR_F + 3;
cable("plumbing", [CONNECTORS[0], [CONNECTORS[0][0] - 4, CONNECTORS[0][1], CONNECTORS[0][2]], [CONNECTORS[0][0] - 4, CONNECTORS[0][1], DATA_Z], [-96, CONNECTORS[0][1], DATA_Z], [-96, -11, FLOOR_R + 4.6], [GX + 13, -11, FLOOR_R + 4.6]], { name: "plumbing.data-core", shells: [true, false], free: [true, false], r: 0.6, bend: 3 });
cable("plumbing", [CONNECTORS[1], [CONNECTORS[1][0] - 7, CONNECTORS[1][1], CONNECTORS[1][2]], [CONNECTORS[1][0] - 7, CONNECTORS[1][1], DATA_Z], [-108, CONNECTORS[1][1], DATA_Z], [-108, -9, FLOOR_R + 2]], { name: "plumbing.data-bank", shells: [true, false], free: [true, false], r: 0.6, bend: 3 });
cable("plumbing", [CONNECTORS[3], [CONNECTORS[3][0] - 4, CONNECTORS[3][1], CONNECTORS[3][2]], [CONNECTORS[3][0] - 4, CONNECTORS[3][1], DATA_Z], [-30, CONNECTORS[3][1], DATA_Z], [-30, 10, 70]], { name: "plumbing.data-cell", shells: [true, true], free: [true, true], r: 0.6, bend: 3 });

// ================================================================ DOCKING CRADLES — under the real belly
// each saddle is cut to the height of the belly above it, so the craft rests on both
const CRADLES = [-148, 64];
for (const cx of CRADLES) {
  const top = Math.min(bellyAt(cx - 12, 0), bellyAt(cx + 12, 0), bellyAt(cx, -16), bellyAt(cx, 16));
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
A.settle(R, P);
// the real mesh goes into one SVG layer per assembly and side (back faces / front faces): each layer
// moves as a whole with a CSS transform, so taking the craft apart composites instead of repainting
// 7,000 textured faces; the systems (kit parts) sit in their own layer between the hull's back faces
// and its front faces, which is where they physically are
const LAYERS = new Map();
for (const item of MESH_ITEMS) {
  const id = `${item.piece}-${item.front ? "f" : "b"}`;
  if (!LAYERS.has(id)) LAYERS.set(id, { id, piece: item.piece, front: item.front, list: [] });
  LAYERS.get(id).list.push(item);
}
const layerSvg = (layer) => {
  layer.list.sort((a, b) => a.key - b.key);
  const mean = layer.list.reduce((sum, item) => sum + item.key, 0) / layer.list.length;
  const [mx, my, mz] = PIECES[layer.piece].move;
  return { mean, front: layer.front, svg: `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fx-layer" viewBox="0 0 ${W} ${H}" aria-hidden="true" data-piece="${layer.piece}" data-side="${layer.front ? "f" : "b"}" data-k="MEAN" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}">${layer.list.map((item) => item.svg).join("")}</svg>`.replace("MEAN", mean.toFixed(2)) };
};
const MESH_LAYERS = [...LAYERS.values()].map(layerSvg);
const backLayers = MESH_LAYERS.filter((layer) => !layer.front).sort((a, b) => a.mean - b.mean).map((layer) => layer.svg).join("");
const frontLayers = MESH_LAYERS.filter((layer) => layer.front).sort((a, b) => a.mean - b.mean).map((layer) => layer.svg).join("");
const ALL = [...items];
ALL.sort((a, b) => a.key - b.key);
const groups = ALL.map((item, index) => {
  const [mx, my, mz] = item.move;
  return `<g class="it" data-piece="${item.piece}"${item.ride !== item.piece ? ` data-ride="${item.ride}"` : ""} data-k="${item.key.toFixed(2)}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}" data-i="${index}">${item.svg}</g>`;
});

const LABEL_TEXT =
  "Cutaway of the FEISAR FX350 anti-gravity racing craft resting on two docking cradles over a section of federal track lattice in the Västerås test bay: a carbon-ceramic keel of six bulkheads and longerons, the nose cone, two wing pods on pylons with four field emitters underneath, and the Syrus plasma ramjet at the tail.";
const backSvg = k.figureSvg({ width: W, height: H, label: LABEL_TEXT, body: back, className: "fx-back" });
const TEX_DEFS = [...USED_IMAGES].map((image) => `<image id="fx-tex${image}" width="1" height="1" preserveAspectRatio="none" href="data:image/webp;base64,${readFileSync(join(TEX, `emb${image}.webp`)).toString("base64")}"/>`).join("");
const texSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="fx-defs" width="0" height="0" aria-hidden="true"><defs>${TEX_DEFS}</defs></svg>`;
const frontSvg = `${backLayers}<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg fx-front" viewBox="0 0 ${W} ${H}" aria-hidden="true"><g class="fx-craft">${groups.join("")}</g></svg>${frontLayers}`;

const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const ORDER = ["nose", "sensors", "canopy", "cell", "avionics", "core", "power", "emitters", "thrust", "nacelle", "podL", "podR", "keel", "plumbing"];
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
  order: ORDER.filter((id) => items.some((item) => item.piece === id) || MESH_ITEMS.some((item) => item.piece === id)),
  zlat: ZLAT,
  emitters: [...EMITTERS.map((e) => [e.x, e.y, e.face, 11]), [138, 0, FLOOR_F - 1.6, 8]],
  plume: [-238, 0, 80, 6.5],
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
console.log("wrote", file, `${(page.length / 1024).toFixed(0)} KB`, `${items.length} items + ${MESH_ITEMS.length} mesh pieces`, 'craft box', CRAFT_BOX.lo.map(Math.round), CRAFT_BOX.hi.map(Math.round));

A.auditOrExit(R, P, {});
