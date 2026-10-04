// Pure scroll -> camera-parameter maths. No DOM and no three.js, so it is fast to test in isolation (scripts/world-check.ts).
//
// Idea: the page is a stack of zones, each occupying a vertical range of the document. The camera path has one pose
// per zone. We track the point at the CENTRE of the viewport:
//   - while it is inside the middle of a zone (the "plateau"), the camera sits on that zone's pose (u = zone index);
//   - between one zone's plateau and the next, the camera travels along the path (u moves from i to i+1, eased).
// Because it is derived from the real measured section positions, it stays aligned when CMS content changes heights.

export interface ZoneLayout {
  /** Document-space top and bottom in px. */
  top: number;
  bottom: number;
}

export interface RigState {
  /** Continuous path parameter in [0, zones - 1]. Integer values are exactly on a zone's pose. */
  u: number;
  /** Index of the zone the viewport centre is in, or nearest to. */
  zone: number;
  /** Position within that zone's extent, -0.5 (top) to +0.5 (bottom). Used for a small drift while dwelling. */
  local: number;
}

/** Fraction of each zone's height (centred) during which the camera holds its pose. */
export const PLATEAU = 0.5;

export const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

const finite = (n: number, fallback = 0) => (Number.isFinite(n) ? n : fallback);

/**
 * Scroll position -> camera parameter.
 * Robust to: no zones, one zone, zero-height zones, overlapping or unsorted layouts, and NaN input.
 */
export function computeRig(center: number, input: ZoneLayout[], plateau = PLATEAU): RigState {
  const n = input.length;
  if (n === 0) return { u: 0, zone: 0, local: 0 };

  const c = finite(center);

  // Sanitise: finite numbers, non-negative height. Order is the caller's zone order (the camera path is in that order),
  // but a zone can never start before the previous one's plateau ends, so the parameter is always monotonic.
  const zones = input.map((z) => {
    const top = finite(z.top);
    const bottom = Math.max(top, finite(z.bottom, top));
    const h = bottom - top;
    const mid = top + h / 2;
    return { top, bottom, h, mid, p0: mid - (plateau * h) / 2, p1: mid + (plateau * h) / 2 };
  });
  for (let i = 1; i < n; i++) {
    if (zones[i].p0 < zones[i - 1].p1) {
      const meet = (zones[i].p0 + zones[i - 1].p1) / 2;
      zones[i - 1].p1 = Math.min(zones[i - 1].p1, meet);
      zones[i].p0 = Math.max(zones[i].p0, meet);
    }
  }

  let u = 0;
  if (c <= zones[0].p0) {
    u = 0;
  } else if (c >= zones[n - 1].p1) {
    u = n - 1;
  } else {
    for (let i = 0; i < n; i++) {
      const z = zones[i];
      if (c >= z.p0 && c <= z.p1) {
        u = i;
        break;
      }
      if (i < n - 1 && c > z.p1 && c < zones[i + 1].p0) {
        const gap = zones[i + 1].p0 - z.p1;
        u = i + smootherstep((c - z.p1) / gap);
        break;
      }
    }
  }

  const zone = Math.min(n - 1, Math.max(0, Math.round(u)));
  const z = zones[zone];
  const local = z.h > 0 ? Math.min(0.5, Math.max(-0.5, (c - z.top) / z.h - 0.5)) : 0;
  return { u, zone, local };
}

/**
 * The Projects zone camera weave, as a pure function of where the viewport is inside the section (`local`, -0.5 to 0.5)
 * and the dwell factor (1 while the camera holds the zone, fading to 0 during travel). Sway is one S-curve; lift is a
 * single smooth arch (cosine, so it has no kink at the middle); bank leans into the sway. Everything is 0 at local = +-0.5
 * and whenever dwell = 0, so entering and leaving the zone is continuous.
 */
export const WEAVE = { sway: 1.4, lift: 0.6, targetSwing: 0.55, bank: 0.0125 };
export function projectsWeave(local: number, dwell: number) {
  const sway = Math.sin(local * Math.PI * 2) * WEAVE.sway * dwell;
  return {
    sway,
    lift: Math.cos(local * Math.PI) * WEAVE.lift * dwell,
    targetX: -sway * WEAVE.targetSwing,
    bank: -sway * WEAVE.bank, // radians
  };
}
