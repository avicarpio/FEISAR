"""
High-resolution texture pass for the Nobby76 FEISAR (CC BY 4.0).

1. Real-ESRGAN (x4plus, two passes) upscales the 512 px base colour to 4096 px; a light grade
   cleans up the palette (teal / sky / white / yellow) and removes grime.
2. A new 4096 px normal map: panel grooves traced from the real UV island borders + rivets,
   combined with the upscaled original normal map.
3. Cockpit, glass and glow textures are upscaled with Real-ESRGAN as well.

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
S = 4096
base = upscale("Body_baseColor.jpeg", S, passes=2)
a = np.asarray(base).astype(np.float32) / 255
# grade: lift saturation a touch, tame grime (local contrast denoise), push whites clean
hsv = np.asarray(base.convert("HSV")).astype(np.float32)
hsv[..., 1] = np.clip(hsv[..., 1] * 1.12, 0, 255)
graded = Image.fromarray(hsv.astype(np.uint8), "HSV").convert("RGB")
graded = graded.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
g = np.asarray(graded).astype(np.float32)
lum = g.mean(axis=2, keepdims=True)
whiten = np.clip((lum - 170) / 60, 0, 1) * (g.std(axis=2, keepdims=True) < 18)
g = g * (1 - whiten * 0.6) + 244 * whiten * 0.6
Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).save(os.path.join(OUT, "Body_baseColor.jpg"), quality=90)
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
height = height.filter(ImageFilter.GaussianBlur(1.6))
h = np.asarray(height).astype(np.float32) / 255
gx = np.zeros_like(h); gy = np.zeros_like(h)
gx[:, 1:-1] = (h[:, 2:] - h[:, :-2]) * 0.5
gy[1:-1, :] = (h[2:, :] - h[:-2, :]) * 0.5
strength = 6.0
n_seam = np.dstack([-gx * strength, gy * strength, np.ones_like(h)])
n_seam /= np.linalg.norm(n_seam, axis=2, keepdims=True)
orig = np.asarray(Image.open(os.path.join(TEX, "Body_normal.png")).convert("RGB").resize((S, S), Image.LANCZOS)).astype(np.float32) / 255 * 2 - 1
n = np.dstack([orig[..., 0] + n_seam[..., 0], orig[..., 1] + n_seam[..., 1], orig[..., 2] * n_seam[..., 2]])
n /= np.linalg.norm(n, axis=2, keepdims=True)
Image.fromarray(((n * 0.5 + 0.5) * 255).astype(np.uint8)).save(os.path.join(OUT, "Body_normal.jpg"), quality=93)
print("normal done")

# ---------------------------------------------------------------- metallic/roughness (just resize)
Image.open(os.path.join(TEX, "Body_metallicRoughness.png")).convert("RGB").resize((2048, 2048), Image.LANCZOS).save(os.path.join(OUT, "Body_metallicRoughness.jpg"), quality=92)

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
