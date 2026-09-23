import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { TimelineProgress } from "./TimelineProgress";
import type { Experience as ExperienceItem } from "@/lib/types";

export function Experience({ items }: { items: ExperienceItem[] }) {
  return (
    <Section id="experience" eyebrow="Experience" title="Where I have worked." variant="scrim">
      <div className="relative">
        <TimelineProgress />
        <ol className="space-y-12 pl-8 md:pl-12">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span
                aria-hidden
                data-timeline-dot
                className="timeline-dot absolute top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background"
              />
              <Reveal>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="text-xl font-semibold">{item.role}</h3>
                  <p className="font-mono text-xs text-muted-foreground">{item.period}</p>
                </div>
                <p className="mt-1 text-primary">
                  {item.organisation} <span className="text-muted-foreground">· {item.location}</span>
                </p>
                <ul className="mt-5 space-y-3 text-muted-foreground">
                  {item.bullets.map((b) => (
                    <li key={b} className="flex gap-3 leading-relaxed">
                      <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.stack.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
