"use client";

import { cn } from "@/lib/utils";

export function IconButton({
  label,
  onClick,
  disabled,
  variant = "default",
  active,
  children,
}: React.PropsWithChildren<{
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
  active?: boolean;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-30",
        variant === "danger" ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-500" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}
