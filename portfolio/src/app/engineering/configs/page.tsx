import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOW_SAMPLES } from "@/lib/samples";
import Link from "next/link";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { CodeBlock } from "@/components/engineering/CodeBlock";
import { PageHeader, SampleNote } from "@/components/engineering/parts";
import { SampleChip } from "@/components/ui/SampleChip";
import { CONFIGS } from "@/content/configs";
import { getPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Config gallery | Rahul Jagwan",
  description: "Sanitised Nginx, systemd and CI configuration, annotated line by line.",
  // Every example is an illustrative sample, so the page is kept out of search indexing.
  robots: { index: false, follow: true },
};

export default async function ConfigGalleryPage() {
  if (!SHOW_SAMPLES) notFound(); // sample-only page: gone when samples are switched off
  const { projects } = await getPortfolio();
  const slugs = new Set(projects.map((p) => p.slug)); // only link to projects that exist
  return (
    <SubpageShell current="Engineering">
      <PageHeader eyebrow="Config gallery" title="The configuration behind a deployment." intro="Small, sanitised examples with the reasoning written next to the lines it is about." sample />
      <SampleNote>These files are illustrative. Names, paths and hosts are made up, and they are not copies of any real system&apos;s configuration.</SampleNote>

      <div className="mt-12 space-y-16">
        {CONFIGS.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-28">
            <h2 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
              {c.title}
              {c.sample && <SampleChip />}
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">{c.blurb}</p>
            {c.project && slugs.has(c.project) && (
              <p className="mt-2 text-sm text-muted-foreground">
                Illustrates the kind of setup described in{" "}
                <Link href={`/projects/${c.project}`} prefetch={false} className="text-primary hover:underline">
                  this project
                </Link>
                .
              </p>
            )}
            <div className="mt-5">
              <CodeBlock code={c.code} lang={c.lang} filename={c.filename} notes={c.notes} />
            </div>
          </section>
        ))}
      </div>
    </SubpageShell>
  );
}
