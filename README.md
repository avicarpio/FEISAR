# FEISAR

An unofficial, non-commercial **Wipeout fan site** that imagines FEISAR — Federal European Industrial
Science and Research — as a real European agency selling its anti-gravity racing craft.

- **Interface:** no page scroll. Fourteen full-screen scenes, navigated with the wheel, swipes, arrow
  keys, number keys, the side rail or the command palette (`/` or Ctrl+K), with a warp transition.
- **3D scenes (Three.js):** hold the pointer or Space on the launch scene to fire up and launch the FX350,
  hold to boost on the test run, and drag to orbit / hold to reassemble the exploded engineering view.
- **Fleet:** every FEISAR craft from AGRC 2048 to FX350 Fury, with in-game stats and a spec sheet.
- **Lore:** heritage, twelve headquarters, pilots, research and investor relations, plus an acquisition form.
  The form is a simulation and sends nothing.

## Run

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8097
```

Then open http://localhost:8097.

## Logo

`assets/brand/feisar-logo.svg` is the FEISAR emblem and wordmark redrawn from the Wipeout 3 logo
(fan use; FEISAR belongs to its owners).

## 3D model

The craft is based on **"WipeOut - Feisar" by [Nobby76](https://sketchfab.com/nobbyt76)**
([Sketchfab](https://sketchfab.com/3d-models/wipeout-feisar-74e42e2192384cccbada8486b1f0703b)),
licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). Changes for this site: display
pedestal and boost effect removed, rescaled and reoriented, body split into assemblies for the exploded view,
livery repainted as 4K vector artwork (`tools/livery_decals.py`, rasterised by `tools/feisar_livery.py`
with headless Chrome; fonts in `tools/fonts`, SIL OFL), machinery block upscaled with Real-ESRGAN, new
panel/rivet normal map and satin roughness.

Rebuilding `assets/models/feisar_fx350.glb` from the Sketchfab download:

```bash
tools/blender-bwrap.sh -b --python tools/dump_uv.py -- assets/models/feisar_fx350.glb /tmp/uv.json
python3 tools/feisar_textures.py <unzipped download> /tmp/uv.json <realesrgan-ncnn-vulkan dir> /tmp/hitex
tools/blender-bwrap.sh -b --python tools/prepare_feisar.py -- <unzipped download>/scene.gltf /tmp/hitex
```

`tools/build_feisar.py` (classic-style) and `tools/build_feisar_hd.py` (HD FX350) are earlier procedural
models built from code. `tools/viewer.html?v=az,el,dist;...` renders the GLB from several angles.

## Disclaimer

This site is not related to Wipeout in any way. It is not affiliated with or endorsed by Sony Interactive
Entertainment or any owner of the Wipeout franchise. FEISAR, ship names and ship imagery belong to their
respective owners. Ship images and lore come from [Wipeout Central](https://wipeout.fandom.com/wiki/FEISAR).
