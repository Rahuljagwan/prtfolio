// Shared rules for resume files. Used by the admin upload API and the public download route.
import type { ResumeFileInfo } from "./types";

export const RESUME_KINDS = ["pdf", "docx"] as const;
export type ResumeKind = (typeof RESUME_KINDS)[number];

/** Vercel caps request and response bodies at 4.5 MB, so stay comfortably below it. */
export const MAX_RESUME_BYTES = 3 * 1024 * 1024;

export const RESUME_TYPES: Record<ResumeKind, { mime: string; ext: string; label: string }> = {
  pdf: { mime: "application/pdf", ext: ".pdf", label: "PDF" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
    label: "DOCX",
  },
};

export const isResumeKind = (v: string): v is ResumeKind => (RESUME_KINDS as readonly string[]).includes(v);

/**
 * Content check, not just the file extension. A PDF must start with "%PDF-". A DOCX is a zip ("PK\x03\x04")
 * that contains Word's "word/" folder, which rejects renamed executables and unrelated zip files.
 */
export function hasValidContent(kind: ResumeKind, bytes: Buffer): boolean {
  if (kind === "pdf") return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04 && bytes.includes("word/");
}

/** Keeps only safe characters so the name can go straight into a Content-Disposition header. */
export function safeFilename(original: string, kind: ResumeKind): string {
  const { ext } = RESUME_TYPES[kind];
  const base = original.split(/[\\/]/).pop() ?? "";
  const stem =
    base
      .normalize("NFKD")
      // Strip combining accent marks (U+0300 to U+036F) so an accented "e" becomes a plain "e".
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\.[^.]*$/, "")
      .replace(/[^A-Za-z0-9._() -]+/g, "-")
      .trim()
      .slice(0, 80) || "Resume";
  return `${stem}${ext}`;
}

/**
 * Link for a resume file. Uploaded files are served by /resume/[kind] (inline for "view", attachment for "download").
 * Files dropped in public/resume/ are plain static files, so they link straight to the file.
 */
export function resumeHref(kind: ResumeKind, info: ResumeFileInfo, mode: "view" | "download"): string {
  if (info.source === "public") return `/resume/resume${RESUME_TYPES[kind].ext}`;
  return kind === "pdf" && mode === "download" ? "/resume/pdf?download=1" : `/resume/${kind}`;
}
