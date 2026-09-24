import type { Project } from "@/lib/types";
import type { ProjectExtras } from "./projects-meta";

// ILLUSTRATIVE projects. They exist so the Projects section, filters, views and flight can be seen working with five to
// nine entries. Every one is flagged `sample`, renders a "Sample" chip, and is excluded from the assistant, the sitemap
// and search indexing. Replace them by adding real projects in /admin and setting NEXT_PUBLIC_SHOW_SAMPLES=0.
// The first NEXT_PUBLIC_SAMPLE_PROJECTS (default 0, since the real projects are in) are shown; the rest exist to test a nine-project layout.

const filler = (n: number) => "Confidential. ".repeat(Math.ceil(n / 14)).slice(0, n);

export interface SampleProjectDef {
  base: Pick<Project, "title" | "summary" | "role" | "highlights" | "stack" | "challenge" | "approach" | "outcome">;
  extras: ProjectExtras;
}

export const SAMPLE_PROJECTS: SampleProjectDef[] = [
  {
    base: {
      title: "Release Dashboard",
      summary: "A dashboard that shows which release each environment runs, and how long the last deploys took.",
      role: "Full-stack development, deployment and on-call",
      highlights: ["Per-environment release history", "Deploy duration and failure trends", "A guarded rollback shortcut"],
      stack: ["React", "Node.js", "PostgreSQL", "GitHub Actions"],
      challenge: "Nobody could say quickly which version was running in which environment.",
      approach: [
        "Recorded every deploy as an event from the pipeline.",
        "Built a read-only dashboard over those events.",
        "Added a guarded rollback that re-runs the previous release.",
      ],
      outcome: "Release state is visible at a glance, and rollbacks follow one documented path.",
    },
    extras: {
      status: "maintained",
      period: "2025",
      lastDeployed: "2026-08",
      ownership: { build: true, ship: true, run: true },
      categories: ["DevOps", "Internal tool"],
      motif: "pipeline",
      metrics: [
        { label: "Deploys per week", value: "6" },
        { label: "Median deploy time", value: "4 min" },
        { label: "Rollbacks last quarter", value: "1" },
      ],
      decisions: [
        {
          title: "Record events, not snapshots",
          chose: "Append-only deploy events written by the pipeline.",
          rejected: ["Polling each server for its version", "A manual release spreadsheet"],
          why: "Events give a real history and cannot drift out of date the way a polled snapshot can.",
        },
      ],
      retrospective: ["Add alerting for failed deploys instead of relying on someone watching the page."],
    },
  },
  {
    base: {
      title: "Config Audit Tool",
      summary: "Compares server configuration against an approved baseline and reports drift before it causes an incident.",
      role: "Backend development and deployment",
      highlights: ["Baseline versus live comparison", "Human-readable drift report", "Scheduled nightly runs"],
      stack: ["Python", "Flask", "PostgreSQL", "Nginx"],
      challenge: "Configuration changed by hand on servers and nobody could tell what differed from the agreed setup.",
      approach: [
        "Defined the approved baseline as versioned files.",
        "Wrote a collector that reads live configuration on a schedule.",
        "Produced a diff report that names the file, the line and the owner.",
      ],
      outcome: "Drift is found in a nightly report instead of during an outage.",
    },
    extras: {
      status: "live",
      period: "2025",
      lastDeployed: "2026-07",
      ownership: { build: true, ship: true },
      categories: ["DevOps", "Security"],
      motif: "vault",
      metrics: [
        { label: "Servers covered", value: "12" },
        { label: "Drift findings resolved", value: "31" },
      ],
    },
  },
  {
    base: {
      title: "Notification Service",
      summary: "A small service that sends email and in-app notifications for other internal systems, with retries and a delivery log.",
      role: "Backend development",
      highlights: ["Retries with backoff", "Per-recipient delivery log", "Templates managed as code"],
      stack: ["Python", "Flask", "Redis", "PostgreSQL"],
      challenge: "Each system sent its own notifications differently, with no record of what was actually delivered.",
      approach: [
        "Defined one message contract that every system uses.",
        "Queued sends and retried failures with exponential backoff.",
        "Stored a delivery record for every attempt.",
      ],
      outcome: "Delivery is consistent across systems and every message can be traced.",
    },
    extras: {
      status: "in-development",
      period: "2026",
      ownership: { build: true },
      categories: ["Backend"],
      motif: "network",
    },
  },
  {
    // Placeholder text only: it is stripped on the server and its LENGTH alone sizes the blackout bars in the UI.
    base: {
      title: "Access Review Portal",
      summary: filler(118),
      role: "Full-stack development",
      highlights: [filler(41), filler(56), filler(33)],
      stack: ["Flask", "React", "PostgreSQL"],
      challenge: filler(96),
      approach: [filler(72)],
      outcome: filler(84),
    },
    extras: {
      status: "archived",
      period: "2023",
      ownership: { build: true },
      categories: ["Security", "Fintech"],
      motif: "vault",
      confidential: { publicSummary: "An internal portal for periodic access reviews. Details are confidential." },
    },
  },
  {
    base: {
      title: "Uptime Monitor",
      summary: "Checks internal endpoints on a schedule, records response times, and raises an alert when a check fails twice in a row.",
      role: "Full-stack development, deployment and on-call",
      highlights: ["Two-strike alerting to avoid noise", "Response-time history", "One page per service"],
      stack: ["Node.js", "PostgreSQL", "Docker"],
      challenge: "Outages were reported by users before anyone on the team knew.",
      approach: [
        "Wrote lightweight scheduled checks for each endpoint.",
        "Alerted only after two consecutive failures.",
        "Kept a history so slow trends are visible before they become failures.",
      ],
      outcome: "The team hears about a failing service before its users do.",
    },
    extras: {
      status: "live",
      period: "2024",
      lastDeployed: "2026-06",
      ownership: { build: true, ship: true, run: true },
      categories: ["DevOps", "Observability"],
      motif: "network",
      metrics: [{ label: "Endpoints watched", value: "18" }],
    },
  },
  {
    base: {
      title: "Audit Log Explorer",
      summary: "A searchable view over application audit logs so reviewers can answer who changed what, and when.",
      role: "Full-stack development",
      highlights: ["Filter by user, action and time", "Export for reviewers", "Read-only by design"],
      stack: ["React", "Flask", "PostgreSQL"],
      challenge: "Answering a simple audit question meant asking an engineer to query the database.",
      approach: [
        "Normalised events from several systems into one schema.",
        "Built filters that match how reviewers ask questions.",
        "Made the whole tool read-only so it can be trusted.",
      ],
      outcome: "Reviewers answer their own audit questions without engineering help.",
    },
    extras: {
      status: "maintained",
      period: "2024",
      lastDeployed: "2026-05",
      ownership: { build: true, ship: true },
      categories: ["Security", "Internal tool"],
      motif: "vault",
    },
  },
];
