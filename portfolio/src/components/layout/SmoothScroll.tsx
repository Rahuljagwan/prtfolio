"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { scrollState, smoothScrollTo } from "@/lib/scroll-state";

/**
 * Mounts Lenis for inertial scrolling. Skipped when the user prefers reduced motion.
 *
 * Lenis needs a frame loop only while it is animating a scroll. The loop starts on any input that can scroll the page
 * (wheel, touch, keys, resize, or a scroll event) and stops after about half a second of stillness, so an idle page
 * does not wake the CPU 60 times a second.
 *
 * Feel: the wheel is smoothed by exponential approach (lerp), not by restarting a fixed-length tween on every wheel tick
 * (which is what made a notched mouse wheel feel steppy: each tick re-aimed the tween and briefly changed its speed).
 * Same-page links (`<a href="#about">`) glide there with an eased, distance-aware scroll instead of jumping, so the camera
 * travels the route between sections. The running instance is shared through lib/scroll-state so the 3D camera can follow its
 * fractional position rather than the browser's whole-pixel one.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, touchMultiplier: 1.4, smoothWheel: true });
    scrollState.lenis = lenis;

    // Lenis advances its animations by the time between the frames it is given. The loop below sleeps when the page is still, so
    // the first frame after waking would arrive seconds after the previous one and a glide would complete in a single step (an
    // instant jump). Lenis is therefore fed its own clock: each frame advances it by the real frame time, capped, and the first
    // frame after a sleep by one ordinary frame. A slow frame then slows the glide down instead of skipping ahead.
    let clock = 0;
    let prev = -1;
    let raf = 0;
    let still = 0;
    const loop = (time: number) => {
      clock += prev < 0 ? 16.7 : Math.min(time - prev, 100);
      prev = time;
      lenis.raf(clock);
      still = lenis.isScrolling ? 0 : still + 1;
      if (still > 30) {
        raf = 0; // stop; the next input restarts it
        prev = -1;
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      still = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    };

    // A plain click on a link to a section of this page glides there. Modified clicks, other targets and links the page
    // handles itself are left to the browser.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const hash = a.getAttribute("href") ?? "";
      const id = decodeURIComponent(hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (hash !== "#" && !el) return;
      e.preventDefault();
      wake();
      if (el) {
        smoothScrollTo(el);
        history.replaceState(null, "", hash);
      } else {
        smoothScrollTo(0);
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    document.addEventListener("click", onClick);

    // While the page is moving, decorative CSS loops rest (see .is-scrolling in globals.css), and resume 160 ms after it stops.
    const root = document.documentElement;
    let scrolling = false;
    let scrollEnd: ReturnType<typeof setTimeout> | undefined;
    const markScrolling = () => {
      if (!scrolling) {
        scrolling = true;
        root.classList.add("is-scrolling");
      }
      clearTimeout(scrollEnd);
      scrollEnd = setTimeout(() => {
        scrolling = false;
        root.classList.remove("is-scrolling");
      }, 160);
    };

    const events: (keyof WindowEventMap)[] = ["wheel", "touchstart", "keydown", "pointerdown", "resize", "hashchange"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    const offScroll = lenis.on("scroll", () => {
      wake();
      markScrolling();
    });
    wake();

    return () => {
      document.removeEventListener("click", onClick);
      events.forEach((e) => window.removeEventListener(e, wake));
      offScroll();
      clearTimeout(scrollEnd);
      root.classList.remove("is-scrolling");
      cancelAnimationFrame(raf);
      if (scrollState.lenis === lenis) scrollState.lenis = null;
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
