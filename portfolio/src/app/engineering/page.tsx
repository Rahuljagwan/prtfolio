import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { SampleChip } from "@/components/ui/SampleChip";
import { PageHeader } from "@/components/engineering/parts";
import { SHOW_SAMPLES } from "@/lib/samples";

export const metadata: Metadata = {
  title: "Engineering | Rahul Jagwan",
  description: "How this site is built, incident reviews, configuration examples, a learning roadmap and a pipeline simulator.",
};

const ITEMS: { href: string; title: string; text: string; tag?: "sample" | "simulation" | "real" }[] = [
  { href: "/engineering/how-this-site-is-built", title: "How this site is built", text: "The real architecture of this site, each part with the decision behind it and the files that prove it.", tag: "real" },
  { href: "/engineering/pipeline", title: "Pipeline playground", text: "Push a release through lint, tests, staging and a canary. Break a step and roll back. A simulation of a production pipeline.", tag: "simulation" },
  { href: "/engineering/postmortems", title: "Post-incident reviews", text: "Blameless write-ups: timeline, root cause, fix, what to change. Illustrative examples of the format.", tag: "sample" },
  { href: "/engineering/configs", title: "Config gallery", text: "Sanitised Nginx, systemd and CI configuration with the reasoning annotated line by line.", tag: "sample" },
  { href: "/engineering/roadmap", title: "Learning roadmap", text: "What is done, in progress and next, on the way from software engineer toward DevOps.", tag: "real" },
  { href: "/notes", title: "Notes", text: "Short technical write-ups.", tag: "sample" },
];

export default function EngineeringHub() {
  return (
    <SubpageShell current="Engineering">
      <PageHeader eyebrow="Engineering" title="How I work, not just what I know." intro="Where the portfolio shows its workings: the architecture of this site, how incidents get reviewed, the configuration behind a deployment, and a pipeline you can break on purpose." back={{ href: "/", label: "Portfolio" }} />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2">
        {ITEMS.filter((item) => SHOW_SAMPLES || item.tag !== "sample").map((item) => (
          <li key={item.href}>
            <Link href={item.href} prefetch={false} className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
              <span className="flex items-center gap-2">
                <span className="text-lg font-semibold group-hover:text-primary">{item.title}</span>
                {item.tag === "sample" && <SampleChip />}
                {item.tag === "simulation" && <SampleChip label="Simulation" />}
                <ArrowUpRight size={16} aria-hidden className="ml-auto text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
              <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {SHOW_SAMPLES && (
        <p className="mt-10 text-sm text-muted-foreground">
          A &quot;Sample&quot; chip means the content is illustrative, written to show the format, and is not a real claim. The pages that are not marked describe this site as it actually is.
        </p>
      )}
    </SubpageShell>
  );
}
