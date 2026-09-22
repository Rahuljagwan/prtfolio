"use client";

import { useEffect } from "react";

/**
 * Mount once per page. One pointer listener drives every card effect, so cards need no client code of their own:
 *  - [data-spotlight]: writes --mx / --my (the glow position)
 *  - [data-tilt]:      writes --tilt-x / --tilt-y (a few degrees of 3D tilt toward the pointer)
 * Work is batched into one requestAnimationFrame per frame. Skipped on devices without hover (phones), and the tilt is
 * skipped for reduced motion. Only CSS variables change, so nothing reflows.
 */
export function SpotlightController() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let activeTilt: HTMLElement | null = null;
    let last: PointerEvent | null = null;
    let frame = 0;

    const resetTilt = (el: HTMLElement) => {
      el.style.setProperty("--tilt-x", "0deg");
      el.style.setProperty("--tilt-y", "0deg");
    };

    const update = () => {
      frame = 0;
      const e = last;
      if (!e) return;
      const target = e.target as Element | null;

      const spot = target?.closest?.<HTMLElement>("[data-spotlight]");
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
        spot.style.setProperty("--my", `${e.clientY - r.top}px`);
      }

      const tilt = reduceMotion ? null : (target?.closest?.<HTMLElement>("[data-tilt]") ?? null);
      if (activeTilt && activeTilt !== tilt) {
        resetTilt(activeTilt);
        activeTilt = null;
      }
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty("--tilt-x", `${(-py * 7).toFixed(2)}deg`);
        tilt.style.setProperty("--tilt-y", `${(px * 9).toFixed(2)}deg`);
        activeTilt = tilt;
      }
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!frame) frame = requestAnimationFrame(update);
    };
    const onLeaveWindow = () => {
      if (activeTilt) resetTilt(activeTilt);
      activeTilt = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
