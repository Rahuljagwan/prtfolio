// A tiny way for any component to ask for a sound without importing the sound engine (which is loaded later, only for visitors who turn
// sound on). It just dispatches a window event; the SoundController listens. With sound off, nothing listens and it costs nothing.

export const SFX_EVENT = "sfx:cue";

export type CueName = "stage" | "station" | "flip";

/** Asks for a named sound. `i` is an index where the sound climbs a scale (the nth stage, the nth project). */
export function cue(name: CueName, i = 0) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SFX_EVENT, { detail: { name, i } }));
}
