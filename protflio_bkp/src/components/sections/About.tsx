import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { Profile } from "@/lib/types";

export function About({ profile }: { profile: Profile }) {
  return (
    <Section id="about" eyebrow="About" title="Building reliable systems, end to end.">
      <div className="grid gap-12 lg:grid-cols-5">
        <div className="space-y-5 text-lg leading-relaxed text-muted-foreground lg:col-span-3">
          {profile.bio.map((p, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <p>{p}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1} className="lg:col-span-2">
          <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
            {profile.facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-right font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {profile.highlights.map((h, i) => (
          <Reveal key={h.title} delay={i * 0.08}>
            <SpotlightCard className="h-full p-6">
              <h3 className="font-semibold">{h.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{h.text}</p>
            </SpotlightCard>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
