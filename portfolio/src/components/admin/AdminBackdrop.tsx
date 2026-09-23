"use client";

import { Component, useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { canRun3D } from "@/lib/world/capability";

// Mirrors WorldCanvas.tsx's contract (dynamic import, capability gate, idle-after-load mount, swallow-and-disable on
// error) but is its own independent tree: importing only the dependency-free palette.ts, not WorldBoundary or the
// rig/zone module graph, so the admin bundle never pulls in the public site's scroll-narrative code for a purely
// decorative backdrop that has nothing to do with it.
const AdminScene = dynamic(() => import("./AdminScene"), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
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

export function AdminBackdrop() {
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!canRun3D()) return;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => setReady(true);
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
    };
  }, []);

  if (!ready || failed) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-5] opacity-100 transition-opacity duration-1000">
      <SceneBoundary onError={() => setFailed(true)}>
        <AdminScene dark={resolvedTheme === "dark"} />
      </SceneBoundary>
    </div>
  );
}
