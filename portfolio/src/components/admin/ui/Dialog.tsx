"use client";

import { useEffect, useRef } from "react";

/**
 * Modal shell: overlay + panel, Esc-to-close, body scroll lock, and focus management (focuses the first focusable
 * element on open, returns focus to whatever triggered it on close). Centralizes what ResourceManager's inline
 * modal used to hand-roll without any of these three.
 */
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'input, textarea, select, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusables?.[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div ref={panelRef} className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
