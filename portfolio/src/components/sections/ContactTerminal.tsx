"use client";

import { useEffect, useRef, useState } from "react";
// Deliberately from lib/world/events and lib/contact, not from any zone file that imports three.js — Contact ships in
// the ordinary page bundle, so it must stay three.js-free (see RequestCounter.tsx for the reasoning).
import { SEND_REQUEST_EVENT, WAKE_EVENT } from "@/lib/world/events";
import { contactHref, findContact } from "@/lib/contact";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import type { ContactLink } from "@/lib/types";

// Matches RequestOriginZone's TRAVEL_SECONDS exactly: the terminal's "200 OK" lands the instant the packet this
// button sends actually completes its trip across the whole site and arrives back here — the visitor's own message
// is the last request served, closing the loop the hero's "send a request" button opened.
const TRAVEL_SECONDS = 4.6;

type Stage = "idle" | "compose" | "sending" | "done";

/**
 * A terminal-styled way to reach out, sitting alongside the plain contact links above. There is no form backend
 * (see Contact.tsx's own links — they are all mailto/tel/wa.me), so "send" composes a real mailto: and opens the
 * visitor's own mail client; the "200 OK" is the site's own request completing, not a claim that the email was
 * delivered — the line under it says exactly what happened.
 */
export function ContactTerminal({ contacts }: { contacts: ContactLink[] }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const email = findContact(contacts, "email");

  const send = () => {
    if (!email || !message.trim()) return;
    setStage("sending");
    window.dispatchEvent(new Event(WAKE_EVENT));
    window.dispatchEvent(new Event(SEND_REQUEST_EVENT));
    const subject = encodeURIComponent(`Portfolio contact${name ? ` from ${name}` : ""}`);
    const body = encodeURIComponent(message + (name ? `\n\n— ${name}` : ""));
    const mailto = `${contactHref(email)}?subject=${subject}&body=${body}`;
    timer.current = setTimeout(() => {
      setStage("done");
      window.location.href = mailto;
    }, TRAVEL_SECONDS * 1000);
  };

  const reset = () => {
    setStage("idle");
    setName("");
    setMessage("");
  };

  if (!email) return null;

  return (
    <SpotlightCard className="p-5 font-mono text-sm">
      <div className="flex items-center gap-1.5 border-b border-border pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-primary/60" />
        <span className="ml-2 text-xs text-muted-foreground">contact.sh</span>
      </div>
      <div className="mt-3 space-y-2 text-muted-foreground">
        <p>
          <span className="text-primary">$</span> init contact
        </p>
        {stage === "idle" && (
          <button type="button" onClick={() => setStage("compose")} className="text-primary underline-offset-2 hover:underline">
            press enter to start a session
          </button>
        )}
        {stage !== "idle" && (
          <div className="space-y-2">
            <label className="block">
              <span className="text-primary">name (optional):</span>{" "}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={stage !== "compose"}
                className="w-44 border-b border-border bg-transparent text-foreground outline-none disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="text-primary">message:</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={stage !== "compose"}
                rows={3}
                placeholder="what would you like to say?"
                className="mt-1 block w-full resize-none rounded border border-border bg-transparent p-2 text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-60"
              />
            </label>
          </div>
        )}
        {stage === "compose" && (
          <button
            type="button"
            onClick={send}
            disabled={!message.trim()}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            $ send
          </button>
        )}
        {stage === "sending" && <p className="text-accent">packet dispatched, awaiting response…</p>}
        {stage === "done" && (
          <div aria-live="polite" className="space-y-1">
            <p className="text-primary">&lt; HTTP/1.1 200 OK</p>
            <p className="text-xs">Opening your email client to finish sending — nothing leaves this page on its own.</p>
            <button type="button" onClick={reset} className="mt-1 text-xs text-muted-foreground hover:text-foreground">
              new session
            </button>
          </div>
        )}
      </div>
    </SpotlightCard>
  );
}
