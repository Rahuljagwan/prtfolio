"use client";

import { Component, useCallback, useEffect, useState, type MutableRefObject, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { canRun3D } from "@/lib/world/capability";
import type { AssistantBridge, ClusterInfo } from "./bridge";

// The scene (three.js, react-three-fiber, drei) is its own chunk, fetched only when this page is open and the device passes
// the same gate as the home world. Everywhere else the page is complete without it.
const KnowledgeScene = dynamic(() => import("./scene/KnowledgeScene"), { ssr: false });

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

type SceneState = "off" | "loading" | "ready";

/**
 * Fixed canvas behind the assistant page. It is decorative (aria-hidden, no pointer events), sits under the page content and
 * fades in once the first frame is drawn. `html[data-assistant-scene]` reports the state so CSS can adapt the layout.
 */
export function KnowledgeCanvas({ clusters, bridge }: { clusters: ClusterInfo[]; bridge: MutableRefObject<AssistantBridge> }) {
  const { resolvedTheme } = useTheme();
  const [state, setState] = useState<SceneState>("off");

  const set = useCallback((next: SceneState) => {
    setState(next);
    if (next === "off") delete document.documentElement.dataset.assistantScene;
    else document.documentElement.dataset.assistantScene = next;
  }, []);

  // Same start-up policy as the home world: wait for the page to finish loading and go idle before fetching and booting the
  // scene, so it never competes with first paint or counts as blocking time during load.
  useEffect(() => {
    if (!canRun3D()) return;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout>;
    const start = () => set("loading");
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
      delete document.documentElement.dataset.assistantScene;
    };
  }, [set]);

  const fail = useCallback(() => set("off"), [set]);
  const ready = useCallback(() => set("ready"), [set]);

  if (state === "off") return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 z-[-5] transition-opacity duration-1000 ${state === "ready" ? "opacity-100" : "opacity-0"}`}
    >
      <SceneBoundary onError={fail}>
        <KnowledgeScene clusters={clusters} dark={resolvedTheme === "dark"} bridge={bridge} onReady={ready} onLost={fail} />
      </SceneBoundary>
    </div>
  );
}
