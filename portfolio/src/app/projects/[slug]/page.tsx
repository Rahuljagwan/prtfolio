import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { ProjectPage } from "@/components/projects/ProjectPage";
import { getPortfolio } from "@/lib/portfolio";
import { SITE_NAME } from "@/lib/site";

interface Params {
  params: { slug: string };
}

// Slugs come from the enriched project list (DB or seed, plus labelled samples). Unknown slugs 404; a project added in
// /admin after the build is rendered on first request (dynamicParams) and refreshed by publish() -> revalidatePath.
export async function generateStaticParams() {
  const { projects } = await getPortfolio();
  return projects.filter((p) => p.slug).map((p) => ({ slug: p.slug as string }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { projects, profile } = await getPortfolio();
  const p = projects.find((x) => x.slug === params.slug);
  if (!p) return { title: "Project not found" };
  const title = `${p.title} | ${profile.name}`;
  return {
    title,
    description: p.summary,
    // A wholly illustrative project must never be indexed or shared as if it were real work.
    robots: p.sample ? { index: false, follow: false } : undefined,
    openGraph: p.sample ? undefined : { title, description: p.summary, type: "article", siteName: SITE_NAME },
    twitter: p.sample ? undefined : { card: "summary_large_image", title, description: p.summary },
  };
}

export default async function ProjectRoute({ params }: Params) {
  const { projects, profile } = await getPortfolio();
  const i = projects.findIndex((x) => x.slug === params.slug);
  if (i < 0) notFound();
  const p = projects[i];
  const around = (k: number) => (projects[k]?.slug ? { slug: projects[k].slug as string, title: projects[k].title } : undefined);

  // Structured data only for real work. Illustrative projects are noindex and carry no schema.
  const jsonLd = p.sample
    ? null
    : {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: p.title,
        description: p.summary,
        creator: { "@type": "Person", name: profile.name },
        keywords: p.stack.join(", "),
        ...(p.links?.live ? { url: p.links.live } : {}),
      };

  return (
    <SubpageShell current="Project">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\u003c") }} />}
      <ProjectPage project={p} prev={around(i - 1)} next={around(i + 1)} />
    </SubpageShell>
  );
}
