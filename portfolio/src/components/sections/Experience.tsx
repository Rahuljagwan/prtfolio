import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import { TimelineProgress } from "./TimelineProgress";
import type { Experience as ExperienceItem } from "@/lib/types";

/**
 * Experience is a log. The heading holds still on the left while the entries scroll past on the right; each bullet is an
 * added line in a diff (a green plus, a faint green wash), and the stack closes each entry as a list of tokens.
 */
export function Experience({ items }: { items: ExperienceItem[] }) {
  return (
    <SectionShell id="experience">
      <div className="wrap">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="veil lg:sticky lg:top-32">
              <Chapter n="03" label="Experience" />
              <Headline lines={["Where I", "have worked."]} className="mt-7 text-5xl md:text-6xl" />
              <Reveal delay={0.2}>
                <p className="mono-label mt-8">
                  {items.length} {items.length === 1 ? "role" : "roles"}
                </p>
              </Reveal>
            </div>
          </div>

          <div className="veil veil-r relative lg:col-span-8">
            <TimelineProgress />
            <ol className="space-y-20 pl-8 md:pl-12">
              {items.map((item) => (
                <li key={item.id} className="relative">
                  <span aria-hidden data-timeline-dot className="timeline-dot absolute top-3 h-3 w-3 rounded-full border-2 border-primary bg-background" />
                  <Reveal>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
                      <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">{item.role}</h3>
                      <p className="mono-label shrink-0">{item.period}</p>
                    </div>
                    <p className="mt-2 text-lg text-primary">
                      {item.organisation} <span className="text-muted-foreground">· {item.location}</span>
                    </p>

                    <ul className="mt-9 border-t border-border/60">
                      {item.bullets.map((b) => (
                        <li key={b} className="diff-row">
                          <span aria-hidden className="diff-mark">
                            +
                          </span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-7 flex flex-wrap items-center gap-2">
                      <span className="mono-label mr-1">stack</span>
                      {item.stack.map((s) => (
                        <span key={s} className="tok">
                          {s}
                        </span>
                      ))}
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
