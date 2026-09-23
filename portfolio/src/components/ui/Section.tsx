import { cn } from "@/lib/utils";
import { Reveal } from "./Reveal";

interface SectionProps {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
  /** "panel" (default): a bounded glass card. "scrim": no edges, a soft tonal cloud the world bleeds into.
   * Alternated per section so the page doesn't read as one repeating module all the way down. */
  variant?: "panel" | "scrim";
}

/** Shared section shell so every section has identical spacing, heading style and anchor offset. */
export function Section({ id, eyebrow, title, children, className, variant = "panel" }: SectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-24 md:py-32", className)}>
      <div className={cn("container", variant === "panel" ? "section-panel" : "section-scrim")}>
        <Reveal>
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">{title}</h2>
        </Reveal>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
