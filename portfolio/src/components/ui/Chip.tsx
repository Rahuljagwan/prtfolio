import { cn } from "@/lib/utils";

type ChipProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> & { children: React.ReactNode };

/** Small pill for technologies and tags. Extra props (for example data-* attributes) go to the element. */
export function Chip({ children, className, ...rest }: ChipProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
