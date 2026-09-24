import type { MetadataRoute } from "next";
import { getPortfolio } from "@/lib/portfolio";
import { SITE_URL } from "@/lib/site";

// Real pages only: samples are excluded, so illustrative content is never offered to search engines. With no configured
// origin there are no absolute URLs to list, so the sitemap is empty rather than wrong.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!SITE_URL) return [];
  const { projects } = await getPortfolio({ samples: false });
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/assistant`, changeFrequency: "monthly", priority: 0.4 },
    // The engineering pages that describe the site as it really is. The sample-only ones (reviews, configs, notes) are noindex and left out.
    ...["/engineering", "/engineering/how-this-site-is-built", "/engineering/pipeline", "/engineering/roadmap"].map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...projects.filter((p) => p.slug && !p.sample).map((p) => ({ url: `${SITE_URL}/projects/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
