"use client";

import { useMemo } from "react";
import { Chip } from "@/components/ui/Chip";
import { SampleChip } from "@/components/ui/SampleChip";
import { cn } from "@/lib/utils";
import { hasCaseStudy, timelineGroup } from "@/lib/projects/utils";
import type { Project } from "@/lib/types";
import { OwnershipBar, StatusChip, statusDotClass } from "./parts";

const UNDATED = "Not dated";

/**
 * Projects grouped by the period they state (an employer and dates, "Freelance", or a year), in the order the list gives them.
 * A project with no period and no date goes in a final "Not dated" group rather than being given a made-up one.
 */
export function TimelineView({ projects }: { projects: Project[] }) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, Project[]>();
    for (const p of projects) {
      const g = timelineGroup(p);
      byGroup.set(g, [...(byGroup.get(g) ?? []), p]);
    }
    const keys = [...byGroup.keys()].sort((a, b) => (a === UNDATED ? 1 : b === UNDATED ? -1 : 0)); // stable: list order otherwise
    return keys.map((k) => ({ year: k, items: byGroup.get(k) ?? [] }));
  }, [projects]);

  return (
    <ol className="relative ml-1 space-y-10 border-l border-border pl-7 sm:pl-9">
      {groups.map(({ year, items }) => (
        <li key={year} className="relative">
          <span aria-hidden className="absolute -left-[34px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background sm:-left-[42px]" />
          <h3 className="font-mono text-sm font-medium text-primary">{year}</h3>
          <ul className="mt-4 space-y-3">
            {items.map((p) => {
              const caseStudy = hasCaseStudy(p);
              return (
                <li key={p.id}>
                  <div
                    data-project-card
                    data-project-id={p.id}
                    data-has-case={caseStudy ? "true" : undefined}
                    tabIndex={-1}
                    className={cn(
                      "rounded-xl border border-border bg-card p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
                      caseStudy && "cursor-pointer hover:border-primary/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span aria-hidden className={cn("h-2 w-2 rounded-full", statusDotClass(p.status))} />
                      <h4 className="font-semibold">{p.title}</h4>
                      {p.sample && <SampleChip />}
                      <StatusChip project={p} className="ml-auto" />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.summary}</p>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
                      <div className="flex flex-wrap gap-1.5">
                        {p.stack.slice(0, 4).map((s) => (
                          <Chip key={s}>{s}</Chip>
                        ))}
                      </div>
                      <OwnershipBar ownership={p.ownership} className="w-40" />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
