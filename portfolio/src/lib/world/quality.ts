// Resolution governor for the 3D canvas: a small pure state machine (no DOM, no three.js), tested in scripts/tunnel-check.ts.
//
// The canvas is drawn at a pixel ratio. When a machine cannot keep up, the cheapest fix that still looks fine is to draw fewer
// pixels, so the governor steps the ratio down, one notch at a time, while frames are running slow, and gives it back after a long
// calm stretch. It is deliberately conservative: a display locked at 30 fps (an OS or browser power-saving mode) has frames of 33 ms,
// which is a limit of the screen and not of the GPU, so the slow threshold sits well above it.

export const QUALITY = {
  /** Never draw below this pixel ratio. */
  min: 0.6,
  /** A step down (or up) multiplies the ratio by this (or divides it by this). */
  step: 0.85,
  /** A smoothed frame time above this (ms) is "slow": worse than about 28 fps. */
  slowMs: 36,
  /** A smoothed frame time below this (ms) is "calm": a comfortable 60 fps. */
  calmMs: 18.5,
  /** How long (seconds of measured frames) to wait after any change before judging again. */
  settle: 1.5,
  /** How long (seconds of measured frames) frames must be calm before the ratio is raised again... */
  calmFor: 4,
  /** ...and how long after a step down before it may be raised at all. */
  holdAfterDrop: 30,
} as const;

export interface Governor {
  /** The pixel ratio in force. */
  dpr: number;
  /** The most the ratio may be raised to (what the device would draw at with no trouble). */
  ceiling: number;
  /** Smoothed frame time in ms. */
  ema: number;
  /** Seconds of measured frames since the last change. */
  since: number;
  /** Seconds of consecutive calm frames. */
  calm: number;
  /** Seconds since the last step down. */
  sinceDrop: number;
}

export function makeGovernor(ceiling: number): Governor {
  const c = Math.max(QUALITY.min, Number.isFinite(ceiling) ? ceiling : 1);
  return { dpr: c, ceiling: c, ema: 16.7, since: 0, calm: 0, sinceDrop: Infinity };
}

/**
 * Feeds one measured frame (`frameMs`, the time it took) to the governor. Returns the new pixel ratio when it decides to change it,
 * or undefined. Call it only for frames that were being drawn continuously (for example while scrolling), never for the long gaps
 * of an idle page, which are not slow frames.
 */
export function stepGovernor(g: Governor, frameMs: number): number | undefined {
  if (!Number.isFinite(frameMs) || frameMs <= 0) return undefined;
  const ms = Math.min(frameMs, 250);
  const dt = ms / 1000;
  g.ema += (ms - g.ema) * 0.1;
  g.since += dt;
  g.sinceDrop += dt;
  if (g.since < QUALITY.settle) return undefined;

  if (g.ema > QUALITY.slowMs && g.dpr > QUALITY.min) {
    g.dpr = Math.max(QUALITY.min, g.dpr * QUALITY.step);
    g.since = 0;
    g.calm = 0;
    g.sinceDrop = 0;
    g.ema = 16.7; // judge the new setting on its own frames
    return g.dpr;
  }

  g.calm = g.ema < QUALITY.calmMs ? g.calm + dt : 0;
  if (g.calm >= QUALITY.calmFor && g.dpr < g.ceiling && g.sinceDrop >= QUALITY.holdAfterDrop) {
    g.dpr = Math.min(g.ceiling, g.dpr / QUALITY.step);
    g.since = 0;
    g.calm = 0;
    return g.dpr;
  }
  return undefined;
}
