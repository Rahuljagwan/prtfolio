"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SampleChip } from "@/components/ui/SampleChip";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, formatMonth } from "@/lib/projects/utils";
import type { Project, ProjectStatus } from "@/lib/types";
import { useLiveCheck } from "./useLiveCheck";

// Small pieces shared by the cards, the timeline and the matrix. Colours follow the site's status language:
// green = live / healthy, amber = in progress, muted = archived. Red is never used here (it is reserved for the incident).

const STATUS_STYLE: Record<ProjectStatus, { chip: string; dot: string }> = {
  live: { chip: "border-primary/40 bg-primary/10 text-primary", dot: "bg-primary" },
  maintained: { chip: "border-primary/30 text-primary", dot: "bg-primary/60" },
  "in-development": { chip: "border-accent/40 bg-accent/10 text-accent", dot: "bg-accent" },
  archived: { chip: "border-border text-muted-foreground", dot: "bg-muted-foreground/50" },
};

export const statusDotClass = (s: ProjectStatus | undefined) => (s ? STATUS_STYLE[s].dot : "bg-border");

export function StatusChip({ project, className }: { project: Pick<Project, "status" | "lastDeployed">; className?: string }) {
  const { status, lastDeployed } = project;
  if (!status) return null;
  const style = STATUS_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", style.chip, className)}>
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
      {STATUS_LABEL[status]}
      {lastDeployed && <span className="font-normal opacity-70">· {formatMonth(lastDeployed)}</span>}
    </span>
  );
}

const STAGES = [
  { key: "build", label: "Build" },
  { key: "ship", label: "Ship" },
  { key: "run", label: "Run" },
] as const;

/**
 * Which lifecycle stages the author owned. Filled = owned, plain = explicitly not, dashed = not stated. "Not stated" is
 * deliberately distinct from "not owned": a stage nobody wrote down is never presented as a claim either way.
 */
export function OwnershipBar({ ownership, className }: { ownership: Project["ownership"]; className?: string }) {
  if (!ownership || STAGES.every((s) => ownership[s.key] === undefined)) return null;
  const spoken = STAGES.map((s) => `${s.label} ${ownership[s.key] === undefined ? "not stated" : ownership[s.key] ? "owned" : "not owned"}`).join(", ");
  return (
    <div role="img" aria-label={`Lifecycle stages owned: ${spoken}`} className={cn("flex gap-1.5", className)}>
      {STAGES.map((s) => {
        const v = ownership[s.key];
        return (
          <div key={s.key} className="flex-1" title={v === undefined ? "Not stated" : v ? "Owned" : "Not owned"}>
            <div className={cn("h-1.5 rounded-full", v === true && "bg-primary", v === false && "bg-border", v === undefined && "border border-dashed border-border")} />
            <p className={cn("mt-1 font-mono text-[10px] uppercase tracking-wider", v ? "text-foreground" : "text-muted-foreground")}>
              {s.label}
              {v === undefined && <span aria-hidden> ?</span>}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function MetricsStrip({ metrics, sample, className }: { metrics: Project["metrics"]; sample?: boolean; className?: string }) {
  if (!metrics || metrics.length === 0) return null;
  return (
    <div className={className}>
      {sample && <SampleChip className="mb-2" />}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {metrics.slice(0, 3).map((m) => (
          <div key={m.label}>
            <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</dt>
            <dd className="font-mono text-lg font-semibold leading-tight">{m.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Only rendered for a project with a public demo. Says "reachable", never "up" (see useLiveCheck). */
export function LiveDot({ url }: { url: string }) {
  const { ref, state } = useLiveCheck(url);
  const label =
    state.status === "reachable" ? `reachable · ${state.ms} ms` : state.status === "unreachable" ? "unreachable" : state.status === "checking" ? "checking…" : "demo";
  return (
    <span ref={ref as React.RefObject<HTMLSpanElement>} className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
      <span
        aria-hidden
        className={cn("h-1.5 w-1.5 rounded-full", state.status === "reachable" ? "bg-primary" : state.status === "unreachable" ? "bg-accent" : "bg-border", state.status === "checking" && "animate-pulse")}
      />
      <span role="status">{label}</span>
    </span>
  );
}

/**
 * A confidential project's summary. The blackout bars only sit on top of the PUBLIC summary (the one piece of text the
 * server sent): everything genuinely private was removed before it reached the browser, so there is nothing to uncover.
 * The bars are widths only. Hover, focus or the button reveals the public summary; the text is always in the DOM for
 * screen readers.
 */
export function RedactedSummary({ publicSummary, bars }: { publicSummary: string; bars: number[] }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pinned, setPinned] = useState(false);
  const shown = hover || focus || pinned;
  return (
    <div className="mt-3" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}>
      <div className="relative min-h-[3.75rem]">
        {/* Hidden by colour, not by an opaque cover, so it works on any background (a card, or the world behind the Flight text). */}
        <p className={cn("text-sm leading-relaxed transition-colors duration-300", shown ? "text-muted-foreground" : "select-none text-transparent")}>{publicSummary}</p>
        <div aria-hidden className={cn("absolute inset-0 flex flex-col justify-center gap-2 transition-opacity duration-300", shown ? "pointer-events-none opacity-0" : "opacity-100")}>
          {bars.slice(0, 4).map((w, i) => (
            <span key={i} className="h-2.5 rounded-[3px] bg-foreground/85" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <button
        type="button"
        data-no-case
        aria-pressed={pinned}
        onClick={() => setPinned((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {shown ? <Eye size={12} aria-hidden /> : <EyeOff size={12} aria-hidden />}
        Confidential · {pinned ? "hide summary" : "show public summary"}
      </button>
    </div>
  );
}

/** The cover strip of a card. With a motif it is also the window a 3D pod is drawn into (data-pod-stage); without one it stays a CSS cover. */
export function Cover({ index, motif, stageKey, className }: { index: number; motif?: string; stageKey: string; className?: string }) {
  return (
    <div
      aria-hidden
      {...(motif ? { "data-pod-stage": "", "data-motif": motif, "data-stage-key": stageKey } : {})}
      className={cn("relative overflow-hidden border-b border-border", className)}
      style={{ background: `linear-gradient(${125 + index * 35}deg, hsl(var(--primary) / 0.32), hsl(var(--accent) / 0.2) 70%, transparent)` }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1.2px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(180deg, #000, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
        }}
      />
      <span className="absolute bottom-2 left-6 select-none font-mono text-6xl font-semibold leading-none tracking-tighter text-foreground/15">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}
