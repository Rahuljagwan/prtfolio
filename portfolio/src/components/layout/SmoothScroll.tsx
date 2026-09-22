"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Mounts Lenis for inertial scrolling. Skipped when the user prefers reduced motion.
 *
 * Lenis needs a frame loop only while it is animating a scroll. The loop starts on any input that can scroll the page
 * (wheel, touch, keys, resize, or a scroll event) and stops after about half a second of stillness, so an idle page
 * does not wake the CPU 60 times a second.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });

    let raf = 0;
    let still = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      still = lenis.isScrolling ? 0 : still + 1;
      if (still > 30) {
        raf = 0; // stop; the next input restarts it
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      still = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    const events: (keyof WindowEventMap)[] = ["wheel", "touchstart", "keydown", "pointerdown", "resize", "hashchange"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    const offScroll = lenis.on("scroll", wake);
    wake();

    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      offScroll();
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
