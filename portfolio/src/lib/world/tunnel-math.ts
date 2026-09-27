// Pure maths for the "tunnel run": the camera direction that plays over the world's own rig as the visitor scrolls the page.
// No DOM and no three.js, so it is tested in isolation (scripts/tunnel-check.ts) and stays out of every eager chunk.
//
// The rig (rig-math, untouched) already carries the camera along the route, one pose per zone. This layer adds what a
// cinematographer would: every section has its own SHOT (a base angle and a slow move that plays as the section scrolls by),
// the shots glide into one another at the section boundaries, and the camera reacts to how fast the visitor is scrolling
// (the lens widens, the horizon banks), so moving through the page feels like travelling through a tunnel, not flipping slides.
//
// Everything here is a pure function of the page position, continuous (no jump anywhere, including at the section
// boundaries), bounded, and returns exactly zero over the hero and the Projects section (which has its own flight).

import { ZONES } from "./zones";

/** The camera offset, in the camera's own frame: right / up / forward in world units, angles in degrees. */
export interface Pose {
  /** Truck: move right (+) or left (-). */
  dx: number;
  /** Crane: move up (+) or down (-). */
  dy: number;
  /** Dolly: move forward (+) or back (-). */
  dz: number;
  /** Pan: turn the view right (+) or left (-). */
  yaw: number;
  /** Tilt: turn the view up (+) or down (-). */
  pitch: number;
  /** Roll: the horizon turns clockwise (+) or anticlockwise (-). */
  roll: number;
  /** Lens: widen (+) or narrow (-) the field of view. */
  fov: number;
}

export const POSE_KEYS = ["dx", "dy", "dz", "yaw", "pitch", "roll", "fov"] as const;
export type PoseKey = (typeof POSE_KEYS)[number];

export const ZERO_POSE: Readonly<Pose> = { dx: 0, dy: 0, dz: 0, yaw: 0, pitch: 0, roll: 0, fov: 0 };

/** The lens the world is built for (WorldScene's camera prop). The tunnel widens and narrows it around this. */
export const WORLD_FOV = 42;

const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, finite(x, lo)));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const smootherstep = (t: number) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const pose = (p: Partial<Pose>): Pose => ({ ...ZERO_POSE, ...p });

/** A section's shot: `base` is the framing while it is centred, `drift` is how far the camera travels from the start of the section to its end (the move plays as it scrolls). */
export interface Shot {
  base: Pose;
  drift: Pose;
}

export type SectionKey = "hero" | "about" | "experience" | "journey" | "projects" | "skills" | "education" | "resume" | "contact";

/** Page order. */
export const SHOT_ORDER: readonly SectionKey[] = ["hero", "about", "experience", "journey", "projects", "skills", "education", "resume", "contact"];

const NO_SHOT: Shot = { base: ZERO_POSE, drift: ZERO_POSE };

// The camera book. Each move stays within a few world units and a few degrees: enough that the world visibly swings around the
// content, never enough to look away from it. Signs alternate from section to section, so every boundary is a change of angle.
export const SHOTS: Record<SectionKey, Shot> = {
  hero: NO_SHOT, // the opening scene is left exactly as it is
  // The plaza: settles high and to the left just inside the gate it has flown through (never back toward it), then eases forward
  // and down into the square, straightening as it arrives.
  about: {
    base: pose({ dx: -0.5, dy: 0.4, dz: 1.9, yaw: 3.5, pitch: 1, roll: -2 }),
    drift: pose({ dx: 1.4, dy: -0.8, dz: 3.2, yaw: -4.5, pitch: -1.5, roll: 2.6, fov: -2 }),
  },
  // The first stretch of the pipeline: a wide lens leaning the other way, pushing down the street.
  experience: {
    base: pose({ dx: 0.4, dy: 0.3, dz: 0.4, yaw: -3.5, pitch: 0.5, roll: 2.2, fov: 1.5 }),
    drift: pose({ dx: -1.3, dz: 3.4, yaw: 5.5, pitch: 1, roll: -3.6 }),
  },
  // Through the gates: lifts its gaze to the arch as it approaches.
  journey: {
    base: pose({ dx: -0.5, dy: -0.2, dz: 0.8, yaw: 3.2, pitch: 2.4, roll: -1.6 }),
    drift: pose({ dx: 1.1, dy: 0.6, dz: 3, yaw: -4.8, pitch: 1.6, roll: 3.2, fov: -1.5 }),
  },
  projects: NO_SHOT, // has its own flight
  // The tower: looks up its length, the horizon turning slowly as the camera climbs.
  skills: {
    base: pose({ dy: -0.4, pitch: 2, roll: 2.6, fov: 1 }),
    drift: pose({ dx: 1.7, dy: 1.9, dz: 2.6, yaw: 5.2, pitch: 3, roll: -5 }),
  },
  // The vault: settles the other way, lower, looking down into the records.
  education: {
    base: pose({ dx: 0.9, dy: 1, dz: 1, yaw: 4, pitch: -2, roll: -2.2 }),
    drift: pose({ dx: -1.9, dy: -0.9, dz: 2.2, yaw: -6, pitch: 1.6, roll: 4.6, fov: -1 }),
  },
  // Out into the open: a wider lens rising toward the beacon.
  resume: {
    base: pose({ dx: -0.8, dy: -0.5, dz: 0.5, yaw: 3, pitch: -1.5, roll: 2, fov: 1.5 }),
    drift: pose({ dx: 1.5, dy: 0.9, dz: 3.4, yaw: -5, pitch: 2, roll: -3 }),
  },
  // Arrival: a slow push toward the beacon on a narrowing lens. The pan swings back as it closes in, so the beacon stays in frame.
  contact: {
    base: pose({ dx: 0.2, dy: 0.6, dz: 2.3, yaw: -0.8, pitch: 1, roll: -1, fov: -2.5 }),
    drift: pose({ dx: -1.6, dy: 1.2, dz: 2.6, yaw: 5, pitch: 2.5, roll: 2.2, fov: -2 }),
  },
};

/** A section's place on the page, in document pixels. */
export interface SectionExtent {
  id: string;
  top: number;
  bottom: number;
}

/** The hop between two neighbouring shots: half its length as a fraction of the shorter section, and its limits in pixels. */
export const HOP = { fraction: 0.4, min: 140, max: 700 } as const;

const lerpPose = (a: Pose, b: Pose, e: number): Pose => ({
  dx: a.dx + (b.dx - a.dx) * e,
  dy: a.dy + (b.dy - a.dy) * e,
  dz: a.dz + (b.dz - a.dz) * e,
  yaw: a.yaw + (b.yaw - a.yaw) * e,
  pitch: a.pitch + (b.pitch - a.pitch) * e,
  roll: a.roll + (b.roll - a.roll) * e,
  fov: a.fov + (b.fov - a.fov) * e,
});

const shotFor = (id: string): Shot | undefined => (id in SHOTS ? SHOTS[id as SectionKey] : undefined);

/** Where a section's own move has got to for a viewport centre: 0 before it, 1 after it, eased at both ends so there is no kink where it starts or stops. */
export function sectionProgress(center: number, top: number, bottom: number): number {
  const h = finite(bottom) - finite(top);
  if (!(h > 0)) return 0.5;
  return smootherstep((finite(center) - finite(top)) / h);
}

/** A section's pose at progress p (0 to 1): its base framing plus the move, centred so the base is the framing at the middle of the section. */
export function shotPose(shot: Shot, p: number): Pose {
  const k = clamp01(p) - 0.5;
  return {
    dx: shot.base.dx + shot.drift.dx * k,
    dy: shot.base.dy + shot.drift.dy * k,
    dz: shot.base.dz + shot.drift.dz * k,
    yaw: shot.base.yaw + shot.drift.yaw * k,
    pitch: shot.base.pitch + shot.drift.pitch * k,
    roll: shot.base.roll + shot.drift.roll * k,
    fov: shot.base.fov + shot.drift.fov * k,
  };
}

/**
 * The camera direction for the viewport centre `center` (document pixels, the same point the rig follows), given where the
 * sections sit on the page (in page order; a section that is not on the page is simply not listed and its neighbours meet).
 * Continuous in `center`: inside a section it follows the section's move, and around each boundary it glides from one shot
 * to the next over a hop centred on the boundary (a smootherstep, so it starts and ends at rest).
 */
export function poseAt(center: number, sections: readonly SectionExtent[]): Pose {
  const list = sections
    .map((s) => ({ shot: shotFor(s.id), top: finite(s.top), bottom: Math.max(finite(s.top), finite(s.bottom, s.top)) }))
    .filter((s): s is { shot: Shot; top: number; bottom: number } => !!s.shot)
    .sort((a, b) => a.top - b.top);
  if (list.length === 0) return { ...ZERO_POSE };

  // The hops: one per boundary, centred on it. Two hops never overlap (each is at most half the distance to the next boundary),
  // so a stretch of very short sections still moves one shot at a time.
  const hops = list.slice(0, -1).map((a, i) => {
    const b = list[i + 1];
    return { boundary: (a.bottom + b.top) / 2, half: clamp(HOP.fraction * Math.min(a.bottom - a.top, b.bottom - b.top), HOP.min, HOP.max) };
  });
  for (let i = 0; i < hops.length; i++) {
    const room = Math.min(i > 0 ? hops[i].boundary - hops[i - 1].boundary : Infinity, i + 1 < hops.length ? hops[i + 1].boundary - hops[i].boundary : Infinity);
    hops[i].half = Math.max(1e-6, Math.min(hops[i].half, room / 2));
  }

  const c = finite(center);
  const at = (i: number) => shotPose(list[i].shot, sectionProgress(c, list[i].top, list[i].bottom));
  let result = at(0);
  for (let i = 0; i < hops.length; i++) {
    const e = smootherstep((c - (hops[i].boundary - hops[i].half)) / (2 * hops[i].half));
    if (e > 0) result = lerpPose(result, at(i + 1), e);
  }
  return result;
}

/**
 * Where the boundary between two neighbouring sections sits within the zone they share, in the rig's `local` units (-0.5 at the
 * top of the zone, +0.5 at the bottom), or undefined when either is not on the page. Zones that show something different for each
 * of their sections (the Stack: Skills, then Education) use it to know which section is on screen while the camera is held still.
 */
export function boundaryLocal(sections: readonly SectionExtent[], first: string, second: string): number | undefined {
  const a = sections.find((s) => s.id === first);
  const b = sections.find((s) => s.id === second);
  if (!a || !b) return undefined;
  const top = Math.min(finite(a.top), finite(b.top));
  const bottom = Math.max(finite(a.bottom), finite(b.bottom));
  const h = bottom - top;
  if (!(h > 0)) return undefined;
  const boundary = (Math.max(finite(a.top), finite(a.bottom)) + Math.min(finite(b.top), finite(b.bottom))) / 2;
  return clamp((boundary - top) / h - 0.5, -0.5, 0.5);
}

// ---- reacting to speed

export const FX = {
  /** Scroll speed, in screens per second, that counts as "full speed". */
  fullSpeed: 2.5,
  /** The lens widens by this much (degrees) at full speed. */
  maxFov: 6.5,
  /** At full speed the camera is thrown this far forward (or back, scrolling up), in world units... */
  leanDolly: 1.3,
  /** ...and its horizon leans this many degrees into the motion. */
  leanRoll: 2.2,
} as const;

/** Scroll speed (screens per second) as -1 to 1: negative scrolling up, positive scrolling down. */
export const speedNorm = (screensPerSecond: number) => clamp(finite(screensPerSecond) / FX.fullSpeed, -1, 1);

/** How much the lens widens (degrees) for a speed of 0 to 1 (sign ignored): nothing at rest, eased in so slow scrolling does not pump it. */
export const fovKick = (speed: number) => FX.maxFov * smootherstep(Math.abs(clamp(speed, -1, 1)));

/** The forward throw and the roll into the motion (dolly in world units, roll in degrees) for a signed speed of -1 to 1. Odd in the speed, zero at rest. */
export function leanFor(speed: number): { dz: number; roll: number } {
  const s = clamp(speed, -1, 1);
  const e = Math.sign(s) * smootherstep(Math.abs(s));
  return { dz: FX.leanDolly * e, roll: FX.leanRoll * e };
}

/** How much of the speed reaction applies at path position u: none over the hero, full once the visitor has left it. */
export const fxWeight = (u: number) => smootherstep((finite(u) - 0.3) / 0.6);

/** How far the camera sways at full speed: the small, slow, never-repeating-looking movement of something travelling, not standing. */
export const SWAY = { dx: 0.1, dy: 0.07, yaw: 0.5, pitch: 0.3, roll: 0.35 } as const;

/**
 * The sway at `time` seconds for an `amount` of 0 to 1 (the speed): a few sine waves with unrelated periods, so it never
 * settles into a visible loop. Exactly zero at rest, bounded by SWAY for any time.
 */
export function swayAt(time: number, amount: number): Pose {
  const a = clamp01(amount);
  const t = finite(time);
  return {
    dx: SWAY.dx * a * Math.sin(t * 0.83 + 0.4),
    dy: SWAY.dy * a * Math.sin(t * 1.17 + 2.0),
    dz: 0,
    yaw: SWAY.yaw * a * Math.sin(t * 0.73 + 3.2),
    pitch: SWAY.pitch * a * Math.sin(t * 0.97 + 1.3),
    roll: SWAY.roll * a * Math.sin(t * 0.61 + 1.1),
    fov: 0,
  };
}

// ---- the pivot the camera keeps its subject on

/** Distance from each zone's camera to its look-at point: the depth of what the shot is composed around. */
const FOCAL = ZONES.map((z) => Math.hypot(z.camera.target[0] - z.camera.position[0], z.camera.target[1] - z.camera.position[1], z.camera.target[2] - z.camera.position[2]));

/** The focal distance at path position u (between zone poses it blends the two neighbours'). */
export function focalDistance(u: number): number {
  const last = FOCAL.length - 1;
  if (last < 0) return 10;
  const x = clamp(u, 0, last);
  const i = Math.min(last, Math.floor(x));
  const j = Math.min(last, i + 1);
  return FOCAL[i] + (FOCAL[j] - FOCAL[i]) * (x - i);
}

// ---- smoothing

/** State of one critically damped value: where it is, and how fast it is moving. */
export interface Damped {
  x: number;
  v: number;
}

/**
 * Moves `s` toward `target` like a critically damped spring: it accelerates gently, arrives without overshooting, and never
 * jumps, however large the step or the change of target. Closed form, so it is exact and stable at any frame time.
 * `omega` is the stiffness in 1/s (about 4 / omega seconds to settle).
 */
export function damp(s: Damped, target: number, dt: number, omega: number): Damped {
  const t = clamp(dt, 0, 1);
  const w = Math.max(0, finite(omega));
  const goal = finite(target, s.x);
  const d = s.x - goal;
  const e = Math.exp(-w * t);
  const k = s.v + w * d;
  s.x = goal + (d + k * t) * e;
  s.v = (s.v - w * k * t) * e;
  return s;
}

export type PoseState = Record<PoseKey, Damped>;
export const makePoseState = (from: Pose = ZERO_POSE): PoseState => ({
  dx: { x: from.dx, v: 0 },
  dy: { x: from.dy, v: 0 },
  dz: { x: from.dz, v: 0 },
  yaw: { x: from.yaw, v: 0 },
  pitch: { x: from.pitch, v: 0 },
  roll: { x: from.roll, v: 0 },
  fov: { x: from.fov, v: 0 },
});

/** Moves every component of the pose state toward `target`. */
export function dampPose(state: PoseState, target: Pose, dt: number, omega: number): PoseState {
  for (const k of POSE_KEYS) damp(state[k], target[k], dt, omega);
  return state;
}

/** True once every component is within `eps` of the target and has nearly stopped: the frame loop can rest. */
export function settled(state: PoseState, target: Pose, eps = 1e-3): boolean {
  return POSE_KEYS.every((k) => Math.abs(state[k].x - target[k]) < eps && Math.abs(state[k].v) < eps * 4);
}
