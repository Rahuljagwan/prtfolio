"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { useActiveSection } from "@/hooks/useActiveSection";
import { SECTIONS } from "@/content/sections";
import { cn } from "@/lib/utils";
import { AssistantLink } from "@/components/ui/AssistantLink";
import { SoundToggle } from "@/components/audio/SoundToggle";
import { ThemeToggle } from "./ThemeToggle";
import { OPEN_PALETTE_EVENT } from "./CommandPalette";

const navItems = SECTIONS.filter((s) => s.inNav);
const ids = navItems.map((s) => s.id);

export function Navbar() {
  const active = useActiveSection(ids);
  const [open, setOpen] = useState(false);
  const activeLabel = navItems.find((s) => s.id === active)?.label ?? "Menu";

  // Close the mobile menu on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Primary"
        className="relative flex items-center gap-1 rounded-full border border-border bg-background/70 p-1.5 shadow-sm backdrop-blur-xl"
      >
        {/* Desktop: full pill with all links. */}
        <div className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = active === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </a>
            );
          })}
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            aria-label="Open command palette"
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Ctrl K
          </button>
          <AssistantLink className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10">
            <Sparkles size={14} aria-hidden /> Ask
          </AssistantLink>
        </div>

        {/* Mobile: current section plus a dropdown, so six links never overflow a narrow screen. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground lg:hidden"
        >
          {activeLabel}
          <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
        </button>

        <SoundToggle />
        <ThemeToggle />

        <AnimatePresence>
          {open && (
            <motion.ul
              id="mobile-menu"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur-xl lg:hidden"
            >
              {navItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setOpen(false)}
                    aria-current={active === item.id ? "true" : undefined}
                    className={cn(
                      "block rounded-xl px-4 py-2.5 text-sm",
                      active === item.id ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <AssistantLink className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-primary">
                  <Sparkles size={14} aria-hidden /> Ask the assistant
                </AssistantLink>
              </li>
              {/* The desktop pill has a "Ctrl K" button (lg:flex, above); this is the equivalent for touch, since Ctrl+K has
                  no touch equivalent otherwise. Only here, not in the shared footer: the palette is mounted on this page alone. */}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm text-muted-foreground"
                >
                  <Search size={14} aria-hidden /> Commands
                </button>
              </li>
            </motion.ul>
          )}
        </AnimatePresence>
      </motion.nav>
    </header>
  );
}
