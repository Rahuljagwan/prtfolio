// The real architecture of THIS site, for /engineering/how-this-site-is-built. Every node states something that is true of
// the code, and points at the files that prove it (`refs`, checked to exist by scripts/engineering-check.ts, so this page
// cannot drift into describing files that are gone). Nothing here is illustrative, so nothing is marked "Sample".

export type NodeId = "browser" | "host" | "pages" | "content" | "db" | "routes" | "admin" | "world";

export interface ArchNode {
  id: NodeId;
  label: string;
  /** Second line in the box. */
  sub: string;
  /** Top-left of the box in the diagram space (see DIAGRAM). */
  x: number;
  y: number;
  /** What it is and what it does. */
  summary: string;
  /** The decision behind it, and why. */
  decision: string;
  /** Files (relative to the project root) that implement or document it. */
  refs: string[];
}

export interface ArchEdge {
  from: NodeId;
  to: NodeId;
  label?: string;
}

/** The diagram's coordinate space. */
export const DIAGRAM = { w: 1000, h: 340 } as const;
export const NODE_W = 140;
export const NODE_H = 66;

export const NODES: ArchNode[] = [
  {
    id: "browser",
    label: "Browser",
    sub: "HTML first",
    x: 35,
    y: 40,
    summary: "A visitor receives server-rendered HTML, so the text, the navigation and search engines never wait for JavaScript.",
    decision:
      "The 3D world is an enhancement, not the page. It is only fetched when a strict check passes: not reduced-motion, not a touch device, a viewport of 900 px or wider, no data-saver, and at least 4 GB of memory and 4 CPU cores where the browser reports them. Everyone else gets the complete static page.",
    refs: ["src/lib/world/capability.ts", "src/components/world/WorldCanvas.tsx"],
  },
  {
    id: "host",
    label: "Host",
    sub: "edge + functions",
    x: 235,
    y: 40,
    summary: "Serves the prerendered pages from a CDN and runs the few dynamic routes as serverless functions.",
    decision:
      "The deployment plan is Vercel for the app and Neon for Postgres, with the project rooted at the portfolio folder. The security headers (HSTS, nosniff, referrer and permissions policy, frame-ancestors) are set in the Next.js config, so they are part of the code and not a dashboard setting somebody has to remember.",
    refs: ["docs/DEPLOY.md", "next.config.mjs"],
  },
  {
    id: "pages",
    label: "Static pages",
    sub: "prerendered",
    x: 435,
    y: 40,
    summary: "The home page and every project page are generated at build time, and regenerated on demand.",
    decision:
      "Static prerendering keeps the page fast and independent of the database at request time. When content changes, an admin save calls revalidatePath for the affected routes, so the site updates without a redeploy.",
    refs: ["src/app/page.tsx", "src/app/projects/[slug]/page.tsx", "src/lib/admin/api.ts"],
  },
  {
    id: "content",
    label: "Content layer",
    sub: "getPortfolio()",
    x: 635,
    y: 40,
    summary: "One function returns everything the site shows: database rows, or the built-in seed content.",
    decision:
      "If there is no database, or it cannot be reached, the site falls back to seed content instead of going blank (this is how the site runs on a machine that cannot reach the database). Static content modules add extra fields by slug, and every invented entry is flagged as a sample and kept out of the assistant and the sitemap.",
    refs: ["src/lib/portfolio.ts", "src/content/seed.ts", "src/lib/projects/enrich.ts"],
  },
  {
    id: "db",
    label: "Postgres",
    sub: "Neon + Prisma",
    x: 835,
    y: 40,
    summary: "The content store, reached through Prisma.",
    decision:
      "Two connection strings on purpose: a pooled one for the running site (serverless functions open many short connections), and a direct one used only for migrations, which cannot go through a pooler.",
    refs: ["prisma/schema.prisma", "src/lib/db.ts", "docs/DEPLOY.md"],
  },
  {
    id: "routes",
    label: "Server routes",
    sub: "/api/*",
    x: 435,
    y: 250,
    summary: "The assistant, the health check and the version endpoint, plus the admin API.",
    decision:
      "The assistant answers from the portfolio's own content with local retrieval, so it makes no external calls unless a key is configured, and it is rate limited. The health endpoint is liveness by default and only touches the database when asked (?deep=1), with a timeout and a short cache, so it cannot be used to hammer it.",
    refs: ["src/app/api/assistant/route.ts", "src/app/api/health/route.ts", "src/app/api/version/route.ts", "src/lib/rate-limit.ts"],
  },
  {
    id: "admin",
    label: "Admin CMS",
    sub: "/admin",
    x: 835,
    y: 250,
    summary: "The editor for every piece of content on the site.",
    decision:
      "A password login and a signed session cookie. The rate limiter is per server instance, which slows guessing but is not a global cap; the deploy notes say so, and recommend a long password.",
    refs: ["src/app/admin/page.tsx", "src/lib/auth.ts", "src/lib/admin/api.ts"],
  },
  {
    id: "world",
    label: "3D world",
    sub: "lazy chunk",
    x: 35,
    y: 250,
    summary: "One persistent canvas behind the page. The sections are ordinary HTML on top of it.",
    decision:
      "It renders on demand: frames are drawn while the visitor scrolls or moves the pointer and briefly after, and never otherwise. The pixel ratio is capped, a watchdog lowers it if the frame rate drops, and any error or lost context simply leaves the static page in place.",
    refs: ["src/components/world/WorldScene.tsx", "src/components/world/scene/useRenderScheduler.ts", "docs/WORLD.md"],
  },
];

export const EDGES: ArchEdge[] = [
  { from: "browser", to: "host", label: "request" },
  { from: "host", to: "pages", label: "serves" },
  { from: "pages", to: "content", label: "at build" },
  { from: "content", to: "db", label: "reads" },
  { from: "browser", to: "world", label: "lazy" },
  { from: "host", to: "routes", label: "runs" },
  { from: "routes", to: "content" },
  { from: "admin", to: "db", label: "writes" },
  { from: "admin", to: "pages", label: "revalidates" },
];

/** What the Host node says about this particular build, without ever guessing. */
export function hostNote(deployEnv: string): string {
  return deployEnv
    ? `This build was made in the host's "${deployEnv}" environment.`
    : "This build is a local build, so this page does not claim a live deployment. The plan in docs/DEPLOY.md is Vercel and Neon.";
}
