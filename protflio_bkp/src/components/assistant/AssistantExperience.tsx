"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Cursor } from "@/components/layout/Cursor";
import { Reveal } from "@/components/ui/Reveal";
import { SpotlightController } from "@/components/ui/SpotlightController";
import { AssistantChat } from "./AssistantChat";
import { AssistantNav } from "./AssistantNav";
import { KnowledgeCanvas } from "./KnowledgeCanvas";
import { ASSISTANT_WAKE, CLUSTER_COLORS, newBridge, type AnswerPhase, type AssistantBridge, type ClusterInfo } from "./bridge";

interface Props {
  name: string;
  suggestions: string[];
  llm: boolean;
  clusters: ClusterInfo[];
}

const STATUS: Record<AnswerPhase, string> = {
  idle: "Ready. Ask anything about the work.",
  thinking: "Searching the portfolio...",
  answered: "Built from",
  nomatch: "Not in this portfolio.",
};

/**
 * The assistant page: nav, an intro column with a live legend of the portfolio's sections, the chat, and the 3D knowledge
 * constellation behind. The legend doubles as the fallback for phones and reduced-motion users: it shows which sections an
 * answer came from with no WebGL at all.
 */
export function AssistantExperience({ name, suggestions, llm, clusters }: Props) {
  const bridge = useRef<AssistantBridge>(newBridge());
  const [phase, setPhaseState] = useState<AnswerPhase>("idle");
  const [anchors, setAnchors] = useState<string[]>([]);

  const onPhase = useCallback((next: AnswerPhase, sourceAnchors: string[]) => {
    const b = bridge.current;
    b.phase = next;
    b.anchors = sourceAnchors;
    b.version += 1;
    setPhaseState(next);
    setAnchors(sourceAnchors);
    window.dispatchEvent(new Event(ASSISTANT_WAKE));
  }, []);

  const onHover = useCallback((anchor: string | null) => {
    bridge.current.hover = anchor;
    window.dispatchEvent(new Event(ASSISTANT_WAKE));
  }, []);

  const labelOf = (a: string) => clusters.find((c) => c.anchor === a)?.label ?? a;
  const answeredFrom = anchors.map(labelOf).join(" · ");

  return (
    <div className="relative min-h-[100dvh]">
      <Cursor />
      <SpotlightController />
      <KnowledgeCanvas clusters={clusters} bridge={bridge} />
      <AssistantNav />

      <main className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 pb-6 pt-24 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,44rem)] lg:gap-10 lg:pt-28">
        {/* Intro: text only, at the top, so the constellation below it stays uncovered */}
        <aside className="flex min-w-0 flex-col lg:pt-4">
          <Reveal>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">Ask · grounded in this portfolio</p>
          </Reveal>
          <Reveal delay={0.06}>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Ask about{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{name}&apos;s</span> work.
            </h1>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 max-w-md text-muted-foreground">
              Every answer is built only from the content of this site. The constellation shows where each one comes from.
            </p>
          </Reveal>
        </aside>

        {/* Legend strip + chat */}
        <motion.section
          initial={{ opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 min-w-0 flex-col gap-3 lg:h-[calc(100dvh-8.5rem)]"
        >
          <div className="shrink-0">
            <ul className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:flex-wrap lg:overflow-visible" aria-label="Sections the assistant can answer from">
              {clusters.map((c) => {
                const active = anchors.includes(c.anchor);
                const col = CLUSTER_COLORS[c.anchor] ?? CLUSTER_COLORS.about;
                return (
                  <li key={c.anchor} className="shrink-0">
                    <Link
                      href={`/#${c.anchor}`}
                      prefetch={false}
                      onPointerEnter={() => onHover(c.anchor)}
                      onPointerLeave={() => onHover(null)}
                      onFocus={() => onHover(c.anchor)}
                      onBlur={() => onHover(null)}
                      data-active={active ? "true" : undefined}
                      className="legend-chip group flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1.5 text-xs text-muted-foreground transition-[border-color,background-color,color,transform] duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground data-[active=true]:border-primary/60 data-[active=true]:bg-primary/10 data-[active=true]:text-foreground"
                    >
                      <span aria-hidden className="legend-dot h-2 w-2 shrink-0 rounded-full" style={{ "--cl": col.light, "--cd": col.dark } as React.CSSProperties} />
                      {c.label}
                      <span className="font-mono opacity-60">{c.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p aria-hidden className="mt-2 flex items-center gap-2 font-mono text-[0.7rem] text-muted-foreground">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  phase === "thinking" ? "animate-ping bg-accent" : phase === "answered" ? "bg-primary" : phase === "nomatch" ? "bg-red-500/80" : "bg-muted-foreground/50"
                } motion-reduce:animate-none`}
              />
              {STATUS[phase]}
              {phase === "answered" && answeredFrom && <span className="text-foreground">{answeredFrom}</span>}
            </p>
          </div>
          <AssistantChat className="min-h-0 flex-1" name={name} suggestions={suggestions} llm={llm} onPhase={onPhase} onSourceHover={onHover} />
        </motion.section>
      </main>
    </div>
  );
}
