// Reads the craft straight from the site's GLB (assets/models/feisar_fx350.glb, Nobby76's "WipeOut -
// Feisar", CC BY 4.0) so the anatomy figure is the real model, triangle for triangle.
import { readFileSync } from "node:fs";

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const ARRAYS = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

function accessorOf(json, bin, index) {
  const accessor = json.accessors[index];
  const view = json.bufferViews[accessor.bufferView];
  const Type = ARRAYS[accessor.componentType];
  const size = COMPONENTS[accessor.type];
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 0;
  const out = [];
  for (let i = 0; i < accessor.count; i++) {
    const base = offset + (stride ? i * stride : i * size * Type.BYTES_PER_ELEMENT);
    const value = [];
    for (let c = 0; c < size; c++) value.push(new Type(bin.buffer, bin.byteOffset + base + c * Type.BYTES_PER_ELEMENT, 1)[0]);
    out.push(size === 1 ? value[0] : value);
  }
  return out;
}

function quatApply([x, y, z, w], [vx, vy, vz]) {
  const ix = w * vx + y * vz - z * vy;
  const iy = w * vy + z * vx - x * vz;
  const iz = w * vz + x * vy - y * vx;
  const iw = -x * vx - y * vy - z * vz;
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}

/**
 * Parts of the GLB in figure coordinates: x along the craft (nose +x), y across, z up, in figure units.
 * `scale` is figure units per GLB unit; `shift` is added after the axis swap.
 */
export function loadCraft(path, { scale, shift = [0, 0, 0] }) {
  const file = readFileSync(path);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength + 8;
  const bin = file.subarray(binStart);
  const parts = [];
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const t = node.translation ?? [0, 0, 0];
    const q = node.rotation ?? [0, 0, 0, 1];
    const s = node.scale ?? [1, 1, 1];
    const toWorld = ([x, y, z]) => {
      const r = quatApply(q, [x * s[0], y * s[1], z * s[2]]);
      const web = [r[0] + t[0], r[1] + t[1], r[2] + t[2]];
      // web axes (x right, y up, z = nose) to figure axes (x = nose, y across, z up)
      return [web[2] * scale + shift[0], web[0] * scale + shift[1], web[1] * scale + shift[2]];
    };
    const tris = [];
    for (const prim of json.meshes[node.mesh].primitives) {
      const pos = accessorOf(json, bin, prim.attributes.POSITION).map(toWorld);
      const idx = prim.indices !== undefined ? accessorOf(json, bin, prim.indices) : pos.map((_, i) => i);
      const mat = prim.material !== undefined ? json.materials[prim.material] : null;
      const material = mat ? mat.name : "";
      const texture = mat?.pbrMetallicRoughness?.baseColorTexture?.index;
      const image = texture !== undefined ? json.textures[texture].source ?? json.textures[texture].extensions?.EXT_texture_webp?.source : null;
      const factor = mat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
      const uv = prim.attributes.TEXCOORD_0 !== undefined ? accessorOf(json, bin, prim.attributes.TEXCOORD_0) : null;
      for (let i = 0; i + 2 < idx.length; i += 3) {
        const corner = [idx[i], idx[i + 1], idx[i + 2]];
        tris.push({ p: corner.map((v) => pos[v]), uv: uv ? corner.map((v) => uv[v]) : null, material, image, factor });
      }
    }
    parts.push({ name: node.name, tris });
  }
  return parts;
}

export function boundsOf(points) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let c = 0; c < 3; c++) {
    lo[c] = Math.min(lo[c], p[c]);
    hi[c] = Math.max(hi[c], p[c]);
  }
  return { lo, hi };
}

/** The GLB's embedded images: [{ index, mime, bytes }]. */
export function imagesOf(path) {
  const file = readFileSync(path);
  const jsonLength = file.readUInt32LE(12);
  const json = JSON.parse(file.subarray(20, 20 + jsonLength).toString("utf8"));
  const bin = file.subarray(20 + jsonLength + 8);
  return (json.images ?? []).map((image, index) => {
    const view = json.bufferViews[image.bufferView];
    return { index, mime: image.mimeType, bytes: bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength) };
  });
}
