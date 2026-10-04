import { ArrowDown, Check } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/utils";
import { TimelineProgress } from "./TimelineProgress";
import type { Journey as JourneyData, MilestoneStatus } from "@/lib/types";

const STATUS: Record<MilestoneStatus, { label: string; chip: string }> = {
  done: { label: "Done", chip: "bg-primary/10 text-primary" },
  current: { label: "In progress", chip: "bg-accent/15 text-accent" },
  next: { label: "Up next", chip: "border border-dashed border-border text-muted-foreground" },
};

/**
 * "Path into Automation": a short story on the left (sticky on large screens) and the milestones as a pipeline
 * on the right. The connecting line draws as you scroll (shared with the Experience timeline).
 * The From -> Now summary is derived from the milestones, so editing them updates it too.
 */
export function Journey({ journey }: { journey: JourneyData }) {
  const { milestones } = journey;
  const from = milestones[0];
  const now = [...milestones].reverse().find((m) => m.status === "current") ?? milestones[milestones.length - 1];

  return (
    <Section id="journey" eyebrow="Path into automation" title={journey.heading}>
      <div className="grid gap-12 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-28">
            <div className="space-y-5 text-lg leading-relaxed text-muted-foreground">
              {journey.story.map((p, i) => (
                <Reveal key={i} delay={i * 0.08}>
                  <p>{p}</p>
                </Reveal>
              ))}
            </div>

            {from && now && from.id !== now.id && (
              <Reveal delay={0.16} className="mt-8">
                <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">From</p>
                  <p className="mt-1 font-medium">{from.title}</p>
                  <ArrowDown size={16} className="my-3 text-primary" aria-hidden />
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Now</p>
                  <p className="mt-1 font-medium text-primary">{now.title}</p>
                </div>
              </Reveal>
            )}
          </div>
        </div>

        <div className="relative lg:col-span-3">
          <TimelineProgress />
          <ol className="space-y-6 pl-8 md:pl-12">
            {milestones.map((m) => {
              const st = STATUS[m.status];
              return (
                <li key={m.id} className="relative">
                  <span
                    aria-hidden
                    data-timeline-dot
                    className={cn(
                      "timeline-dot absolute top-7 h-3 w-3 rounded-full border-2 border-primary bg-background",
                      m.status === "next" && "is-next border-dashed",
                    )}
                  />
                  <Reveal>
                    <SpotlightCard data-assemble-card className={cn("p-6", m.status === "current" && "border-primary/50", m.status === "next" && "border-dashed")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", st.chip)}>
                          {m.status === "done" && <Check size={12} aria-hidden />}
                          {m.status === "current" && (
                            <span className="relative flex h-2 w-2" aria-hidden>
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                            </span>
                          )}
                          {st.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{m.period}</span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">{m.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.description}</p>
                      {m.tags.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {m.tags.map((t) => (
                            <Chip key={t}>{t}</Chip>
                          ))}
                        </div>
                      )}
                    </SpotlightCard>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Section>
  );
}
