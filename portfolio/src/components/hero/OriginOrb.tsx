"use client";

import { useEffect, useState } from "react";
// From lib/world/events, not a scene file: this ships in the home page's first-load JS and must stay three.js-free (see
// RequestCounter.tsx for the same reasoning).
import { REQUEST_TRAVEL_SECONDS, SEND_REQUEST_EVENT } from "@/lib/world/events";
import { cn } from "@/lib/utils";

/**
 * The same idea as the hero's 3D origin node (a glowing core in a wireframe shell, "a visitor's request arriving"), drawn in
 * plain CSS and SVG instead of WebGL, so it can show everywhere the 3D world does not: phones, tablets, reduced motion,
 * browsers without WebGL. It is not a smaller copy of the 3D scene (no camera, no route, no other zones) -- just this one
 * idea, the one the rest of the hero's copy is about, kept intact instead of being replaced by an unrelated decoration.
 *
 * Mounted twice in Hero.tsx, each with its own `className` for its own spot -- small and in the flow of the text column on
 * narrow screens (`md:hidden`), pulled out to dedicated space beside the text on wide screens (`hidden md:block`, positioned
 * against the hero section itself, the same way HeroGuide is). Two instances rather than one repositioned by breakpoint
 * because this component's natural parent (a div with a CSS entrance animation, "fade-up") has a `transform` on it once that
 * animation finishes (`translateY(0)`, not literally `none`), which CSS counts as establishing a new containing block --
 * an absolutely positioned descendant would be confined to that div's own (narrow, text-column) width instead of the
 * section's, exactly the kind of implicit coupling to an unrelated ancestor a `className` prop and two call sites avoid.
 * Both instances react to the same event (see below), so whichever is visible always answers; the other, hidden by CSS,
 * costs nothing extra to look at.
 *
 * It is part of `.hero-fallback` (see globals.css), so it fades out the moment the real 3D world takes over, on any device
 * where that happens.
 *
 * Pressing "send a request" (RequestCounter) dispatches SEND_REQUEST_EVENT, which the 3D node answers with a packet
 * travelling the whole route; here, the same signal rings the core outward instead, timed to the same
 * REQUEST_TRAVEL_SECONDS so both versions "arrive" together.
 */
export function OriginOrb({ className }: { className: string }) {
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onSend = () => {
      setSending(true);
      clearTimeout(timer);
      timer = setTimeout(() => setSending(false), REQUEST_TRAVEL_SECONDS * 1000);
    };
    window.addEventListener(SEND_REQUEST_EVENT, onSend);
    return () => {
      window.removeEventListener(SEND_REQUEST_EVENT, onSend);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div aria-hidden className={cn("hero-fallback pointer-events-none", className)}>
      <div className="orb relative h-28 w-28 md:h-64 md:w-64" data-sending={sending || undefined}>
        {/* Outer facets: a slow-turning wireframe shell, the same language as the 3D node's icosahedron. */}
        <svg viewBox="0 0 100 100" className="orb-shell absolute inset-0 h-full w-full text-primary">
          <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.55" />
          <polygon points="50,4 90,27 50,50 10,27" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
          <polygon points="10,73 50,50 90,73 50,96" fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.4" />
          <line x1="50" y1="4" x2="50" y2="96" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
        </svg>
        {/* A second ring, turning the other way, so the shell reads as a solid the eye can turn around, not a flat sticker. */}
        <svg viewBox="0 0 100 100" className="orb-ring absolute inset-[12%] h-[76%] w-[76%] text-accent">
          <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="3 5" opacity="0.65" />
        </svg>
        {/* The core: the visitor's request, at rest. */}
        <div className="orb-core absolute inset-[24%] rounded-full" />
        {/* The rings a sent request answers with. Three, staggered, so it reads as one pulse expanding rather than a blink. */}
        <span className="orb-wave absolute inset-[24%] rounded-full border border-primary" style={{ animationDelay: "0s" }} />
        <span className="orb-wave absolute inset-[24%] rounded-full border border-primary" style={{ animationDelay: "0.5s" }} />
        <span className="orb-wave absolute inset-[24%] rounded-full border border-primary" style={{ animationDelay: "1s" }} />
      </div>
    </div>
  );
}
