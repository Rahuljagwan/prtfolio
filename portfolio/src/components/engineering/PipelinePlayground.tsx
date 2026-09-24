"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, RotateCcw, Rocket, Undo2, X } from "lucide-react";
import {
  DISCLAIMER,
  STAGES,
  applyRun,
  canRollback,
  initialLedger,
  liveVersion,
  nextVersion,
  planRun,
  rollback,
  statusAt,
  type FailureMode,
  type RunPlan,
  type StageStatus,
} from "@/lib/pipeline/model";
import { cn } from "@/lib/utils";

const SEED = 11;
const SPEEDS = [1, 2, 4] as const;

const FAILURES: { value: FailureMode; label: string }[] = [
  { value: "none", label: "Everything passes" },
  { value: "tests", label: "A test fails" },
  { value: "canary", label: "The canary fails" },
];

const LEVEL_CLASS = { info: "text-muted-foreground", ok: "text-primary", warn: "text-accent", error: "text-accent font-medium" } as const;

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "passed") return <Check size={14} aria-hidden className="text-primary" />;
  if (status === "failed") return <X size={14} aria-hidden className="text-accent" />;
  if (status === "skipped") return <Minus size={14} aria-hidden className="text-muted-foreground" />;
  if (status === "running") return <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />;
  return <span aria-hidden className="h-2 w-2 rounded-full border border-border" />;
}

const STATUS_WORD: Record<StageStatus, string> = { pending: "waiting", running: "running", passed: "passed", failed: "failed", skipped: "skipped" };

/**
 * The release-pipeline simulator. All behaviour comes from lib/pipeline/model.ts (pure and tested); this component only
 * advances a clock and draws the result. Amber marks failure (red is reserved for the incident sequence on the home page).
 * Operable by keyboard, and it never claims to be this site's own pipeline.
 */
export function PipelinePlayground() {
  const [ledger, setLedger] = useState(initialLedger);
  const [plan, setPlan] = useState<RunPlan | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [failure, setFailure] = useState<FailureMode>("none");
  const [announce, setAnnounce] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const recorded = useRef<number>(-1);

  const view = useMemo(() => (plan ? statusAt(plan, elapsed) : null), [plan, elapsed]);
  const live = liveVersion(ledger);
  const next = nextVersion(ledger);

  // The clock: advances `elapsed` while a run is in progress.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      setElapsed((e) => e + dt * speed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, speed]);

  // When a run finishes, record it once: only a run that reached production changes what is live.
  useEffect(() => {
    if (!plan || !view?.done || recorded.current === plan.id) return;
    recorded.current = plan.id;
    setRunning(false);
    setLedger((l) => applyRun(l, plan));
    setAnnounce(plan.outcome === "deployed" ? `${plan.version} is live.` : `Run ${plan.id} ${plan.outcome}. ${liveVersion(ledger)} is still live.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.done, plan]);

  // Announce stage changes for screen readers (the log itself is not a live region: it would read out every line).
  useEffect(() => {
    if (view?.active) setAnnounce(`${STAGES.find((s) => s.id === view.active)?.label} running.`);
  }, [view?.active]);

  // Keep the newest log line in view, inside the log's own box (never scrolling the page).
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view?.log.length]);

  const start = useCallback(() => {
    if (running) return;
    const p = planRun(SEED, ledger.nextRun, nextVersion(ledger), failure);
    setPlan(p);
    setElapsed(0);
    setRunning(true);
  }, [running, ledger, failure]);

  const doRollback = () => {
    const rolled = rollback(ledger);
    if (!rolled) return;
    setLedger(rolled);
    setPlan(null);
    setElapsed(0);
    setAnnounce(`Rolled back. ${liveVersion(rolled)} is live.`);
  };

  const reset = () => {
    setRunning(false);
    setPlan(null);
    setElapsed(0);
    setLedger(initialLedger());
    recorded.current = -1;
    setAnnounce("Simulation reset.");
  };

  const traffic = view?.traffic ?? { previous: 100, next: 0 };
  const btn =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div>
      <p role="note" className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
        <strong className="font-medium">{DISCLAIMER}</strong> For reference, this site&apos;s own build runs ESLint and the TypeScript check as part of <code className="font-mono">next build</code>. It has no staging
        environment, no canary and no CI workflow.
      </p>

      {/* Controls */}
      <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <label htmlFor="pl-failure" className="block text-xs uppercase tracking-wider text-muted-foreground">
            Next release
          </label>
          <select
            id="pl-failure"
            value={failure}
            disabled={running}
            onChange={(e) => setFailure(e.target.value as FailureMode)}
            className="mt-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            {FAILURES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={start} disabled={running} className={cn(btn, "border-primary bg-primary text-primary-foreground hover:opacity-90")}>
          <Rocket size={15} aria-hidden /> Push {next}
        </button>
        <button type="button" onClick={doRollback} disabled={running || !canRollback(ledger)} className={cn(btn, "border-border bg-background hover:border-primary/50")} title={canRollback(ledger) ? "Restore the previous release" : "There is no earlier release to restore"}>
          <Undo2 size={15} aria-hidden /> Roll back
        </button>
        <div role="group" aria-label="Simulation speed" className="inline-flex rounded-full border border-border p-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={speed === s}
              onClick={() => setSpeed(s)}
              className={cn("rounded-full px-3 py-1 font-mono text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary", speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {s}x
            </button>
          ))}
        </div>
        <button type="button" onClick={reset} className={cn(btn, "border-transparent text-muted-foreground hover:text-foreground")}>
          <RotateCcw size={14} aria-hidden /> Reset
        </button>
      </div>

      {/* Environment */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            Production is running <span className="font-mono font-semibold text-primary">{live}</span>
          </p>
          <p className="font-mono text-xs text-muted-foreground">{traffic.next > 0 ? `${plan?.version}: ${traffic.next}% of traffic` : "all traffic on the live release"}</p>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${traffic.previous}% of traffic on ${live}${traffic.next ? `, ${traffic.next}% on ${plan?.version}` : ""}`}>
          <div className="bg-primary/70 motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${traffic.previous}%` }} />
          <div className="bg-accent motion-safe:transition-[width] motion-safe:duration-200" style={{ width: `${traffic.next}%` }} />
        </div>
      </div>

      {/* Stages */}
      <ol className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Pipeline stages">
        {STAGES.map((s, i) => {
          const v = view?.stages[i];
          const status: StageStatus = v?.status ?? "pending";
          return (
            <li
              key={s.id}
              className={cn(
                "relative overflow-hidden rounded-xl border p-3.5",
                status === "running" && "border-primary bg-primary/5",
                status === "passed" && "border-primary/40 bg-card",
                status === "failed" && "border-accent bg-accent/10",
                status === "skipped" && "border-dashed border-border bg-card/50 text-muted-foreground",
                status === "pending" && "border-border bg-card",
              )}
            >
              <div className="flex items-center gap-2">
                <StageIcon status={status} />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">{STATUS_WORD[status]}</p>
              {status === "running" && <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" style={{ width: `${Math.round((v?.progress ?? 0) * 100)}%` }} />}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Log */}
        <section className="lg:col-span-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-primary">Log</h2>
          <div ref={logRef} data-lenis-prevent role="log" aria-label="Pipeline log" tabIndex={0} className="thin-scroll mt-2 h-72 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed">
            {!view || view.log.length === 0 ? (
              <p className="text-muted-foreground">Nothing has run yet. Push a release to start.</p>
            ) : (
              view.log.map((l, i) => (
                <p key={i} className={LEVEL_CLASS[l.level]}>
                  <span className="mr-2 text-muted-foreground/70">{(l.at / 1000).toFixed(1).padStart(4, " ")}s</span>
                  {l.stage !== "pipeline" && <span className="mr-2 text-muted-foreground">[{l.stage}]</span>}
                  {l.text}
                </p>
              ))
            )}
          </div>
        </section>

        {/* History */}
        <section className="lg:col-span-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-primary">Releases</h2>
          <ul className="mt-2 space-y-2">
            {ledger.history.slice(0, 8).map((h) => (
              <li key={`${h.kind}-${h.id}`} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">{h.version}</span>
                  <span className={cn("font-mono text-[11px]", h.outcome === "deployed" || h.outcome === "baseline" ? "text-primary" : "text-accent")}>{h.outcome}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
