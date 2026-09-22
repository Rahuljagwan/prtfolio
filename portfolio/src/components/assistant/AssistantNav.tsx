"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const LINKS = [
  { href: "/#projects", label: "Projects" },
  { href: "/#experience", label: "Experience" },
  { href: "/#skills", label: "Skills" },
  { href: "/#contact", label: "Contact" },
];

/** The same floating pill as the home navigation, so moving between the two pages feels like one site. All links are next/link. */
export function AssistantNav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <motion.nav
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Primary"
        className="relative flex items-center gap-1 rounded-full border border-border bg-background/70 p-1.5 shadow-sm backdrop-blur-xl"
      >
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden /> Portfolio
        </Link>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} prefetch={false} className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <span aria-current="page" className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm text-primary-foreground">
          <Sparkles size={14} aria-hidden /> Ask
        </span>
        <ThemeToggle />
      </motion.nav>
    </header>
  );
}
