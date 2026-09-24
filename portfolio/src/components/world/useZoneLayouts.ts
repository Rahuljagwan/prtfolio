"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ZONES } from "@/lib/world/zones";
import type { ZoneLayout } from "@/lib/world/rig-math";
import { SHOT_ORDER, type SectionExtent } from "@/lib/world/tunnel-math";

/**
 * Measures where each zone really sits on the page and keeps that up to date.
 *
 * A zone spans the combined extent of its sections. Positions are read from the DOM (so they follow the real content,
 * including anything edited in /admin) and re-measured whenever the page could have changed shape:
 * body/main resize (content or image growth, wrapped text), window resize, fonts finishing, load, and a few short
 * delayed passes to catch late layout. Measuring is batched into one animation frame and is cheap (a few rect reads).
 *
 * The same pass also records where each individual section sits (`sections`, in page order), which the tunnel camera uses to
 * give every section its own shot.
 *
 * It only runs when the world is enabled, so devices that keep the static page do no measuring at all.
 *
 * A zone with no section on the page (for example, no education and no resume) is filled with a zero-height layout at
 * the neighbouring boundary, so the camera passes straight through its pose instead of stalling or jumping.
 */
export function useZoneLayouts(host: RefObject<HTMLElement | null>, enabled: boolean) {
  const layouts = useRef<ZoneLayout[]>([]);
  const sections = useRef<SectionExtent[]>([]);

  useEffect(() => {
    if (!enabled) return; // phones, reduced motion, no WebGL: never measure anything
    let frame = 0;

    const measure = () => {
      frame = 0;
      const scrollY = window.scrollY;
      const raw = ZONES.map((zone) => {
        let top = Infinity;
        let bottom = -Infinity;
        for (const id of zone.sections) {
          const el = document.getElementById(id);
          if (!el) continue;
          const r = el.getBoundingClientRect();
          top = Math.min(top, r.top + scrollY);
          bottom = Math.max(bottom, r.bottom + scrollY);
        }
        return Number.isFinite(top) && Number.isFinite(bottom) ? { top, bottom } : null;
      });

      const filled: ZoneLayout[] = raw.map((z, i) => {
        if (z) return z;
        const before = [...raw.slice(0, i)].reverse().find(Boolean);
        const edge = before ? before.bottom : (raw.slice(i + 1).find(Boolean)?.top ?? 0);
        return { top: edge, bottom: edge };
      });

      layouts.current = filled;

      const extents: SectionExtent[] = [];
      for (const id of SHOT_ORDER) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.height <= 0) continue; // hidden (display: none) sections have no place on the page
        extents.push({ id, top: r.top + scrollY, bottom: r.bottom + scrollY });
      }
      sections.current = extents;
      if (host.current) host.current.dataset.layouts = JSON.stringify(filled.map((z) => [Math.round(z.top), Math.round(z.bottom)]));
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();

    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    const main = document.querySelector("main");
    if (main) observer.observe(main);

    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    void document.fonts?.ready.then(schedule);
    const timers = [300, 1200, 3000].map((ms) => window.setTimeout(schedule, ms));

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [host, enabled]);

  return { layouts, sections };
}
