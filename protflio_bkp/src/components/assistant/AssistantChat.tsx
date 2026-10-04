"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Sparkles } from "lucide-react";
import { Magnetic } from "@/components/ui/Magnetic";
import { Reveal } from "@/components/ui/Reveal";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { cn } from "@/lib/utils";
import { CLUSTER_COLORS, type AnswerPhase } from "./bridge";

interface Source {
  label: string;
  anchor: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  grounded?: boolean;
  error?: boolean;
}

const MAX_CHARS = 300;
/** Words beyond this many appear together instead of one by one, so a long answer never takes seconds to finish revealing. */
const STAGGERED_WORDS = 90;

/** Renders answer text: "• " lines become list items, blank lines become paragraph breaks. Words fade in one after another. */
function AnswerText({ text }: { text: string }) {
  const blocks: { type: "p" | "ul"; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    const isBullet = line.startsWith("• ");
    const last = blocks[blocks.length - 1];
    if (isBullet) {
      if (last?.type === "ul") last.lines.push(line.slice(2));
      else blocks.push({ type: "ul", lines: [line.slice(2)] });
    } else {
      blocks.push({ type: "p", lines: [line] });
    }
  }

  let n = 0; // running word index across the whole answer, for the stagger
  const words = (s: string) =>
    s.split(" ").map((w, i) => (
      // The space sits outside the span: an inline-block swallows a trailing space, which would glue the words together.
      <Fragment key={i}>
        <span className="answer-word" style={{ "--i": Math.min(n++, STAGGERED_WORDS) } as React.CSSProperties}>
          {w}
        </span>{" "}
      </Fragment>
    ));

  return (
    <div className="space-y-3 text-[0.95rem] leading-relaxed">
      {blocks.map((b, i) =>
        b.type === "p" ? (
          <p key={i}>{words(b.lines[0])}</p>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-2.5">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{words(l)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

interface ChatProps {
  name: string;
  suggestions: string[];
  llm: boolean;
  /** Tells the page (and through it the 3D scene) what the assistant is doing and which sections an answer came from. */
  onPhase: (phase: AnswerPhase, anchors: string[]) => void;
  /** Section a source chip is pointed at, so the scene can highlight it. */
  onSourceHover: (anchor: string | null) => void;
  className?: string;
}

export function AssistantChat({ name, suggestions, llm, onPhase, onSourceHover, className }: ChatProps) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [messages, busy, reduce]);

  const send = async (raw: string) => {
    const question = raw.trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    onPhase("thinking", []);
    setMessages((m) => [...m, { id: ++idRef.current, role: "user", text: question }]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      const sources: Source[] = data.sources ?? [];
      setMessages((m) => [...m, { id: ++idRef.current, role: "assistant", text: data.answer, sources, grounded: data.grounded }]);
      onPhase(data.grounded ? "answered" : "nomatch", data.grounded ? sources.map((s) => s.anchor) : []);
    } catch (e) {
      setMessages((m) => [...m, { id: ++idRef.current, role: "assistant", text: (e as Error).message, error: true }]);
      onPhase("idle", []);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const empty = messages.length === 0;

  return (
    <div className={cn("assistant-panel flex min-h-[26rem] min-w-0 flex-col rounded-3xl border border-border bg-background/60 shadow-xl", className)}>
      {/* Conversation. aria-live announces new answers to screen readers. */}
      <div role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        {empty && (
          <div className="py-2">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles size={20} aria-hidden />
                </span>
                <div>
                  <h2 className="font-semibold tracking-tight">Try asking</h2>
                  <p className="text-sm text-muted-foreground">
                    Answers come only from the content on this site. If it isn&apos;t in the portfolio, I&apos;ll say so.
                  </p>
                </div>
              </div>
            </Reveal>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <li key={s}>
                  <Reveal delay={0.08 + i * 0.05} y={14} className="h-full">
                    <SpotlightCard className="h-full rounded-2xl">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => send(s)}
                        className="flex h-full w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        <span>{s}</span>
                        <ArrowUp size={14} aria-hidden className="mt-0.5 shrink-0 rotate-45 opacity-50" />
                      </button>
                    </SpotlightCard>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              {m.role === "user" ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[0.95rem] text-primary-foreground shadow-sm">{m.text}</p>
              ) : (
                <div
                  className={cn(
                    "max-w-[94%] rounded-2xl rounded-bl-md border px-5 py-4",
                    m.error ? "border-red-500/40 bg-red-500/10" : "border-border bg-card/90",
                  )}
                >
                  <AnswerText text={m.text} />
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">Source:</span>
                      {m.sources.map((s) => {
                        const col = CLUSTER_COLORS[s.anchor];
                        return (
                          <Link
                            key={s.anchor}
                            href={`/#${s.anchor}`}
                            prefetch={false}
                            onPointerEnter={() => onSourceHover(s.anchor)}
                            onPointerLeave={() => onSourceHover(null)}
                            onFocus={() => onSourceHover(s.anchor)}
                            onBlur={() => onSourceHover(null)}
                            className="legend-chip group inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                          >
                            {col && <span aria-hidden className="legend-dot h-1.5 w-1.5 rounded-full" style={{ "--cl": col.light, "--cd": col.dark } as React.CSSProperties} />}
                            {s.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="flex justify-start" role="status" aria-label="Looking through the portfolio">
            <div className="thinking-bar relative overflow-hidden rounded-2xl rounded-bl-md border border-border bg-card/90 px-5 py-4" aria-hidden>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70 motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
                Searching the portfolio
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border/60 px-4 pb-4 pt-3 sm:px-6">
        {!empty && (
          <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => send(s)}
                className="shrink-0 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-sm text-muted-foreground transition-[border-color,color,transform] hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-full border border-border bg-card/90 p-1.5 pl-5 shadow-sm transition-colors focus-within:border-primary"
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            placeholder={`Ask about ${name}'s work...`}
            aria-label="Your question"
            maxLength={MAX_CHARS}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Magnetic strength={0.2}>
            <button
              type="submit"
              disabled={busy || input.trim() === ""}
              aria-label="Send question"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-[opacity,transform] hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            >
              <ArrowUp size={16} aria-hidden />
            </button>
          </Magnetic>
        </form>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {llm
            ? "Answers are written by an AI model from this portfolio's content only. Your question is sent to the model provider and is not saved by this site."
            : "Answers are assembled from this portfolio's content only. No AI service is called and questions are not saved."}
        </p>
      </div>
    </div>
  );
}
