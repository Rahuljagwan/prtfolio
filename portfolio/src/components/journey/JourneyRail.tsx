"use client";

import { useEffect, useRef } from "react";
import { SECTIONS } from "@/content/sections";
import { useActiveSection } from "@/hooks/useActiveSection";
import { cn } from "@/lib/utils";

const items = SECTIONS.filter((s) => s.inNav);
const ids = items.map((s) => s.id);

/**
 * Slim progress rail on the right edge (wide screens only): one dot per section, the current one highlighted with its
 * number, and a line that fills as you scroll. It is a visual aid only (the main nav already provides navigation),
 * so it is hidden from assistive tech. Progress is written straight to a CSS variable, so scrolling never re-renders it.
 */
export function JourneyRail() {
  const active = useActiveSection(ids);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      rail.current?.style.setProperty("--p", p.toFixed(4));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const activeIndex = Math.max(0, (ids as string[]).indexOf(active));

  return (
    <div aria-hidden className="pointer-events-none fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
      <div ref={rail} className="relative flex w-8 flex-col items-end gap-5" style={{ "--p": 0 } as React.CSSProperties}>
        {/* track and fill */}
        <span className="absolute bottom-1 right-[4px] top-1 w-px bg-border" />
        <span className="absolute right-[4px] top-1 w-px origin-top bg-primary" style={{ bottom: "0.25rem", transform: "scaleY(var(--p))" }} />

        {items.map((s, i) => {
          const isActive = i === activeIndex;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              tabIndex={-1}
              title={s.label}
              className="pointer-events-auto relative flex items-center gap-2"
            >
              <span className={cn("w-5 text-right font-mono text-[10px] transition-opacity duration-300", isActive ? "text-primary opacity-100" : "opacity-0")}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  "h-[9px] w-[9px] rounded-full border-2 bg-background transition-all duration-300",
                  isActive ? "scale-125 border-primary bg-primary" : "border-border",
                )}
              />
            </a>
          );
        })}
      </div>
    </div>
  );
}
