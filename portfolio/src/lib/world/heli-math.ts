// Pure maths for the helicopter that lives in the 3D world (components/world/scene/Helicopter.tsx). No DOM and no three.js, so the
// whole flight can be checked as numbers.
//
// The story it tells, driven only by scroll (so it plays forwards and backwards, and always matches where the page is):
//   1. It is parked on the helipad (the concentric rings under the About content) while the visitor reads.
//   2. Further down About the rotors spool up and it lifts straight off the pad, hovering (driven by the About zone's own `local`).
//   3. It rolls forward and then leads the visitor down the whole route, always ahead of the camera, above the route line (so it never
//      touches the traffic dots on it) and on the axis the camera itself flies, so it clears everything the camera clears.
//   4. At the end of the route it eases to a stop beside the closing beacon and circles it for as long as the visitor is there.

import { smootherstep } from "./rig-math";

export const HELI = {
  /** Where the helipad rings (FoundationZone) are centred. The helicopter lands on this point. It is a quarter of a unit left of
   *  the world's centre line so the rotor keeps well clear of the route line, which passes just to its right at this depth. */
  PAD: { x: -0.25, z: -14 },
  /** Height of the helicopter's centre above the ground while it hovers over the pad. */
  HOVER_ALT: 1.55,

  /** About-zone `local` (-0.5 top .. +0.5 bottom) over which it spools up and lifts: a long, unhurried take-off. The camera's
   *  plateau ends at +0.25, so it is hovering well before the camera starts to travel. */
  LIFT_FROM: -0.12,
  LIFT_TO: 0.2,
  /** It starts rolling forward over the last stretch of the plateau (LAUNCH_*), covering PRE_S (in route units) by the time the camera
   *  moves on, so it is already clear of the pad when the camera sets off. */
  LAUNCH_FROM: 0.15,
  LAUNCH_TO: 0.25,
  PRE_S: 0.12,

  /** How far ahead of the camera it flies (in route units; about 16 world units each): the lead at the pad grows to this over
   *  LEAD_RAMP of camera travel. */
  LEAD_CRUISE: 1.15,
  LEAD_RAMP: 0.9,
  /** Lane: it starts left of the route (as the pad is) and settles onto the route axis over LATERAL_RAMP; it climbs from the hover
   *  height to ABOVE_CRUISE above the route line over ABOVE_RAMP. Always at least ~1 unit above the line, so never touching it. */
  LATERAL_RAMP: 0.35,
  /** Where it settles across the route axis (positive = right): a little right of it keeps it clear of the small nodes that sit just left of
   *  the axis in the tower, and of the left rack of the Projects chain. */
  LATERAL_CRUISE: 0.6,
  ABOVE_CRUISE: 1.3,
  ABOVE_RAMP: 0.8,
  /** Over the last stretch it climbs a little more (END_LIFT, from route position END_LIFT_FROM over END_LIFT_RAMP), so the circling at the
   *  beacon happens above the topmost layers of the tower (which are centred on the end of the camera's path). */
  END_LIFT: 2.8,
  END_LIFT_FROM: 4.5,
  END_LIFT_RAMP: 0.8,

  /** The route continues past the camera's last pose in a straight leg to the beacon (LEG_U route units long). It eases to a stop at
   *  S_ORBIT, a point on that leg, then circles the beacon from there, starting once the camera is past ORBIT_FROM_U (ramping up over
   *  ORBIT_RAMP), at ORBIT_OMEGA radians per second. */
  LEG_U: 0.9,
  S_ORBIT: 5.6,
  ORBIT_FROM_U: 4.4,
  ORBIT_RAMP: 0.5,
  ORBIT_OMEGA: 0.22,

  /** Heading while parked, as a horizontal direction: nose to the right and slightly away, so the visitor sees its side. */
  PARKED_HEADING: [0.84, -0.55] as readonly [number, number],
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));

/**
 * 0 while parked, 1 once it is hovering. Plain scroll position decides it while the camera rests on About (u = 1); before that
 * (arriving from the hero) it is parked, after that (the camera has moved on) it is airborne.
 */
export function liftGoal(u: number, local: number): number {
  if (u < 1 - 1e-3) return 0;
  if (u > 1 + 1e-3) return 1;
  return smootherstep((local - HELI.LIFT_FROM) / (HELI.LIFT_TO - HELI.LIFT_FROM));
}

/** A smooth minimum (continuous slope): follows the smaller of a and b, rounding the corner where they cross over a width k. */
export function smoothMin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/**
 * Where the helicopter is along the route, in route units (the same units as the camera's u). Parked at the pad (sPad) until it
 * launches; from then on it leads the camera by a distance that grows to cruise, and it never goes past the orbit point.
 */
export function trackS(u: number, local: number, sPad: number): number {
  if (u <= 1 + 1e-3) {
    const launch = u < 1 - 1e-3 ? 0 : smootherstep((local - HELI.LAUNCH_FROM) / (HELI.LAUNCH_TO - HELI.LAUNCH_FROM));
    return sPad + HELI.PRE_S * launch;
  }
  const lead0 = sPad - 1 + HELI.PRE_S; // the lead at u = 1, so the two branches meet exactly
  const lead = lead0 + (HELI.LEAD_CRUISE - lead0) * smootherstep((u - 1) / HELI.LEAD_RAMP);
  return smoothMin(u + lead, HELI.S_ORBIT, 0.5);
}

/** Lateral offset from the route axis (negative = left): starts at the pad's own offset and settles at LATERAL_CRUISE. */
export const laneLateral = (lateral0: number, s: number, sPad: number) => lateral0 + (HELI.LATERAL_CRUISE - lateral0) * smootherstep((s - sPad) / HELI.LATERAL_RAMP);
/** Height above the route line: from the hover height at the pad to cruise. */
export const laneAbove = (above0: number, s: number, sPad: number) =>
  above0 + (HELI.ABOVE_CRUISE - above0) * smootherstep((s - sPad) / HELI.ABOVE_RAMP) + HELI.END_LIFT * smootherstep((s - HELI.END_LIFT_FROM) / HELI.END_LIFT_RAMP);
/** How strongly the hover position is pulled onto the exact pad centre: 1 while hovering, easing out as it flies off. */
export const padPull = (s: number, sPad: number) => 1 - smootherstep((s - sPad) / 0.25);

/** Opacity: it appears as the camera leaves the hero and stays. */
export function heliOpacity(u: number): number {
  const inn = clamp01((u - 0.1) / 0.7);
  return inn * inn * (3 - 2 * inn);
}

/** The pad's own markings fade with the rest of the Gate zone (same curve as FoundationZone). */
export function padOpacity(u: number): number {
  const inn = clamp01((u - 0.1) / 0.7);
  const out = 1 - clamp01((u - 1.7) / 0.9);
  return inn * inn * (3 - 2 * inn) * out;
}

/** How far into the circling at the beacon it is (0 until the camera is near the end of the route). */
export const orbitRamp = (u: number) => smootherstep((u - HELI.ORBIT_FROM_U) / HELI.ORBIT_RAMP);

/** Rotor speed (0 to 1) from the lift: it spins up first, over the first 40% of the lift, then leaves the ground. */
export const spoolFor = (lift: number) => smootherstep(lift / 0.4);

/** How far off the pad it has risen (0 to 1): it only leaves the ground once the rotors are turning at speed. */
export const riseFor = (lift: number) => smootherstep((lift - 0.28) / 0.72);

/** Heading as a yaw angle (radians, rotation about +Y that carries the model's forward axis -Z onto the direction (x, z)). */
export const yawFor = (x: number, z: number) => Math.atan2(-x, -z);

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
