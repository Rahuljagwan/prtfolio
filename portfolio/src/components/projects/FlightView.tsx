"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SampleChip } from "@/components/ui/SampleChip";
import { cn } from "@/lib/utils";
import { OPEN_PROJECT_EVENT, hasCaseStudy } from "@/lib/projects/utils";
import { architectureFor, rackLayers } from "@/lib/projects/architecture";
import { captionFor } from "@/lib/projects/exhibits";
import { activeIndex, indexFromProgress, progressForIndex, progressFromRect, trackHeightVh } from "@/lib/world/station-math";
import { registerFlight, unregisterFlight } from "@/lib/world/stations";
import { smoothScrollTo } from "@/lib/scroll-state";
import type { Project } from "@/lib/types";
import { LiveDot, MetricsStrip, OwnershipBar, RedactedSummary, StatusChip } from "./parts";

const STEP_VH = 85;

/** The HUD label: the project's slug (enrichProjects sets it), else a slug of its title. */
const labelOf = (p: Project) => p.slug ?? p.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const typing = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable], [role='dialog']");

/**
 * The Projects "flight". A tall track (about one screen per hop) pins a full-screen stage. Scrolling through the track
 * moves the 3D camera from one project's rack to the next (ProjectStations reads the track's rect straight from the DOM
 * each frame), while the text on the left shows the project the camera is on. The scroll stays the single source of truth:
 * the rail, the arrow keys and j / k just scroll the page to the matching spot.
 *
 * Only offered when the 3D world is running (see ProjectsClient); phones, reduced motion and no-WebGL get the other views.
 */
export function FlightView({ projects }: { projects: Project[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const n = projects.length;

  const infos = useMemo(() => projects.map((p) => ({ id: p.id, label: labelOf(p), status: p.status, layers: rackLayers(architectureFor(p.stack)), exhibit: p.exhibit })), [projects]);

  // Tell the 3D side there is a flight on the page, and which projects are in it.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    registerFlight(el, infos);
    return () => unregisterFlight(el);
  }, [infos]);

  // Which project the text shows: derived from the same scroll position and pure maths the camera uses.
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = indexFromProgress(progressFromRect(r.top, r.height, window.innerHeight), n);
      setActive((prev) => activeIndex(t, n, prev));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);

  const goTo = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const range = Math.max(1, el.offsetHeight - vh);
      smoothScrollTo(top + progressForIndex(i, n) * range, { offset: 0 });
    },
    [n],
  );

  // Arrow keys and j / k step between projects while the flight is on screen. At either end the key falls through to the
  // browser, so the same key carries on scrolling the page out of the flight.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || typing(e.target) || document.querySelector("[role='dialog']")) return;
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const engaged = r.top < window.innerHeight * 0.5 && r.bottom > window.innerHeight * 0.5;
      if (!engaged) return;
      const next = e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "j" || e.key === "J";
      const prev = e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "k" || e.key === "K";
      if (!next && !prev) return;
      const target = activeRef.current + (next ? 1 : -1);
      if (target < 0 || target > n - 1) return;
      e.preventDefault();
      goTo(target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [n, goTo]);

  const project = projects[Math.min(n - 1, Math.max(0, active))];
  if (!project) return null;
  const caseStudy = hasCaseStudy(project);
  const redacted = !!project.confidential;
  const pad = (k: number) => String(k).padStart(2, "0");

  return (
    <div ref={track} role="region" aria-label="Project flight" style={{ height: `${trackHeightVh(n, STEP_VH)}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center pt-14">
        {/* A soft veil behind the text only: the world stays visible everywhere else. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 -ml-[50vw] w-[62vw] bg-gradient-to-r from-background/90 via-background/70 to-transparent" />

        <div className="relative w-full">
          {/* Screen readers get a plain announcement; the visible copy below is decorative motion around it. */}
          <p className="sr-only" aria-live="polite">
            Project {active + 1} of {n}: {project.title}
          </p>

          <motion.div key={project.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} className="max-w-[30rem]" data-project-id={project.id}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              {pad(active + 1)} / {pad(n)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusChip project={project} />
              {project.sample && <SampleChip />}
            </div>
            <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">{project.title}</h3>

            {redacted ? (
              <RedactedSummary publicSummary={project.confidential!.publicSummary} bars={project.confidential!.bars} />
            ) : (
              <p className="mt-4 leading-relaxed text-muted-foreground">{project.summary}</p>
            )}

            <p className="mt-4 text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Role</span> · <span className="text-foreground">{project.role}</span>
            </p>
            <OwnershipBar ownership={project.ownership} className="mt-5 max-w-xs" />

            {!redacted && project.highlights.length > 0 && (
              <ul className="mt-5 hidden space-y-1.5 text-sm text-muted-foreground [@media(min-height:1000px)]:block">
                {project.highlights.slice(0, 3).map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
            <MetricsStrip metrics={project.metrics} sample={project.sampleFields?.includes("metrics")} className="mt-5" />

            {infos[active]?.layers.length ? (
              <div className="mt-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">The stack, top to bottom</p>
                <dl className="mt-2 space-y-1.5">
                  {infos[active].layers.map((l) => (
                    <div key={l.label} className="flex gap-3 text-[13px] leading-snug">
                      <dt className="w-24 shrink-0 pt-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">{l.label}</dt>
                      <dd className="text-foreground/90">{l.items.join(" · ")}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {project.stack.map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
              </div>
            )}

            {(caseStudy || project.links?.live || project.slug) && (
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                {caseStudy && (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    aria-label={`Open case study: ${project.title}`}
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PROJECT_EVENT, { detail: { id: project.id } }))}
                    className="group/cs inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Case study
                    <ArrowUpRight size={15} aria-hidden className="transition-transform group-hover/cs:-translate-y-0.5 group-hover/cs:translate-x-0.5" />
                  </button>
                )}
                {project.slug && (
                  <Link href={`/projects/${project.slug}`} prefetch={false} className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Full page <ArrowUpRight size={13} aria-hidden />
                  </Link>
                )}
                {project.links?.live && (
                  <span className="inline-flex items-center gap-3">
                    <a href={project.links.live} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
                      Live demo <ExternalLink size={13} aria-hidden />
                    </a>
                    <LiveDot url={project.links.live} />
                  </span>
                )}
              </div>
            )}
          </motion.div>

          {/* Progress rail: one tick per project. Click to fly there. */}
          <div className="mt-10 flex items-center gap-4">
            <ol className="flex items-center gap-1.5" aria-label="Projects">
              {projects.map((p, i) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Go to project ${i + 1}: ${p.title}`}
                    aria-current={i === active ? "step" : undefined}
                    className="group grid h-6 place-items-center px-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <span className={cn("block h-1.5 rounded-full transition-all duration-300", i === active ? "w-8 bg-primary" : "w-3 bg-border group-hover:bg-muted-foreground")} />
                  </button>
                </li>
              ))}
            </ol>
            <span className="hidden font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:inline">scroll or ↑ ↓ to fly</span>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground [@media(max-height:820px)]:hidden">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <p className="max-w-md">
              {captionFor(project.exhibit) ? (
                <>
                  <span className="text-foreground/80">On the right, a schematic: </span>
                  {captionFor(project.exhibit)}
                </>
              ) : (
                <>The rack on the right is this project&apos;s stack: one slab per layer, from what users see at the top to where it runs at the bottom.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
