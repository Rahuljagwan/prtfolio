import { ArrowUpRight } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { Project } from "@/lib/types";

/** True when a project has any case-study content. Shared with the page so the layer only receives these projects. */
export const hasCaseStudy = (p: Project) => Boolean(p.challenge || p.outcome || (p.approach && p.approach.length > 0));

/** Signature 3D motif per project: fintech pipeline, people graph, document vault. Chosen from the CMS `motif` field once it exists, else by position. */
const MOTIFS = ["pipeline", "network", "vault"];
const motifOf = (p: Project, i: number) => {
  const m = (p as Project & { motif?: string | null }).motif;
  return m && m !== "auto" ? m : MOTIFS[i % MOTIFS.length];
};

/** Decorative cover: a per-card angled gradient, a dot grid and the project number. Pure CSS, no images. */
function Cover({ index, motif }: { index: number; motif: string }) {
  return (
    <div
      aria-hidden
      data-pod-stage
      data-motif={motif}
      className="relative h-44 overflow-hidden border-b border-border"
      style={{
        background: `linear-gradient(${125 + index * 35}deg, hsl(var(--primary) / 0.32), hsl(var(--accent) / 0.2) 70%, transparent)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--foreground) / 0.16) 1px, transparent 1.2px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(180deg, #000, transparent)",
          WebkitMaskImage: "linear-gradient(180deg, #000, transparent)",
        }}
      />
      <span className="absolute bottom-2 left-6 select-none font-mono text-6xl font-semibold leading-none tracking-tighter text-foreground/15">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}

export function Projects({ items }: { items: Project[] }) {
  return (
    <Section id="projects" eyebrow="Projects" title="Selected work." variant="scrim">
      <div className="grid gap-5 lg:grid-cols-3">
        {items.map((p, i) => {
          const caseStudy = hasCaseStudy(p);
          return (
            <Reveal key={p.id} delay={i * 0.08} className="h-full">
              <SpotlightCard
                tilt
                data-project-card
                data-project-id={p.id}
                data-has-case={caseStudy ? "true" : undefined}
                className={caseStudy ? "flex h-full cursor-pointer flex-col" : "flex h-full flex-col"}
              >
                <Cover index={i} motif={motifOf(p, i)} />
                <div className="flex flex-1 flex-col bg-card p-7">
                  <h3 className="text-xl font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>

                  <p className="mt-5 text-xs uppercase tracking-wider text-muted-foreground">Role</p>
                  <p className="mt-1 text-sm">{p.role}</p>

                  <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                    {p.highlights.map((h) => (
                      <li key={h} className="flex gap-2.5">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto flex flex-wrap gap-2 pt-6">
                    {p.stack.map((s) => (
                      <Chip key={s}>{s}</Chip>
                    ))}
                  </div>

                  {caseStudy && (
                    <button
                      type="button"
                      data-case-open
                      aria-haspopup="dialog"
                      aria-label={`Open case study: ${p.title}`}
                      className="group/cs mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-background/60 px-4 py-2 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      Case study
                      <ArrowUpRight size={15} aria-hidden className="transition-transform group-hover/cs:-translate-y-0.5 group-hover/cs:translate-x-0.5" />
                    </button>
                  )}
                </div>
              </SpotlightCard>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
