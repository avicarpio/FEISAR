"""
High-resolution texture pass for the Nobby76 FEISAR (CC BY 4.0).

1. Base colour: vector livery from tools/feisar_livery.py; only the photographic machinery block
   (belly/engine) is upscaled with Real-ESRGAN (x4plus, two passes).
2. A new 4096 px normal map: grooves at the UV island borders and along the livery's panel lines,
   rivets, and the original normal map on the machinery block only.
3. Metallic/roughness: satin paint on the livery, brushed metal on the machinery.
4. Cockpit, glass and glow textures are upscaled with Real-ESRGAN as well.

Usage:
  python3 tools/feisar_textures.py <unzipped sketchfab dir> <uv.json from tools/dump_uv.py> <realesrgan dir> <out dir>
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC, UVJSON, RESR, OUT = sys.argv[1:5]
TEX = os.path.join(SRC, "textures")
os.makedirs(OUT, exist_ok=True)
tmp = os.path.join(OUT, "_tmp")
os.makedirs(tmp, exist_ok=True)


def esrgan(src, dst, model="realesrgan-x4plus"):
    subprocess.run([os.path.join(RESR, "realesrgan-ncnn-vulkan"), "-i", src, "-o", dst, "-n", model, "-s", "4"],
                   cwd=RESR, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def upscale(name, size, passes=1):
    src = os.path.join(TEX, name)
    rgb = Image.open(src).convert("RGB")
    p = os.path.join(tmp, name + ".0.png")
    rgb.save(p)
    for k in range(passes):
        q = os.path.join(tmp, f"{name}.{k + 1}.png")
        esrgan(p, q)
        p = q
    return Image.open(p).convert("RGB").resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- base colour
# Only the photographic machinery block (top-right quadrant: belly and engine) is upscaled; the painted
# livery is vector artwork (tools/feisar_livery.py), so its type and edges stay sharp.
S = 4096
base = upscale("Body_baseColor.jpeg", S, passes=2)
hsv = np.asarray(base.convert("HSV")).astype(np.float32)
hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255)
graded = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
graded = graded.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
mach_png = os.path.join(tmp, "machinery.png")
graded.crop((S // 2, 0, S, S // 2)).save(mach_png)
subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "feisar_livery.py"), mach_png, OUT, UVJSON], check=True)
print("base colour done")

# ---------------------------------------------------------------- normal map
faces = [f for f in json.load(open(UVJSON)) if f["mat"] == "Body"]
height = Image.new("L", (S, S), 128)
d = ImageDraw.Draw(height)
# island borders: edges used by exactly one face (in UV space)
edges = {}
for f in faces:
    pts = [(round(u * S), round(v * S)) for u, v in f["uv"]]
    for i in range(len(pts)):
        e = tuple(sorted((pts[i], pts[(i + 1) % len(pts)])))
        edges[e] = edges.get(e, 0) + 1
border = [e for e, n in edges.items() if n == 1]
for (p, q) in border:
    d.line([p, q], fill=40, width=7)
# rivets just inside each border edge
for (p, q) in border:
    p, q = np.array(p, float), np.array(q, float)
    L = np.linalg.norm(q - p)
    if L < 60:
        continue
    t = (q - p) / L
    nrm = np.array([-t[1], t[0]])
    for k in range(int(L // 46)):
        c = p + t * (23 + k * 46)
        for side in (1, -1):
            r = c + nrm * side * 16
            d.ellipse([r[0] - 4, r[1] - 4, r[0] + 4, r[1] + 4], fill=200)
grooves = np.asarray(Image.open(os.path.join(OUT, "Body_grooves.png")).convert("L")).astype(np.float32)
hh = np.asarray(height).astype(np.float32) - (128 - np.minimum(grooves, 128)) * 0.55
height = Image.fromarray(np.clip(hh, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6))
h = np.asarray(height).astype(np.float32) / 255
gx = np.zeros_like(h); gy = np.zeros_like(h)
gx[:, 1:-1] = (h[:, 2:] - h[:, :-2]) * 0.5
gy[1:-1, :] = (h[2:, :] - h[:-2, :]) * 0.5
strength = 6.0
n_seam = np.dstack([-gx * strength, gy * strength, np.ones_like(h)])
n_seam /= np.linalg.norm(n_seam, axis=2, keepdims=True)
orig = np.asarray(Image.open(os.path.join(TEX, "Body_normal.png")).convert("RGB").resize((S, S), Image.LANCZOS)).astype(np.float32) / 255 * 2 - 1
# the original normal map carries the old decals' dents: keep it only on the machinery block
mq = np.zeros((S, S), np.float32)
mq[: S // 2, S // 2:] = 1
mq = np.asarray(Image.fromarray((mq * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(8))).astype(np.float32) / 255
mq *= 1 - np.asarray(Image.open(os.path.join(OUT, "Body_paintmask.png")).convert("L")).astype(np.float32) / 255   # repainted faces
orig[..., 0] *= mq
orig[..., 1] *= mq
orig[..., 2] = orig[..., 2] * mq + (1 - mq)
n = np.dstack([orig[..., 0] + n_seam[..., 0], orig[..., 1] + n_seam[..., 1], orig[..., 2] * n_seam[..., 2]])
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(OUT, "Body_normal.jpg"), quality=93)
print("normal done")

# ---------------------------------------------------------------- metallic/roughness
# the source is near mirror-gloss (roughness ~0.09) which reads as wet plastic: satin paint on the livery,
# brushed metal on the machinery block, seams a touch rougher
M = 2048
mr = np.asarray(Image.open(os.path.join(TEX, "Body_metallicRoughness.png")).convert("RGB").resize((M, M), Image.LANCZOS)).astype(np.float32)
paint = np.zeros((M, M, 3), np.float32)
paint[..., 1] = 0.34 * 255
seam = 1 - np.asarray(height.resize((M, M))).astype(np.float32) / 128
paint[..., 1] += np.clip(seam, 0, 1) * 60
mach = mr.copy()
mach[..., 1] = np.clip(mr[..., 1] * 3.2 + 40, 0, 255)       # 0.09 -> ~0.45
mach[..., 2] = np.clip(mr[..., 2] * 4, 0, 255)
mq2 = np.asarray(Image.fromarray((mq * 255).astype(np.uint8)).resize((M, M))).astype(np.float32)[..., None] / 255
Image.fromarray(np.clip(paint * (1 - mq2) + mach * mq2, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "Body_metallicRoughness.jpg"), quality=92)

# ---------------------------------------------------------------- small textures
for name, out in (("Cockpit_baseColor.jpeg", "Cockpit_baseColor.jpg"), ("Glow_emissive.jpeg", "Glow_emissive.jpg")):
    upscale(name, 1024).save(os.path.join(OUT, out), quality=92)
glow = Image.open(os.path.join(TEX, "Glow_baseColor.png"))
glow_rgb = upscale("Glow_baseColor.png", 1024)
if glow.mode == "RGBA":
    alpha = glow.getchannel("A").resize((1024, 1024), Image.LANCZOS)
    glow_rgb.putalpha(alpha)
glow_rgb.save(os.path.join(OUT, "Glow_baseColor.png"))
print("all done")
