"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { VolumeX } from "lucide-react";
import { sound } from "@/lib/audio/store";

const HINT_KEY = "portfolio-sound-hint";

/**
 * The sound switch, beside the theme switch. Sound is off until a visitor chooses it (a browser would not start it before a gesture anyway,
 * and an unexpected sound is not a kindness); the choice is remembered. Until it has been used once, the icon carries a slow ring to say
 * "there is sound here". While it is on, three small bars move, like a level meter.
 */
export function SoundToggle() {
  const on = useSyncExternalStore(sound.subscribe, sound.getOn, () => false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    try {
      setHint(localStorage.getItem(HINT_KEY) !== "1");
    } catch {
      setHint(true);
    }
  }, []);

  const toggle = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* private mode */
    }
    setHint(false);
    sound.setOn(!on);
  };

  return (
    <button
      type="button"
      data-sfx="off"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      title={on ? "Sound on" : "Sound off: click for the soundscape"}
      className="relative grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {hint && !on && <span aria-hidden className="absolute inset-0 animate-ping rounded-full border border-primary/60 motion-reduce:animate-none" />}
      {on ? (
        <span aria-hidden className="sound-bars text-primary">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <VolumeX size={16} aria-hidden />
      )}
    </button>
  );
}
