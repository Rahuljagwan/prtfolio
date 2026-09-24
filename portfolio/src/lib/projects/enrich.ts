import { PROJECT_EXTRAS, TITLE_TO_SLUG, type ProjectExtras } from "@/content/projects-meta";
import { SAMPLE_PROJECTS } from "@/content/projects-samples";
import { SAMPLE_PROJECT_COUNT } from "@/lib/samples";
import type { Project, SampleField } from "@/lib/types";

// Merges the static extras onto whatever the database (or seed.ts) returned, then applies confidentiality. Pure and
// server-side: getPortfolio() calls it before anything is handed to a client component, so a redacted field never
// leaves the server.

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

export const slugFor = (title: string) => TITLE_TO_SLUG[title] ?? slugify(title);

const ENRICHABLE = ["constraints", "deployment", "metrics", "decisions", "retrospective"] as const;

/** Quantises text length to a bar width (percent of a line), so the UI can draw believable blackout bars and nothing else. */
const barWidth = (len: number) => Math.min(96, Math.max(28, Math.round((len / 1.6) / 8) * 8));

/** Removes everything private from a confidential project. Only the public summary, the role and the tech stack survive. */
export function redactProject(p: Project, publicSummary: string): Project {
  const hidden = [p.summary, ...p.highlights, p.challenge ?? "", ...(p.approach ?? []), p.outcome ?? ""].filter(Boolean);
  return {
    id: p.id,
    title: p.title,
    role: p.role,
    stack: p.stack,
    summary: publicSummary,
    highlights: [],
    challenge: null,
    approach: [],
    outcome: null,
    slug: p.slug,
    featured: p.featured,
    status: p.status,
    period: p.period,
    lastDeployed: p.lastDeployed,
    ownership: p.ownership,
    categories: p.categories,
    motif: p.motif,
    sample: p.sample,
    confidential: { publicSummary, bars: hidden.slice(0, 5).map((t) => barWidth(t.length)) },
  };
}

function applyExtras(project: Project, extras: ProjectExtras | undefined, includeSampleExtras: boolean): Project {
  if (!extras) return project;
  const { sampleExtras, confidential, ...real } = extras;
  const merged: Project = { ...project, ...real };
  if (includeSampleExtras && sampleExtras) {
    const flagged: SampleField[] = [];
    for (const key of ENRICHABLE) {
      const value = sampleExtras[key];
      if (value !== undefined && merged[key] === undefined) {
        (merged as unknown as Record<string, unknown>)[key] = value;
        flagged.push(key);
      }
    }
    if (flagged.length) merged.sampleFields = flagged;
  }
  return confidential ? redactProject(merged, confidential.publicSummary) : merged;
}

/** Guarantees unique slugs: a second project with the same title gets -2, -3 and so on. */
function uniqueSlugs(projects: Project[]): Project[] {
  const seen = new Map<string, number>();
  return projects.map((p) => {
    const base = p.slug ?? slugFor(p.title);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...p, slug: n === 1 ? base : `${base}-${n}` };
  });
}

/**
 * The projects the site shows: the real rows (DB wins for every column it has) with static extras merged on, followed by
 * the illustrative sample projects when samples are on. With `samples: false` (the assistant) every sample and every
 * sample-flagged section is left out.
 */
export function enrichProjects(rows: Project[], opts: { samples: boolean }): Project[] {
  const real = rows.map((row) => applyExtras({ ...row, slug: slugFor(row.title) }, PROJECT_EXTRAS[slugFor(row.title)], opts.samples));

  const samples: Project[] = opts.samples
    ? SAMPLE_PROJECTS.slice(0, SAMPLE_PROJECT_COUNT).map((def, i) =>
        applyExtras(
          { id: `sample-${i + 1}`, ...def.base, slug: slugFor(def.base.title), sample: true },
          def.extras,
          false,
        ),
      )
    : [];

  return uniqueSlugs([...real, ...samples]);
}
