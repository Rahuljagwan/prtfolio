"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useThemeTransition } from "@/hooks/useThemeTransition";

/** Theme switch. The page change is a circular reveal from this button (see useThemeTransition). */
export function ThemeToggle() {
  const { toggle, resolvedTheme } = useThemeTransition();
  const ref = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dark = mounted && resolvedTheme === "dark";

  const onClick = () => {
    const rect = ref.current?.getBoundingClientRect();
    toggle(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="grid place-items-center"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
