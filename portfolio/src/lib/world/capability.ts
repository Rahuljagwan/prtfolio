// Shared "should this device run a WebGL scene at all?" gate, used by the home world and the assistant page.

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/**
 * Conservative gate. The 3D world is a desktop enhancement; phones and tablets keep the fast 2D page by design.
 * Anything doubtful gets the static version, which is always complete and fully usable.
 */
export function canRun3D(): boolean {
  if (new URLSearchParams(window.location.search).has("lite")) return false; // manual override / A-B testing
  const media = (q: string) => window.matchMedia(q).matches;
  if (media("(prefers-reduced-motion: reduce)")) return false;
  if (media("(pointer: coarse)") || window.innerWidth < 900) return false; // phones and tablets
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) return false;
  return true; // no WebGL probe: creating a throwaway context costs main-thread time; the real context failing is handled below
}
