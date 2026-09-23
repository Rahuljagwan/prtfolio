"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useThemeTransition } from "@/hooks/useThemeTransition";
import { ArrowRight, Search } from "lucide-react";
import { SECTIONS } from "@/content/sections";
import { contactHref, WHATSAPP_GREETING } from "@/lib/contact";
import { resumeHref } from "@/lib/resume";
import type { ContactLink, ResumeInfo } from "@/lib/types";

export const OPEN_PALETTE_EVENT = "open-command-palette";

interface Command {
  id: string;
  label: string;
  group: "Go to" | "Actions" | "Contact" | "Resume";
  run: () => void;
}

const CONTACT_LABELS: Record<ContactLink["type"], string> = {
  email: "Send an email",
  phone: "Call",
  whatsapp: "Open WhatsApp",
  linkedin: "Open LinkedIn",
  github: "Open GitHub",
};

export function CommandPalette({ contacts, resume }: { contacts: ContactLink[]; resume: ResumeInfo }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toggle: toggleTheme, resolvedTheme } = useThemeTransition();

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const goTo = SECTIONS.map<Command>((s) => ({
      id: `go-${s.id}`,
      label: s.label,
      group: "Go to",
      run: () => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }),
    }));
    const actions: Command[] = [
      { id: "ask", label: "Ask the assistant", group: "Actions", run: () => router.push("/assistant") },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        run: () => toggleTheme(),
      },
    ];
    const contact = contacts.map<Command>((c) => ({
      id: `contact-${c.type}`,
      label: CONTACT_LABELS[c.type],
      group: "Contact",
      run: () => window.open(contactHref(c, WHATSAPP_GREETING), c.type === "email" || c.type === "phone" ? "_self" : "_blank", "noopener"),
    }));
    const resumeCmds: Command[] = [];
    if (resume.pdf) {
      resumeCmds.push({ id: "resume-view", label: "View resume in browser", group: "Resume", run: () => window.open(resumeHref("pdf", resume.pdf!, "view"), "_blank", "noopener") });
      resumeCmds.push({ id: "resume-pdf", label: "Download resume (PDF)", group: "Resume", run: () => window.location.assign(resumeHref("pdf", resume.pdf!, "download")) });
    }
    if (resume.docx) {
      resumeCmds.push({ id: "resume-docx", label: "Download resume (DOCX)", group: "Resume", run: () => window.location.assign(resumeHref("docx", resume.docx!, "download")) });
    }
    return [...goTo, ...actions, ...resumeCmds, ...contact];
  }, [contacts, resume, resolvedTheme, toggleTheme, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands;
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const execute = (cmd?: Command) => {
    if (!cmd) return;
    close();
    // Let the panel close before scrolling so the animation is not fighting the scroll.
    setTimeout(cmd.run, 120);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      execute(filtered[index]);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-background/60 px-4 pt-[18vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={close}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={16} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Search sections and actions..."
                aria-label="Search commands"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <ul className="thin-scroll max-h-72 overflow-y-auto p-2" role="listbox">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No results</li>}
              {filtered.map((cmd, i) => (
                <li key={cmd.id} role="option" aria-selected={i === index}>
                  <button
                    type="button"
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => execute(cmd)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${
                      i === index ? "bg-primary/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span>{cmd.label}</span>
                    <span className="flex items-center gap-2 text-xs">
                      {cmd.group}
                      <ArrowRight size={12} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
