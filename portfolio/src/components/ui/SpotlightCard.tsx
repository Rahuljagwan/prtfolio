import { cn } from "@/lib/utils";

type SpotlightCardProps = Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  children: React.ReactNode;
  /** Adds the subtle 3D tilt (driven by SpotlightController). Off by default. */
  tilt?: boolean;
};

/**
 * Card with a soft glow that follows the pointer, and an optional tilt. This is a plain server component: it only
 * renders markup. Pointer effects are written by one shared listener (see SpotlightController) that finds the card
 * under the pointer, so there is no per-card client code to hydrate. Extra props (for example data-* attributes) are
 * passed through to the card element.
 */
export function SpotlightCard({ children, className, tilt = false, ...rest }: SpotlightCardProps) {
  return (
    <div
      data-spotlight
      {...(tilt ? { "data-tilt": "" } : {})}
      {...rest}
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(360px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--primary) / 0.12), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}
