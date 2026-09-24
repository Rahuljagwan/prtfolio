// Pure maths for the Projects "flight": the camera hopping from one project's rack to the next as the visitor scrolls.
// No DOM and no three.js, so it is tested in isolation (scripts/stations-check.ts) and stays out of every eager chunk.
//
// Shape of the feature:
//   - each project is a "station" (a service rack) on a gentle chain in the Deployments region of the world;
//   - a tall DOM track pins a full-screen stage; scrolling through the track moves a fractional index t in [0, n - 1];
//   - focusAt(t, n) is the camera pose for that t: it rests on a station (a plateau) and glides to the next one in between;
//   - flightWeight() says how much of that pose to blend over the rig's own camera, so the flight fades in as the track
//     enters the screen and out as it leaves, and the rig (rig-math, untouched) drives the camera everywhere else.

export type Vec3 = [number, number, number];

/** Layout and framing constants. World units; the camera looks down -z like every other zone. */
export const STATION = {
  /** Distance between neighbouring racks along x. */
  spacing: 7.5,
  /** Depth of the chain. The Deployments pose is at z -40 looking to -53, so the racks sit just past its plateau. */
  baseZ: -51,
  /** Racks step gently in y and z so the chain reads as a route through space, not a shelf. */
  stepY: 0.7,
  stepZ: 2.2,
  /** Camera relative to the rack it rests on: left of it (the rack lands right of centre, clear of the text), up, back. */
  camOffset: [-2.9, 0.9, 8.2] as Vec3,
  /** Where it looks, relative to the rack. */
  lookOffset: [-2.3, 0, 0] as Vec3,
  /** Mid-flight the camera lifts and pulls back this much (scaled by sin(pi * e)): the move reveals depth. */
  liftMid: 0.9,
  pullMid: 3.2,
  /** Fraction of each hop the camera rests on a station. */
  hold: 0.5,
} as const;

/**
 * A rack is a stack of slabs, one per layer of the project's technology stack (browser, proxy, application, data, ...).
 * These are its dimensions, so the 3D scene and the tests agree on them.
 */
export const RACK = { pitch: 0.52, slab: 0.4, maxSlabs: 6, defaultSlabs: 3 } as const;

/** How many slabs a rack with `layers` layers gets: at least one, at most maxSlabs; no layer information gives a plain default. */
export function slabCount(layers: number): number {
  const n = Math.floor(finiteNum(layers));
  return n <= 0 ? RACK.defaultSlabs : Math.min(RACK.maxSlabs, n);
}

/** Height of slab j (0 is the top) in a rack of k slabs centred at height cy. */
export const slabY = (cy: number, k: number, j: number) => cy + ((k - 1) / 2 - j) * RACK.pitch;

/** Width of a slab: a little variety, deterministic. */
export const slabWidth = (rack: number, j: number) => 2.55 + ((rack * 3 + j * 2) % 4) * 0.19;

/** The floor a rack stands on (top of its plinth) and the top of its highest slab. */
export const rackFloorY = (cy: number, k: number) => cy - ((k - 1) / 2) * RACK.pitch - RACK.slab / 2 - 0.1;
export const rackTopY = (cy: number, k: number) => cy + ((k - 1) / 2) * RACK.pitch + RACK.slab / 2;

/** Hysteresis for the active index, in stations: it only changes once t is this far past the halfway point. */
export const ACTIVE_HYSTERESIS = 0.08;

const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const finiteNum = (n: number) => finite(n);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, finite(x, lo)));
const clamp01 = (x: number) => clamp(x, 0, 1);
const lerp = (a: number, b: number, e: number) => a + (b - a) * e;
const lerp3 = (a: Vec3, b: Vec3, e: number): Vec3 => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Rack centres for n stations. Centred on x = 0, so the chain is symmetric about the Deployments axis. */
export function stationLayout(n: number): Vec3[] {
  const count = Math.max(0, Math.floor(finite(n)));
  return Array.from({ length: count }, (_, i): Vec3 => [
    (i - (count - 1) / 2) * STATION.spacing,
    -0.8 + Math.sin(i * 1.25) * STATION.stepY,
    STATION.baseZ - Math.cos(i * 0.85) * STATION.stepZ,
  ]);
}

/**
 * Eased 0 to 1 over one hop, with flat plateaus at both ends: `hold` is the total fraction of the hop spent at rest
 * (half at each end). Monotonic and continuous, with zero slope where it meets a plateau.
 */
export function stepEase(frac: number, hold: number = STATION.hold): number {
  const h = clamp(hold, 0, 0.9);
  const a = h / 2;
  const f = clamp01(frac);
  if (f <= a) return 0;
  if (f >= 1 - a) return 1;
  return smootherstep((f - a) / (1 - 2 * a));
}

export interface Focus {
  position: Vec3;
  target: Vec3;
  /** 0 while resting on a station, 1 half-way through a hop. Drives the small roll the camera adds. */
  travel: number;
  /** Which way this hop moves along x: -1, 0 (resting), or 1. */
  direction: number;
}

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** The camera pose that rests on station i. */
export function restPose(stations: Vec3[], i: number): { position: Vec3; target: Vec3 } {
  const s = stations[Math.min(stations.length - 1, Math.max(0, i))];
  return { position: add3(s, STATION.camOffset), target: add3(s, STATION.lookOffset) };
}

/** Camera pose for fractional index t in [0, n - 1] (clamped). Empty chain gives a neutral pose. */
export function focusAt(t: number, n: number): Focus {
  const stations = stationLayout(n);
  if (stations.length === 0) return { position: [0, 0, 0], target: [0, 0, -1], travel: 0, direction: 0 };
  const tt = clamp(t, 0, stations.length - 1);
  const i = Math.min(stations.length - 1, Math.floor(tt));
  const j = Math.min(stations.length - 1, i + 1);
  const a = restPose(stations, i);
  const b = restPose(stations, j);
  const e = i === j ? 0 : stepEase(tt - i);
  const arc = Math.sin(Math.PI * e);
  const position = lerp3(a.position, b.position, e);
  position[1] += STATION.liftMid * arc;
  position[2] += STATION.pullMid * arc;
  const dx = b.position[0] - a.position[0];
  return { position, target: lerp3(a.target, b.target, e), travel: arc, direction: e > 0 && e < 1 ? Math.sign(dx) : 0 };
}

/** The station the UI treats as current. Sticks to `prev` until t is clearly past the halfway point. */
export function activeIndex(t: number, n: number, prev: number): number {
  if (n <= 0) return 0;
  const tt = clamp(t, 0, n - 1);
  const p = Math.min(n - 1, Math.max(0, Math.floor(finite(prev))));
  if (Math.abs(tt - p) < 0.5 + ACTIVE_HYSTERESIS) return p;
  return Math.min(n - 1, Math.max(0, Math.round(tt)));
}

/** Track scroll progress, 0 to 1, from the track's viewport rect: 0 when its top reaches the top of the screen (the pin starts), 1 when its bottom reaches the bottom (the pin ends). */
export function progressFromRect(top: number, height: number, vh: number): number {
  const range = Math.max(1, finite(height) - finite(vh));
  return clamp01(-finite(top) / range);
}

/**
 * How much of the flight pose to blend over the rig camera: 0 when the track is off screen, ramping up as it enters,
 * 1 while it is pinned, ramping down as it leaves. `top` and `bottom` are the track's viewport rect edges.
 */
export function flightWeight(top: number, bottom: number, vh: number): number {
  const h = Math.max(1, finite(vh, 1));
  const enter = smootherstep((h - finite(top, h)) / (0.8 * h));
  const exit = smootherstep((finite(bottom, 0) - 0.2 * h) / (0.8 * h));
  return enter * exit;
}

/** Fractional index for a track progress (0 to 1) over n stations. */
export const indexFromProgress = (progress: number, n: number) => clamp01(progress) * Math.max(0, n - 1);

/** Inverse of indexFromProgress, for jumping to a station: the track progress at which the camera rests on station i. */
export const progressForIndex = (i: number, n: number) => (n <= 1 ? 0 : clamp(i, 0, n - 1) / (n - 1));

/** Track height in viewport heights: one screen of pin plus `stepVh` of scroll per hop. Never less than one screen. */
export const trackHeightVh = (n: number, stepVh = 85) => 100 + Math.max(0, n - 1) * stepVh;
