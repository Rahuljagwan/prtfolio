"use client";

import { forwardRef, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "./Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  trailing?: React.ReactNode;
  /** Grows with content instead of scrolling internally. Default true. */
  autoGrow?: boolean;
}

function setRefs<T>(refs: (React.Ref<T> | undefined)[], value: T | null) {
  for (const ref of refs) {
    if (!ref) continue;
    if (typeof ref === "function") ref(value);
    else (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { error, trailing, autoGrow = true, className, onInput, rows = 3, ...rest },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null) as React.MutableRefObject<HTMLTextAreaElement | null>;

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    if (autoGrow && inner.current) grow(inner.current);
  }, [autoGrow, rest.value]);

  return (
    // Same min-w-0 + flex-1 reasoning as Input.tsx: load-bearing inside a flex row (list-item rows), a no-op elsewhere.
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={(el) => {
          inner.current = el;
          setRefs([ref], el);
        }}
        rows={rows}
        aria-invalid={error || undefined}
        className={cn(inputBase, "resize-none", error ? "border-red-500/60 focus:border-red-500" : "border-border", trailing && "pr-9", className)}
        onInput={(e) => {
          if (autoGrow) grow(e.currentTarget);
          onInput?.(e);
        }}
        {...rest}
      />
      {trailing && <div className="absolute right-1 top-1.5">{trailing}</div>}
    </div>
  );
});
