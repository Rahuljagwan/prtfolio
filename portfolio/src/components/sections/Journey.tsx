import { Check } from "lucide-react";
import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import { TimelineProgress } from "./TimelineProgress";
import { JourneyIndex } from "./JourneyIndex";
import type { Journey as JourneyData, MilestoneStatus } from "@/lib/types";

const STATUS: Record<MilestoneStatus, string> = { done: "Shipped", current: "In progress", next: "Up next" };

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
const roman = (n: number) => ROMAN[n] ?? String(n);

/**
 * "My path" as a ledger of stages. The story opens it, a route plate sums it up (where it started, where it is now, how
 * many stages have shipped), and the stages follow as plates on one spine, each numbered in Roman numerals, with a sticky index beside
 * them that follows the one being read. The plates, the index, the From -> Now plate and the shipped count are all derived from the
 * milestones, so editing them in /admin updates all of it.
 *
 * Motion (CSS and one small observer, see "Journey" in globals.css): each plate rises in, its title lifts out of a mask, its numeral and
 * hairline draw themselves; the spine fills as you scroll and lights each node when it arrives; the current stage keeps a live pulse;
 * the pointer carries a soft glow across a plate; the route plate draws its line from "From" to "Now".
 */
export function Journey({ journey }: { journey: JourneyData }) {
  const { milestones } = journey;
  const from = milestones[0];
  const now = [...milestones].reverse().find((m) => m.status === "current") ?? milestones[milestones.length - 1];
  const shipped = milestones.filter((m) => m.status === "done").length;
  const [lead, ...rest] = journey.story;

  return (
    <SectionShell id="journey">
      <div className="wrap">
        <div className="grid items-end gap-x-16 gap-y-8 lg:grid-cols-12">
          <div className="veil veil-l lg:col-span-7">
            <Chapter n="04" label="My path" />
            <Headline lines={[journey.heading]} className="mt-7 max-w-3xl text-4xl md:text-6xl" />
          </div>
          <div className="veil veil-r space-y-5 lg:col-span-5">
            {lead && (
              <Reveal delay={0.05}>
                <p className="text-lg leading-relaxed text-foreground/90 md:text-xl">{lead}</p>
              </Reveal>
            )}
            {rest.map((p, i) => (
              <Reveal key={i} delay={0.12 + i * 0.08}>
                <p className="leading-relaxed text-foreground/80">{p}</p>
              </Reveal>
            ))}
          </div>
        </div>

        {from && now && from.id !== now.id && (
          <Reveal variant="bare" className="mt-16 md:mt-24">
            <div className="jr-route">
              <div className="jr-route-end">
                <p className="mono-label">From</p>
                <p className="jr-route-title">{from.title}</p>
                <p className="jr-route-when">{from.period}</p>
              </div>
              <div aria-hidden className="jr-route-track">
                <span className="jr-route-meta">
                  {shipped} of {milestones.length} stages shipped
                </span>
                <span className="jr-route-rail">
                  <span className="flow-line jr-route-line" />
                </span>
              </div>
              <div className="jr-route-end jr-route-end--now">
                <p className="mono-label text-primary">Now</p>
                <p className="jr-route-title text-primary">{now.title}</p>
                <p className="jr-route-when">{now.period}</p>
              </div>
            </div>
          </Reveal>
        )}

        {milestones.length > 0 && (
          <div className="mt-16 grid gap-x-12 gap-y-10 md:mt-24 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <JourneyIndex items={milestones.map((m, i) => ({ id: m.id, numeral: roman(i + 1), title: m.title, status: m.status }))} />
            </aside>

            <div className="relative">
              <TimelineProgress className="left-[1.375rem]" />
              <ol className="jr-stages">
                {milestones.map((m, i) => (
                  <li key={m.id} id={`stage-${m.id}`} className="jr-stage" data-status={m.status}>
                    <span aria-hidden data-timeline-dot data-status={m.status} className="jr-node">
                      {m.status === "done" && <Check size={15} strokeWidth={3} />}
                      {m.status === "current" && <span className="h-2 w-2 animate-pulse rounded-full bg-current motion-reduce:animate-none" />}
                      {m.status === "next" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                    </span>

                    <Reveal>
                      <article data-spotlight data-status={m.status} className="jr-plate">
                        <span aria-hidden className="ticks jr-corners" />
                        <span aria-hidden className="jr-num">
                          {roman(i + 1)}
                        </span>

                        <div className="jr-plate-top">
                          <span data-status={m.status} className="jr-pill">
                            {STATUS[m.status]}
                          </span>
                          <span className="jr-when">{m.period}</span>
                        </div>

                        <Headline as="h3" lines={[m.title]} className="jr-title text-2xl md:text-4xl" />
                        <p className="jr-desc">{m.description}</p>

                        {m.tags.length > 0 && (
                          <ul className="jr-tags" aria-label="Technologies">
                            {m.tags.map((t) => (
                              <li key={t}>{t}</li>
                            ))}
                          </ul>
                        )}
                        <span aria-hidden className="jr-rule" />
                      </article>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </SectionShell>
  );
}
