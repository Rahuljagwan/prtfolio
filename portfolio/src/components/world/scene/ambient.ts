import { activity } from "@/lib/world/activity";

// Some zones have a slow ambient animation (a pulsing light bar, packets drifting along the route) that needs a redraw for as long as
// it is on screen. Asking for the next frame on every frame kept the GPU at full rate even for a visitor who had stopped to read, and
// it kept doing so forever. Ambient animations go through here instead: a calm 25 frames a second, and none at all once the page
// has been still for a while (the same "rest until the next input" rule the render scheduler follows).

const AMBIENT_FRAME_MS = 40;
const REST_AFTER_MS = 12_000;

let timer: ReturnType<typeof setTimeout> | 0 = 0;
let last = 0;

/** Asks for the next frame of an ambient animation (at most every 40 ms), unless the page has been idle long enough to rest. */
export function ambientInvalidate(invalidate: () => void) {
  if (timer || typeof document === "undefined" || document.hidden) return;
  if (performance.now() - activity.last > REST_AFTER_MS) return;
  const wait = Math.max(0, AMBIENT_FRAME_MS - (performance.now() - last));
  timer = setTimeout(() => {
    timer = 0;
    last = performance.now();
    invalidate();
  }, wait);
}
