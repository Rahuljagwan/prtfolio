# Stage 4: 3D hero and scroll timeline, performance notes

## Lighthouse performance (production build, Edge, 3 runs each)

| Build | Mobile | Desktop |
|---|---|---|
| Before Stage 4 (Stage 3 build) | 90 (85, 90, 92) | 100 |
| After Stage 4, real GPU | 92, 92, 92 | 99, 99, 86 |
| After Stage 4, `?lite` (3D off) | not run | 100 |
| After Stage 4, software renderer forced on (worst case) | 91 to 92 | 74 to 77 |

- Mobile never loads 3D, so its score is the static hero. It improved slightly because the hero headline now uses a CSS
  entrance animation instead of a JavaScript fade-in.
- The 86 desktop run is one outlier (TBT 320 ms) among 99s. Lab runs vary; the other two runs and the earlier real-GPU
  runs (99, 99, 99) show the typical result.
- The software-renderer row is a lab artefact: Lighthouse's headless browser has no GPU, so WebGL was force-enabled on a
  software renderer where creating a context alone takes about 550 ms (it takes about 20 ms on the real GPU). Real
  browsers without a GPU do not offer WebGL at all, and those visitors get the static hero (tested).
- CLS is 0 in every run.

## Why 3D is cheap for most visitors

The three.js chunks (about 165 KB + 60 KB gzip) are not in the first-load bundle. They are fetched only when all of this is true:

1. Not reduced-motion, not a touch device, viewport 900 px or wider, no data-saver, 4+ GB memory and 4+ CPU cores (where the browser reports them).
2. The page has fully loaded, plus a 1.5 s pause, plus a browser idle callback.
3. The URL does not contain `?lite`.

After that:

- Shaders compile asynchronously before the first frame (no main-thread stall).
- Rendering stops when the hero is off-screen or the tab is hidden.
- A frame-rate watchdog drops the pixel ratio if the scene runs below about 36 fps.
- Pixel ratio is capped at 1.25.
- Errors, no WebGL, or a lost context leave the static hero in place. The page never breaks.

Things learned the hard way, so they stay fixed:

- Do not probe WebGL with a throwaway canvas during hydration. It cost about 500 ms on the main thread.
- Hero text must not depend on JavaScript to become visible (it hurts LCP), so it uses CSS animations.

## Scroll timeline

`TimelineProgress` draws the line with GSAP ScrollTrigger (`scaleY`, compositor only). GSAP is imported dynamically.
Reduced-motion users and browsers where GSAP fails to load see the completed line with all dots lit. With JavaScript disabled, the line and dots are shown complete.

## Handy switches

- `/?lite` forces the static hero (useful for comparing).
