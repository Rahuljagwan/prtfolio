// Turns a project's technology list into the layers of a typical request path (browser -> proxy -> application -> data),
// for the diagram on /projects/[slug]. Pure, so it is tested (scripts/projects-check.ts).
//
// Honesty rule: this is drawn FROM THE TECH LIST. It says which layers the listed technologies typically occupy; it does not
// claim to be how the project was actually deployed. The page labels it that way. A technology that fits no layer is kept
// aside (never guessed into one), and a layer nobody listed a technology for is simply not drawn.

export type LayerKey = "client" | "proxy" | "app" | "data";

export interface Layer {
  key: LayerKey;
  label: string;
  items: string[];
}

export interface Architecture {
  /** Layers in request order, only those that have at least one listed technology. */
  layers: Layer[];
  /** Hosting, containers and CI: shown as a band under the path, not as a step in it. */
  platform: string[];
  /** Listed technologies that fit no layer (languages, libraries, tools). */
  other: string[];
}

const LAYER_LABEL: Record<LayerKey, string> = { client: "Browser", proxy: "Reverse proxy", app: "Application", data: "Data" };
const ORDER: LayerKey[] = ["client", "proxy", "app", "data"];

// Matched against the lower-cased technology name. Whole-word-ish patterns so "go" does not match "MongoDB".
const RULES: { layer: LayerKey | "platform"; test: RegExp }[] = [
  { layer: "proxy", test: /\b(nginx|caddy|apache|haproxy|traefik|cloudfront|cloudflare|load balancer|alb|elb)\b/ },
  { layer: "data", test: /\b(postgres(ql)?|mysql|mariadb|sqlite|mongodb|mongo|redis|dynamodb|sql server|oracle|elasticsearch|memcached|s3)\b/ },
  { layer: "platform", test: /\b(aws|ec2|ecs|eks|lambda|docker|kubernetes|k8s|github actions|gitlab ci|jenkins|terraform|ansible|vercel|netlify|azure|gcp|linux|systemd|ci\/cd|cloudinary)\b/ },
  { layer: "client", test: /\b(react|vue|angular|svelte|next\.?js|nuxt|vite|webpack|tailwind|redux|rtk|axios|recharts|chart\.js|d3|toastify|html|css|sass)\b/ },
  { layer: "app", test: /\b(flask|django|fastapi|express|node\.?js|nestjs|gunicorn|uwsgi|uvicorn|spring|laravel|rails|celery|apscheduler|reportlab|sqlalchemy|sequelize|mongoose|prisma|socket\.io|python|java|golang|php|\.net|rust)\b/ },
];

export function architectureFor(stack: string[]): Architecture {
  const byLayer: Record<LayerKey, string[]> = { client: [], proxy: [], app: [], data: [] };
  const platform: string[] = [];
  const other: string[] = [];
  const seen = new Set<string>();

  for (const raw of stack) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const rule = RULES.find((r) => r.test.test(key));
    if (!rule) other.push(name);
    else if (rule.layer === "platform") platform.push(name);
    else byLayer[rule.layer].push(name);
  }

  return {
    layers: ORDER.filter((k) => byLayer[k].length > 0).map((k) => ({ key: k, label: LAYER_LABEL[k], items: byLayer[k] })),
    platform,
    other,
  };
}

/** One slab of the 3D rack on the Projects flight: a stack layer, the hosting band, or the leftover libraries. */
export interface RackLayer {
  label: string;
  items: string[];
}

/**
 * The layers of a project's stack, top to bottom, for the rack: the request-path layers (Browser, Reverse proxy, Application,
 * Data), then Platform (hosting and cloud services), then Libraries (technologies that fit no layer). Only layers that have a
 * listed technology appear, and nothing is invented.
 */
export function rackLayers(a: Architecture): RackLayer[] {
  const rows: RackLayer[] = a.layers.map((l) => ({ label: l.label, items: l.items }));
  if (a.platform.length) rows.push({ label: "Platform", items: a.platform });
  if (a.other.length) rows.push({ label: "Libraries", items: a.other });
  return rows;
}

/** True when there is enough to draw: a path needs at least two layers. */
export const canDrawArchitecture = (a: Architecture) => a.layers.length >= 2;

/** Plain-text description for screen readers and the figure caption. */
export function describeArchitecture(a: Architecture): string {
  const path = a.layers.map((l) => `${l.label} (${l.items.join(", ")})`).join(", then ");
  return `Typical request path for this stack: ${path}.${a.platform.length ? ` Platform: ${a.platform.join(", ")}.` : ""}`;
}
