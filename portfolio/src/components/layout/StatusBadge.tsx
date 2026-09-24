"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { ageLabel, statusLine } from "@/lib/ops";
import { cn } from "@/lib/utils";

interface Version {
  sha: string;
  builtAt: string | null;
  env: string;
  region?: string;
}

type State = { kind: "idle" } | { kind: "checking" } | { kind: "ok"; ms: number; version: Version | null } | { kind: "fail" };

/**
 * The footer status line. It measures a real round trip to this site's own /api/health when it scrolls into view and says
 * only what came back: "operational" if the endpoint answered ok, an amber "health check failed" otherwise. The build
 * line is what /api/version reports (commit, build time, and "local build" unless the host says it is a deployment).
 * It deliberately links nowhere (no repository or commit URL) and never claims "deployed" or an uptime figure.
 */
export function StatusBadge() {
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    setState({ kind: "checking" });
    try {
      const t0 = performance.now();
      const res = await fetch("/api/health", { cache: "no-store" });
      const ms = Math.round(performance.now() - t0);
      const body = (await res.json().catch(() => null)) as { status?: string } | null;
      if (!res.ok || body?.status !== "ok") throw new Error("unhealthy");
      let version: Version | null = null;
      try {
        const v = await fetch("/api/version", { cache: "no-store" });
        if (v.ok) version = (await v.json()) as Version;
      } catch {
        /* the badge still reports health without the build line */
      }
      setState({ kind: "ok", ms, version });
    } catch {
      setState({ kind: "fail" });
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          void check();
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [check]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`curl -s ${window.location.origin}/api/health`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the command is visible in the title anyway */
    }
  };

  const built = state.kind === "ok" && state.version?.builtAt ? ageLabel(Date.parse(state.version.builtAt), Date.now()) : "";
  const dot = state.kind === "ok" ? "bg-primary" : state.kind === "fail" ? "bg-accent" : "bg-border";

  return (
    <div ref={ref} aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot, state.kind === "checking" && "animate-pulse")} />
        {state.kind === "ok" && (
          <span>
            operational <span className="opacity-70">· {state.ms} ms round trip</span>
          </span>
        )}
        {state.kind === "fail" && <span className="text-accent">health check failed</span>}
        {(state.kind === "idle" || state.kind === "checking") && <span>checking…</span>}
      </span>

      {state.kind === "ok" && state.version && (
        <>
          <span>build {state.version.sha}</span>
          {built && <span>built {built}</span>}
          <span>{statusLine({ env: state.version.env, region: state.version.region })}</span>
        </>
      )}

      <button
        type="button"
        onClick={copy}
        title="Copy: curl -s <this site>/api/health"
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
        {copied ? "copied" : "curl /api/health"}
      </button>
      {state.kind !== "checking" && state.kind !== "idle" && (
        <button type="button" onClick={check} aria-label="Check again" className="inline-flex items-center gap-1 transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <RefreshCw size={12} aria-hidden /> recheck
        </button>
      )}
    </div>
  );
}
