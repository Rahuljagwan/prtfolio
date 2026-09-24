import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOW_SAMPLES } from "@/lib/samples";
import Link from "next/link";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { PageHeader, SampleNote } from "@/components/engineering/parts";
import { SampleChip } from "@/components/ui/SampleChip";
import { NOTES } from "@/content/notes";

export const metadata: Metadata = {
  title: "Notes | Rahul",
  description: "Short technical notes.",
  // Every note is an illustrative sample for now, so the index is kept out of search indexing too.
  robots: { index: false, follow: true },
};

export default function NotesIndex() {
  if (!SHOW_SAMPLES) notFound(); // sample-only page: gone when samples are switched off
  const notes = [...NOTES].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <SubpageShell current="Notes">
      <PageHeader eyebrow="Notes" title="Short notes." intro="Small technical write-ups, kept short on purpose." back={{ href: "/", label: "Portfolio" }} sample />
      <SampleNote>These notes are illustrative examples of the format and tone, not published writing.</SampleNote>
      <ul className="mt-12 space-y-4">
        {notes.map((n) => (
          <li key={n.slug}>
            <Link href={`/notes/${n.slug}`} prefetch={false} className="group block rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40">
              <span className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
                {n.date}
                {n.sample && <SampleChip />}
              </span>
              <span className="mt-2 block text-xl font-semibold group-hover:text-primary">{n.title}</span>
              <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{n.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </SubpageShell>
  );
}
