"use client";

import { useEffect } from "react";
import { SFX_EVENT } from "@/lib/audio/cues";
import { sound } from "@/lib/audio/store";
import { scrollDuration } from "@/lib/scroll-state";
import { INCIDENT_EVENT, SEND_REQUEST_EVENT } from "@/lib/world/events";
import { OPEN_PROJECT_EVENT } from "@/lib/projects/utils";
import { OPEN_HOOD_EVENT, OPEN_TERMINAL_EVENT } from "@/lib/ops";
import { OPEN_PALETTE_EVENT } from "@/components/layout/CommandPalette";

// What is worth a hover sound or a click sound: controls, links, and the cards that behave like them.
const INTERACTIVE = "a[href], button:not([disabled]), [role='button'], summary, [data-project-card], .jr-plate";
// The sound toggle makes its own sound, and anything marked data-sfx="off" asks for none.
const SILENT = "[data-sfx='off']";

/**
 * Wires the whole page to the sound engine. It renders nothing. It does nothing at all until the visitor turns sound on (the engine is not
 * even fetched until the page is idle, and then only to be ready for the click that turns it on).
 *
 * It listens for the page's own events and turns them into sounds: the request button and its journey, the incident, the command palette, the
 * terminal, a case study opening, a theme change, a link that travels to another section, the stages of the journey, the stations of the
 * project flight; and, through delegated listeners, hover, click and typing. And once a second-twentieth it asks the engine to follow the 3D
 * world (the journey's chords and gates, the helicopter, the ambient life).
 *
 * A remembered "on" cannot start audio by itself (a browser requires a gesture first), so the first click, key press or touch resumes it.
 */
export function SoundController() {
  useEffect(() => {
    sound.restore();

    // Fetch the engine once the page is quiet, so it is ready the instant a click asks for it.
    let idle = 0;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    const load = () => void sound.load();
    if ("requestIdleCallback" in window) idle = window.requestIdleCallback(load, { timeout: 4000 });
    else loadTimer = setTimeout(load, 2000);

    // A remembered "on": the first gesture of the visit starts the audio.
    const gestures = ["pointerup", "keydown", "touchend", "click"] as const;
    const onGesture = () => {
      if (!sound.getOn()) return;
      const e = sound.getEngine();
      if (!e) {
        void sound.load().then((eng) => sound.getOn() && eng.enable());
        return;
      }
      if (!e.isRunning()) e.enable();
      if (e.isRunning()) gestures.forEach((g) => window.removeEventListener(g, onGesture, true));
    };
    gestures.forEach((g) => window.addEventListener(g, onGesture, true));

    const play = (name: string, i = 0, o: { dark?: boolean; dur?: number; kind?: string } = {}) => sound.getEngine()?.cue(name, i, o);

    // ---- the page's own events
    const on = (type: string, fn: (e: Event) => void) => {
      window.addEventListener(type, fn);
      return () => window.removeEventListener(type, fn);
    };
    const offs = [
      on(SEND_REQUEST_EVENT, () => play("request")),
      on(INCIDENT_EVENT, () => play("incident")),
      on(OPEN_PALETTE_EVENT, () => play("palette")),
      on(OPEN_PROJECT_EVENT, () => play("open")),
      on(OPEN_TERMINAL_EVENT, () => play("panel")),
      on(OPEN_HOOD_EVENT, () => play("panel")),
      on(SFX_EVENT, (e) => {
        const d = (e as CustomEvent<{ name: string; i?: number }>).detail;
        if (d.name === "stage") play("stage", d.i ?? 0);
        else if (d.name === "station") play("station", d.i ?? 0);
      }),
    ];

    // ---- hover, click, typing (delegated: no component needs any sound code of its own)
    let lastHover: Element | null = null;
    let lastHoverAt = 0;
    const onOver = (e: PointerEvent) => {
      if (!sound.getOn() || e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE) ?? null;
      if (el === lastHover) return;
      lastHover = el;
      if (!el || el.closest(SILENT)) return;
      const now = performance.now();
      if (now - lastHoverAt < 70) return;
      lastHoverAt = now;
      play(el.matches("[data-project-card], .jr-plate") ? "card" : "hover");
    };
    const onClick = (e: MouseEvent) => {
      if (!sound.getOn()) return;
      const el = (e.target as Element | null)?.closest?.(INTERACTIVE);
      if (!el || el.closest(SILENT)) return;
      // A link to another section is a journey along the route: its sound lasts as long as the camera's move does.
      if (el instanceof HTMLAnchorElement) {
        const href = el.getAttribute("href") ?? "";
        const target = href.startsWith("#") && href.length > 1 ? document.getElementById(decodeURIComponent(href.slice(1))) : null;
        if (target) {
          const screens = Math.abs(target.getBoundingClientRect().top - 96) / Math.max(1, window.innerHeight);
          play("travel", 0, { dur: scrollDuration(screens) });
          return;
        }
      }
      play("click");
    };
    let typed = 0;
    const onKey = (e: KeyboardEvent) => {
      if (!sound.getOn() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as Element | null;
      if (!t?.closest?.("[data-terminal] input")) return;
      if (e.key === "Enter") play("enter");
      else if (e.key.length === 1 || e.key === "Backspace") play("type", typed++);
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);

    // ---- theme: a bright rising chime into the light, a deeper falling one into the dark
    let dark = document.documentElement.classList.contains("dark");
    const themeObserver = new MutationObserver(() => {
      const now = document.documentElement.classList.contains("dark");
      if (now === dark) return;
      dark = now;
      play("theme", 0, { dark });
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // ---- the clock: follow the 3D world, and rest while the tab is hidden
    const tick = setInterval(() => sound.getEngine()?.update(performance.now()), 50);
    const onVisibility = () => sound.getEngine()?.setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (idle) window.cancelIdleCallback(idle);
      if (loadTimer) clearTimeout(loadTimer);
      gestures.forEach((g) => window.removeEventListener(g, onGesture, true));
      offs.forEach((off) => off());
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      themeObserver.disconnect();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
