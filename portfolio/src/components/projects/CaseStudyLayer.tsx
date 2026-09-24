"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Chip } from "@/components/ui/Chip";
import { SampleChip } from "@/components/ui/SampleChip";
import { OPEN_PROJECT_EVENT, hasCaseStudy } from "@/lib/projects/utils";
import type { Project } from "@/lib/types";

// The clicked card and the expanded panel share this view-transition name, so the browser morphs one into the other.
const MORPH = "project-morph";
const BACKDROP = "project-backdrop";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Case-study panel for project cards. The cards are rendered by ProjectsClient (in any of its views); this one client
 * component listens for clicks on them (event delegation) and for the open-project event (command palette), and shows the
 * matching project. It receives the FULL project list so the case-study number matches the card's cover number. Clicks on links or on anything marked data-no-case (live demo, redacted-summary toggle) are ignored.
 *
 * Motion: with View Transitions the card morphs into the panel and back. Without support, or with reduced motion,
 * it opens instantly (a short fade where motion is allowed). Focus moves into the dialog and returns to the button.
 */
export function CaseStudyLayer({ projects }: { projects: Project[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const origin = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const project = projects.find((p) => p.id === openId) ?? null;
  const canMorph = () => typeof document.startViewTransition === "function" && !prefersReducedMotion();

  const open = useCallback((id: string, card: HTMLElement | null) => {
    origin.current = card;
    if (!card || !canMorph()) {
      setFadeIn(!prefersReducedMotion());
      setOpenId(id);
      return;
    }
    setFadeIn(false);
    card.style.viewTransitionName = MORPH; // "before" snapshot: the card
    const transition = document.startViewTransition(() => {
      card.style.viewTransitionName = ""; // "after" snapshot: the panel carries the name
      flushSync(() => setOpenId(id));
    });
    transition.finished.finally(() => {
      card.style.viewTransitionName = "";
    });
  }, []);

  const close = useCallback(() => {
    const card = origin.current;
    const restoreFocus = () => (card?.querySelector<HTMLElement>("[data-case-open]") ?? card)?.focus();

    if (!canMorph() || !card) {
      setOpenId(null);
      restoreFocus();
      return;
    }
    const transition = document.startViewTransition(() => {
      flushSync(() => setOpenId(null));
      card.style.viewTransitionName = MORPH; // "after" snapshot: the card again
    });
    transition.finished.finally(() => {
      card.style.viewTransitionName = "";
      restoreFocus();
    });
  }, []);

  // Open on click of a card that has a case study (or its button). Delegated, so cards need no client code.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("a[href], [data-no-case]")) return;
      const card = target?.closest?.<HTMLElement>("[data-project-card][data-has-case]");
      const id = card?.dataset.projectId;
      if (card && id && projects.some((p) => p.id === id && hasCaseStudy(p))) open(id, card);
    };
    // The command palette (and later the terminal) opens a case study by id, with no card to morph from.
    const onOpenEvent = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id && projects.some((p) => p.id === id && hasCaseStudy(p))) open(id, null);
    };
    document.addEventListener("click", onClick);
    window.addEventListener(OPEN_PROJECT_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(OPEN_PROJECT_EVENT, onOpenEvent);
    };
  }, [open, projects]);

  // Move focus into the dialog when it opens; handle Escape and keep Tab inside it.
  useEffect(() => {
    if (!project) return;
    closeButton.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1'])");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, close]);

  if (!project) return null;

  const index = projects.findIndex((p) => p.id === project.id);
  const label = "text-xs font-medium uppercase tracking-wider text-primary";

  return (
    // The overlay is itself the scroll container, so long case studies scroll here and never move the page behind.
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[85] overflow-y-auto overscroll-contain"
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-background/70 backdrop-blur-md" style={{ viewTransitionName: BACKDROP }} />

      <div className="relative mx-auto flex min-h-full max-w-3xl items-start px-4 py-10 sm:py-16" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="case-study-title"
          style={{ viewTransitionName: MORPH }}
          className={`relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl ${fadeIn ? "animate-fade-up" : ""}`}
        >
          <div
            aria-hidden
            className="h-24 border-b border-border"
            style={{ background: `linear-gradient(${125 + index * 35}deg, hsl(var(--primary) / 0.32), hsl(var(--accent) / 0.2) 70%, transparent)` }}
          />
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close case study"
            className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X size={16} aria-hidden />
          </button>

          <div className="space-y-8 p-6 sm:p-9">
            <header>
              <p className="flex flex-wrap items-center gap-2 font-mono text-xs text-primary">
                <span>
                  Case study · {String(index + 1).padStart(2, "0")} · {project.role}
                </span>
                {project.sample && <SampleChip />}
              </p>
              <h2 id="case-study-title" className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {project.title}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{project.summary}</p>
              {project.slug && (
                <Link href={`/projects/${project.slug}`} prefetch={false} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  Open as a shareable page <ArrowUpRight size={14} aria-hidden />
                </Link>
              )}
            </header>

            {project.challenge && (
              <section>
                <h3 className={label}>The challenge</h3>
                <p className="mt-2 leading-relaxed">{project.challenge}</p>
              </section>
            )}

            {project.approach && project.approach.length > 0 && (
              <section>
                <h3 className={label}>What I did</h3>
                <ol className="mt-3 space-y-3">
                  {project.approach.map((step, i) => (
                    <li key={step} className="flex gap-3 leading-relaxed">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 font-mono text-xs text-primary">{i + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {project.outcome && (
              <section>
                <h3 className={label}>The outcome</h3>
                <p className="mt-2 leading-relaxed">{project.outcome}</p>
              </section>
            )}

            {project.highlights.length > 0 && (
              <section>
                <h3 className={label}>Highlights</h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {project.highlights.map((h) => (
                    <li key={h} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {h}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {project.learnings && (
              <section>
                <h3 className={label}>What I learned</h3>
                <p className="mt-2 leading-relaxed">{project.learnings}</p>
              </section>
            )}

            {project.stack.length > 0 && (
              <section>
                <h3 className={label}>Built with</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.stack.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
