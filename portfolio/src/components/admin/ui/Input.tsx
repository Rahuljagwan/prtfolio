"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const inputBase =
  "w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  /** Rendered inside the field, right-aligned (the mic button). */
  trailing?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ error, trailing, className, ...rest }, ref) {
  return (
    // min-w-0 + flex-1: a no-op in a block context, but load-bearing wherever this sits inside a flex row (list-item
    // rows: drag handle, this field, a trash button) -- without it the field shrinks to its own intrinsic content
    // width instead of filling the row, which is what "scattered, narrow boxes" actually was.
    <div className="relative min-w-0 flex-1">
      <input
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(inputBase, error ? "border-red-500/60 focus:border-red-500" : "border-border", trailing && "pr-9", className)}
        {...rest}
      />
      {trailing && <div className="absolute right-1 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  );
});
