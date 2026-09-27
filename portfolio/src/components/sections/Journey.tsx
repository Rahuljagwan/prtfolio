import { Check } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";
import { TimelineProgress } from "./TimelineProgress";
import type { Journey as JourneyData, MilestoneStatus } from "@/lib/types";

const STATUS: Record<MilestoneStatus, string> = { done: "Done", current: "In progress", next: "Up next" };

/**
 * "Path into Automation" is a pipeline. The story opens it, a From -> Now line sums it up, and the milestones are stages on a
 * central spine, alternating sides, each with a node that lights as the line reaches it (done: filled; in progress: amber;
 * up next: dashed and hollow). The From -> Now line is derived from the milestones, so editing them updates it too.
 *
 * The motion is the section's original one, kept on purpose: the heading and story fade up as they enter, the spine draws itself
 * as you scroll and lights each node when it arrives, and every stage slides in from the right with a slight scale as you scroll
 * it into view (data-assemble-card, driven by ScrollJourney).
 */
export function Journey({ journey }: { journey: JourneyData }) {
  const { milestones } = journey;
  const from = milestones[0];
  const now = [...milestones].reverse().find((m) => m.status === "current") ?? milestones[milestones.length - 1];

  return (
    <SectionShell id="journey">
      <div className="wrap">
        <div className="grid items-end gap-x-16 gap-y-10 lg:grid-cols-12">
          <div className="veil veil-l lg:col-span-7">
            <Reveal>
              <p className="chapter">
                <span className="chapter-n">04</span>
                <span aria-hidden className="chapter-rule" />
                <span>Path into automation</span>
              </p>
              <h2 className="headline mt-7 max-w-3xl text-5xl md:text-7xl">{journey.heading}</h2>
            </Reveal>
          </div>
          <div className="veil veil-r space-y-5 text-lg leading-relaxed text-muted-foreground lg:col-span-5">
            {journey.story.map((p, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <p>{p}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {from && now && from.id !== now.id && (
          <Reveal delay={0.16} className="mt-20 md:mt-28">
            <div className="veil veil-soft flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <p className="mono-label">From</p>
                <p className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{from.title}</p>
              </div>
              <span aria-hidden className="flow-line hidden sm:block" />
              <div className="sm:text-right">
                <p className="mono-label text-primary">Now</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-primary md:text-2xl">{now.title}</p>
              </div>
            </div>
          </Reveal>
        )}

        <div className="relative mt-20 md:mt-28">
          <TimelineProgress className="left-[1.125rem] md:left-1/2" />
          <ol className="pipeline grid gap-y-16 md:gap-y-24">
            {milestones.map((m, i) => (
              <li key={m.id} className={cn("stage", i % 2 === 0 ? "stage-l" : "stage-r")}>
                <span aria-hidden data-timeline-dot data-status={m.status} className="stage-node">
                  {m.status === "done" && <Check size={15} strokeWidth={3} />}
                  {m.status === "current" && <span className="h-2 w-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
                  {m.status === "next" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>

                <p className="stage-when mono-label">{m.period}</p>

                <Reveal className="stage-body">
                  <div data-assemble-card className="veil veil-soft">
                    <p className="mono-label">
                      <span className={cn(m.status === "done" && "text-primary", m.status === "current" && "text-accent")}>{STATUS[m.status]}</span>
                      <span className="stage-inline-when"> · {m.period}</span>
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{m.title}</h3>
                    <p className={cn("mt-3 max-w-xl leading-relaxed text-muted-foreground", i % 2 === 0 && "md:ml-auto")}>{m.description}</p>
                    {m.tags.length > 0 && (
                      <div className="stage-tags mt-5 flex flex-wrap gap-2">
                        {m.tags.map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    )}
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}
