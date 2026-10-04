import type { Metadata } from "next";
import Link from "next/link";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { PageHeader } from "@/components/engineering/parts";
import { SampleChip } from "@/components/ui/SampleChip";
import { ROADMAP, ROADMAP_AREAS, type RoadmapStatus } from "@/content/roadmap";
import { getPortfolio } from "@/lib/portfolio";
import { SHOW_SAMPLES } from "@/lib/samples";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Learning roadmap | Rahul Jagwan",
  description: "From software engineer toward DevOps: what is done, what is in progress and what is next.",
};

const COLUMNS: { status: RoadmapStatus; label: string; dot: string }[] = [
  { status: "done", label: "Done", dot: "bg-primary" },
  { status: "current", label: "In progress", dot: "bg-accent" },
  { status: "next", label: "Next", dot: "bg-border" },
];

export default async function RoadmapPage() {
  const { journey } = await getPortfolio();

  return (
    <SubpageShell current="Engineering">
      <PageHeader eyebrow="Roadmap" title="From full stack toward DevOps." intro="Where I have been, what I am working on, and what comes next. No percentages: an item is done, in progress, or next." />

      <section className="mt-12">
        <h2 className="text-xs font-medium uppercase tracking-wider text-primary">The milestones</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are the milestones from the{" "}
          <Link href="/#journey" prefetch={false} className="text-primary hover:underline">
            Journey section
          </Link>{" "}
          on the home page.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.status}>
              <h3 className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                <span aria-hidden className={cn("h-2 w-2 rounded-full", col.dot)} />
                {col.label}
              </h3>
              <ul className="mt-3 space-y-3">
                {journey.milestones
                  .filter((m) => m.status === col.status)
                  .map((m) => (
                    <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                      <p className="font-medium">{m.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {SHOW_SAMPLES && (
      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
          The detail, by area <SampleChip />
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Finer-grained items under those milestones. Illustrative until replaced with the real list.</p>
        <div className="mt-4 space-y-8">
          {ROADMAP_AREAS.map((area) => {
            const items = ROADMAP.filter((r) => r.area === area);
            if (items.length === 0) return null;
            return (
              <div key={area}>
                <h3 className="text-sm font-semibold">{area}</h3>
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {items.map((r) => {
                    const col = COLUMNS.find((c) => c.status === r.status)!;
                    return (
                      <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                        <p className="flex items-center gap-2 font-medium">
                          <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", col.dot)} />
                          {r.title}
                          <span className="ml-auto font-mono text-[11px] font-normal text-muted-foreground">{col.label}</span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
      )}
    </SubpageShell>
  );
}
