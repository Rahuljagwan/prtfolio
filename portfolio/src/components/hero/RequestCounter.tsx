"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
// Deliberately from lib/world/events, NOT from the scene files that define these: those import three.js/R3F at module
// scope, and importing even one small constant from them would pull that whole stack into Hero's eager bundle (this
// was tested: it added 200+ KB to the home page's first-load JS the first time). This module has no such imports.
import { SEND_REQUEST_EVENT, WAKE_EVENT } from "@/lib/world/events";

const START = 14_203; // an illustrative starting count, not live telemetry

/**
 * A small ticking "requests served" counter beside the hero copy, with a button that sends a real one: it dispatches
 * SEND_REQUEST_EVENT, which RequestOriginZone (the 3D hero node) picks up and sends a packet travelling the whole route
 * curve. WAKE_EVENT wakes the canvas's render-on-demand loop too, in case the visitor hasn't touched the page yet and
 * it is fully idle. Both events are no-ops if the 3D world isn't running (reduced motion, mobile, ?lite, no WebGL) —
 * the button and the counter still work on their own; the button is simply enhanced further, not gated by, the 3D layer.
 * The counter itself is decorative, not real traffic data — the same spirit as the rest of "The Living System" theme.
 * It ticks on an irregular interval so it reads as traffic passing through, not a countdown.
 */
export function RequestCounter() {
  const [count, setCount] = useState(START);
  const [sending, setSending] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setCount((c) => c + 1 + Math.floor(Math.random() * 3));
      timer = setTimeout(tick, reduced.current ? 6000 : 600 + Math.random() * 1400);
    };
    timer = setTimeout(tick, 900);
    return () => clearTimeout(timer);
  }, []);

  const send = () => {
    if (sending) return;
    setCount((c) => c + 1);
    setSending(true);
    window.dispatchEvent(new Event(WAKE_EVENT));
    window.dispatchEvent(new Event(SEND_REQUEST_EVENT));
    setTimeout(() => setSending(false), 4800); // roughly the packet's own travel time, so the button can't be spammed mid-flight
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p aria-hidden className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
        </span>
        requests served: {count.toLocaleString()}
      </p>
      <button
        type="button"
        onClick={send}
        disabled={sending}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      >
        {sending ? "sending..." : "send a request"}
        <ArrowUpRight size={12} aria-hidden />
      </button>
    </div>
  );
}
