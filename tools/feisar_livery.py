"""
Vector FEISAR body livery (4096 px) for the Nobby76 model (CC BY 4.0).

Every colour field and decal (wordmarks, roundels, arrows, hazard stripes, grilles, micro-copy) is drawn
by hand as SVG (tools/livery_decals.py) in the layout of the original 512 px atlas; the photographic
machinery block (top-right quadrant: belly and engine) comes from the Real-ESRGAN pass in
tools/feisar_textures.py. The SVG is rasterised with headless Chrome, so all edges and type are sharp.

Also writes Body_grooves.png: the panel lines (class "pl") alone, black on mid grey, used as a height map
for the normal map.

Usage:
  python3 tools/feisar_livery.py <machinery.png> <out dir>
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from livery_decals import decals  # noqa: E402

MACH, OUT = sys.argv[1:3]
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
S = 4096
os.makedirs(OUT, exist_ok=True)
work = tempfile.mkdtemp(prefix="feisar_livery_")
COL = dict(teal="#1d84b4", sky="#5ab4d9", pale="#c6e2ec", white="#f3f5f6", yellow="#f2c014",
           grey="#8b959a", dark="#3b4347", ink="#0b1a2a", red="#e0242f")

svg = f"""<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{S}" height="{S}" viewBox="0 0 512 512">
<style>
@font-face {{ font-family: Michroma; src: url('file://{os.path.abspath(FONTS)}/Michroma.ttf'); }}
@font-face {{ font-family: Saira; src: url('file://{os.path.abspath(FONTS)}/Saira.ttf'); }}
@font-face {{ font-family: Orbitron; src: url('file://{os.path.abspath(FONTS)}/Orbitron.ttf'); }}
</style>
<rect width="512" height="512" fill="{COL['teal']}"/>
<image x="256" y="0" width="256" height="256" preserveAspectRatio="none" xlink:href="file://{os.path.abspath(MACH)}"/>
{decals(COL)}
</svg>"""
svg_path = os.path.join(OUT, "Body_livery.svg")
open(svg_path, "w").write(svg)


def render(body, png):
    html = os.path.join(work, "p.html")
    open(html, "w").write(f"<html><body style='margin:0;background:#000'>{body}</body></html>")
    subprocess.run(["google-chrome", "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    f"--window-size={S},{S}", "--virtual-time-budget=4000", f"--screenshot={png}", f"--user-data-dir={work}/prof",
                    "file://" + html], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


png = os.path.join(work, "p.png")
render(svg, png)
Image.open(png).convert("RGB").save(os.path.join(OUT, "Body_baseColor.jpg"), quality=95)
groove_css = ("<style>svg *{visibility:hidden} svg .pl{visibility:visible;stroke:#000 !important;opacity:1 !important}"
              "</style><div style='position:absolute;inset:0;background:#808080'></div><div style='position:absolute;inset:0'>")
render(groove_css + svg + "</div>", png)
Image.open(png).convert("L").save(os.path.join(OUT, "Body_grooves.png"))
print("livery done", svg_path)
