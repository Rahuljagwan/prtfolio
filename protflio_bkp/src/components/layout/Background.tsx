/**
 * Fixed, full-screen page background with a distinct look per theme. Server-rendered, no JavaScript.
 *
 *  Dark  : night sky. Deep indigo base, three drifting aurora glows, a faint perspective-free grid, two star layers
 *          (one twinkling), and a soft vignette.
 *  Light : warm paper. Cream base, peach / lavender / mint washes, a fine dot grid and film grain.
 *
 * GPU cost: radial gradients (no blur filters), static SVG tiles, and only transform/opacity animations.
 * The layer for the inactive theme is display:none, so it costs nothing while hidden.
 *
 * Layout stability: nothing here is anchored to the right edge. The fixed container narrows when the page scrollbar
 * appears after load, which would shift right-anchored shapes and register as CLS. Positions use left/top and 100vw.
 */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* ------------------------------ DARK ------------------------------ */}
      <div className="absolute inset-0 hidden dark:block">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(232_38%_5%)_0%,hsl(240_36%_8%)_55%,hsl(250_34%_9%)_100%)]" />

        <div className="absolute -left-[10vmax] top-[-12vmax] h-[62vmax] w-[62vmax] animate-drift bg-[radial-gradient(closest-side,hsl(258_90%_62%/0.34),transparent)] motion-reduce:animate-none" />
        <div className="absolute left-[calc(100vw-42vmax)] top-[22vh] h-[56vmax] w-[56vmax] animate-drift bg-[radial-gradient(closest-side,hsl(172_80%_45%/0.20),transparent)] [animation-delay:-5s] [animation-duration:19s] motion-reduce:animate-none" />
        <div className="absolute -bottom-[18vmax] left-[18vw] h-[58vmax] w-[58vmax] animate-drift bg-[radial-gradient(closest-side,hsl(214_90%_55%/0.20),transparent)] [animation-delay:-11s] [animation-duration:23s] motion-reduce:animate-none" />

        <div className="bg-grid-dark absolute inset-0" />
        <div className="bg-stars-a absolute inset-0 opacity-70" />
        <div className="bg-stars-b animate-twinkle absolute inset-0" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,hsl(232_40%_3%/0.55)_100%)]" />
      </div>

      {/* ------------------------------ LIGHT ------------------------------ */}
      <div className="absolute inset-0 dark:hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,hsl(42_45%_98%)_0%,hsl(38_36%_96%)_55%,hsl(30_32%_94%)_100%)]" />

        <div className="absolute -left-[12vmax] top-[-14vmax] h-[60vmax] w-[60vmax] animate-drift bg-[radial-gradient(closest-side,hsl(24_95%_76%/0.42),transparent)] motion-reduce:animate-none" />
        <div className="absolute left-[calc(100vw-42vmax)] top-[16vh] h-[56vmax] w-[56vmax] animate-drift bg-[radial-gradient(closest-side,hsl(256_85%_80%/0.38),transparent)] [animation-delay:-6s] [animation-duration:20s] motion-reduce:animate-none" />
        <div className="absolute -bottom-[16vmax] left-[14vw] h-[54vmax] w-[54vmax] animate-drift bg-[radial-gradient(closest-side,hsl(168_62%_78%/0.34),transparent)] [animation-delay:-12s] [animation-duration:24s] motion-reduce:animate-none" />

        <div className="bg-dots-light absolute inset-0" />
        <div className="bg-grain absolute inset-0 opacity-[0.07]" />
        <div className="absolute inset-x-0 top-0 h-[40vh] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.7),transparent)]" />
      </div>
    </div>
  );
}
