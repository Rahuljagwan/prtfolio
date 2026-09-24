"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Clock, LayoutGrid, Route, Table2, X } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";
import { NO_FILTERS, filterOptions, isFiltering, matchesFilters, type FilterGroup, type Filters } from "@/lib/projects/utils";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";

// The Grid is the server-rendered default; the other views are only fetched when the visitor (or the world becoming ready)
// asks for them, so they stay out of the home page's first-load JS.
const FlightView = dynamic(() => import("./FlightView").then((m) => m.FlightView), { ssr: false });
const TimelineView = dynamic(() => import("./TimelineView").then((m) => m.TimelineView), { ssr: false });
const MatrixView = dynamic(() => import("./MatrixView").then((m) => m.MatrixView), { ssr: false });

type View = "flight" | "grid" | "timeline" | "matrix";

const FLIGHT = { key: "flight", label: "Flight", Icon: Route } as const;
const VIEWS: { key: View; label: string; Icon: typeof LayoutGrid }[] = [
  { key: "grid", label: "Grid", Icon: LayoutGrid },
  { key: "timeline", label: "Timeline", Icon: Clock },
  { key: "matrix", label: "Matrix", Icon: Table2 },
];

const GROUP_LABEL: Record<FilterGroup, string> = { category: "Type", status: "Status", stack: "Stack" };

const CARD_MOTION = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

/** True while the 3D world is running (html[data-world="ready"]). The Flight view needs it; without it the section offers the other views only. */
function useWorldReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setReady(root.dataset.world === "ready");
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-world"] });
    return () => observer.disconnect();
  }, []);
  return ready;
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-muted/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The Projects section. SSR renders the Grid view (so phones, reduced-motion and no-JS visitors get the full section);
 * Timeline and Matrix are alternative views of the same filtered list. Hierarchy: featured projects get large alternating
 * rows, everything else is compact. Filters are OR within a group and AND across groups.
 */
export function ProjectsClient({ projects }: { projects: Project[] }) {
  const [view, setView] = useState<View>("grid");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const worldReady = useWorldReady();
  const chose = useRef(false);

  // Flight becomes the default once the world is running, but only if the visitor has not picked a view yet and the section is
  // still below the screen (so nothing they are looking at changes shape). If the world goes away, fall back to the Grid.
  useEffect(() => {
    if (!worldReady) {
      setView((v) => (v === "flight" ? "grid" : v));
      return;
    }
    const top = document.getElementById("projects")?.getBoundingClientRect().top ?? 0;
    if (!chose.current && top > window.innerHeight * 0.5) setView("flight");
  }, [worldReady]);

  const options = useMemo(() => filterOptions(projects), [projects]);
  const shown = useMemo(() => projects.filter((p) => matchesFilters(p, filters)), [projects, filters]);
  const indexOf = useMemo(() => new Map(projects.map((p, i) => [p.id, i])), [projects]);
  const featured = shown.filter((p) => p.featured);
  const compact = shown.filter((p) => !p.featured);
  const filtering = isFiltering(filters);
  const showFilters = projects.length >= 4 && options.category.length + options.status.length + options.stack.length > 0;

  const toggle = (group: FilterGroup, value: string) =>
    setFilters((f) => ({ ...f, [group]: f[group].includes(value) ? f[group].filter((v) => v !== value) : [...f[group], value] }));

  // Arrow keys move between project cards (in every view); Enter or Space on a focused card opens its case study.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("input, select, textarea, [contenteditable]")) return;
    const card = target.closest<HTMLElement>("[data-project-card]");
    if (!card) return;
    if ((e.key === "Enter" || e.key === " ") && target === card && card.dataset.hasCase) {
      e.preventDefault();
      card.click();
      return;
    }
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
    if (!forward && e.key !== "ArrowLeft" && e.key !== "ArrowUp") return;
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-project-card]"));
    const next = cards[cards.indexOf(card) + (forward ? 1 : -1)];
    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  return (
    <div>
      <Reveal>
        <div className="section-panel mb-8 !py-6 sm:!px-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">Projects</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Selected work.</h2>
            <div role="group" aria-label="Choose a view" className="inline-flex rounded-full border border-border bg-background/60 p-1">
              {(worldReady ? [FLIGHT, ...VIEWS] : VIEWS).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => {
                    chose.current = true;
                    setView(key);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                    view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon size={14} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {showFilters && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5" role="group" aria-label="Filter projects">
              {(Object.keys(GROUP_LABEL) as FilterGroup[]).map(
                (g) =>
                  options[g].length > 0 && (
                    <div key={g} className="thin-scroll -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:p-0">
                      <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{GROUP_LABEL[g]}</span>
                      {(options[g] as string[]).map((v) => (
                        <FilterChip key={v} active={filters[g].includes(v)} onClick={() => toggle(g, v)}>
                          {g === "status" ? v.replace("-", " ") : v}
                        </FilterChip>
                      ))}
                    </div>
                  ),
              )}
              {filtering && (
                <button type="button" onClick={() => setFilters(NO_FILTERS)} className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                  <X size={12} aria-hidden /> Clear
                </button>
              )}
            </div>
          )}
          <p aria-live="polite" className="mt-4 text-xs text-muted-foreground">
            {filtering ? `Showing ${shown.length} of ${projects.length} projects` : `${projects.length} projects`}
          </p>
        </div>
      </Reveal>

      <div onKeyDown={onKeyDown}>
        {shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">No projects match those filters.</p>
            <button type="button" onClick={() => setFilters(NO_FILTERS)} className="mt-3 text-sm font-medium text-primary hover:underline">
              Clear filters
            </button>
          </div>
        ) : view === "flight" && worldReady ? (
          <FlightView projects={shown} />
        ) : view === "grid" || view === "flight" ? (
          <LayoutGroup>
            {featured.length > 0 && (
              <div className="space-y-6">
                <AnimatePresence mode="popLayout" initial={false}>
                  {featured.map((p, i) => (
                    <motion.div key={p.id} layout {...CARD_MOTION}>
                      <ProjectCard project={p} index={indexOf.get(p.id) ?? i} variant="featured" flip={i % 2 === 1} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            {compact.length > 0 && (
              <div className={cn("grid gap-5 sm:grid-cols-2 lg:grid-cols-3", featured.length > 0 && "mt-6")}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {compact.map((p, i) => (
                    <motion.div key={p.id} layout {...CARD_MOTION} className="h-full">
                      <ProjectCard project={p} index={indexOf.get(p.id) ?? i} variant="compact" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </LayoutGroup>
        ) : view === "timeline" ? (
          <TimelineView projects={shown} />
        ) : (
          <MatrixView projects={shown} all={projects} />
        )}
      </div>
    </div>
  );
}
