import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Chapter, Headline, SectionShell } from "@/components/ui/editorial";
import { Reveal } from "@/components/ui/Reveal";
import { RESUME_TYPES, resumeHref, type ResumeKind } from "@/lib/resume";
import type { ResumeInfo } from "@/lib/types";

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface Action {
  key: string;
  title: string;
  hint: string;
  href: string;
  arrow: "out" | "down";
  newTab?: boolean;
  download?: boolean;
}

/** A page being read: two sheets, one with a light passing over it. Decorative, and deliberately without any text. */
function Sheets() {
  return (
    <div className="relative">
      <div aria-hidden className="sheet absolute left-6 top-3 rotate-[5deg] opacity-60" />
      <div aria-hidden className="sheet relative -rotate-[3.5deg]">
        <div className="mb-5 flex items-center gap-3">
          <span className="h-9 w-9 shrink-0 rounded-full bg-primary/20" />
          <div className="flex-1 space-y-2">
            <div className="sheet-line w-3/4" />
            <div className="sheet-line w-1/2 opacity-70" />
          </div>
        </div>
        <div className="space-y-2.5">
          {[100, 92, 96, 70, 100, 88, 60].map((w, i) => (
            <div key={i} className="sheet-line" style={{ width: `${w}%`, opacity: i === 3 ? 0.5 : 1 }} />
          ))}
        </div>
        <div className="mt-6 space-y-2.5">
          {[45, 100, 94, 80, 52].map((w, i) => (
            <div key={i} className="sheet-line" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dedicated resume section. Only options for files that exist are shown; with no files the section is hidden. */
export function ResumeSection({ resume }: { resume: ResumeInfo }) {
  const actions: Action[] = [];
  const pdf = resume.pdf;
  const docx = resume.docx;

  if (pdf) {
    actions.push({ key: "view", title: "View in browser", hint: "Opens the PDF in a new tab", href: resumeHref("pdf", pdf, "view"), arrow: "out", newTab: true });
    actions.push({ key: "pdf", title: "Download PDF", hint: `${formatSize(pdf.size)} · best for sharing`, href: resumeHref("pdf", pdf, "download"), arrow: "down", download: pdf.source === "public" });
  }
  if (docx) {
    actions.push({ key: "docx", title: "Download DOCX", hint: `${formatSize(docx.size)} · editable in Word`, href: resumeHref("docx" as ResumeKind, docx, "download"), arrow: "down", download: true });
  }
  if (actions.length === 0) return null;

  const updated = [pdf, docx].filter(Boolean).map((f) => new Date(f!.updatedAt).getTime()).sort((a, b) => b - a)[0];
  const label = `${RESUME_TYPES.pdf.label} and ${RESUME_TYPES.docx.label}`;

  return (
    <SectionShell id="resume">
      <div className="wrap">
        <div className="grid items-center gap-x-20 gap-y-16 lg:grid-cols-12">
          <Reveal className="flex justify-center lg:col-span-5" variant="fade">
            <div data-parallax="0.3">
              <Sheets />
            </div>
          </Reveal>

          <div className="veil veil-r lg:col-span-7">
            <Chapter n="↓" label="Resume" />
            <Headline lines={["Take the details", "with you."]} className="mt-7 text-5xl md:text-7xl" />

            <div className="mt-12">
              {actions.map((a, i) => (
                <Reveal key={a.key} delay={0.1 + i * 0.08}>
                  <a
                    href={a.href}
                    {...(a.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    {...(a.download ? { download: "" } : {})}
                    className="action group focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="mono-label w-6 shrink-0 text-primary">{String(i + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-2xl font-semibold tracking-tight md:text-3xl">{a.title}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{a.hint}</span>
                    </span>
                    {a.arrow === "down" ? <ArrowDown size={22} aria-hidden className="arrow arrow-down shrink-0 text-primary" /> : <ArrowUpRight size={22} aria-hidden className="arrow shrink-0 text-primary" />}
                  </a>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Available as {actions.length > 2 ? label : actions.some((a) => a.key === "docx") ? RESUME_TYPES.docx.label : RESUME_TYPES.pdf.label}
              {updated ? `. Last updated ${new Date(updated).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}.` : "."}
            </p>
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
