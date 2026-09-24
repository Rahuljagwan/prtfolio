"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useCommandActions } from "@/components/commands/useCommandActions";
import { COMMAND_NAMES, complete, runCommand, type OutLine, type Tone } from "@/lib/commands/terminal";
import type { CommandData, FetchResult } from "@/lib/commands/types";
import { cn } from "@/lib/utils";

const HISTORY_KEY = "terminal-history";
const PROMPT = "visitor@portfolio:~$";

type Row = { kind: "cmd"; text: string } | { kind: "out"; line: OutLine };

const TONE: Record<Tone, string> = { dim: "text-muted-foreground", err: "text-accent", ok: "text-primary", accent: "text-primary font-medium" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadHistory(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function saveHistory(h: string[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(-50)));
  } catch {
    /* storage blocked: history simply is not kept */
  }
}

async function fetchJson(path: string): Promise<FetchResult> {
  const t0 = performance.now();
  const res = await fetch(path, { cache: "no-store" });
  const ms = Math.round(performance.now() - t0);
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, ms, json };
}

function LineView({ line, onNavigate }: { line: OutLine; onNavigate: () => void }) {
  const cls = cn("whitespace-pre-wrap break-words", line.tone && TONE[line.tone], line.href && "underline decoration-primary/40 underline-offset-2 hover:decoration-primary");
  if (!line.href) return <p className={cls}>{line.text || " "}</p>;
  if (line.href.startsWith("/")) {
    return (
      <p className={cls}>
        <Link href={line.href} prefetch={false} onClick={onNavigate}>
          {line.text}
        </Link>
      </p>
    );
  }
  return (
    <p className={cls}>
      <a href={line.href} target={/^(mailto|tel):/.test(line.href) ? undefined : "_blank"} rel="noopener noreferrer">
        {line.text}
      </a>
    </p>
  );
}

/**
 * The site-wide terminal (Ctrl+`). All command behaviour is in lib/commands/terminal.ts (pure, tested); this component is the
 * screen: history, tab completion, output with links, a focus trap and Esc to close. Output appears line by line unless the
 * visitor prefers reduced motion. Loaded on first open, so it costs nothing until then.
 */
export function Terminal({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const actions = useCommandActions();
  const [data, setData] = useState<CommandData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [
    { kind: "out", line: { text: 'Type "help" to see what you can do. Tab completes, Esc closes.', tone: "dim" } },
    { kind: "out", line: { text: 'Try: status · ls projects · open pipeline · health --deep', tone: "dim" } },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const draft = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const previous = useRef<HTMLElement | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    previous.current = document.activeElement as HTMLElement | null;
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    history.current = loadHistory();
    inputRef.current?.focus();
    let live = true;
    fetch("/api/terminal-data")
      .then((r) => (r.ok ? (r.json() as Promise<CommandData>) : Promise.reject(new Error("bad status"))))
      .then((d) => live && setData(d))
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows, busy]);

  const close = useCallback(
    (restoreFocus = true) => {
      if (restoreFocus) previous.current?.focus?.();
      onClose();
    },
    [onClose],
  );

  // Escape closes; Tab stays inside the terminal. Ctrl+` (the shortcut that opened it) closes it again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.code === "Backquote" && e.ctrlKey)) {
        e.preventDefault();
        close();
      } else if (e.key === "Tab" && panel.current) {
        const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>("input, button, a[href]"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const fallback = useMemo<CommandData>(() => ({ sections: [], projects: [], contacts: [], resume: {} }), []);

  const print = useCallback(async (lines: OutLine[]) => {
    if (lines.length <= 1 || reduced.current) {
      setRows((r) => [...r, ...lines.map((line): Row => ({ kind: "out", line }))]);
      return;
    }
    for (const line of lines) {
      setRows((r) => [...r, { kind: "out", line }]);
      await sleep(16);
    }
  }, []);

  const submit = async () => {
    const line = input.trim();
    if (busy) return;
    setInput("");
    cursor.current = -1;
    draft.current = "";
    if (!line) {
      setRows((r) => [...r, { kind: "cmd", text: "" }]);
      return;
    }
    setRows((r) => [...r, { kind: "cmd", text: line }]);
    history.current = [...history.current, line];
    saveHistory(history.current);
    if (!data && !loadError) {
      setRows((r) => [...r, { kind: "out", line: { text: "still loading the site's data, try again in a moment", tone: "dim" } }]);
      return;
    }
    setBusy(true);
    const result = await runCommand(line, { data: data ?? fallback, actions, env: { path: pathname, fetchJson }, history: history.current });
    if (result.clear) setRows([]);
    await print(result.lines);
    setBusy(false);
    if (result.close) close(false); // the command moved the visitor somewhere: do not pull focus back to where they were
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.current.length === 0) return;
      if (cursor.current === -1) draft.current = input;
      cursor.current = Math.min(history.current.length - 1, cursor.current + 1);
      setInput(history.current[history.current.length - 1 - cursor.current]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (cursor.current === -1) return;
      cursor.current -= 1;
      setInput(cursor.current === -1 ? draft.current : history.current[history.current.length - 1 - cursor.current]);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const r = complete(input, data ?? fallback);
      setInput(r.value);
      if (r.options.length > 1) setRows((rs) => [...rs, { kind: "out", line: { text: r.options.join("   "), tone: "dim" } }]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      setRows([]);
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
      e.preventDefault();
      setRows((rs) => [...rs, { kind: "cmd", text: `${input}^C` }]);
      setInput("");
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Terminal"
        data-terminal
        className="relative flex h-[75vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:h-[28rem] sm:rounded-2xl"
        onMouseUp={() => {
          if (!window.getSelection()?.toString()) inputRef.current?.focus();
        }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">terminal · esc to close</span>
          </div>
          <button type="button" onClick={() => close()} aria-label="Close terminal" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <X size={14} aria-hidden />
          </button>
        </div>

        <div ref={scroller} data-lenis-prevent role="log" aria-live="polite" aria-label="Terminal output" className="thin-scroll flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-4 py-3 font-mono text-[13px] leading-relaxed">
          {rows.map((row, i) =>
            row.kind === "cmd" ? (
              <p key={i} className="whitespace-pre-wrap break-words">
                <span className="text-primary">{PROMPT}</span> {row.text}
              </p>
            ) : (
              <LineView key={i} line={row.line} onNavigate={() => close(false)} />
            ),
          )}
          {busy && <p className="text-muted-foreground">…</p>}
          {loadError && rows.length < 4 && <p className="text-accent">could not load the site data; the built-in commands still work</p>}
        </div>

        <label className="flex items-center gap-2 border-t border-border px-4 py-3 font-mono text-[13px]">
          <span className="shrink-0 text-primary">{PROMPT}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Command"
            placeholder={COMMAND_NAMES.slice(0, 4).join(", ") + "…"}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/50"
          />
        </label>
      </div>
    </div>
  );
}
