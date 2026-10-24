// FEISAR FX350 (2207) — the engineering model behind the anatomy figure.
//
// Fiction, but self-consistent: every number the figure shows comes from these functions.
//
// Lift. A FEISAR craft does not "float": its four Delft field emitters drive a travelling field
// against the passive AG lattice cast into every federal track (a Halbach lattice of pitch λ). As in
// an Inductrack maglev, the repulsion per emitter falls off exponentially with the gap,
//   F(h) = F0 · (I / Inom)² · e^(−2kh),  k = 2π / λ,
// so the craft settles where 4·F(h) = m·g:  h = h0 + ln(I / Inom) / k.
// Thrust. The Toulouse Syrus plasma ramjet ingests air through both pod intakes, compresses it
// magnetically and heats it in a p-¹¹B (aneutronic) plasma chamber; a magnetic nozzle sets the exhaust
// velocity. Top speed is where thrust equals aerodynamic drag, ½ρ·CdA·v².
// Stability. The Tru-Fly™ core is a gimballed flywheel whose angular momentum L = I·ω resists roll;
// its precession is what FEISAR pilots feel as "the handling".

export const G0 = 9.80665;
export const RHO = 1.225;

export const SHIP = {
  name: "FEISAR FX350",
  year: 2207,
  length: 9.6, // m
  beam: 3.4, // m, across the pods
  dry: 1180, // kg
  pilot: 82, // kg, pilot + suit
  lambda: 2.4, // m, track lattice pitch
  hoverNom: 1.2, // m, emitter face to lattice at nominal current
  cradle: 1.04, // m, emitter face to lattice when resting on the docking cradles
  iNom: 2.4, // kA per emitter, nominal
  emitters: 4,
  thrustMax: 78, // kN, Syrus ramjet at full throttle
  exhaust: 9.6, // km/s, magnetic-nozzle exhaust velocity
  cdA: 0.62, // m², drag area
  gyro: { mass: 42, radius: 0.18, rpm: 42000 },
  capacitors: { cells: 4, kWhEach: 4.65 },
};

export const MASS = SHIP.dry + SHIP.pilot;
export const WEIGHT_KN = (MASS * G0) / 1000;
export const K = (2 * Math.PI) / SHIP.lambda;
// lift of one emitter at zero gap and nominal current, so that four of them hold the craft at hoverNom
export const F0_KN = (WEIGHT_KN / SHIP.emitters) * Math.exp(2 * K * SHIP.hoverNom);

/** Total field lift (kN) at gap h (m) with emitter current i (kA). */
export function lift(h, i) {
  return SHIP.emitters * F0_KN * (i / SHIP.iNom) ** 2 * Math.exp(-2 * K * h);
}

/** Free hover gap (m) for emitter current i (kA); below liftoff the craft sits on its cradles. */
export function hoverGap(i) {
  if (i <= 0) return SHIP.cradle;
  return Math.max(SHIP.cradle, SHIP.hoverNom + Math.log(i / SHIP.iNom) / K);
}

/** Current (kA) at which the field lifts the craft off its cradles. */
export const I_LIFTOFF = SHIP.iNom * Math.exp(-K * (SHIP.hoverNom - SHIP.cradle));

/** Thrust (kN) at a throttle share 0..1. */
export const thrust = (throttle) => SHIP.thrustMax * Math.max(0, Math.min(1, throttle));

/** Speed (km/h) where thrust equals drag. */
export function topSpeed(throttle) {
  const t = thrust(throttle) * 1000;
  return Math.sqrt((2 * t) / (RHO * SHIP.cdA)) * 3.6;
}

/** Plasma mass flow (g/s) through the nozzle at a throttle share. */
export const massFlow = (throttle) => (thrust(throttle) / SHIP.exhaust) * 1000;

/** Jet power (MW) = ½·ṁ·ve². */
export const jetPower = (throttle) => (0.5 * (massFlow(throttle) / 1000) * (SHIP.exhaust * 1000) ** 2) / 1e6;

const { mass, radius, rpm } = SHIP.gyro;
export const GYRO_I = 0.5 * mass * radius ** 2; // kg·m²
/** Tru-Fly angular momentum (N·m·s) at a spin share 0..1. */
export const gyroL = (share) => GYRO_I * ((rpm * share * 2 * Math.PI) / 60);

export const CAPACITY_KWH = SHIP.capacitors.cells * SHIP.capacitors.kWhEach;

/** Everything the readout needs at once. */
export function state({ current = 0, throttle = 0, spin = 0 } = {}) {
  return {
    gap: hoverGap(current),
    lift: Math.min(lift(hoverGap(current), current), WEIGHT_KN * 1.0001),
    airborne: current >= I_LIFTOFF,
    thrust: thrust(throttle),
    speed: topSpeed(throttle),
    flow: massFlow(throttle),
    power: jetPower(throttle),
    rpm: SHIP.gyro.rpm * spin,
    L: gyroL(spin),
  };
}
