"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import type { RigShared } from "../RigDriver";
import { NetworkPod } from "./NetworkPod";
import { PipelinePod } from "./PipelinePod";
import type { PodShared } from "./usePodStage";
import { VaultPod } from "./VaultPod";

const POD_MOTIFS = new Set(["pipeline", "network", "vault"]);

interface Stage {
  key: string;
  motif: string;
}

const readStages = (): Stage[] =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-pod-stage][data-stage-key]"), (el) => ({ key: el.dataset.stageKey ?? "", motif: el.dataset.motif ?? "" })).filter(
    (s) => s.key && POD_MOTIFS.has(s.motif),
  );

/**
 * Finds every project card's stage window (data-pod-stage, with its data-motif and data-stage-key) and mounts the matching
 * 3D pod for each, keyed by the project (not the DOM position), so filtering or switching the Projects view never swaps or
 * shuffles motifs. A MutationObserver on the section re-reads the windows when cards come and go. The pods anchor themselves
 * to the windows (see usePodStage). This component also tracks which card is hovered or focused, and the pointer, and
 * shares both with the pods through refs (no React state, so no re-render per event). Motifs without a pod render nothing,
 * and their card keeps its CSS cover.
 */
export function ProjectPods({ dark, shared }: { dark: boolean; shared: MutableRefObject<RigShared> }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const mounted = useRef(new Set<string>());
  const hoverCard = useRef<Element | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const pod = useRef<PodShared>({ hoverCard, pointer }).current;
  const invalidate = useThree((s) => s.invalidate);

  // The pods mount after the world's own warm-up has finished, so their shader programs would otherwise compile the first
  // time a card scrolls into view (measured: one extra program and a 100+ ms long task mid-scroll). Once they exist, draw
  // them once, invisibly. It uses its own flag (podWarm) rather than the world warm-up, so only the pods are drawn, not every
  // zone again. One pass of 250 ms; nothing keeps running.
  useEffect(() => {
    if (stages.length === 0) return;
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
  }, [stages.length, shared, invalidate]);

  // Mark each window that has a mounted pod (data-pod="on"), so CSS clears its cover and card background and the pod shows
  // through. Idempotent, and re-run after every DOM change because a remounted card brings a fresh, unmarked window.
  const mark = useRef(() => false);
  mark.current = () => {
    let changed = false;
    document.querySelectorAll<HTMLElement>("[data-pod-stage][data-stage-key]").forEach((el) => {
      const on = mounted.current.has(el.dataset.stageKey ?? "");
      if (on && el.dataset.pod !== "on") {
        el.dataset.pod = "on";
        changed = true;
      } else if (!on && el.dataset.pod) {
        delete el.dataset.pod;
        changed = true;
      }
    });
    return changed;
  };
  useEffect(() => {
    mounted.current = new Set(stages.map((s) => s.key));
    mark.current();
    invalidate();
  }, [stages, invalidate]);
  useEffect(
    () => () => {
      mounted.current = new Set();
      mark.current();
    },
    [],
  );

  useEffect(() => {
    const read = () => {
      const next = readStages();
      setStages((prev) => (prev.length === next.length && prev.every((p, i) => p.key === next[i].key && p.motif === next[i].motif) ? prev : next));
      if (mark.current()) invalidate(); // a remounted card's window needs a frame to get its pod back
    };
    read();

    // Cards come and go with filters and view switches. Coalesce bursts of mutations into one read per frame.
    let raf = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    });
    observer.observe(document.getElementById("projects") ?? document.body, { childList: true, subtree: true });

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
      observer.disconnect();
      cancelAnimationFrame(raf);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", over);
      document.removeEventListener("focusout", focusOut);
      window.removeEventListener("pointermove", move);
    };
  }, [invalidate]);

  return (
    <>
      {stages.map(({ key, motif }) => {
        if (motif === "pipeline") return <PipelinePod key={key} stageKey={key} dark={dark} shared={shared} pod={pod} />;
        if (motif === "network") return <NetworkPod key={key} stageKey={key} dark={dark} shared={shared} pod={pod} />;
        return <VaultPod key={key} stageKey={key} dark={dark} shared={shared} pod={pod} />;
      })}
    </>
  );
}
