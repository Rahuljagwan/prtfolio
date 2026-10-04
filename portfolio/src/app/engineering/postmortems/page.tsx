import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOW_SAMPLES } from "@/lib/samples";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { PageHeader, SampleNote } from "@/components/engineering/parts";
import { SampleChip } from "@/components/ui/SampleChip";
import { POSTMORTEMS, SEVERITY_LABEL, type Severity } from "@/content/postmortems";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Post-incident reviews | Rahul Jagwan",
  description: "Blameless incident reviews: timeline, root cause, fix and prevention. Illustrative examples of the format.",
  // Every review here is an illustrative sample, so the page is kept out of search indexing.
  robots: { index: false, follow: true },
};

// Amber, never red: red is reserved for the live incident sequence on the home page.
const SEVERITY_STYLE: Record<Severity, string> = {
  sev1: "border-accent bg-accent/20 text-accent",
  sev2: "border-accent/60 bg-accent/10 text-accent",
  sev3: "border-border text-muted-foreground",
};

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-1.5">
    {items.map((t) => (
      <li key={t} className="flex gap-2.5 text-sm leading-relaxed">
        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
        {t}
      </li>
    ))}
  </ul>
);

export default function PostmortemsPage() {
  if (!SHOW_SAMPLES) notFound(); // sample-only page: gone when samples are switched off
  return (
    <SubpageShell current="Engineering">
      <PageHeader eyebrow="Post-incident reviews" title="What broke, and what changed." intro="Blameless reviews focus on the system and the signals, not on who did what. Each one ends with concrete changes." sample />
      <SampleNote>These reviews are illustrative examples of the format. They are not accounts of real incidents.</SampleNote>

      <div className="mt-12 space-y-16">
        {POSTMORTEMS.map((p) => (
          <article key={p.slug} id={p.slug} className="scroll-mt-28">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-0.5 font-mono text-[11px]", SEVERITY_STYLE[p.severity])}>{SEVERITY_LABEL[p.severity]}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {p.date} · {p.duration}
              </span>
              {p.sample && <SampleChip />}
            </div>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{p.title}</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{p.summary}</p>

            <dl className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-primary">Impact</dt>
                <dd className="mt-2 text-sm leading-relaxed">{p.impact}</dd>
              </div>
              <div className="rounded-xl border border-border bg-card p-5">
                <dt className="text-xs font-medium uppercase tracking-wider text-primary">Root cause</dt>
                <dd className="mt-2 text-sm leading-relaxed">{p.rootCause}</dd>
              </div>
            </dl>

            <h3 className="mt-8 text-xs font-medium uppercase tracking-wider text-primary">Timeline</h3>
            <ol className="mt-3 space-y-3 border-l border-border pl-5">
              {p.timeline.map((e) => (
                <li key={e.time + e.text} className="relative text-sm leading-relaxed">
                  <span aria-hidden className="absolute -left-[26px] top-1.5 h-2 w-2 rounded-full border border-primary bg-background" />
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{e.time}</span>
                  {e.text}
                </li>
              ))}
            </ol>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-primary">The fix</h3>
                <p className="mt-2 text-sm leading-relaxed">{p.fix}</p>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-primary">What we changed to prevent it</h3>
                <div className="mt-2">
                  <Bullets items={p.prevention} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What went well</h3>
                <div className="mt-2">
                  <Bullets items={p.wentWell} />
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">What went badly</h3>
                <div className="mt-2">
                  <Bullets items={p.wentBadly} />
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SubpageShell>
  );
}
