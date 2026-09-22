import type { Portfolio } from "@/lib/types";

// The assistant's entire "knowledge" is derived from the portfolio content passed in here (the same data the public
// site renders). Nothing else is read: no admin data, no environment variables, no database credentials.

export type Anchor = "hero" | "about" | "experience" | "journey" | "projects" | "skills" | "education" | "contact";

export type ChunkKind = "profile" | "project" | "experience" | "skillGroup" | "education" | "journeyStory" | "milestone" | "contact";

export interface Chunk {
  id: string;
  kind: ChunkKind;
  title: string;
  anchor: Anchor;
  /** One-line statement built only from stored fields. */
  headline: string;
  /** Supporting lines built only from stored fields. */
  details: string[];
  /** Technologies and skills attached to this chunk, in display form. */
  terms: string[];
  /** Milestones only: done | current | next. */
  status?: string;
}

const STATUS_LABEL: Record<string, string> = { done: "completed", current: "in progress", next: "planned next step" };

export function buildChunks(p: Portfolio): Chunk[] {
  const chunks: Chunk[] = [];
  const { profile } = p;

  chunks.push({
    id: "profile",
    kind: "profile",
    title: "About",
    anchor: "about",
    headline: `${profile.name} is a ${profile.role} based in ${profile.location}. ${profile.headline}`,
    details: [
      ...profile.bio,
      ...profile.facts.map((f) => `${f.label}: ${f.value}`),
      ...profile.highlights.map((h) => `${h.title}: ${h.text}`),
      `Availability: ${profile.availability}`,
    ],
    terms: [],
  });

  for (const pr of p.projects) {
    chunks.push({
      id: `project:${pr.id}`,
      kind: "project",
      title: pr.title,
      anchor: "projects",
      headline: `${pr.title}. ${pr.summary}`,
      details: [
        `Role: ${pr.role}`,
        ...(pr.stack.length ? [`Stack: ${pr.stack.join(", ")}`] : []),
        ...pr.highlights,
        ...(pr.challenge ? [`Challenge: ${pr.challenge}`] : []),
        ...(pr.approach ?? []).map((a) => `Approach: ${a}`),
        ...(pr.outcome ? [`Outcome: ${pr.outcome}`] : []),
      ],
      terms: pr.stack,
    });
  }

  for (const ex of p.experience) {
    chunks.push({
      id: `experience:${ex.id}`,
      kind: "experience",
      title: `${ex.role} at ${ex.organisation}`,
      anchor: "experience",
      headline: `${ex.role} at ${ex.organisation} (${ex.period}, ${ex.location})`,
      details: [...ex.bullets, ...(ex.stack.length ? [`Stack: ${ex.stack.join(", ")}`] : [])],
      terms: ex.stack,
    });
  }

  for (const g of p.skillGroups) {
    chunks.push({
      id: `skills:${g.id}`,
      kind: "skillGroup",
      title: g.name,
      anchor: "skills",
      headline: `${g.name}: ${g.skills.join(", ")}`,
      details: [],
      terms: g.skills,
    });
  }

  for (const e of p.education) {
    chunks.push({
      id: `education:${e.id}`,
      kind: "education",
      title: e.degree,
      anchor: "education",
      headline: `${e.degree}, ${e.institution} (${e.period})`,
      details: e.description ? [e.description] : [],
      terms: [],
    });
  }

  if (p.journey.story.length > 0) {
    chunks.push({
      id: "journey:story",
      kind: "journeyStory",
      title: p.journey.heading,
      anchor: "journey",
      headline: p.journey.story[0],
      details: p.journey.story.slice(1),
      terms: [],
    });
  }
  for (const m of p.journey.milestones) {
    chunks.push({
      id: `milestone:${m.id}`,
      kind: "milestone",
      title: m.title,
      anchor: "journey",
      headline: `${m.title} (${STATUS_LABEL[m.status] ?? m.status}): ${m.description}`,
      details: [],
      terms: m.tags,
      status: m.status,
    });
  }

  const contactLabel: Record<string, string> = { email: "Email", phone: "Phone", whatsapp: "WhatsApp", linkedin: "LinkedIn", github: "GitHub" };
  if (p.contacts.length > 0) {
    chunks.push({
      id: "contact",
      kind: "contact",
      title: "Contact",
      anchor: "contact",
      headline: `You can reach ${profile.name} through the links below.`,
      details: p.contacts.map((c) => `${contactLabel[c.type] ?? c.type}: ${c.value}`),
      terms: [],
    });
  }

  return chunks;
}
