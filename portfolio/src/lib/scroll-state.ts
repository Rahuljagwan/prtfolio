// One shared view of the page's scroll for everything that follows it (the 3D camera, the flight, scroll-linked effects), and the
// one way to scroll the page smoothly from code.
//
// Why: `window.scrollY` is a whole number of pixels. While the page is decelerating (a few tenths of a pixel per frame) it
// steps 0, 0, 1, 0, 1 ... and a camera driven by it steps with it, which reads as a fine judder exactly when the eye is most
// sensitive to it. Lenis knows the exact (fractional) position it is animating to, so while it is scrolling we use that.
// This file is three-free and holds no React state, so it is safe to import from anywhere, including eager bundles.

import type Lenis from "lenis";

interface ScrollState {
  /** The running Lenis instance, or null (reduced motion, or before it mounts). */
  lenis: Lenis | null;
}

export const scrollState: ScrollState = { lenis: null };

/** The scroll position in CSS pixels, fractional while Lenis is animating and exactly `window.scrollY` otherwise. */
export function getScrollY(): number {
  const lenis = scrollState.lenis;
  return lenis && lenis.isScrolling ? lenis.animatedScroll : window.scrollY;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * How long a programmatic scroll of `screens` viewport heights should take (seconds): a short hop is quick, a far jump is a
 * proper journey but never a wait. Grows slowly with distance, so crossing the whole page is about 3 seconds.
 */
export const scrollDuration = (screens: number) => clamp(0.9 + 0.5 * Math.log2(1 + Math.abs(Number.isFinite(screens) ? screens : 0)), 0.9, 3.2);

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scrolls to a document position (px) or an element, with an eased, distance-aware glide. Falls back to the browser's own
 * scroll when Lenis is not running, and to an instant jump for reduced motion. `offset` is added to the element's top
 * (the site's sections use a 6rem scroll margin, so the default is -96).
 */
export function smoothScrollTo(target: number | HTMLElement, opts: { offset?: number; onComplete?: () => void } = {}) {
  const offset = opts.offset ?? (typeof target === "number" ? 0 : -96);
  const rawTop = typeof target === "number" ? target : target.getBoundingClientRect().top + window.scrollY;
  const top = Math.max(0, rawTop + offset);
  const lenis = scrollState.lenis;
  if (reducedMotion()) {
    window.scrollTo(0, top);
    opts.onComplete?.();
    return;
  }
  if (lenis) {
    const from = lenis.animatedScroll;
    lenis.scrollTo(top, { duration: scrollDuration((top - from) / Math.max(1, window.innerHeight)), easing: easeInOutCubic, onComplete: opts.onComplete });
    return;
  }
  window.scrollTo({ top, behavior: "smooth" });
  opts.onComplete?.();
}

/** Scrolls to a section (or any element) by id. Returns false when there is no such element. */
export function smoothScrollToId(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  smoothScrollTo(el);
  return true;
}
