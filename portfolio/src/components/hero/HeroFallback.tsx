/**
 * Lightweight hero backdrop: layered gradients plus two slowly rotating rings, all CSS.
 * It is rendered on the server, so it paints with the first HTML. It is also the permanent visual on phones,
 * reduced-motion users, data-saver mode and browsers without WebGL. Only transform and opacity animate.
 */
export function HeroFallback() {
  return (
    <div
      aria-hidden
      className="hero-fallback pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-700"
    >
      <div className="absolute right-[-12%] top-[10%] h-[34rem] w-[34rem] animate-drift rounded-full bg-primary/25 blur-3xl motion-reduce:animate-none" />
      <div className="absolute bottom-[-10%] right-[18%] h-[22rem] w-[22rem] animate-drift rounded-full bg-accent/15 blur-3xl [animation-delay:-7s] motion-reduce:animate-none" />

      <div className="absolute right-[6%] top-1/2 hidden h-[26rem] w-[26rem] -translate-y-1/2 md:block">
        <div className="absolute inset-0 animate-spin-slow rounded-full border border-primary/30 motion-reduce:animate-none" />
        <div className="absolute inset-12 animate-spin-slow rounded-full border border-dashed border-accent/30 [animation-direction:reverse] motion-reduce:animate-none" />
        <div className="absolute inset-[7.5rem] rounded-full bg-gradient-to-br from-primary/40 to-accent/30 blur-md" />
      </div>
    </div>
  );
}
