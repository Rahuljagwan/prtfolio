// Pure helpers for the Projects flight's exhibits (the per-project 3D schematics): repeating clocks, smooth windows and
// movement along a path. No DOM and no three.js, so they are tested in scripts/stations-check.ts.

export type V3 = [number, number, number];

const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);
export const clamp01 = (x: number) => Math.min(1, Math.max(0, finite(x)));

/** Smoothstep, clamped to 0..1. */
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** Position in a repeating cycle, 0 (inclusive) to 1 (exclusive), for a time in seconds. Negative times wrap correctly. */
export function cyc(time: number, period: number, offset = 0): number {
  const p = Math.max(1e-6, finite(period, 1));
  const u = ((finite(time) + finite(offset)) % p) / p;
  return u < 0 ? u + 1 : u >= 1 ? 0 : u;
}

/** 0 before `a`, 1 after `b`, smooth in between. */
export const ramp = (u: number, a: number, b: number) => smooth((u - a) / Math.max(1e-6, b - a));

/** A smooth pulse: rises over `soft` from `a`, holds at 1 until `b`, falls over `soft`. 0 everywhere else. */
export const win = (u: number, a: number, b: number, soft = 0.05) => smooth((u - a) / Math.max(1e-6, soft)) * (1 - smooth((u - b) / Math.max(1e-6, soft)));

export function polylineLength(pts: V3[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  return total;
}

/** The point at fraction u (0 to 1, clamped) of the way along a polyline, by length. */
export function pointAlong(pts: V3[], u: number): V3 {
  if (pts.length === 0) return [0, 0, 0];
  if (pts.length === 1) return [...pts[0]];
  const target = clamp01(u) * polylineLength(pts);
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (run + seg >= target || i === pts.length - 1) {
      const f = seg > 0 ? Math.min(1, Math.max(0, (target - run) / seg)) : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
    run += seg;
  }
  return [...pts[pts.length - 1]];
}

/** Where a token sits when it moves through `stops` (x positions) in `legs`: each leg is [start, end] in cycle fraction, with dwell between. */
export function stepAlong(u: number, stops: number[], legs: [number, number][]): number {
  let x = stops[0] ?? 0;
  for (let i = 0; i < legs.length && i + 1 < stops.length; i++) x += (stops[i + 1] - stops[i]) * ramp(u, legs[i][0], legs[i][1]);
  return x;
}
