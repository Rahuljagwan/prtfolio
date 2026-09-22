import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "border border-border bg-background/60 text-foreground hover:bg-muted",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

/** The button look as a class string, for links that need a different element than <a> (for example next/link). */
export const buttonStyles = button;

type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & VariantProps<typeof button>;

export function ButtonLink({ variant, className, ...props }: Props) {
  return <a className={cn(button({ variant }), className)} {...props} />;
}
