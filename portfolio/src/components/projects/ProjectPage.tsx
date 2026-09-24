import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SampleChip } from "@/components/ui/SampleChip";
import { architectureFor, canDrawArchitecture } from "@/lib/projects/architecture";
import type { Project, SampleField } from "@/lib/types";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { OwnershipBar, StatusChip } from "./parts";

function Block({ title, sample, children }: { title: string; sample?: boolean; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary">
        {title}
        {sample && <SampleChip />}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-2 leading-relaxed">
    {items.map((t) => (
      <li key={t} className="flex gap-3">
        <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
        {t}
      </li>
    ))}
  </ul>
);

interface Neighbour {
  slug: string;
  title: string;
}

/**
 * The full page for one project. Every block renders only if the project has content for it, so a real project with a short
 * write-up gets a short page, never placeholders. Illustrative blocks (project.sampleFields) carry a "Sample" chip; a wholly
 * illustrative project also gets a banner and is kept out of search indexing (see the route's metadata).
 */
export function ProjectPage({ project: p, prev, next }: { project: Project; prev?: Neighbour; next?: Neighbour }) {
  const sampleIn = (f: SampleField) => !!p.sampleFields?.includes(f);
  const architecture = architectureFor(p.stack);
  const confidential = !!p.confidential;

  return (
    <article>
      <Link href="/#projects" prefetch={false} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={14} aria-hidden /> All projects
      </Link>

      {p.sample && (
        <p role="note" className="mt-6 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
          <strong className="font-medium">Sample project.</strong> This page shows illustrative content to demonstrate the layout. It is not a real claim about my work.
        </p>
      )}

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip project={p} />
          {p.sample && <SampleChip />}
          {p.categories?.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{p.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{p.summary}</p>
        {confidential && <p className="mt-3 text-sm text-muted-foreground">The details of this project are confidential, so only this public summary is shown.</p>}

        <dl className="mt-6 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted-foreground">Role</dt>
            <dd className="mt-1">{p.role}</dd>
          </div>
          {p.period && (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Period</dt>
              <dd className="mt-1">{p.period}</dd>
            </div>
          )}
          {p.links?.live || p.links?.repo ? (
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">Links</dt>
              <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {p.links.live && (
                  <a href={p.links.live} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Live demo <ExternalLink size={12} aria-hidden />
                  </a>
                )}
                {p.links.repo && (
                  <a href={p.links.repo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    Source <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </dd>
            </div>
          ) : null}
        </dl>

        {p.ownership && (
          <div className="mt-6 max-w-sm">
            <OwnershipBar ownership={p.ownership} />
            <p className="mt-2 text-xs text-muted-foreground">Which lifecycle stages I owned. A dashed stage means it is not stated, not that I did or did not own it.</p>
          </div>
        )}
      </header>

      {!confidential && (
        <>
          {p.challenge && (
            <Block title="The problem">
              <p className="leading-relaxed">{p.challenge}</p>
            </Block>
          )}

          {p.constraints && p.constraints.length > 0 && (
            <Block title="Constraints" sample={sampleIn("constraints")}>
              <Bullets items={p.constraints} />
            </Block>
          )}

          {canDrawArchitecture(architecture) && (
            <Block title="Architecture">
              <ArchitectureDiagram architecture={architecture} />
            </Block>
          )}

          {p.approach && p.approach.length > 0 && (
            <Block title="What I did">
              <ol className="space-y-3">
                {p.approach.map((step, i) => (
                  <li key={step} className="flex gap-3 leading-relaxed">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs text-primary">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}

          {p.decisions && p.decisions.length > 0 && (
            <Block title="Decision log" sample={sampleIn("decisions")}>
              <ul className="space-y-4">
                {p.decisions.map((d) => (
                  <li key={d.title} className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="font-semibold">{d.title}</h3>
                    <dl className="mt-3 space-y-2 text-sm">
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-primary">Chose</dt>
                        <dd>{d.chose}</dd>
                      </div>
                      {d.rejected.length > 0 && (
                        <div className="flex gap-3">
                          <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">Rejected</dt>
                          <dd className="text-muted-foreground">{d.rejected.join(" · ")}</dd>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <dt className="w-20 shrink-0 text-xs uppercase tracking-wider text-muted-foreground">Why</dt>
                        <dd className="leading-relaxed">{d.why}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {p.deployment && p.deployment.length > 0 && (
            <Block title="Deployment" sample={sampleIn("deployment")}>
              <Bullets items={p.deployment} />
            </Block>
          )}

          {p.outcome && (
            <Block title="Outcome">
              <p className="leading-relaxed">{p.outcome}</p>
            </Block>
          )}

          {p.metrics && p.metrics.length > 0 && (
            <Block title="Numbers" sample={sampleIn("metrics")}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {p.metrics.map((m) => (
                  <div key={m.label} className="rounded-xl border border-border bg-card p-4">
                    <dt className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</dt>
                    <dd className="mt-1 font-mono text-2xl font-semibold">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </Block>
          )}

          {p.learnings && (
            <Block title="What I learned">
              <p className="leading-relaxed">{p.learnings}</p>
            </Block>
          )}

          {p.retrospective && p.retrospective.length > 0 && (
            <Block title="What I would change" sample={sampleIn("retrospective")}>
              <Bullets items={p.retrospective} />
            </Block>
          )}

          {p.highlights.length > 0 && (
            <Block title="Highlights">
              <Bullets items={p.highlights} />
            </Block>
          )}
        </>
      )}

      {p.stack.length > 0 && (
        <Block title="Built with">
          <div className="flex flex-wrap gap-2">
            {p.stack.map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
          </div>
        </Block>
      )}

      {(prev || next) && (
        <nav aria-label="More projects" className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={`/projects/${prev.slug}`} prefetch={false} className="group rounded-xl border border-border p-4 transition-colors hover:border-primary/40">
              <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                <ArrowLeft size={12} aria-hidden /> Previous
              </span>
              <span className="mt-1 block font-medium group-hover:text-primary">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/projects/${next.slug}`} prefetch={false} className="group rounded-xl border border-border p-4 text-right transition-colors hover:border-primary/40 sm:col-start-2">
              <span className="flex items-center justify-end gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
                Next <ArrowRight size={12} aria-hidden />
              </span>
              <span className="mt-1 block font-medium group-hover:text-primary">{next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
