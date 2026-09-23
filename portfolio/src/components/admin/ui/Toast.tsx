"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Toast {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
  action?: { label: string; onClick: () => void };
}

type PushToast = (t: Omit<Toast, "id">) => void;
const ToastContext = createContext<PushToast | null>(null);

const ICON: Record<Toast["tone"], React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-primary" />,
  error: <XCircle size={16} className="text-red-500" />,
  info: <Info size={16} className="text-muted-foreground" />,
};

/** Mounted once in Dashboard. Replaces the three separate ad-hoc flash-text patterns across the admin. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback<PushToast>((t) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { ...t, id }]);
    const ttl = t.action ? 5000 : 3000;
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-card/95 px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
              "animate-fade-up",
            )}
          >
            {ICON[t.tone]}
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Falls back to a no-op if used outside the provider (never happens in practice, but keeps callers crash-free). */
export function useToast(): PushToast {
  const ctx = useContext(ToastContext);
  return ctx ?? (() => {});
}
