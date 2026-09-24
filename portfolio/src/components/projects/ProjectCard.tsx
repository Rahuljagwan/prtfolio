"use client";

import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SampleChip } from "@/components/ui/SampleChip";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/utils";
import { hasCaseStudy, motifOf } from "@/lib/projects/utils";
import type { Project } from "@/lib/types";
import { Cover, LiveDot, MetricsStrip, OwnershipBar, RedactedSummary, StatusChip } from "./parts";

const COMPACT_STACK = 5;

interface ProjectCardProps {
  project: Project;
  /** Position in the FULL list (not the filtered one): it seeds the cover gradient and the default 3D motif, so filtering never reshuffles them. */
  index: number;
  variant: "featured" | "compact";
  /** Featured rows alternate which side the cover is on. */
  flip?: boolean;
}

/**
 * One project. `data-project-card` / `data-project-id` / `data-has-case` are the contract with CaseStudyLayer (click
 * delegation opens the case study) and with the 3D pods (they find the cover window inside the card and key on the id).
 */
export function ProjectCard({ project: p, index, variant, flip }: ProjectCardProps) {
  const caseStudy = hasCaseStudy(p);
  const featured = variant === "featured";
  const motif = motifOf(p, index);
  const redacted = !!p.confidential;
  const stack = featured ? p.stack : p.stack.slice(0, COMPACT_STACK);
  const moreStack = p.stack.length - stack.length;

  return (
    <SpotlightCard
      tilt
      tabIndex={-1}
      data-project-card
      data-project-id={p.id}
      data-has-case={caseStudy ? "true" : undefined}
      className={cn(
        "flex h-full flex-col outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        caseStudy && "cursor-pointer",
        featured && "lg:grid lg:grid-cols-5",
      )}
    >
      <Cover
        index={index}
        motif={motif}
        stageKey={p.id}
        className={cn(featured ? "h-52 lg:col-span-2 lg:h-full lg:min-h-[21rem] lg:border-b-0" : "h-36", featured && (flip ? "lg:order-2 lg:border-l" : "lg:border-r"))}
      />

      <div className={cn("flex flex-1 flex-col bg-card p-6", featured && "lg:col-span-3 lg:p-9")}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip project={p} />
          {p.sample && <SampleChip />}
        </div>

        <h3 className={cn("mt-3 font-semibold leading-snug", featured ? "text-2xl" : "text-lg")}>{p.title}</h3>

        {redacted ? (
          <RedactedSummary publicSummary={p.confidential!.publicSummary} bars={p.confidential!.bars} />
        ) : (
          <p className={cn("mt-3 text-sm leading-relaxed text-muted-foreground", !featured && "line-clamp-3")}>{p.summary}</p>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">Role</span> · <span className="text-foreground">{p.role}</span>
        </p>

        <OwnershipBar ownership={p.ownership} className={cn("mt-5", featured && "max-w-sm")} />

        {featured && !redacted && p.highlights.length > 0 && (
          <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
            {p.highlights.map((h) => (
              <li key={h} className="flex gap-2.5">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {h}
              </li>
            ))}
          </ul>
        )}

        {featured && <MetricsStrip metrics={p.metrics} sample={p.sampleFields?.includes("metrics")} className="mt-6" />}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-6">
          {stack.map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
          {moreStack > 0 && <Chip className="bg-transparent">+{moreStack}</Chip>}
        </div>

        {(caseStudy || p.links?.live) && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
            {caseStudy && (
              <button
                type="button"
                data-case-open
                aria-haspopup="dialog"
                aria-label={`Open case study: ${p.title}`}
                className="group/cs inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Case study
                <ArrowUpRight size={15} aria-hidden className="transition-transform group-hover/cs:-translate-y-0.5 group-hover/cs:translate-x-0.5" />
              </button>
            )}
            {p.links?.live && (
              <span data-no-case className="inline-flex items-center gap-3">
                <a
                  href={p.links.live}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Live demo <ExternalLink size={13} aria-hidden />
                </a>
                <LiveDot url={p.links.live} />
              </span>
            )}
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
