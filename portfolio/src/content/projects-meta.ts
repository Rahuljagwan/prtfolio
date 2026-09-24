import type { Project } from "@/lib/types";

// Extra, structured data for projects. Projects themselves come from the database (or seed.ts); this file adds fields the
// database has no columns for. It is merged in by lib/projects/enrich.ts, matching on the project's slug.
//
// Rules for this file:
//  - Top-level fields (ownership, learnings, categories, ...) are REAL. Only put something there if it is true, and here it
//    comes from the resume. Unknown stays unset: an unset ownership stage renders as "not stated", never as a guess, and a
//    project with no stated status simply shows none.
//  - Anything illustrative goes in `sampleExtras`. It renders with a visible "Sample" chip, is dropped when samples are
//    turned off, and never reaches the assistant.

type Enrichable = "constraints" | "deployment" | "metrics" | "decisions" | "retrospective";

export interface ProjectExtras {
  featured?: boolean;
  status?: Project["status"];
  period?: string;
  lastDeployed?: string;
  ownership?: Project["ownership"];
  links?: Project["links"];
  categories?: string[];
  /** Which 3D cover to use in the Grid: pipeline | network | vault, or "none" for the plain CSS cover. */
  motif?: string;
  /** Which 3D schematic the Projects flight draws for this project (a key of lib/projects/exhibits.ts). */
  exhibit?: string;
  learnings?: string;
  /** Marks the project confidential: the public site shows only this summary, and the redaction happens on the server. */
  confidential?: { publicSummary: string };
  constraints?: Project["constraints"];
  deployment?: Project["deployment"];
  metrics?: Project["metrics"];
  decisions?: Project["decisions"];
  retrospective?: Project["retrospective"];
  sampleExtras?: Partial<Pick<Project, Enrichable>>;
}

/**
 * The slug is derived from the title (see slugify). These pin each title to a short, stable slug, so /projects/infradesk
 * survives a reworded title in /admin as long as the mapping is updated with it.
 */
export const TITLE_TO_SLUG: Record<string, string> = {
  "Admin Portal (Saarthi Platform)": "saarthi",
  "InfraDesk: IT Asset Request and Approval System": "infradesk",
  "Soochna: Legal Notice Management System": "soochna",
  "Sakshar: Compliance Training Platform": "sakshar",
  "Print Tracker: Print Usage Analytics Dashboard": "print-tracker",
  "DellCube: Goods Management for a Logistics Platform": "dellcube",
  "JMD: Role-based Dashboard for Shop Owners": "jmd",
  "CVEarity: CVE Management Dashboard": "cvearity",
};

const SBFC = "SBFC Finance Limited · Dec 2025 to present";

export const PROJECT_EXTRAS: Record<string, ProjectExtras> = {
  saarthi: {
    featured: true,
    period: SBFC,
    categories: ["Internal tool", "Workflow"],
    motif: "network",
    exhibit: "branch-ops",
    // The resume says "worked on" the portal and "built" the notification engine: build is claimed, ship and run are not stated.
    ownership: { build: true },
    learnings: "Learned to keep a large codebase organised and to run daily jobs safely, so users never get duplicate notifications. Also learned to write tests for business rules.",
  },
  infradesk: {
    featured: true,
    period: SBFC,
    categories: ["Internal tool", "Workflow", "Security"],
    motif: "pipeline",
    exhibit: "approval-flow",
    // The resume says the backend was deployed as a systemd-managed Gunicorn service, so ship is claimed. Run is not stated.
    ownership: { build: true, ship: true },
    learnings: "Learned how to design approval flows with several stages, keep email approval links safe, and manage user sessions securely.",
  },
  soochna: {
    featured: true,
    period: SBFC,
    categories: ["Internal tool", "Workflow", "Security"],
    motif: "vault",
    exhibit: "notice-lifecycle",
    ownership: { build: true },
    learnings: "Learned to build a secure system end to end, from database design to deployment, and to fix issues found in security reviews.",
  },
  sakshar: {
    featured: true,
    period: SBFC,
    categories: ["Internal tool", "Compliance", "AI"],
    motif: "network",
    exhibit: "training-flow",
    ownership: { build: true },
    learnings: "Learned to run scheduled jobs, generate PDF certificates, store files on cloud storage and use an AI service inside an application.",
  },
  "print-tracker": {
    period: SBFC,
    categories: ["Internal tool", "Analytics"],
    motif: "none",
    exhibit: "print-analytics",
    ownership: { build: true },
    learnings: "Learned how to make dashboards load faster using caching and database indexes, and how to package an app with Docker.",
  },
  dellcube: {
    period: "Freelance",
    categories: ["Freelance", "Logistics"],
    motif: "none",
    exhibit: "goods-table",
    ownership: { build: true },
  },
  jmd: {
    period: "Freelance",
    categories: ["Freelance", "Dashboard"],
    motif: "none",
    exhibit: "shop-dashboard",
    ownership: { build: true },
  },
  cvearity: {
    period: "Freelance",
    categories: ["Freelance", "Dashboard", "Security"],
    motif: "none",
    exhibit: "cve-log",
    ownership: { build: true },
  },
};
