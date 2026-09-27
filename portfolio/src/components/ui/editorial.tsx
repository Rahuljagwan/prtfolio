import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

/**
 * Small pieces of the page's editorial language, shared by the sections. Server components: markup only, the motion is CSS
 * (see "Editorial" in globals.css), started by the shared Reveal observer.
 */

/** A section's chapter mark: its number on the journey rail, a hairline that draws itself, and the section name. */
export function Chapter({ n, label, className }: { n: string; label: string; className?: string }) {
  return (
    <Reveal variant="bare" className={className}>
      <p className="chapter">
        <span className="chapter-n">{n}</span>
        <span aria-hidden className="chapter-rule" />
        <span>{label}</span>
      </p>
    </Reveal>
  );
}

/**
 * A headline whose lines rise out of a mask one after another. `lines` are the visual lines; they are joined for assistive
 * tech, so the heading reads as one sentence. Give it the size and weight through `className`.
 */
export function Headline({ lines, className, as: Tag = "h2", delay = 0 }: { lines: React.ReactNode[]; className?: string; as?: "h1" | "h2" | "h3"; delay?: number }) {
  return (
    <Reveal variant="bare">
      <Tag className={cn("headline", className)}>
        {lines.map((line, i) => (
          <span key={i} className="mask" style={{ "--d": `${delay + i * 0.09}s` } as React.CSSProperties}>
            <span className="mask-in">{line}</span>
          </span>
        ))}
      </Tag>
    </Reveal>
  );
}

/** The frame every section sits in: the anchor (with the site's scroll margin) and its vertical rhythm. No box, no background. */
export function SectionShell({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={cn("relative scroll-mt-24 py-28 md:py-40", className)}>
      {children}
    </section>
  );
}
