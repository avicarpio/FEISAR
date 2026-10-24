# FEISAR FX350 — anatomy parts list

The craft is the site's own model, `assets/models/feisar_fx350.glb` (Nobby76, CC BY 4.0, FEISAR livery),
read triangle for triangle by `mesh.mjs` and drawn with its real texture (`build.mjs`, affine UV map per
face). Nothing outside the shell is invented: every system below sits inside a cavity probed from the mesh,
so the assembled figure is exactly the 3D model, and taking it apart ghosts the upper hull to show them.

World units: 1 u = 2 cm. x along the craft (nose +x), y across (starboard +y), z up.
Every number on the page comes from `model.mjs` (Inductrack-style lift F = 4·F0·(I/Inom)²·e^(−2kh)).

## Stand — Västerås AG test bed (stand)
- deck slab, groove, corner screws
- federal track lattice: 40 Halbach tiles (the passive half of the lift, pitch λ = 2.4 m)
- two guard curbs with ruler ticks, label plate "FX350 · BAY 4"
- two docking cradles cut to the real belly height (craft rests with emitter faces 1.04 m over the lattice)

## Mesh assemblies (the real model, split by GLB node)
- keel: hull + glow strips — the upper hull fades to a phantom when apart
- nose: nose cone · canopy: glass + frame · cell: cockpit tub
- podL / podR: the two side pods (port lifts, starboard drops and swings out)
- nacelle: the rear engine shell

## Internals (in the probed cavities)
- keel deck plates under each bay
- **Field capacitor bank — Brussels (power)**, rear spine x −150: 4 superconducting cells × 4.65 kWh = 18.6 kWh,
  rack, two straps, bus bars, terminal posts
- **Tru-Fly™ stability core (core)**, x −92: plinth, uprights, outer gimbal ring, pivots, inner ring,
  ribbed 42 kg flywheel (42,000 rpm, L = 2,993 N·m·s), drive motor
- **Armacall VII avionics — Warsaw (avionics)**, forward bay x 40: chassis, vents, heat-sink fins, 4 connectors
- **Nose sensors (sensors)**: lidar on its mount, forward trim emitter, ballast rails and ballast
- **AG field emitters ×4 — Delft (emitters)** under the pods at x −182 / −124, y ±48: coil, terminal disc;
  faces follow the real belly
- **Syrus plasma ramjet — Toulouse (thrust)** in the closed spine: mount, ribbed compressor, p-¹¹B chamber,
  magnetic nozzle, two field coils (78 kN, exhaust 9.6 km/s)
- **Plumbing and harness (plumbing)**: heat exchanger with two coolant legs from the chamber; one power cable
  per cell to its emitter in two lanes; three data cables from the Armacall connectors aft along the floor

## Live layer (WebGL, `live.js`)
- one field column per emitter (and the trim emitter) from its face to the lattice, banded and scrolling,
  plus the light it lays on the tiles — scaled by emitter current
- the Syrus plume leaving the nacelle along −x, scaled by throttle
- light theme solves each colour for its ink over the paper; dark theme adds light
