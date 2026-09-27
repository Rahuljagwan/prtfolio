"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useThemeTransition } from "@/hooks/useThemeTransition";
import { OPEN_HOOD_EVENT, OPEN_TERMINAL_EVENT } from "@/lib/ops";
import { OPEN_PROJECT_EVENT } from "@/lib/projects/utils";
import { INCIDENT_EVENT } from "@/lib/world/events";
import { smoothScrollToId } from "@/lib/scroll-state";
import type { CommandActions } from "@/lib/commands/types";

/**
 * The real implementations of everything a command can do, shared by the palette and the terminal. Section scrolling works
 * from any page: off the home page it navigates to /#id first.
 */
export function useCommandActions(): CommandActions {
  const router = useRouter();
  const pathname = usePathname();
  const { toggle, resolvedTheme } = useThemeTransition();

  return useMemo<CommandActions>(() => {
    const scrollTo = (id: string) => {
      if (pathname === "/") smoothScrollToId(id);
      else router.push(`/#${id}`);
    };
    return {
      navigate: (path) => router.push(path),
      scrollTo,
      openProject: (id) => window.dispatchEvent(new CustomEvent(OPEN_PROJECT_EVENT, { detail: { id } })),
      toggleTheme: () => toggle(),
      setTheme: (mode) => {
        if (resolvedTheme !== mode) toggle();
      },
      currentTheme: () => (resolvedTheme === "dark" ? "dark" : "light"),
      openHood: () => window.dispatchEvent(new Event(OPEN_HOOD_EVENT)),
      openTerminal: () => window.dispatchEvent(new Event(OPEN_TERMINAL_EVENT)),
      // The sequence lives in the 3D Stack zone: it needs the home page and a running world. Then bring the section into view.
      triggerIncident: () => {
        if (pathname !== "/" || document.documentElement.dataset.world !== "ready") return false;
        window.dispatchEvent(new Event(INCIDENT_EVENT));
        scrollTo("skills");
        return true;
      },
      open: (url, target) => {
        if (target === "self") window.location.assign(url);
        else window.open(url, "_blank", "noopener");
      },
      download: (url) => window.location.assign(url),
    };
  }, [router, pathname, toggle, resolvedTheme]);
}
