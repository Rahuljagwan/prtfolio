import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { RESUME_KINDS, RESUME_TYPES } from "./resume";
import type { ResumeInfo } from "./types";

/**
 * Resume files dropped into public/resume/ (resume.pdf and/or resume.docx). Next.js serves them as static files, so
 * no upload or database is needed. This runs at build/revalidate time on the server; missing files are simply skipped.
 */
export async function publicResume(): Promise<ResumeInfo> {
  const found: ResumeInfo = {};
  for (const kind of RESUME_KINDS) {
    const filename = `resume${RESUME_TYPES[kind].ext}`;
    try {
      const stat = await fs.stat(path.join(process.cwd(), "public", "resume", filename));
      if (stat.isFile() && stat.size > 0) {
        found[kind] = { filename, size: stat.size, updatedAt: stat.mtime.toISOString(), source: "public" };
      }
    } catch {
      // not present
    }
  }
  return found;
}
