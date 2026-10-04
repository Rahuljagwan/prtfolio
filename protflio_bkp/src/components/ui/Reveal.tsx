"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

// One IntersectionObserver is shared by every Reveal on the page. Each instance only adds a CSS class when it scrolls
// into view; the animation itself is a CSS transition (see .reveal in globals.css) on opacity and transform, so it never
// causes layout shift. This replaced a per-element Framer Motion component, which cost noticeable hydration time on
// low-powered phones once the page had many sections.
let observer: IntersectionObserver | null = null;

function sharedObserver() {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer?.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -80px 0px" },
    );
  }
  return observer;
}

/** Fades and lifts content in once as it enters the viewport. Reduced motion (and no-JS) shows it immediately. */
export function Reveal({ children, delay = 0, y = 24, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-visible");
      return;
    }
    const io = sharedObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}s`, "--reveal-y": `${y}px` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
