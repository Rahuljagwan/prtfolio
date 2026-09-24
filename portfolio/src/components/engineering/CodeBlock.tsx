"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlight, type Lang, type TokenKind } from "@/lib/highlight";
import { cn } from "@/lib/utils";

const KIND_CLASS: Record<TokenKind, string> = {
  comment: "italic text-muted-foreground",
  string: "text-primary",
  keyword: "text-accent",
  number: "text-accent",
  key: "font-medium text-foreground",
  punct: "text-muted-foreground",
  plain: "text-foreground/90",
};

/**
 * A highlighted code listing with line numbers, a copy button and optional per-line notes. The highlighter is a dependency-free
 * scanner (lib/highlight.ts). Annotated lines get an accent edge and a numbered marker; the notes are listed below the code.
 */
export function CodeBlock({ code, lang, filename, notes = [] }: { code: string; lang: Lang; filename?: string; notes?: { line: number; text: string }[] }) {
  const lines = useMemo(() => highlight(code, lang), [code, lang]);
  const noteByLine = useMemo(() => new Map(notes.map((n, i) => [n.line, i + 1])), [notes]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the text is selectable */
    }
  };

  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-card">
      <figcaption className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <span className="truncate font-mono text-xs text-muted-foreground">{filename ?? lang}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
          {copied ? "copied" : "copy"}
        </button>
      </figcaption>
      <pre className="thin-scroll overflow-x-auto py-3 text-[13px] leading-6" tabIndex={0} aria-label={`${filename ?? lang} listing`}>
        <code className="block min-w-max font-mono">
          {lines.map((tokens, i) => {
            const n = noteByLine.get(i + 1);
            return (
              <span key={i} className={cn("flex border-l-2 pl-0 pr-4", n ? "border-primary bg-primary/5" : "border-transparent")}>
                <span aria-hidden className="w-10 shrink-0 select-none pr-3 text-right text-muted-foreground/60">
                  {i + 1}
                </span>
                <span className="whitespace-pre">
                  {tokens.length === 0 ? " " : tokens.map((t, k) => (
                    <span key={k} className={KIND_CLASS[t.kind]}>
                      {t.text}
                    </span>
                  ))}
                </span>
                {n && (
                  <span aria-hidden className="ml-3 mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 font-sans text-[10px] font-medium text-primary">
                    {n}
                  </span>
                )}
              </span>
            );
          })}
        </code>
      </pre>
      {notes.length > 0 && (
        <ol className="space-y-2 border-t border-border px-4 py-4 text-sm">
          {notes.map((n, i) => (
            <li key={n.line} className="flex gap-3">
              <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-medium text-primary">
                {i + 1}
              </span>
              <span>
                <span className="mr-2 font-mono text-xs text-muted-foreground">line {n.line}</span>
                {n.text}
              </span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
