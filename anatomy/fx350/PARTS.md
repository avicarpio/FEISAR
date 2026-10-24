# FEISAR FX350 — anatomy parts list

The craft is built from kit parts, panel by panel. Its lines come from the site's own model,
`assets/models/feisar_fx350.glb` (Nobby76, CC BY 4.0, FEISAR livery): stations cut through the GLB
(`shell.mjs`) give the section of each component, and consecutive sections bound one convex panel bay
(`panel()` in `build.mjs`). Each panel face takes the paint of the model's texture under it, snapped to
the FEISAR palette (blue, yellow, white, pale, dark, red). Every number on the page comes from `model.mjs`.

World units: 1 u = 2 cm. x along the craft (nose +x), y across (starboard +y), z up.
`node build.mjs --audit` proves the geometry (`kit/audit.mjs`, extended with a convex `loft` solid).

## Stand — Västerås AG test bed (stand)
- deck slab, groove, corner screws, label plate "FX350 · BAY 4"
- federal track lattice: 40 Halbach tiles, each engraved with its magnetisation
- two guard curbs with lattice-pitch rulers
- two docking cradles: base, post, saddle, rubber pad (emitter faces 1.04 m over the lattice)

## Airframe
- keel pan (keel): the flat belly, one bay per station, seams and rivets
- frames (keel): two, aft and ahead of the pilot cell: posts, web with lightening holes, cross beam
- emitter brackets (keel): one per emitter, on the pan's edge or the nacelle wall
- side panels (podL, podR): from the spine root to the skid edge, 27 bays a side
  - round Syrus intake with bezel, fan and hub on each side
  - airbrake flap on each trailing edge, with its hinge rod
- dorsal spine covers (spine): over the rear bay and the forward bay, hollow
- canopy (canopy): Torino glass on the cockpit walls, a bow at every station
- nose cone (nose): hollow upper shell, blunt tip, pitot probe
- engine nacelle (nacelle): hollow housing between the side panels at the tail

## Systems
- **Field capacitor bank — Brussels (power):** 4 cells × 4.65 kWh on a rack, straps, terminal posts,
  bus bars, and the harness: one cable per cell to its emitter, under the side panel
- **Tru-Fly™ core (core):** plinth, uprights, segmented outer and inner gimbal rings with their pivots,
  ribbed 42 kg flywheel (42,000 rpm), drive motor, axle
- **Armacall VII avionics — Warsaw (avionics):** chassis, vents, heat-sink fins, 4 connectors
- **Pilot cell — Lisbon (cell):** seat on rails, seat back with harness, headrest, side consoles with
  switches, control column and yoke, binnacle with three displays, pedals
- **Nose sensors — Gothenburg (sensors):** lidar on its mount, trim emitter, ballast on two rails
- **AG field emitters ×4 — Delft (emitters):** ribbed coil housings and terminals at the belly
- **Syrus plasma ramjet — Toulouse (thrust):** mount, ribbed compressor, p-¹¹B chamber, magnetic nozzle,
  two segmented field coils, tailpipe and exit lip
- **Plumbing (plumbing):** heat exchanger, two coolant legs on saddle bosses, three data cables from
  the Armacall to the core, the bank and the pilot cell

## Live layer (WebGL, `live.js`)
- one field column per emitter (and the trim emitter) down to the lattice, and the light they lay on it
- the Syrus plume leaving the exit lip, scaled by throttle
