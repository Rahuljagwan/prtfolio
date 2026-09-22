import { GraduationCap } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { EducationEntry } from "@/lib/types";

export function Education({ items }: { items: EducationEntry[] }) {
  // An empty list hides the section (and its nav link target simply does not exist).
  if (items.length === 0) return null;

  return (
    <Section id="education" eyebrow="Education" title="Where I studied.">
      <div className="grid gap-5 md:grid-cols-2">
        {items.map((e, i) => (
          <Reveal key={e.id} delay={i * 0.08} className="h-full">
            <SpotlightCard className="flex h-full gap-5 p-7">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap size={20} aria-hidden />
              </span>
              <div>
                <p className="font-mono text-xs text-primary">{e.period}</p>
                <h3 className="mt-1 text-lg font-semibold leading-snug">{e.degree}</h3>
                <p className="mt-1 text-muted-foreground">{e.institution}</p>
                {e.description && <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{e.description}</p>}
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
