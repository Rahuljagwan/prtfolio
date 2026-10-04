import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SHOW_SAMPLES } from "@/lib/samples";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { CodeBlock } from "@/components/engineering/CodeBlock";
import { PageHeader, SampleNote } from "@/components/engineering/parts";
import { SampleChip } from "@/components/ui/SampleChip";
import { NOTES, type Note, type NoteBlock } from "@/content/notes";
import type { Lang } from "@/lib/highlight";
import { getPortfolio } from "@/lib/portfolio";

interface Params {
  params: { slug: string };
}

const LANGS: Lang[] = ["nginx", "ini", "yaml", "bash"];

export function generateStaticParams() {
  return SHOW_SAMPLES ? NOTES.map((n) => ({ slug: n.slug })) : [];
}

export function generateMetadata({ params }: Params): Metadata {
  const n = NOTES.find((x) => x.slug === params.slug);
  if (!n) return { title: "Note not found" };
  return {
    title: `${n.title} | Rahul Jagwan`,
    description: n.summary,
    robots: n.sample ? { index: false, follow: true } : undefined,
  };
}

function Block({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case "p":
      return <p className="leading-relaxed">{block.text}</p>;
    case "h2":
      return <h2 className="pt-4 text-xl font-semibold tracking-tight">{block.text}</h2>;
    case "list":
      return (
        <ul className="space-y-2">
          {block.items.map((t) => (
            <li key={t} className="flex gap-3 leading-relaxed">
              <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
              {t}
            </li>
          ))}
        </ul>
      );
    case "quote":
      return <blockquote className="border-l-2 border-primary pl-4 italic text-muted-foreground">{block.text}</blockquote>;
    case "code": {
      const lang = LANGS.find((l) => l === block.lang) ?? "bash";
      return <CodeBlock code={block.text} lang={lang} />;
    }
  }
}

export default async function NotePage({ params }: Params) {
  const note: Note | undefined = SHOW_SAMPLES ? NOTES.find((x) => x.slug === params.slug) : undefined; // every note is a sample
  if (!note) notFound();
  const { profile } = await getPortfolio();

  // Structured data only for real writing: an illustrative note carries none.
  const jsonLd = note.sample ? null : { "@context": "https://schema.org", "@type": "Article", headline: note.title, datePublished: note.date, description: note.summary, author: { "@type": "Person", name: profile.name }, keywords: note.tags.join(", ") };

  return (
    <SubpageShell current="Notes">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      <PageHeader eyebrow={note.date} title={note.title} intro={note.summary} back={{ href: "/notes", label: "All notes" }} sample={note.sample} />
      {note.sample && <SampleNote>This note is an illustrative example of the format, not published writing.</SampleNote>}
      <article className="mt-10 max-w-2xl space-y-5">
        {note.body.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </article>
      <p className="mt-12 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {note.tags.map((t) => (
          <span key={t} className="rounded-full border border-border bg-muted/60 px-3 py-1 text-xs">
            {t}
          </span>
        ))}
        {note.sample && <SampleChip />}
      </p>
    </SubpageShell>
  );
}
