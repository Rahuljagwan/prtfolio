"use client";

import { useEffect, useRef, useState } from "react";

export type LiveState = { status: "idle" | "checking" | "reachable" | "unreachable"; ms?: number };

const TIMEOUT_MS = 5000;

/**
 * An honest reachability check for a public demo, run from the visitor's own browser, once, when the element scrolls into
 * view. `mode: "no-cors"` means the response is opaque: it proves the host answered, not that the app is healthy, and it can
 * never report an HTTP status. So the result is "reachable" or "unreachable", with the measured round trip. It cannot
 * claim "up", and a host that is down cannot look reachable.
 */
export function useLiveCheck(url: string | undefined) {
  const ref = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<LiveState>({ status: "idle" });

  useEffect(() => {
    const el = ref.current;
    if (!url || !el) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      setState({ status: "checking" });
      const t0 = performance.now();
      timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
        setState({ status: "reachable", ms: Math.round(performance.now() - t0) });
      } catch {
        setState({ status: "unreachable" });
      } finally {
        clearTimeout(timer);
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          io.disconnect();
          void run();
        }
      },
      { rootMargin: "80px" },
    );
    io.observe(el);

    return () => {
      io.disconnect();
      clearTimeout(timer);
      controller.abort();
    };
  }, [url]);

  return { ref, state };
}
