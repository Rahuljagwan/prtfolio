import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import type { Profile } from "@/lib/types";

/**
 * About is a dossier: a poster-sized statement, the bio in a lead paragraph and a body, a spec sheet of facts drawn with
 * corner ticks (no fill, no box) set lower on the right, and three numbered principles closing it. Nothing here is a card.
 */
export function About({ profile }: { profile: Profile }) {
  const [lead, ...rest] = profile.bio;

  return (
    <SectionShell id="about">
      <div className="wrap">
        <div className="grid gap-x-16 gap-y-14 lg:grid-cols-12">
          <div className="veil veil-l lg:col-span-7">
            <Chapter n="02" label="About" />
            <Headline lines={["Building reliable", "systems, end to end."]} className="mt-7 text-5xl md:text-7xl" />

            {lead && (
              <Reveal delay={0.15}>
                <p className="lead mt-10 max-w-2xl">{lead}</p>
              </Reveal>
            )}
            <div className="mt-8 max-w-2xl space-y-5 text-lg leading-relaxed text-muted-foreground">
              {rest.map((p, i) => (
                <Reveal key={i} delay={0.2 + i * 0.08}>
                  <p>{p}</p>
                </Reveal>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-5 lg:pt-44">
            <Reveal delay={0.2} variant="right">
              <div className="ticks veil veil-strong veil-r p-7 sm:p-9">
                <p className="mono-label mb-2">Spec sheet</p>
                <dl>
                  {profile.facts.map((f) => (
                    <div key={f.label} className="spec-row">
                      <dt className="mono-label">{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          </aside>
        </div>

        <ol className="veil veil-soft mt-28 grid list-none gap-y-12 md:mt-36 md:grid-cols-3">
          {profile.highlights.map((h, i) => (
            <li key={h.title} className="principle">
              <Reveal delay={i * 0.1}>
                <span data-parallax="0.35" className="outline-num block">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{h.title}</h3>
                <p className="mt-3 max-w-sm leading-relaxed text-muted-foreground">{h.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  );
}
