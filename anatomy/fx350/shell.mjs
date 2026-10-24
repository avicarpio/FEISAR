// The FX350 airframe as panels: stations cut through the site's GLB (the reference shape) give one
// convex ring per station and component; consecutive rings bound one panel bay. The craft is then
// built from those bays with the kit, so it keeps the model's lines while every panel is a real part.
import { hullOf } from "../kit/lathe.mjs";

/** Points where the plane x = X cuts the given triangles: [[y, z], ...]. */
export function sliceAt(tris, X) {
  const out = [];
  for (const t of tris)
    for (let e = 0; e < 3; e++) {
      const a = t[e];
      const c = t[(e + 1) % 3];
      if ((a[0] - X) * (c[0] - X) > 0 || a[0] === c[0]) continue;
      const s = (X - a[0]) / (c[0] - a[0]);
      out.push([a[1] + s * (c[1] - a[1]), a[2] + s * (c[2] - a[2])]);
    }
  return out;
}

/** A convex ring of `count` points round `centre` (in y, z), one per equal angle, on the hull of `points`. */
export function ringOf(points, centre, count, { phase = 0 } = {}) {
  const hull = hullOf(points);
  if (hull.length < 3) return null;
  const ring = [];
  for (let i = 0; i < count; i++) {
    const angle = phase + (i / count) * Math.PI * 2;
    const d = [Math.cos(angle), Math.sin(angle)];
    let best = null;
    for (let j = 0; j < hull.length; j++) {
      const a = hull[j];
      const b = hull[(j + 1) % hull.length];
      const e = [b[0] - a[0], b[1] - a[1]];
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-12) continue;
      const w = [a[0] - centre[0], a[1] - centre[1]];
      const t = (w[0] * e[1] - w[1] * e[0]) / den;
      const u = (w[0] * d[1] - w[1] * d[0]) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && (best === null || t < best)) best = t;
    }
    if (best === null) return null;
    ring.push([centre[0] + d[0] * best, centre[1] + d[1] * best]);
  }
  return ring;
}

/** Stations of one component: [{ x, ring }] where the reference has a section. */
export function stationsOf(tris, xs, { keep = () => true, centre, count }) {
  const out = [];
  for (const x of xs) {
    const points = sliceAt(tris, x).filter(keep);
    if (points.length < 3) continue;
    const c = typeof centre === "function" ? centre(points, x) : centre;
    const ring = ringOf(points, c, count);
    if (ring) out.push({ x, ring });
  }
  return out;
}
