"use client";

import { useEffect, useRef, useState } from "react";
// Deliberately from lib/world/events, not from any zone file that imports three.js — see RequestCounter.tsx for why:
// this component ships in the ordinary page bundle (Skills is not lazy-loaded), so it must stay three.js-free.
import { INCIDENT_EVENT, INCIDENT_TIMING, WAKE_EVENT } from "@/lib/world/events";

const LINES = {
  alert: "ALERT: node unresponsive",
  rerouted: "Rerouted traffic to healthy nodes",
  restarted: "Node restarted",
  nominal: "Nominal ✓",
};

/**
 * Triggers the Stack zone's Incident sequence (see StackZone.tsx) and reads its progress out loud in a small log,
 * ending with the punchline exactly as the failing node turns green.
 *
 * This runs its own timer off INCIDENT_TIMING rather than listening for events the 3D side dispatches — on a device
 * where the 3D world never mounts (the static fallback), nothing would ever dispatch them, and an earlier version of
 * this panel that only listened stayed on "simulate an incident" forever: a real dead button, found during the
 * fallback audit. Now this panel works identically with or without the 3D world; when it is present, StackZone runs
 * the matching visual off the same trigger and the same timing constants, independently.
 */
export function IncidentPanel() {
  const [log, setLog] = useState<string[]>([]);
  const [active, setActive] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const trigger = () => {
    if (active) return;
    setActive(true);
    setLog([LINES.alert]);
    window.dispatchEvent(new Event(WAKE_EVENT));
    window.dispatchEvent(new Event(INCIDENT_EVENT)); // runs the 3D visual too, if the world is mounted — independent of this timer
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setLog((prev) => [...prev, LINES.rerouted]), INCIDENT_TIMING.restart * 1000),
      setTimeout(() => setLog((prev) => [...prev, LINES.restarted]), INCIDENT_TIMING.nominal * 1000),
      setTimeout(() => {
        setActive(false);
        setLog((prev) => [...prev, LINES.nominal, "This is what I do at 3am."]);
        timers.current.push(setTimeout(() => setLog([]), 3200));
      }, (INCIDENT_TIMING.nominal + 0.05) * 1000),
    ];
  };

  return (
    <div className="mt-6 flex flex-wrap items-start gap-3">
      <button
        type="button"
        onClick={trigger}
        disabled={active}
        className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
      >
        {active ? "incident in progress..." : "simulate an incident"}
      </button>
      {log.length > 0 && (
        <div aria-live="polite" className="rounded-lg border border-border bg-background/85 px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground backdrop-blur">
          {log.map((line, i) => (
            <p key={i} className={line.startsWith("This is") ? "mt-1 text-foreground" : undefined}>
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
