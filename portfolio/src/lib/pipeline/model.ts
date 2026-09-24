// A pure model of a release pipeline, for the playground at /engineering/pipeline.
//
// THIS IS A SIMULATION. It models how a typical production pipeline behaves (stages in order, a failure halting the run,
// a canary that reverts itself, a rollback that restores the previous release). It is not this site's pipeline, and the
// page says so. Everything here is deterministic given a seed, so it can be tested without a browser or a clock:
//   planRun()   builds the whole timeline of one run up front (durations with seeded jitter, where it fails, every log line);
//   statusAt()  reads that timeline at any elapsed time, so the UI only has to advance a number;
//   the Ledger tracks what is live and what a rollback would restore.

export const DISCLAIMER = "Simulation: a model of a production pipeline, not this site's pipeline.";

export type StageId = "lint" | "typecheck" | "tests" | "build" | "staging" | "canary" | "production";
export type FailureMode = "none" | "tests" | "canary";
export type StageResult = "passed" | "failed" | "skipped";
export type StageStatus = "pending" | "running" | StageResult;
export type Outcome = "deployed" | "failed" | "halted";
export type LogLevel = "info" | "ok" | "warn" | "error";

export const STAGES: { id: StageId; label: string; baseMs: number }[] = [
  { id: "lint", label: "Lint", baseMs: 1200 },
  { id: "typecheck", label: "Type check", baseMs: 2100 },
  { id: "tests", label: "Tests", baseMs: 3400 },
  { id: "build", label: "Build", baseMs: 2600 },
  { id: "staging", label: "Deploy to staging", baseMs: 2200 },
  { id: "canary", label: "Canary (5% of traffic)", baseMs: 3000 },
  { id: "production", label: "Promote to production", baseMs: 1600 },
];

export interface LogLine {
  /** Milliseconds from the start of the run. */
  at: number;
  stage: StageId | "pipeline";
  level: LogLevel;
  text: string;
}

export interface PlannedStage {
  id: StageId;
  start: number;
  end: number;
  result: StageResult;
}

export interface RunPlan {
  id: number;
  version: string;
  failure: FailureMode;
  stages: PlannedStage[];
  log: LogLine[];
  totalMs: number;
  outcome: Outcome;
}

/** mulberry32: a tiny seeded generator, so a given seed always produces the same run. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FAILING_TESTS = ["test_reminder_escalation_after_deadline", "test_approval_requires_owner", "test_audit_record_written_on_reject"];

/**
 * The full timeline of one run. Each stage takes its base time +-25% (seeded). A `tests` failure stops the run at about 60% of
 * the tests stage and skips everything after it. A `canary` failure stops at about 70% of the canary, reverts the canary
 * automatically, and skips promotion. A run that fails never changes what is live.
 */
export function planRun(seed: number, id: number, version: string, failure: FailureMode): RunPlan {
  const rand = rng(seed * 7919 + id * 104729);
  const stages: PlannedStage[] = [];
  const log: LogLine[] = [];
  const say = (at: number, stage: LogLine["stage"], level: LogLevel, text: string) => log.push({ at: Math.round(at), stage, level, text });

  say(0, "pipeline", "info", `run #${id} started for ${version}${failure === "none" ? "" : ` (injected failure: ${failure === "tests" ? "a failing test" : "a failing canary"})`}`);

  let t = 0;
  let stopped = false;
  let outcome: Outcome = "deployed";

  for (const s of STAGES) {
    if (stopped) {
      stages.push({ id: s.id, start: t, end: t, result: "skipped" });
      say(t, s.id, "info", `${s.label}: skipped`);
      continue;
    }
    const dur = Math.round(s.baseMs * (0.75 + rand() * 0.5));
    const failsHere = (failure === "tests" && s.id === "tests") || (failure === "canary" && s.id === "canary");
    say(t, s.id, "info", `${s.label}: started`);

    if (failsHere) {
      const failAt = t + Math.round(dur * (s.id === "tests" ? 0.6 : 0.7));
      if (s.id === "tests") {
        const name = FAILING_TESTS[Math.floor(rand() * FAILING_TESTS.length)];
        say(failAt - 200, "tests", "info", "running 148 tests");
        say(failAt, "tests", "error", `FAILED ${name}`);
        say(failAt + 60, "tests", "error", "1 failed, 97 passed before the run was stopped");
        say(failAt + 120, "pipeline", "warn", "halting: a required check failed. Nothing was deployed.");
        outcome = "failed";
      } else {
        say(failAt - 300, "canary", "info", "5% of traffic now on the new version");
        say(failAt, "canary", "error", "error rate 4.1% is above the 1% threshold");
        say(failAt + 60, "canary", "warn", "reverting the canary to the previous version automatically");
        say(failAt + 160, "canary", "ok", "canary reverted: 100% of traffic is back on the previous version");
        say(failAt + 220, "pipeline", "warn", "halting: the canary failed. Production was never changed.");
        outcome = "halted";
      }
      stages.push({ id: s.id, start: t, end: failAt + (s.id === "canary" ? 160 : 60), result: "failed" });
      t = failAt + (s.id === "canary" ? 160 : 60);
      stopped = true;
      continue;
    }

    stages.push({ id: s.id, start: t, end: t + dur, result: "passed" });
    const detail: Partial<Record<StageId, string>> = {
      lint: "no problems found",
      typecheck: "0 errors",
      tests: "148 passed",
      build: "artifact built",
      staging: "staging is healthy",
      canary: "error rate 0.2%, within the 1% threshold",
      production: "100% of traffic on the new version",
    };
    say(t + dur, s.id, "ok", `${s.label}: passed (${detail[s.id]})`);
    t += dur;
  }

  const totalMs = Math.max(t, ...log.map((l) => l.at)) + 200;
  say(totalMs, "pipeline", outcome === "deployed" ? "ok" : "warn", outcome === "deployed" ? `run #${id} finished: ${version} is live` : `run #${id} finished: ${outcome}. The previous release is still live.`);
  log.sort((a, b) => a.at - b.at);
  return { id, version, failure, stages, log, totalMs: totalMs + 1, outcome };
}

export interface StageView {
  id: StageId;
  label: string;
  status: StageStatus;
  /** 0 to 1 while running, 1 once finished. */
  progress: number;
}

export interface RunView {
  stages: StageView[];
  /** The log lines that have happened by `elapsed`. */
  log: LogLine[];
  active: StageId | null;
  done: boolean;
  /** Where production traffic is at this moment, for the environment strip. */
  traffic: { previous: number; next: number };
}

/** The run as it looks `elapsed` ms after it started. Pure: the same plan and time always give the same view. */
export function statusAt(plan: RunPlan, elapsed: number): RunView {
  const e = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  const done = e >= plan.totalMs;
  let active: StageId | null = null;
  const stages = plan.stages.map((p): StageView => {
    const label = STAGES.find((s) => s.id === p.id)?.label ?? p.id;
    if (p.result === "skipped") {
      // A skipped stage is "skipped" from the moment the run stopped before it.
      const stoppedAt = p.start;
      return { id: p.id, label, status: e >= stoppedAt ? "skipped" : "pending", progress: 0 };
    }
    if (e < p.start) return { id: p.id, label, status: "pending", progress: 0 };
    if (e >= p.end) return { id: p.id, label, status: p.result, progress: 1 };
    active = p.id;
    return { id: p.id, label, status: "running", progress: (e - p.start) / Math.max(1, p.end - p.start) };
  });

  const canary = stages.find((s) => s.id === "canary")!;
  const production = stages.find((s) => s.id === "production")!;
  // Production traffic on the new version: 5% during the canary, ramping to 100% while promoting. A canary that fails reverts to 0.
  let next = 0;
  if (production.status === "passed") next = 100;
  else if (production.status === "running") next = Math.round(5 + production.progress * 95);
  else if (canary.status === "running" || canary.status === "passed") next = 5;

  return { stages, log: plan.log.filter((l) => l.at <= e), active, done, traffic: { previous: 100 - next, next } };
}

// ---- what is live, and what a rollback restores

export interface HistoryEntry {
  id: number;
  version: string;
  kind: "run" | "rollback" | "baseline";
  outcome: Outcome | "rolled-back" | "baseline";
  note: string;
}

export interface Ledger {
  /** Versions that reached production, oldest first. The last one is live. */
  deployed: string[];
  history: HistoryEntry[];
  nextRun: number;
  nextPatch: number;
}

export const BASELINE_VERSION = "v1.4.2";

export function initialLedger(): Ledger {
  return {
    deployed: [BASELINE_VERSION],
    history: [{ id: 0, version: BASELINE_VERSION, kind: "baseline", outcome: "baseline", note: "already live when the simulation starts" }],
    nextRun: 1,
    nextPatch: 3,
  };
}

export const liveVersion = (l: Ledger) => l.deployed[l.deployed.length - 1];
export const nextVersion = (l: Ledger) => `v1.4.${l.nextPatch}`;

/** Records a finished run. Only a run that reached production changes what is live. */
export function applyRun(l: Ledger, plan: RunPlan): Ledger {
  const entry: HistoryEntry = {
    id: plan.id,
    version: plan.version,
    kind: "run",
    outcome: plan.outcome,
    note: plan.outcome === "deployed" ? "reached production" : plan.outcome === "failed" ? "stopped at tests; production untouched" : "canary failed and reverted; production untouched",
  };
  return {
    ...l,
    deployed: plan.outcome === "deployed" ? [...l.deployed, plan.version] : l.deployed,
    history: [entry, ...l.history],
    nextRun: l.nextRun + 1,
    nextPatch: l.nextPatch + 1,
  };
}

/** Rollback is possible only when there is an earlier release to restore. */
export const canRollback = (l: Ledger) => l.deployed.length >= 2;

export function rollback(l: Ledger): Ledger | null {
  if (!canRollback(l)) return null;
  const from = liveVersion(l);
  const deployed = l.deployed.slice(0, -1);
  const to = deployed[deployed.length - 1];
  return {
    ...l,
    deployed,
    history: [{ id: l.nextRun, version: to, kind: "rollback", outcome: "rolled-back", note: `restored ${to} (was ${from})` }, ...l.history],
    nextRun: l.nextRun + 1,
  };
}
