// Whether sound is on, and the one place the (lazily loaded) engine is fetched. This file is tiny on purpose: it is part of the page's first
// load, while the engine itself is only fetched at idle after the page has loaded, so the sound design costs a visitor who never turns it
// on nothing but a few hundred bytes.

import type { SoundEngine } from "./engine";

const KEY = "portfolio-sound";

let engine: SoundEngine | null = null;
let loading: Promise<SoundEngine> | null = null;
let on = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((fn) => fn());

export const sound = {
  subscribe(fn: () => void) {
    subs.add(fn);
    return () => {
      subs.delete(fn);
    };
  },
  /** Whether the visitor has sound switched on. */
  getOn: () => on,
  /** The engine once it has loaded, else null. */
  getEngine: () => engine,
  /** Fetches the engine (once). */
  load(): Promise<SoundEngine> {
    if (!loading) loading = import("./engine").then((m) => (engine = m.engine));
    return loading;
  },
  /**
   * Turns sound on or off. Call it straight from the click that asks for it: a browser only lets audio start inside a gesture, so when the
   * engine is already loaded (it is, a moment after the page loads) this starts it synchronously, in the click itself.
   */
  setOn(next: boolean) {
    on = next;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* private mode: it simply does not persist */
    }
    emit();
    if (engine) {
      if (next) engine.enable();
      else engine.disable();
    } else {
      void sound.load().then((e) => {
        if (on) e.enable();
      });
    }
  },
  /** Reads the remembered choice. (The audio itself can only start at the visitor's next gesture: see SoundController.) */
  restore() {
    try {
      if (localStorage.getItem(KEY) === "on" && !on) {
        on = true;
        emit();
      }
    } catch {
      /* private mode */
    }
  },
};
