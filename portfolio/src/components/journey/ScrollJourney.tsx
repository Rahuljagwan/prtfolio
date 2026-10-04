"use client";

import { useEffect } from "react";
import { scrub } from "@/lib/scroll-scrub";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Small scroll-driven effects. Mount once per page. It renders nothing; it finds elements by id / data attribute, so
 * every section stays a server component. (The big journey motion is the 3D camera, see components/world.)
 *
 *  - Skills:  the chips fly in from scattered positions and settle as the section scrolls into view.
 *  - Anything marked data-parallax drifts against the scroll as its section passes, for depth.
 *
 * Everywhere motion is allowed (reduced-motion users get the normal static layout); distances scale down on small screens.
 * Everything animates transform/opacity only. It does no work unless the page is scrolling
 * (see lib/scroll-scrub.ts), and it starts after the page has loaded and gone idle.
 */
export function ScrollJourney() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Phones and tablets get the same effects, scaled to the screen so nothing flies further than the screen is wide.
    const k = Math.min(1, Math.max(0.35, window.innerWidth / 1280));

    const stops: (() => void)[] = [];
    const cleanups: (() => void)[] = [];

    const setup = () => {
      // ---- Skills: chips assemble as the section scrolls into view. Deliberately finishes BEFORE the section reaches
      // the top, so jumping straight to #skills (nav, shared link) shows it complete.
      const skills = document.getElementById("skills");
      const chips = Array.from(document.querySelectorAll<HTMLElement>("#skills [data-assemble-chip]"));
      if (skills && chips.length > 0) {
        const spread = 0.4; // how much of the range is used to stagger the chips
        const order = chips.map((_, i) => i).sort(() => Math.random() - 0.5);
        const params = chips.map((_, i) => ({ x: rand(-140, 140) * k, y: rand(-90, 90) * k, r: rand(-24, 24), delay: (order.indexOf(i) / chips.length) * spread }));

        stops.push(
          scrub({ trigger: skills, start: 0.88, end: 0.3 }, (p) => {
            chips.forEach((el, i) => {
              const { x, y, r, delay } = params[i];
              const local = clamp01((p - delay) / (1 - spread));
              if (local >= 1) {
                el.style.transform = "";
                el.style.opacity = "";
                return;
              }
              const e = easeOut(local);
              el.style.transform = `translate3d(${x * (1 - e)}px, ${y * (1 - e)}px, 0) rotate(${r * (1 - e)}deg) scale(${0.6 + 0.4 * e})`;
              el.style.opacity = String(e);
            });
          }),
        );
        cleanups.push(() =>
          chips.forEach((el) => {
            el.style.transform = "";
            el.style.opacity = "";
          }),
        );
      }

      // Depth: anything marked data-parallax="0.3" drifts against the scroll as its section passes (a fraction of 240px either
      // side of centre), so big numerals, the vault dial and the resume sheets sit at a different depth from the text.
      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const amount = (Number(el.dataset.parallax) || 0.3) * 240 * Math.max(0.5, k);
        const trigger = el.closest<HTMLElement>("section") ?? el;
        stops.push(
          scrub({ trigger, start: 1, end: 0, endEdge: "bottom" }, (p) => {
            el.style.transform = `translate3d(0, ${((0.5 - p) * amount).toFixed(1)}px, 0)`;
          }),
        );
        cleanups.push(() => (el.style.transform = ""));
      });
    };

    // Wait for load, then a pause, then an idle slot, so none of this competes with first paint or interaction.
    let cancelled = false;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        const run = () => !cancelled && setup();
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(run, { timeout: 3000 });
        else run();
      }, 1200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      stops.forEach((stop) => stop());
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
