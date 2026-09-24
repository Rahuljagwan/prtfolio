// Shapes of everything the portfolio renders. In Stage 3 these map 1:1 to Prisma models,
// so the UI never needs to change when content moves from seed data to the database.

export interface Profile {
  name: string;
  role: string;
  headline: string;
  location: string;
  availability: string;
  bio: string[];
  facts: { label: string; value: string }[];
  highlights: { title: string; text: string }[];
}

export type ContactType = "email" | "phone" | "whatsapp" | "linkedin" | "github";

export interface ContactLink {
  type: ContactType;
  value: string;
}

export interface Experience {
  id: string;
  role: string;
  organisation: string;
  period: string;
  location: string;
  bullets: string[];
  stack: string[];
}

export type ProjectStatus = "live" | "maintained" | "in-development" | "archived";

/** Which lifecycle stages the author owned. A stage left undefined means "not stated", which is shown as unknown, never guessed. */
export interface ProjectOwnership {
  build?: boolean;
  ship?: boolean;
  run?: boolean;
}

export interface ProjectMetric {
  label: string;
  value: string;
}

export interface ProjectDecision {
  title: string;
  chose: string;
  rejected: string[];
  why: string;
}

/** Sections of a project whose content is illustrative. The UI shows a "Sample" chip on each one. */
export type SampleField = "metrics" | "decisions" | "constraints" | "deployment" | "retrospective";

export interface Project {
  id: string;
  title: string;
  summary: string;
  role: string;
  highlights: string[];
  stack: string[];
  /** Case study fields. All optional: a project without any of them has no "Case study" button. */
  challenge?: string | null;
  approach?: string[];
  outcome?: string | null;

  // ---- Enrichment (src/content/projects-meta.ts, merged in by lib/projects/enrich.ts). None of these exist in the database.
  /** URL segment for /projects/[slug]. Derived from the title, so it survives only as long as the title (see TITLE_TO_SLUG). */
  slug?: string;
  featured?: boolean;
  status?: ProjectStatus;
  /** Freeform, shown on the timeline (for example "2025"). */
  period?: string;
  /** "YYYY-MM" or an ISO date. */
  lastDeployed?: string;
  ownership?: ProjectOwnership;
  links?: { live?: string; repo?: string };
  categories?: string[];
  constraints?: string[];
  deployment?: string[];
  metrics?: ProjectMetric[];
  decisions?: ProjectDecision[];
  /** "What I would change" bullet points. */
  retrospective?: string[];
  /** What the author says they learned from the project (the resume's "Key learnings"). */
  learnings?: string;
  /** Which of the fields above hold illustrative content. */
  sampleFields?: SampleField[];
  /**
   * Set by the server when a project is confidential. Everything private has already been removed from the object
   * (redaction happens in getPortfolio, never in a client component, so hidden text never reaches the browser);
   * `bars` only carries quantised widths so the UI can draw blackout bars of a believable length.
   */
  confidential?: { publicSummary: string; bars: number[] };
  /** Which 3D cover motif to use (pipeline | network | vault). Projects without one keep the CSS cover. */
  motif?: string;
  /** Which per-project 3D schematic the Projects flight shows (see lib/projects/exhibits.ts). Without one it shows a generic rack of the project's stack. */
  exhibit?: string;
  /** The whole project is illustrative content. */
  sample?: boolean;
}

export interface SkillGroup {
  id: string;
  name: string;
  skills: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  period: string;
  description?: string | null;
}

export type MilestoneStatus = "done" | "current" | "next";

export interface JourneyMilestone {
  id: string;
  title: string;
  period: string;
  description: string;
  tags: string[];
  status: MilestoneStatus;
}

export interface Journey {
  heading: string;
  story: string[];
  milestones: JourneyMilestone[];
}

export interface ResumeFileInfo {
  filename: string;
  size: number;
  updatedAt: string;
  /** "upload": uploaded in /admin and stored in the database. "public": a file dropped in public/resume/. */
  source?: "upload" | "public";
}

/** Which resume files exist. Empty when nothing has been uploaded, and the resume buttons stay hidden. */
export interface ResumeInfo {
  pdf?: ResumeFileInfo;
  docx?: ResumeFileInfo;
}

export interface Portfolio {
  profile: Profile;
  contacts: ContactLink[];
  experience: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
  education: EducationEntry[];
  journey: Journey;
  resume: ResumeInfo;
}
