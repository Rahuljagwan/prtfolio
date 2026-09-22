"use client";

import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { RESUME_KINDS, RESUME_TYPES, MAX_RESUME_BYTES, type ResumeKind } from "@/lib/resume";
import { adminFetch } from "./client";

export interface ResumeMeta {
  kind: string;
  filename: string;
  size: number;
  updatedAt: string;
}

const formatSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Slot({ kind, initial }: { kind: ResumeKind; initial?: ResumeMeta }) {
  const type = RESUME_TYPES[kind];
  const [file, setFile] = useState<ResumeMeta | undefined>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (picked: File) => {
    setMessage(null);
    if (picked.size > MAX_RESUME_BYTES) {
      setMessage({ text: "File is too large. The limit is 3 MB.", error: true });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", picked);
      const res = await fetch(`/api/admin/resume/${kind}`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Upload failed (${res.status})`);
      setFile(data);
      setMessage({ text: "Uploaded. The site is updated." });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove the ${type.label} resume? Visitors will no longer be able to download it.`)) return;
    setBusy(true);
    try {
      await adminFetch(`/api/admin/resume/${kind}`, "DELETE");
      setFile(undefined);
      setMessage({ text: "Removed." });
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label={`${type.label} resume`} className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <FileText size={18} aria-hidden />
          </span>
          <div>
            <h3 className="font-semibold">{type.label} resume</h3>
            {file ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {file.filename} · {formatSize(file.size)} · updated {new Date(file.updatedAt).toLocaleDateString()}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Nothing uploaded. This option stays hidden on the site.</p>
            )}
          </div>
        </div>
        {file && (
          <button type="button" onClick={remove} disabled={busy} aria-label={`Remove ${type.label} resume`} className="rounded-md p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref={input}
          id={`resume-${kind}`}
          type="file"
          accept={`${type.ext},${type.mime}`}
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="sr-only"
        />
        <label
          htmlFor={`resume-${kind}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 has-[:disabled]:opacity-60"
        >
          <Upload size={15} aria-hidden />
          {busy ? "Working..." : file ? `Replace ${type.label}` : `Upload ${type.label}`}
        </label>
        {/* Fixed-height slot so nothing jumps when a message appears. */}
        <p role="status" aria-live="polite" className={`min-h-5 text-sm ${message?.error ? "text-red-500" : "text-muted-foreground"}`}>
          {message?.text}
        </p>
      </div>
    </section>
  );
}

export function ResumeManager({ initial }: { initial: ResumeMeta[] }) {
  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Upload your resume here and it goes live immediately, with no redeploy. Files are stored in the database (3 MB limit each).
        The site shows only the options you have uploaded: <em>View in browser</em> and <em>Download PDF</em> need a PDF,
        <em> Download DOCX</em> needs a DOCX.
      </p>
      {RESUME_KINDS.map((kind) => (
        <Slot key={kind} kind={kind} initial={initial.find((f) => f.kind === kind)} />
      ))}
    </div>
  );
}
