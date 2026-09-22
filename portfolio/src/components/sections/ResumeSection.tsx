import { Download, ExternalLink, FileText } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { Section } from "@/components/ui/Section";
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { RESUME_TYPES, resumeHref, type ResumeKind } from "@/lib/resume";
import type { ResumeInfo } from "@/lib/types";

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

interface Action {
  key: string;
  title: string;
  hint: string;
  href: string;
  icon: typeof Download;
  newTab?: boolean;
  download?: boolean;
}

/** Dedicated resume section. Only options for files that exist are shown; with no files the section is hidden. */
export function ResumeSection({ resume }: { resume: ResumeInfo }) {
  const actions: Action[] = [];
  const pdf = resume.pdf;
  const docx = resume.docx;

  if (pdf) {
    actions.push({ key: "view", title: "View in browser", hint: "Opens the PDF in a new tab", href: resumeHref("pdf", pdf, "view"), icon: ExternalLink, newTab: true });
    actions.push({ key: "pdf", title: "Download PDF", hint: `${formatSize(pdf.size)} · best for sharing`, href: resumeHref("pdf", pdf, "download"), icon: Download, download: pdf.source === "public" });
  }
  if (docx) {
    actions.push({ key: "docx", title: "Download DOCX", hint: `${formatSize(docx.size)} · editable in Word`, href: resumeHref("docx" as ResumeKind, docx, "download"), icon: Download, download: true });
  }
  if (actions.length === 0) return null;

  const updated = [pdf, docx].filter(Boolean).map((f) => new Date(f!.updatedAt).getTime()).sort((a, b) => b - a)[0];
  const label = `${RESUME_TYPES.pdf.label} and ${RESUME_TYPES.docx.label}`;

  return (
    <Section id="resume" eyebrow="Resume" title="Take the details with you.">
      <div className="grid gap-5 md:grid-cols-3">
        {actions.map((a, i) => (
          <Reveal key={a.key} delay={i * 0.08} className="h-full">
            <a
              href={a.href}
              {...(a.newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              {...(a.download ? { download: "" } : {})}
              className="block h-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <SpotlightCard className="flex h-full flex-col p-7">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <a.icon size={20} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.hint}</p>
              </SpotlightCard>
            </a>
          </Reveal>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <FileText size={14} aria-hidden />
        Available as {actions.length > 2 ? label : actions.some((a) => a.key === "docx") ? RESUME_TYPES.docx.label : RESUME_TYPES.pdf.label}
        {updated ? `. Last updated ${new Date(updated).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}.` : "."}
      </p>
    </Section>
  );
}
