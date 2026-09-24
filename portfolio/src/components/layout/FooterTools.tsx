"use client";

import { Activity, Terminal } from "lucide-react";
import { OPEN_HOOD_EVENT, OPEN_TERMINAL_EVENT } from "@/lib/ops";

const BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Footer buttons for the two site-wide overlays. They only dispatch events: the overlays themselves live in OverlayHost (root
 * layout), so they open the same way from the keyboard, the command palette, the terminal and here, on every page.
 */
export function FooterTools() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_TERMINAL_EVENT))} aria-haspopup="dialog" title="Open the terminal (Ctrl+`)" className={BTN}>
        <Terminal size={12} aria-hidden /> terminal
        <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">Ctrl `</kbd>
      </button>
      <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_HOOD_EVENT))} aria-haspopup="dialog" className={BTN}>
        <Activity size={12} aria-hidden /> under the hood
      </button>
    </div>
  );
}
