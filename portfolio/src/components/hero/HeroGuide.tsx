"use client";

import { useEffect, useRef, useState } from "react";
// From lib/world/events, not from a scene file: this ships in the home page's first-load JS and must stay three.js-free.
import { REQUEST_TRAVEL_SECONDS, SEND_REQUEST_EVENT } from "@/lib/world/events";
import { cn } from "@/lib/utils";

/** The route a request takes through this site, in the order the 3D world lays it out (lib/world/zones.ts), in plain words. */
const STAGES = [
  { n: "01", name: "Origin", what: "you arrive", href: "#hero" },
  { n: "02", name: "The Gate", what: "about me", href: "#about" },
  { n: "03", name: "The Build", what: "experience, journey", href: "#experience" },
  { n: "04", name: "Deployments", what: "projects", href: "#projects" },
  { n: "05", name: "The Stack", what: "skills, education", href: "#skills" },
  { n: "06", name: "Signal out", what: "contact me", href: "#contact" },
] as const;

/** -1: at rest. 0 to 5: the request is passing that stage. 6: it has crossed all of them. */
type Progress = number;

/**
 * A legend for the hero's 3D scene, for a visitor who has never seen a system like it. It says what the green ball is (a
 * visitor's request, that is, you), that the ring around it fills as the request moves, and lists the six stages of this site the
 * route passes through, each one a link to that part of the portfolio. When the visitor sends a request (the button in the hero,
 * via SEND_REQUEST_EVENT) the stages light up one after another, on the same clock the 3D packet uses, so the picture and the words
 * move together. It works without the 3D world too: the stages are then simply a map of the page, and the copy about the ball is
 * hidden (see .world-only in globals.css).
 */
export function HeroGuide({ className }: { className?: string }) {
  const [progress, setProgress] = useState<Progress>(-1);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A few seconds after the request lands, the guide rests again.
    const settle = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setProgress(-1), 6000);
    };
    const start = () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(timer.current);
      const t0 = performance.now();
      let last = -2;
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / (REQUEST_TRAVEL_SECONDS * 1000));
        // The packet has travelled `t` of the route, which has six stops spread evenly along it.
        const stage = t >= 1 ? 6 : Math.floor(t * 5);
        if (stage !== last) {
          last = stage;
          setProgress(stage);
        }
        if (t < 1) raf.current = requestAnimationFrame(tick);
        else settle();
      };
      raf.current = requestAnimationFrame(tick);
    };
    const onSend = () => {
      if (reduced) {
        setProgress(6); // no travelling highlight for reduced motion: it simply shows the result
        settle();
      } else start();
    };
    window.addEventListener(SEND_REQUEST_EVENT, onSend);
    return () => {
      window.removeEventListener(SEND_REQUEST_EVENT, onSend);
      cancelAnimationFrame(raf.current);
      clearTimeout(timer.current);
    };
  }, []);

  const running = progress >= 0 && progress < 6;
  const status =
    progress < 0
      ? "Press “send a request” to watch one cross all six."
      : running
        ? `Now passing: ${STAGES[progress].name}, ${STAGES[progress].what}.`
        : "200 OK. It made it through all six. Now scroll it yourself.";
  const stateOf = (i: number) => (progress < 0 ? "idle" : i < progress || progress === 6 ? "done" : i === progress ? "active" : "idle");

  return (
    <aside aria-label="How to read this site" className={cn("hero-guide", className)}>
      <p className="mono-label text-primary">Follow the request</p>
      <p className="guide-intro mt-1.5">
        <span className="world-only">
          The green ball is <span className="font-medium text-foreground">you</span>, a request crossing six stages.
        </span>
        <span className="world-off">Each section is a stage a request passes through.</span>
      </p>
      <div className="thin-scroll -mx-1 mt-4 overflow-x-auto px-1 pb-1">
      <ol className="route">
        {STAGES.map((s, i) => (
          <li key={s.n}>
            <a href={s.href} data-state={stateOf(i)} data-next={i + 1 < STAGES.length && stateOf(i + 1) !== "idle" ? "on" : "off"} className="rs">
              <span className="rs-node" aria-hidden />
              <span className="rs-name">{s.name}</span>
              <span className="rs-what">{s.what}</span>
            </a>
          </li>
        ))}
      </ol>
      </div>
      <p aria-live="polite" data-done={progress === 6 || undefined} className="guide-status mt-3 font-mono">
        {status}
      </p>
    </aside>
  );
}
