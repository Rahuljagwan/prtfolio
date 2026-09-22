"use client";

import { useEffect, useState } from "react";
import { canRun3D } from "@/lib/world/capability";

/**
 * A one-line acknowledgment shown only on the static fallback (canRun3D() false — phones, reduced motion, data-saver,
 * low-end hardware). Turns the limitation into a deliberate choice instead of leaving a visitor to wonder whether
 * something failed to load. Checked client-side after mount (canRun3D reads window/navigator), so this never renders
 * on the server and never flashes on a device that does get the 3D world.
 */
export function FallbackNote() {
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setFallback(!canRun3D());
  }, []);

  if (!fallback) return null;

  return (
    <p className="mt-3 max-w-md font-mono text-xs text-muted-foreground">
      You&apos;re on the lightweight build — this device skips the 3D scene. Graceful degradation is part of the job.
    </p>
  );
}
