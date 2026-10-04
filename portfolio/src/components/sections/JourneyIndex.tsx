"use client";

import { useEffect, useRef, useState } from "react";
import { cue } from "@/lib/audio/cues";
import type { MilestoneStatus } from "@/lib/types";

export interface JourneyIndexItem {
  id: string;
  numeral: string;
  title: string;
  status: MilestoneStatus;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The sticky index beside the stages: every stage by numeral and name, the one on the reading line marked, and a running count.
 * Each entry is a plain link to its stage, so it works as navigation (and without JavaScript the list is still a table of contents);
 * the only client work is one IntersectionObserver that decides which stage is current. It watches a thin band just above the middle of
 * the screen, so the mark moves exactly when a stage reaches the reading line, and it holds between stages instead of flickering.
 */
export function JourneyIndex({ items }: { items: JourneyIndexItem[] }) {
  const [active, setActive] = useState(0);
  const first = useRef(true);

  // A soft note for each stage as it reaches the reading line (none on the first render).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    cue("stage", active);
  }, [active]);

  useEffect(() => {
    const els = items.map((it) => document.getElementById(`stage-${it.id}`)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = items.findIndex((it) => `stage-${it.id}` === entry.target.id);
          if (i >= 0) setActive(i);
        }
      },
      { rootMargin: "-38% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);

  return (
    <nav aria-label="Stages of my path" className="jr-index">
      <p className="mono-label">The stages</p>
      <ol>
        {items.map((it, i) => (
          <li key={it.id}>
            <a href={`#stage-${it.id}`} data-active={i === active ? "" : undefined} data-status={it.status} aria-current={i === active ? "step" : undefined} className="jr-index-link">
              <span className="jr-index-num">{it.numeral}</span>
              <span className="jr-index-title">{it.title}</span>
            </a>
          </li>
        ))}
      </ol>
      <p aria-hidden className="jr-index-count">
        {pad(active + 1)} / {pad(items.length)}
      </p>
    </nav>
  );
}
