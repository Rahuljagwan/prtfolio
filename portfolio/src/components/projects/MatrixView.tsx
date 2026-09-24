"use client";

import { useMemo } from "react";
import { SampleChip } from "@/components/ui/SampleChip";
import { cn } from "@/lib/utils";
import { hasCaseStudy, matrixColumns } from "@/lib/projects/utils";
import type { Project } from "@/lib/types";
import { statusDotClass } from "./parts";

/**
 * Projects (rows) by technology (columns): a dot where a project uses a technology. Breadth at a glance. Columns come from
 * the FULL project list, so they stay put while filters change which rows are shown.
 */
export function MatrixView({ projects, all }: { projects: Project[]; all: Project[] }) {
  const cols = useMemo(() => matrixColumns(all), [all]);
  const totals = useMemo(() => cols.map((c) => projects.filter((p) => p.stack.includes(c)).length), [cols, projects]);

  return (
    <div className="thin-scroll overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Projects by technology. A dot means the project uses that technology.</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Project
            </th>
            {cols.map((c) => (
              <th key={c} scope="col" className="h-28 px-1 pb-3 text-center align-bottom">
                <span className="inline-block rotate-180 text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">{c}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const caseStudy = hasCaseStudy(p);
            return (
              <tr
                key={p.id}
                tabIndex={caseStudy ? 0 : -1}
                data-project-card
                data-project-id={p.id}
                data-has-case={caseStudy ? "true" : undefined}
                onKeyDown={(e) => e.key === "Enter" && caseStudy && e.currentTarget.click()}
                className={cn(
                  "border-t border-border outline-none focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
                  caseStudy && "cursor-pointer hover:bg-muted/50",
                )}
              >
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass(p.status))} />
                    <span>{p.title}</span>
                    {p.sample && <SampleChip />}
                  </span>
                </th>
                {cols.map((c) => (
                  <td key={c} className="px-1 py-3 text-center">
                    {p.stack.includes(c) ? (
                      <>
                        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                        <span className="sr-only">Uses {c}</span>
                      </>
                    ) : (
                      <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-border" />
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Projects using it
            </th>
            {totals.map((n, i) => (
              <td key={cols[i]} className="px-1 py-3 text-center font-mono text-xs text-muted-foreground">
                {n}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
