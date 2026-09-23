"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-60 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "border border-border hover:bg-muted",
        danger: "border border-red-500/30 text-red-500 hover:bg-red-500/10",
      },
      size: {
        md: "px-5 py-2",
        sm: "px-3.5 py-1.5 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant, size, type = "button", ...rest }, ref) {
  return <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} {...rest} />;
});
