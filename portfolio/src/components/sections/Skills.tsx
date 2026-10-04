import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import type { SkillGroup } from "@/lib/types";
import { IncidentPanel } from "./IncidentPanel";

/**
 * Skills are a tower of tiers, the same picture the 3D world draws behind them: the layer users see at the top, where it
 * runs at the bottom, each tier a little wider than the one above and every tool carrying a live dot. The heading and the
 * incident drill hold still on the left while the tiers scroll past on the right.
 */
export function Skills({ groups }: { groups: SkillGroup[] }) {
  const last = groups.length - 1;
  let tool = 0;

  return (
    <SectionShell id="skills">
      <div className="wrap">
        <div className="grid gap-x-16 gap-y-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="veil veil-l lg:sticky lg:top-32">
              <Chapter n="06" label="Skills" />
              <Headline lines={["Tools I", "work with."]} className="mt-7 text-5xl md:text-7xl" />
              <Reveal delay={0.2}>
                <p className="mt-8 max-w-sm text-lg leading-relaxed text-muted-foreground">Grouped by where they sit in the stack, from what people see down to where it runs, then what cuts across all of it.</p>
              </Reveal>
              <Reveal delay={0.28}>
                <IncidentPanel />
              </Reveal>
            </div>
          </div>

          <ol className="veil veil-r lg:col-span-7">
            {groups.map((g, i) => (
              <li key={g.id} className="tier" style={{ "--k": last - i } as React.CSSProperties}>
                <Reveal delay={i * 0.06}>
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-4">
                      <span className="mono-label text-primary">L{i + 1}</span>
                      <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">{g.name}</h3>
                    </div>
                    <span className="mono-label">{g.skills.length} tools</span>
                  </div>
                  <ul className="mt-6 flex flex-wrap gap-2.5">
                    {g.skills.map((s) => {
                      const n = tool++;
                      return (
                        <li key={s} data-assemble-chip className="skill">
                          <span aria-hidden className="pulse" style={{ "--pd": `${(n % 7) * 0.37}s` } as React.CSSProperties} />
                          {s}
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </SectionShell>
  );
}
