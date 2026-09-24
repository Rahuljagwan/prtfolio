"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { OPEN_HOOD_EVENT, OPEN_TERMINAL_EVENT } from "@/lib/ops";

// Both panels are fetched the first time they are opened, so this host is the only part that ships with every page: a keydown
// listener and two event listeners.
const Terminal = dynamic(() => import("./Terminal").then((m) => m.Terminal), { ssr: false });
const Hood = dynamic(() => import("@/components/layout/UnderTheHood").then((m) => m.UnderTheHood), { ssr: false });

type Open = "terminal" | "hood" | null;

const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");

/**
 * Site-wide overlays: the terminal (Ctrl+` or the OPEN_TERMINAL_EVENT) and the "Under the hood" panel (OPEN_HOOD_EVENT).
 * Mounted once in the root layout. Off on /admin (the editor has its own keyboard needs). The shortcut is ignored while the
 * visitor is typing in a field, so it can never eat a keystroke that was meant for a form.
 */
export function OverlayHost() {
  const pathname = usePathname();
  const enabled = !pathname.startsWith("/admin");
  const [open, setOpen] = useState<Open>(null);
  // Each panel closes only itself: `open hood` from the terminal opens the hood and then closes the terminal, and that second step
  // must not close the panel that was just opened.
  const closeTerminal = useCallback(() => setOpen((o) => (o === "terminal" ? null : o)), []);
  const closeHood = useCallback(() => setOpen((o) => (o === "hood" ? null : o)), []);

  useEffect(() => {
    if (!enabled) {
      setOpen(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Backquote" || !e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      if (isEditable(e.target)) return;
      e.preventDefault();
      setOpen((o) => (o === "terminal" ? null : "terminal"));
    };
    const openTerminal = () => setOpen("terminal");
    const openHood = () => setOpen("hood");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_TERMINAL_EVENT, openTerminal);
    window.addEventListener(OPEN_HOOD_EVENT, openHood);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_TERMINAL_EVENT, openTerminal);
      window.removeEventListener(OPEN_HOOD_EVENT, openHood);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      {open === "terminal" && <Terminal onClose={closeTerminal} />}
      {open === "hood" && <Hood onClose={closeHood} />}
    </>
  );
}
