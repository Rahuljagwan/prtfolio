import { SHOW_SAMPLES } from "@/lib/samples";

// The site's routes outside the home page, defined once for the palette, the terminal and the footer.
// scripts/commands-check.ts verifies that every path here has a real page behind it.

export interface PageRef {
  id: string;
  title: string;
  path: string;
  /** Extra words the terminal's `open` accepts. */
  aliases: string[];
  /** The page is illustrative sample content (shown as "sample" in listings). */
  sample?: boolean;
}

const ALL_PAGES: PageRef[] = [
  { id: "engineering", title: "Engineering hub", path: "/engineering", aliases: ["eng"] },
  { id: "built", title: "How this site is built", path: "/engineering/how-this-site-is-built", aliases: ["how-this-site-is-built", "architecture", "how"] },
  { id: "pipeline", title: "Pipeline playground", path: "/engineering/pipeline", aliases: ["playground", "deploy"] },
  { id: "postmortems", title: "Post-incident reviews", path: "/engineering/postmortems", aliases: ["incidents", "reviews"], sample: true },
  { id: "configs", title: "Config gallery", path: "/engineering/configs", aliases: ["config", "gallery"], sample: true },
  { id: "roadmap", title: "Learning roadmap", path: "/engineering/roadmap", aliases: ["learning"] },
  { id: "notes", title: "Notes", path: "/notes", aliases: ["writing", "blog"], sample: true },
  { id: "assistant", title: "Ask the assistant", path: "/assistant", aliases: ["ask", "chat"] },
];

/** The pages the site offers. With samples switched off (see lib/samples.ts) the sample-only pages are not offered anywhere: not in the palette, the terminal or the footer. */
export const PAGES: PageRef[] = ALL_PAGES.filter((p) => SHOW_SAMPLES || !p.sample);

/** Finds a page by id, alias or path (case-insensitive). */
export function findPage(query: string): PageRef | undefined {
  const q = query.trim().toLowerCase().replace(/^\/+/, "");
  return PAGES.find((p) => p.id === q || p.aliases.includes(q) || p.path.replace(/^\/+/, "") === q);
}
