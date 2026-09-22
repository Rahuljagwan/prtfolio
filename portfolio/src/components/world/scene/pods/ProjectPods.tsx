"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { RigShared } from "../RigDriver";
import { NetworkPod } from "./NetworkPod";
import { PipelinePod } from "./PipelinePod";
import type { PodShared } from "./usePodStage";
import { VaultPod } from "./VaultPod";

/**
 * Finds every project card's stage window (data-pod-stage, with its data-motif) and mounts the matching 3D pod for each.
 * The pods anchor themselves to the windows (see usePodStage). This component also tracks which card is hovered or
 * focused, and the pointer, and shares both with the pods through refs (no React state, so no re-render per event).
 * Motifs without a pod yet render nothing, and their card keeps its CSS cover.
 */
export function ProjectPods({ dark, shared }: { dark: boolean; shared: MutableRefObject<RigShared> }) {
  const [motifs, setMotifs] = useState<string[]>([]);
  const hoverCard = useRef<Element | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const pod = useRef<PodShared>({ hoverCard, pointer }).current;
  const invalidate = useThree((s) => s.invalidate);

  // The pods mount after the world's own warm-up has finished, so their shader programs would otherwise compile the first
  // time a card scrolls into view (measured: one extra program and a 100+ ms long task mid-scroll). Once they exist, draw
  // them once, invisibly. It uses its own flag (podWarm) rather than the world warm-up, so only the pods are drawn, not every
  // zone again. One pass of 250 ms; nothing keeps running.
  useEffect(() => {
    if (motifs.length === 0) return;
    let off: ReturnType<typeof setTimeout> | undefined;
    const on = setTimeout(() => {
      shared.current.podWarm = true;
      invalidate();
      off = setTimeout(() => {
        shared.current.podWarm = false;
        invalidate();
      }, 250);
    }, 100);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [motifs.length, shared, invalidate]);

  useEffect(() => {
    const read = () => setMotifs(Array.from(document.querySelectorAll<HTMLElement>("[data-pod-stage]"), (el) => el.dataset.motif ?? ""));
    read();

    const cardOf = (t: EventTarget | null) => (t instanceof Element ? t.closest("[data-project-card]") : null);
    const over = (e: Event) => void (hoverCard.current = cardOf(e.target) ?? hoverCard.current);
    const out = (e: PointerEvent) => {
      if (!cardOf(e.relatedTarget)) hoverCard.current = null;
    };
    const focusOut = (e: FocusEvent) => {
      if (!cardOf(e.relatedTarget)) hoverCard.current = null;
    };
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("focusin", over, { passive: true });
    document.addEventListener("focusout", focusOut, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", focusOut);
      window.removeEventListener("pointermove", move);
    };
  }, []);

  return (
    <>
      {motifs.map((motif, i) => {
        if (motif === "pipeline") return <PipelinePod key={i} index={i} dark={dark} shared={shared} pod={pod} />;
        if (motif === "network") return <NetworkPod key={i} index={i} dark={dark} shared={shared} pod={pod} />;
        if (motif === "vault") return <VaultPod key={i} index={i} dark={dark} shared={shared} pod={pod} />;
        return null;
      })}
    </>
  );
}
