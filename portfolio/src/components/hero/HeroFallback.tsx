/**
 * Lightweight hero backdrop: two soft drifting glows, all CSS.
 * It is rendered on the server, so it paints with the first HTML. It is also the permanent visual on phones,
 * reduced-motion users, data-saver mode and browsers without WebGL (alongside OriginOrb, the one actual idea it stands in
 * for). Only transform and opacity animate.
 */
export function HeroFallback() {
  return (
    <div
      aria-hidden
      className="hero-fallback pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700"
    >
      <div className="absolute right-[-12%] top-[10%] h-[34rem] w-[34rem] animate-drift rounded-full bg-primary/25 blur-3xl motion-reduce:animate-none" />
      <div className="absolute bottom-[-10%] right-[18%] h-[22rem] w-[22rem] animate-drift rounded-full bg-accent/15 blur-3xl [animation-delay:-7s] motion-reduce:animate-none" />
    </div>
  );
}
