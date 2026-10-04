"use client";

import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useTheme } from "next-themes";

export interface Origin {
  x: number;
  y: number;
}

/**
 * Switches theme with a circular reveal that expands from `origin` (the toggle button), using the View Transitions API.
 *
 * - Browsers with View Transitions: the new theme is revealed by a growing circle (compositor-driven clip-path).
 * - Browsers without it: a short colour cross-fade (CSS transitions on `html.theme-fading`).
 * - prefers-reduced-motion: an instant switch, no animation at all.
 *
 * The DOM class is flipped synchronously inside the transition callback, so the "new" snapshot always has the right theme.
 */
export function useThemeTransition() {
  const { resolvedTheme, setTheme } = useTheme();

  const toggle = useCallback(
    (origin?: Origin) => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      const root = document.documentElement;

      const apply = () => {
        root.classList.toggle("dark", next === "dark");
        root.style.colorScheme = next;
        // Sync render so React-driven parts (icon, 3D colours) match the snapshot.
        flushSync(() => setTheme(next));
      };

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        apply();
        return;
      }

      if (typeof document.startViewTransition !== "function") {
        root.classList.add("theme-fading");
        apply();
        window.setTimeout(() => root.classList.remove("theme-fading"), 400);
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? 0;
      // Radius to the farthest corner so the circle always covers the whole screen.
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

      const transition = document.startViewTransition(apply);
      transition.ready
        .then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
            { duration: 800, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
          );
        })
        .catch(() => undefined); // transition skipped (e.g. tab hidden): the theme is already applied
    },
    [resolvedTheme, setTheme],
  );

  return { toggle, resolvedTheme };
}
