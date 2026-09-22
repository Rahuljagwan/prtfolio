import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { SkillGroup } from "@/lib/types";
import { IncidentPanel } from "./IncidentPanel";

export function Skills({ groups }: { groups: SkillGroup[] }) {
  return (
    <Section id="skills" eyebrow="Skills" title="Tools I work with.">
      <div className="grid gap-5 md:grid-cols-3">
        {groups.map((g, i) => (
          <Reveal key={g.id} delay={i * 0.08} className="h-full">
            <SpotlightCard className="h-full p-7">
              <h3 className="font-semibold">{g.name}</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {g.skills.map((s) => (
                  <Chip key={s} data-assemble-chip className="text-foreground">
                    {s}
                  </Chip>
                ))}
              </div>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
      <IncidentPanel />
    </Section>
  );
}
