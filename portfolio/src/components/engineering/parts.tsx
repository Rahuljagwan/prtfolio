import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SampleChip } from "@/components/ui/SampleChip";

/** Heading block shared by every engineering page. `back` is the parent route. */
export function PageHeader({ eyebrow, title, intro, back = { href: "/engineering", label: "Engineering" }, sample }: { eyebrow: string; title: string; intro: string; back?: { href: string; label: string }; sample?: boolean }) {
  return (
    <header>
      <Link href={back.href} prefetch={false} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft size={14} aria-hidden /> {back.label}
      </Link>
      <p className="mt-8 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-primary">
        {eyebrow}
        {sample && <SampleChip />}
      </p>
      <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">{intro}</p>
    </header>
  );
}

/** Banner for a page whose content is illustrative. */
export function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="mt-8 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
      <strong className="font-medium">Sample content.</strong> {children}
    </p>
  );
}
