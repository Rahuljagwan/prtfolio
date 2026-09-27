"use client";

import { useEffect, useRef } from "react";
import { scrub } from "@/lib/scroll-scrub";
import { cn } from "@/lib/utils";

/**
 * Scroll-driven timeline line. Render it inside a `relative` wrapper that also contains the timeline items;
 * it finds its parent, draws a progress line down the left edge as the wrapper scrolls through the viewport,
 * and lights up each `[data-timeline-dot]` when the line reaches it.
 *
 * Reduced motion shows the completed line and lit dots with no animation. Without JavaScript the line is shown complete
 * (see the noscript style below). It uses lib/scroll-scrub.ts, so it does no work unless the page is scrolling.
 */
/** `className` repositions the rail (for example `left-1/2` to run it down the middle of a two-sided layout). */
export function TimelineProgress({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current?.parentElement;
    const line = ref.current?.querySelector<HTMLElement>("[data-progress]");
    if (!root || !line) return;

    const dots = Array.from(root.querySelectorAll<HTMLElement>("[data-timeline-dot]"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      line.style.transform = "scaleY(1)";
      dots.forEach((d) => d.classList.add("is-active"));
      return;
    }

    // scaleY is compositor-only, so drawing the line never triggers layout.
    const stops = [
      scrub({ trigger: root, start: 0.7, end: 0.6, endEdge: "bottom" }, (p) => {
        line.style.transform = `scaleY(${p})`;
      }),
      // Lit once the line reaches the dot, and unlit again only when scrolling back above it.
      ...dots.map((dot) => scrub({ trigger: dot, start: 0.68, end: 0.6 }, (p) => dot.classList.toggle("is-active", p > 0))),
    ];

    return () => stops.forEach((stop) => stop());
  }, []);

  return (
    <div ref={ref} aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 w-px bg-border", className)}>
      <div data-progress className="timeline-progress absolute inset-y-0 -left-px w-[3px] origin-top rounded-full bg-primary" />
      {/* Without JavaScript nothing can draw the line, so show it complete. */}
      <noscript>
        <style>{`.timeline-progress{transform:scaleY(1)!important}[data-timeline-dot]:not(.stage-node){background:hsl(var(--primary))!important}.stage-node{background:hsl(var(--primary))!important;color:hsl(var(--primary-foreground))!important}`}</style>
      </noscript>
    </div>
  );
}
