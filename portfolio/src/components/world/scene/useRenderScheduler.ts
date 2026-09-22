"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { WAKE_EVENT } from "@/lib/world/events";

// Re-exported so existing imports of WAKE_EVENT from this file keep working; the name is defined in lib/world/events.ts
// (which has no three.js/R3F imports) so eagerly-loaded DOM code can reference it without pulling the 3D stack in too.
export { WAKE_EVENT };

const ACTIVE_MS = 1800; // keep drawing every frame this long after the last scroll/pointer/resize
const IDLE_FRAME_MS = 66; // about 15 fps for the gentle idle motion while the hero is on screen
const POD_FRAME_MS = 33; // about 30 fps while a project pod is on screen, where the motion is the point
const IDLE_ANIMATION_MS = 10_000; // ...and only for this long after the last input, then it rests until the next one

// Every zone with its own idle-driven animation (a pulse, a timer that needs to notice it has elapsed) registers the
// DOM section id(s) that place it on screen here. This is the single place that decides "does this zone need to keep
// drawing while the visitor sits still" — a zone that skips this list silently freezes the moment scrolling stops,
// which has already happened once (About's status pulse + 403 timer) and been caught once more before shipping
// (City's gate light bars): a missing entry here is easy to not notice until it's live. Adding a new zone with idle
// motion is a one-line addition, not a new bespoke visibility function.
const ZONE_WATCH: Record<string, string[]> = {
  gate: ["about"],
  city: ["experience", "journey", "projects"],
  stack: ["skills", "education"],
  // SignalOut's beacon (core rotation, expanding signal rings) had no idle animation registered at all — the same
  // freeze bug caught twice before, just never noticed here since nothing had exercised it yet.
  signalOut: ["resume", "contact"],
};

const sectionsVisible = (ids: string[]) =>
  ids.some((id) => {
    const el = document.getElementById(id);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight * 0.85 && r.bottom > window.innerHeight * 0.15;
  });

const zoneVisible = (zoneId: string) => {
  const ids = ZONE_WATCH[zoneId];
  return !!ids && sectionsVisible(ids);
};

/**
 * Render-on-demand driver. The canvas is in frameloop="demand", so nothing draws unless we ask. We ask:
 *  - every frame while the user is scrolling, moving the pointer or resizing (and briefly after, so damping can settle);
 *  - at roughly 15 fps for 10 seconds after the last input while the hero or the closing beacon is on screen and the tab is visible, so the
 *    opening scene feels alive, then it rests completely until the next input;
 *  - never otherwise. A page scrolled away from the hero with no interaction costs no rendering at all.
 * The driver's own animation-frame loop stops when there is nothing to do and restarts on the next event.
 */
export function useRenderScheduler() {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let lastActivity = performance.now();

    // The hero and the closing beacon don't map to a single section id (hero also covers the page-bottom beacon
    // reusing its idle motion), and pods key off a data attribute, not an id — those two stay bespoke predicates.
    // Everything else registers in ZONE_WATCH above.
    const heroVisible = () =>
      window.scrollY < window.innerHeight * 0.9 ||
      window.scrollY + window.innerHeight > document.documentElement.scrollHeight - window.innerHeight * 0.5;

    // Project pods are on screen when any card stage window intersects the viewport.
    const podVisible = () => {
      const el = document.querySelector("[data-pod-stage][data-pod]");
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };

    // Two modes. Active (recent input): one draw per animation frame. Idle hero: one draw every IDLE_FRAME_MS on a timer,
    // so the page wakes about 15 times a second instead of running a 60 Hz loop that mostly does nothing.
    const tick = () => {
      const now = performance.now();
      const active = now - lastActivity < ACTIVE_MS;
      const idleAnimation =
        !active &&
        now - lastActivity < IDLE_ANIMATION_MS &&
        (heroVisible() || podVisible() || Object.keys(ZONE_WATCH).some(zoneVisible)) &&
        !document.hidden;

      if (!active && !idleAnimation) {
        running = false;
        return;
      }
      invalidate();
      if (active) raf = requestAnimationFrame(tick);
      else timer = setTimeout(tick, podVisible() ? POD_FRAME_MS : IDLE_FRAME_MS);
    };

    const wake = () => {
      lastActivity = performance.now();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const events: (keyof WindowEventMap)[] = ["scroll", "pointermove", "resize", "wheel", "touchmove"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    window.addEventListener(WAKE_EVENT, wake);
    document.addEventListener("visibilitychange", wake);
    wake();

    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      window.removeEventListener(WAKE_EVENT, wake);
      document.removeEventListener("visibilitychange", wake);
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [invalidate]);
}
