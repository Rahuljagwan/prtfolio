"use client";

import { useSyncExternalStore } from "react";
import { getAdminStatus, subscribeAdminStatus } from "@/lib/admin/status";
import { cn } from "@/lib/utils";

/**
 * Plain DOM indicator, independent of WebGL support (save feedback must work even with the 3D backdrop off):
 * hidden when idle, amber pulse while a mutation is pending, green flash on success, red flash on error.
 */
export function StatusOrb() {
  const status = useSyncExternalStore(subscribeAdminStatus, getAdminStatus, () => "idle" as const);

  if (status === "idle") return <span className="h-2.5 w-2.5" aria-hidden />;

  return (
    <span
      role="status"
      aria-label={status === "pending" ? "Saving" : status === "success" ? "Saved" : "Save failed"}
      className={cn(
        "h-2.5 w-2.5 rounded-full transition-colors duration-300",
        status === "pending" && "animate-pulse bg-accent",
        status === "success" && "bg-primary",
        status === "error" && "bg-red-500",
      )}
    />
  );
}
