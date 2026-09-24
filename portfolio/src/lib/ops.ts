// Small pure helpers behind the footer status badge and the "Under the hood" panel. Tested in scripts/ops-check.ts.
// The rule for everything here: say only what is true. "Deployed" and "up" are never produced; a build is "built", a
// local build says "local build", and a number that looks weak is reported as it is.

/** Dispatch on window to open the "Under the hood" drawer (the footer button, the command palette and the terminal all use it). */
export const OPEN_HOOD_EVENT = "open-under-the-hood";

/** Dispatch on window to open the terminal (Ctrl+` opens it too; the footer button and the command palette dispatch this). */
export const OPEN_TERMINAL_EVENT = "open-terminal";

/** "3 h ago" for a build timestamp. Empty when either time is not a number; never negative (clock skew reads "just now"). */
export function ageLabel(builtAtMs: number, nowMs: number): string {
  if (!Number.isFinite(builtAtMs) || !Number.isFinite(nowMs)) return "";
  const s = Math.max(0, Math.round((nowMs - builtAtMs) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 172_800) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86_400)} d ago`;
}

/** The badge's environment text. "local build" unless the host reported an environment (see next.config.mjs). */
export function statusLine({ env, region }: { env: string; region?: string }): string {
  if (!env || env === "local") return "local build";
  return region ? `${env} · ${region}` : env;
}

export type VitalKey = "lcp" | "cls" | "fcp" | "ttfb" | "inp";
export type Rating = "good" | "needs-improvement" | "poor";

// [good up to, needs improvement up to] (web.dev thresholds; inclusive). Milliseconds, except CLS which is unitless.
const THRESHOLDS: Record<VitalKey, [number, number]> = {
  lcp: [2500, 4000],
  cls: [0.1, 0.25],
  fcp: [1800, 3000],
  ttfb: [800, 1800],
  inp: [200, 500],
};

export function rateVital(key: VitalKey, value: number): Rating {
  const [good, ok] = THRESHOLDS[key];
  return value <= good ? "good" : value <= ok ? "needs-improvement" : "poor";
}
