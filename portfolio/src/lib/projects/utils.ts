import type { Project, ProjectStatus } from "@/lib/types";

/** Dispatched on window (detail: { id }) to open a project's case study from anywhere (the command palette, the terminal). */
export const OPEN_PROJECT_EVENT = "open-project-case-study";

/** True when a project has any case-study content, which is what earns a card its "Case study" button. */
export const hasCaseStudy = (p: Project) => Boolean(p.challenge || p.outcome || (p.approach && p.approach.length > 0));

const MOTIFS = ["pipeline", "network", "vault"];

/**
 * The 3D cover for a project. An explicit `motif` wins, and "none" means the plain CSS cover. With no motif set, real projects
 * fall back to a position-based assignment and sample projects get none, so illustrative entries never borrow a real pod.
 */
export const motifOf = (p: Project, i: number): string | undefined => (p.motif === "none" ? undefined : p.motif ?? (p.sample ? undefined : MOTIFS[i % MOTIFS.length]));

/**
 * The heading a project sits under on the timeline. The project's own `period` label wins (for example "Freelance" or an
 * employer and dates), so projects are grouped by where and when the work happened, exactly as stated. Without one it falls
 * back to a year, and a project with neither is "Not dated" (never given a made-up date).
 */
export const timelineGroup = (p: Project): string => p.period?.trim() || yearOf(p) || "Not dated";

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  live: "Live",
  maintained: "Maintained",
  "in-development": "In development",
  archived: "Archived",
};

/** "2026-08" -> "Aug 2026". Anything unparseable is returned unchanged. */
export function formatMonth(value: string): string {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(value);
  if (!m) return value;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** The year a project belongs to on the timeline: its period, else its last deploy. Undated projects return null. */
export function yearOf(p: Project): string | null {
  const m = /\d{4}/.exec(p.period ?? "") ?? /\d{4}/.exec(p.lastDeployed ?? "");
  return m ? m[0] : null;
}

const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));

export type FilterGroup = "category" | "status" | "stack";
export type Filters = Record<FilterGroup, string[]>;
export const NO_FILTERS: Filters = { category: [], status: [], stack: [] };

export interface FilterOptions {
  category: string[];
  status: ProjectStatus[];
  stack: string[];
}

/** The chips worth offering: every category and status in use, and the technologies used by more than one project. */
export function filterOptions(projects: Project[]): FilterOptions {
  const freq = new Map<string, number>();
  for (const p of projects) for (const s of uniq(p.stack)) freq.set(s, (freq.get(s) ?? 0) + 1);
  const stack = [...freq.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([s]) => s);
  return {
    category: uniq(projects.flatMap((p) => p.categories ?? [])).sort(),
    status: uniq(projects.map((p) => p.status).filter((s): s is ProjectStatus => !!s)),
    stack,
  };
}

/** OR within a group, AND across groups. An empty group matches everything. */
export function matchesFilters(p: Project, f: Filters): boolean {
  const cat = f.category.length === 0 || (p.categories ?? []).some((c) => f.category.includes(c));
  const status = f.status.length === 0 || (!!p.status && f.status.includes(p.status));
  const stack = f.stack.length === 0 || p.stack.some((s) => f.stack.includes(s));
  return cat && status && stack;
}

export const isFiltering = (f: Filters) => f.category.length + f.status.length + f.stack.length > 0;

/** The technologies for the matrix columns: most used first, capped so the table stays readable. */
export function matrixColumns(projects: Project[], max = 12): string[] {
  const freq = new Map<string, number>();
  for (const p of projects) for (const s of uniq(p.stack)) freq.set(s, (freq.get(s) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([s]) => s);
}
