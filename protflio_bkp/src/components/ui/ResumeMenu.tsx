"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, ExternalLink, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { resumeHref } from "@/lib/resume";
import type { ResumeInfo } from "@/lib/types";

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface Option {
  label: string;
  hint: string;
  href: string;
  icon: typeof Download;
  newTab?: boolean;
  download?: boolean;
}

/**
 * "Resume" button with a small menu: view the PDF in the browser, download the PDF, download the DOCX.
 * Only options for files that have been uploaded in /admin are shown; with no files the button is not rendered.
 */
export function ResumeMenu({ resume }: { resume: ResumeInfo }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options: Option[] = [];
  if (resume.pdf) {
    options.push({ label: "View in browser", hint: "PDF", href: resumeHref("pdf", resume.pdf, "view"), icon: ExternalLink, newTab: true });
    options.push({ label: "Download PDF", hint: formatSize(resume.pdf.size), href: resumeHref("pdf", resume.pdf, "download"), icon: Download, download: resume.pdf.source === "public" });
  }
  if (resume.docx) {
    options.push({ label: "Download DOCX", hint: formatSize(resume.docx.size), href: resumeHref("docx", resume.docx, "download"), icon: Download, download: true });
  }
  if (options.length === 0) return null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/60 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <FileText size={16} aria-hidden />
        Resume
        <ChevronDown size={14} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-20 mt-2 min-w-[15rem] overflow-hidden rounded-2xl border border-border bg-card/95 p-1.5 shadow-xl backdrop-blur-xl"
          >
            {options.map((o) => (
              <li key={o.label} role="none">
                <a
                  role="menuitem"
                  href={o.href}
                  {...(o.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  {...(o.download ? { download: "" } : {})}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-primary/10"
                >
                  <o.icon size={16} className="text-primary" aria-hidden />
                  <span className="flex-1">{o.label}</span>
                  <span className="text-xs text-muted-foreground">{o.hint}</span>
                </a>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
