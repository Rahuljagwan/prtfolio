// Shared "should this device run a WebGL scene, and how much of it?" gate, used by the home world, the assistant page and the admin backdrop.

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

/** "off": keep the static page. "lite": the whole world, drawn lighter (phones, tablets, modest hardware). "full": desktop. */
export type WorldTier = "off" | "lite" | "full";

/**
 * Decides how the home world runs. The visitor's own settings are always respected (reduced motion and data saver get the static page,
 * which is complete and fully usable, as does `?lite`). Everything else gets the world: a phone, a tablet or a modest machine runs the
 * same scene with a lighter budget (fewer particles and cars, a lower pixel-ratio ceiling), and the resolution governor still steps the
 * pixel ratio down on its own if frames run slow. A device that cannot make a WebGL context at all keeps the static page too (handled
 * where the context is created).
 */
export function worldTier(): WorldTier {
  if (new URLSearchParams(window.location.search).has("lite")) return "off"; // manual override / A-B testing
  const media = (q: string) => window.matchMedia(q).matches;
  if (media("(prefers-reduced-motion: reduce)")) return "off";
  const nav = navigator as NavigatorHints;
  if (nav.connection?.saveData) return "off";
  const small = media("(pointer: coarse)") || window.innerWidth < 900;
  const modest = (nav.deviceMemory !== undefined && nav.deviceMemory < 4) || (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4);
  return small || modest ? "lite" : "full"; // no WebGL probe: creating a throwaway context costs main-thread time
}

/** The highest pixel ratio the world's canvas may use: lower on phones and modest hardware, where every pixel costs more. */
export function worldMaxDpr(): number {
  const nav = navigator as NavigatorHints;
  const veryModest = (nav.deviceMemory !== undefined && nav.deviceMemory < 3) || (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4);
  if (worldTier() === "full") return 1.25;
  return veryModest ? 1 : 1.25;
}

/**
 * The old all-or-nothing gate, kept for the pages whose scene is still a desktop enhancement (the assistant's knowledge scene and the
 * admin backdrop): only the full tier runs them.
 */
export function canRun3D(): boolean {
  return worldTier() === "full";
}
