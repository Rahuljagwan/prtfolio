import { cn } from "@/lib/utils";

/** Marks illustrative content. Amber (attention), never red. Renders inline next to whatever it labels. */
export function SampleChip({ className, label = "Sample" }: { className?: string; label?: string }) {
  return (
    <span
      title="Illustrative content, not a real claim. Replace it with your own."
      className={cn(
        "inline-flex items-center rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-accent",
        className,
      )}
    >
      {label}
    </span>
  );
}
