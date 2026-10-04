"use client";

import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { worldTier } from "@/lib/world/capability";
import { useZoneLayouts } from "./useZoneLayouts";

// The 3D chunk (three.js + R3F + the scene) is only fetched if the visitor's own settings allow it (see `worldTier`: phones and
// modest machines get the same world, drawn lighter), and only after the page has loaded and gone idle, so it never competes with first paint.
const WorldScene = dynamic(() => import("./WorldScene"), { ssr: false });

/** If the 3D subtree throws for any reason, the static page simply stays. */
class WorldBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type WorldState = "off" | "loading" | "ready";

/**
 * One persistent, fixed canvas behind the whole page (on a phone it is the height of the page's tallest viewport, so the address bar sliding
 * away never resizes it). The page's sections stay ordinary server-rendered HTML on top of
 * it (so text, SEO and screen readers are untouched); the canvas is decorative and hidden from assistive tech.
 * `html[data-world]` reports the state so CSS can hide the static hero fallback once the 3D is showing.
 */
export function WorldCanvas() {
  const { resolvedTheme } = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<WorldState>("off");
  const { layouts, sections } = useZoneLayouts(host, state !== "off");

  const setWorld = useCallback((next: WorldState) => {
    setState(next);
    if (next === "off") delete document.documentElement.dataset.world;
    else document.documentElement.dataset.world = next;
  }, []);

  useEffect(() => {
    if (worldTier() === "off") return;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => setWorld("loading");
    const schedule = () => {
      timer = setTimeout(() => {
        if ("requestIdleCallback" in window) idle = window.requestIdleCallback(start, { timeout: 2000 });
        else start();
      }, 400);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
      delete document.documentElement.dataset.world;
    };
  }, [setWorld]);

  const fail = useCallback(() => setWorld("off"), [setWorld]);
  const ready = useCallback(() => setWorld("ready"), [setWorld]);

  return (
    <div
      ref={host}
      data-world-canvas
      aria-hidden
      className={`world-host pointer-events-none z-[-5] transition-opacity duration-1000 ${state === "ready" ? "opacity-100" : "opacity-0"}`}
    >
      {state !== "off" && (
        <WorldBoundary onError={fail}>
          <WorldScene dark={resolvedTheme === "dark"} host={host} layouts={layouts} sections={sections} onReady={ready} onLost={fail} />
        </WorldBoundary>
      )}
    </div>
  );
}
