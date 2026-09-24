// The learning roadmap board. The big milestones come straight from the portfolio's own Journey section (real, and editable
// in /admin), so they are not repeated here. These are the finer-grained items under them. They are ILLUSTRATIVE
// (sample: true) until the author replaces them with their real list; the page marks each one "Sample". No percentages:
// an item is done, in progress or next, and nothing pretends to more precision than that.

export type RoadmapStatus = "done" | "current" | "next";
export type RoadmapArea = "Containers" | "CI/CD" | "Cloud" | "Observability" | "Operations";

export interface RoadmapItem {
  id: string;
  area: RoadmapArea;
  title: string;
  note: string;
  status: RoadmapStatus;
  sample: true;
}

export const ROADMAP_AREAS: RoadmapArea[] = ["Containers", "CI/CD", "Cloud", "Observability", "Operations"];

export const ROADMAP: RoadmapItem[] = [
  { id: "r-systemd", area: "Operations", title: "Run services under systemd", note: "Units, restarts, journald.", status: "done", sample: true },
  { id: "r-nginx", area: "Operations", title: "Reverse proxy with Nginx", note: "Static files, upstreams, forwarded headers.", status: "done", sample: true },
  { id: "r-docker-basics", area: "Containers", title: "Package a service with Docker", note: "Multi-stage builds, small images, non-root user.", status: "current", sample: true },
  { id: "r-compose", area: "Containers", title: "Local stacks with Compose", note: "App, database and proxy started with one command.", status: "current", sample: true },
  { id: "r-ci", area: "CI/CD", title: "Tests on every pull request", note: "A required check before merge.", status: "current", sample: true },
  { id: "r-cd", area: "CI/CD", title: "Automated deploy with rollback", note: "One-step release and a one-step way back.", status: "next", sample: true },
  { id: "r-aws-iam", area: "Cloud", title: "AWS IAM done properly", note: "Least privilege, roles instead of long-lived keys.", status: "next", sample: true },
  { id: "r-iac", area: "Cloud", title: "Infrastructure as code", note: "Describe the environment in files, not clicks.", status: "next", sample: true },
  { id: "r-metrics", area: "Observability", title: "Metrics and dashboards", note: "The four golden signals for one real service.", status: "next", sample: true },
  { id: "r-alerts", area: "Observability", title: "Alert on outcomes, not processes", note: "Page on what a user would feel.", status: "next", sample: true },
];
