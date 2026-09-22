// A tiny scroll-linked progress helper. It replaces GSAP ScrollTrigger for the three small effects on this site
// (timeline line, skill chips, journey cards), which only need "how far through this element's scroll range am I?".
//
// Why not ScrollTrigger: it runs a never-ending animation-frame loop for as long as the page is open (a workaround for
// repaint bugs in some browsers), which costs a few percent of CPU on an idle page and on phones. This does no work at
// all unless the page is actually scrolling or resizing, and everything is batched into one animation frame.

export interface ScrubConfig {
  /** Element whose position defines the range. */
  trigger: HTMLElement;
  /** Progress is 0 when the trigger's TOP edge reaches this fraction of the viewport height (0 = top, 1 = bottom). */
  start: number;
  /** Progress is 1 when the trigger's `endEdge` reaches this fraction of the viewport height. */
  end: number;
  /** Which edge of the trigger is tested against `end`. Defaults to "top". */
  endEdge?: "top" | "bottom";
}

interface Item {
  cfg: ScrubConfig;
  apply: (progress: number) => void;
  last: number;
}

const items = new Set<Item>();
let frame = 0;
let bound = false;

function update() {
  frame = 0;
  const vh = window.innerHeight;

  // Read every rect first, then write, so styles set by one item never force a re-layout before the next is measured.
  const results: [Item, number][] = [];
  items.forEach((item) => {
    const rect = item.cfg.trigger.getBoundingClientRect();
    const s = rect.top - item.cfg.start * vh; // 0 when the range starts, falling as you scroll
    const e = (item.cfg.endEdge === "bottom" ? rect.bottom : rect.top) - item.cfg.end * vh; // 0 when the range ends
    const span = s - e; // constant while scrolling
    const p = span === 0 ? (s <= 0 ? 1 : 0) : Math.min(1, Math.max(0, s / span));
    results.push([item, p]);
  });

  for (const [item, p] of results) {
    // Skip negligible changes, but always deliver the exact end points (0 and 1) so effects settle cleanly.
    if (p === item.last || (Math.abs(p - item.last) < 0.0005 && p !== 0 && p !== 1)) continue;
    item.last = p;
    item.apply(p);
  }
}

const schedule = () => {
  if (!frame) frame = requestAnimationFrame(update);
};

function bind() {
  if (bound) return;
  bound = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
}

function unbind() {
  if (!bound || items.size > 0) return;
  bound = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

/** Calls `apply(progress)` (0 to 1) as the page scrolls through the range. Returns a function that stops it. */
export function scrub(cfg: ScrubConfig, apply: (progress: number) => void): () => void {
  const item: Item = { cfg, apply, last: Number.NaN };
  items.add(item);
  bind();
  schedule(); // apply the initial state right away
  return () => {
    items.delete(item);
    unbind();
  };
}
