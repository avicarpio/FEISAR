# FEISAR

An unofficial, non-commercial **Wipeout fan site** that imagines FEISAR — Federal European Industrial
Science and Research — as a real European agency selling its anti-gravity racing craft.

- **Hero:** a Three.js scene with a scroll-driven camera story around a fan-made 3D recreation of the
  FEISAR FX350 (Wipeout HD).
- **Fleet:** every FEISAR craft from AGRC 2048 to FX350 Fury, with in-game stats and a spec sheet.
- **Lore:** heritage, twelve headquarters, pilots, research and investor relations, plus an acquisition form.
  The form is a simulation and sends nothing.

## Run

Serve the folder with any static server, for example:

```bash
python3 -m http.server 8097
```

Then open http://localhost:8097.

## 3D model

The ship is built from code in Blender. To rebuild `assets/models/feisar_fx350.glb`:

```bash
flatpak run --filesystem=$PWD org.blender.Blender -b --python tools/build_feisar.py
```

`tools/viewer.html?v=az,el,dist;az,el,dist` renders the GLB from several angles, which helps when
comparing the model with reference images.

## Disclaimer

This site is not related to Wipeout in any way. It is not affiliated with or endorsed by Sony Interactive
Entertainment or any owner of the Wipeout franchise. FEISAR, ship names and ship imagery belong to their
respective owners. Ship images and lore come from [Wipeout Central](https://wipeout.fandom.com/wiki/FEISAR).
