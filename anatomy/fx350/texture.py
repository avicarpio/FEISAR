"""Decode the GLB's embedded textures to raw RGBA (for build.mjs to sample the livery per triangle).
Usage: python3 -I texture.py <out dir> <img0> <img1> ...   writes <out>/<n>.rgba and <out>/index.json"""
import json, os, sys
from PIL import Image

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
index = []
for n, path in enumerate(sys.argv[2:]):
    im = Image.open(path).convert("RGBA")
    emb = im if max(im.size) <= 2048 else im.resize((2048, 2048), Image.LANCZOS)
    emb.save(os.path.join(out, f"emb{n}.webp"), quality=84, method=6)
    if max(im.size) > 1024:
        im = im.resize((1024, 1024), Image.LANCZOS)
    open(os.path.join(out, f"{n}.rgba"), "wb").write(im.tobytes())
    index.append({"w": im.size[0], "h": im.size[1]})
json.dump(index, open(os.path.join(out, "index.json"), "w"))
