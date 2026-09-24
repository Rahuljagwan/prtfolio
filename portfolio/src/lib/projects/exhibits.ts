// The per-project 3D schematics on the Projects flight ("exhibits"). Each real project has one that shows what that project does,
// drawn from its resume description, not a generic picture of its tech. This file is pure (no three.js): the keys, the caption
// shown beside each, and the component file that draws it, so the DOM side and the tests can use them without loading the 3D.

export const EXHIBIT_KEYS = ["branch-ops", "approval-flow", "notice-lifecycle", "training-flow", "print-analytics", "goods-table", "shop-dashboard", "cve-log"] as const;
export type ExhibitKey = (typeof EXHIBIT_KEYS)[number];

export interface ExhibitInfo {
  /** File in src/components/world/scene/exhibits/ (without .tsx) that draws it. */
  file: string;
  /** One sentence for the text panel: what the schematic on the right shows. */
  caption: string;
}

export const EXHIBITS: Record<ExhibitKey, ExhibitInfo> = {
  "branch-ops": {
    file: "BranchOps",
    caption: "The portal's modules around one hub, and scope-based access: at any moment a user sees only the part that belongs to their branches.",
  },
  "approval-flow": {
    file: "ApprovalFlow",
    caption: "A request moving through the three approval stages, with a secure approve / reject email at each and an SLA timer that escalates overdue requests.",
  },
  "notice-lifecycle": {
    file: "NoticeLifecycle",
    caption: "A legal notice from intake to closure approval: SLA reminders, an overdue alert and an escalation chain on the way, and every step written to the audit trail.",
  },
  "training-flow": {
    file: "TrainingFlow",
    caption: "A training module assigned by an admin, watched and quizzed (the questions written by an AWS Bedrock agent), then certified as a PDF, with a daily reminder.",
  },
  "print-analytics": {
    file: "PrintAnalytics",
    caption: "The dashboard answering from a Redis cache, and going to PostgreSQL only on a miss, whose result is then cached.",
  },
  "goods-table": {
    file: "GoodsTable",
    caption: "The goods list with debounced search, server-side pagination, dynamic item masters and a drawer with the selected item's detail.",
  },
  "shop-dashboard": {
    file: "ShopDashboard",
    caption: "The shop owner's day in one role-based dashboard: order booking, employees and salary, stock, offers, and analytics with live trends.",
  },
  "cve-log": {
    file: "CveLog",
    caption: "The CVE log with search, sort and filtering by severity: the matching rows light up and the rest fall back.",
  },
};

export const isExhibitKey = (key: string | undefined | null): key is ExhibitKey => !!key && (EXHIBIT_KEYS as readonly string[]).includes(key);

/** The caption for a project's schematic, or undefined when it has none (it then gets the generic stack rack instead). */
export const captionFor = (key: string | undefined | null): string | undefined => (isExhibitKey(key) ? EXHIBITS[key].caption : undefined);
