"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { rateVital, type Rating, type VitalKey } from "@/lib/ops";
import { cn } from "@/lib/utils";

// Everything on this panel is measured live, in THIS visitor's browser, for THIS visit. It is not a lab score, and a weak number
// is shown as it is. Amber marks "needs improvement" and "poor" (red is reserved for the incident sequence elsewhere on the site).

const SECURITY_HEADERS = ["strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy", "x-frame-options", "content-security-policy"];

interface Vitals {
  fcp?: number;
  lcp?: number;
  cls?: number;
  ttfb?: number;
  inp?: number;
}

/** Collects vitals with PerformanceObserver (buffered, so entries from before this panel opened are included). */
function useVitals(): Vitals {
  const [v, setV] = useState<Vitals>({});
  useEffect(() => {
    const cleanups: (() => void)[] = [];
    const observe = (type: string, onEntries: (e: PerformanceEntryList) => void, extra: Record<string, unknown> = {}) => {
      try {
        const po = new PerformanceObserver((list) => onEntries(list.getEntries()));
        po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
        cleanups.push(() => po.disconnect());
      } catch {
        /* this browser does not report that entry type: the row stays "n/a" */
      }
    };

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (nav && nav.responseStart > 0) setV((p) => ({ ...p, ttfb: nav.responseStart }));

    observe("paint", (entries) => {
      const fcp = entries.find((e) => e.name === "first-contentful-paint");
      if (fcp) setV((p) => ({ ...p, fcp: fcp.startTime }));
    });
    observe("largest-contentful-paint", (entries) => {
      const last = entries[entries.length - 1];
      if (last) setV((p) => ({ ...p, lcp: last.startTime }));
    });

    // CLS: the largest "session window" of layout shifts (gaps under 1 s, windows under 5 s), ignoring shifts right after input.
    let sessionValue = 0;
    let sessionStart = 0;
    let lastShift = 0;
    let worst = 0;
    observe("layout-shift", (entries) => {
      for (const e of entries as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (e.hadRecentInput) continue;
        if (sessionValue && e.startTime - lastShift < 1000 && e.startTime - sessionStart < 5000) {
          sessionValue += e.value;
        } else {
          sessionValue = e.value;
          sessionStart = e.startTime;
        }
        lastShift = e.startTime;
        worst = Math.max(worst, sessionValue);
      }
      setV((p) => ({ ...p, cls: worst }));
    });

    // The slowest interaction so far (a simplification of INP, which is a high percentile over many; labelled that way).
    let slowest = 0;
    observe(
      "event",
      (entries) => {
        for (const e of entries as (PerformanceEntry & { interactionId?: number })[]) if (e.interactionId) slowest = Math.max(slowest, e.duration);
        if (slowest) setV((p) => ({ ...p, inp: slowest }));
      },
      { durationThreshold: 40 },
    );

    return () => cleanups.forEach((c) => c());
  }, []);
  return v;
}

interface Transfer {
  groups: Record<string, number>;
  total: number;
  cached: number;
}

function readTransfer(): Transfer {
  const groups: Record<string, number> = { HTML: 0, JavaScript: 0, CSS: 0, Fonts: 0, Images: 0, Other: 0 };
  let total = 0;
  let cached = 0;
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    groups.HTML += nav.transferSize;
    total += nav.transferSize;
  }
  for (const e of performance.getEntriesByType("resource") as PerformanceResourceTiming[]) {
    const size = e.transferSize;
    if (!size) {
      cached++; // 0 bytes: served from cache, or cross-origin without Timing-Allow-Origin
      continue;
    }
    const path = e.name.split("?")[0].toLowerCase();
    const key = /\.(m?js)$/.test(path) || e.initiatorType === "script" ? "JavaScript" : /\.css$/.test(path) || e.initiatorType === "css" ? "CSS" : /\.(woff2?|ttf|otf)$/.test(path) ? "Fonts" : /\.(png|jpe?g|webp|avif|gif|svg|ico)$/.test(path) || e.initiatorType === "img" ? "Images" : "Other";
    groups[key] += size;
    total += size;
  }
  return { groups, total, cached };
}

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
const fmtKb = (b: number) => `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} kB`;

const RATING_STYLE: Record<Rating, string> = { good: "text-primary", "needs-improvement": "text-accent", poor: "text-accent" };
const RATING_LABEL: Record<Rating, string> = { good: "good", "needs-improvement": "needs improvement", poor: "poor" };

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <dt>
        <span className="text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </dt>
      <dd className="text-right font-mono text-sm">{children}</dd>
    </div>
  );
}

function Vital({ k, value, format }: { k: VitalKey; value: number | undefined; format: (n: number) => string }) {
  if (value === undefined) return <span className="text-muted-foreground">n/a</span>;
  const r = rateVital(k, value);
  return (
    <span>
      {format(value)} <span className={cn("text-xs", RATING_STYLE[r])}>{RATING_LABEL[r]}</span>
    </span>
  );
}

export function UnderTheHood({ onClose }: { onClose: () => void }) {
  const vitals = useVitals();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [headers, setHeaders] = useState<Record<string, string | null> | null>(null);
  const [version, setVersion] = useState<{ sha: string; builtAt: string | null; env: string } | null>(null);
  const [world, setWorld] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTransfer(readTransfer());
    setWorld(document.documentElement.dataset.world === "ready" ? "running" : "not loaded");
    fetch(window.location.pathname, { method: "HEAD", cache: "no-store" })
      .then((r) => setHeaders(Object.fromEntries(SECURITY_HEADERS.map((h) => [h, r.headers.get(h)]))))
      .catch(() => setHeaders({}));
    fetch("/api/version", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setVersion)
      .catch(() => setVersion(null));
  }, []);

  useEffect(() => {
    closeBtn.current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && panel.current) {
        const focusable = panel.current.querySelectorAll<HTMLElement>("button, a[href]");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  const served = headers ? SECURITY_HEADERS.filter((h) => headers[h]).length : 0;

  return (
    <div data-lenis-prevent className="fixed inset-0 z-[85] overflow-y-auto overscroll-contain" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative ml-auto flex min-h-full w-full max-w-md items-start sm:px-4 sm:py-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="hood-title" className="w-full rounded-none border border-border bg-card p-6 shadow-2xl sm:rounded-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Under the hood</p>
              <h2 id="hood-title" className="mt-1 text-xl font-semibold">
                How this page performed for you
              </h2>
            </div>
            <button ref={closeBtn} type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <X size={16} aria-hidden />
            </button>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Measured live in your browser, on this visit. It is not a lab benchmark, and a weak number is shown as it is.</p>

          <section className="mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-primary">Web vitals</h3>
            <dl className="mt-2">
              <Row label="Largest contentful paint" hint="LCP">
                <Vital k="lcp" value={vitals.lcp} format={fmtMs} />
              </Row>
              <Row label="First contentful paint" hint="FCP">
                <Vital k="fcp" value={vitals.fcp} format={fmtMs} />
              </Row>
              <Row label="Layout shift" hint="CLS">
                <Vital k="cls" value={vitals.cls} format={(n) => n.toFixed(3)} />
              </Row>
              <Row label="Time to first byte" hint="TTFB">
                <Vital k="ttfb" value={vitals.ttfb} format={fmtMs} />
              </Row>
              <Row label="Slowest interaction so far" hint="a simplification of INP">
                <Vital k="inp" value={vitals.inp} format={fmtMs} />
              </Row>
            </dl>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-primary">What was downloaded</h3>
            {transfer ? (
              <dl className="mt-2">
                {Object.entries(transfer.groups)
                  .filter(([, b]) => b > 0)
                  .map(([name, bytes]) => (
                    <Row key={name} label={name}>
                      {fmtKb(bytes)}
                    </Row>
                  ))}
                <Row label="Total transferred" hint={`${transfer.cached} more served from cache or without size info`}>
                  <span className="font-semibold">{fmtKb(transfer.total)}</span>
                </Row>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Reading…</p>
            )}
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-primary">The 3D world</h3>
            <dl className="mt-2">
              <Row label="WebGL scene" hint="a desktop enhancement; phones, reduced motion and no-WebGL keep the static page">
                <span className={world === "running" ? "text-primary" : "text-muted-foreground"}>{world || "…"}</span>
              </Row>
            </dl>
          </section>

          <section className="mt-6">
            <h3 className="text-xs font-medium uppercase tracking-wider text-primary">Security headers served</h3>
            {headers ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  {served} of {SECURITY_HEADERS.length} present on this page&apos;s response (read live, not asserted).
                </p>
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  {SECURITY_HEADERS.map((h) => (
                    <li key={h} className="flex items-baseline gap-2">
                      <span aria-hidden className={headers[h] ? "text-primary" : "text-accent"}>
                        {headers[h] ? "✓" : "✗"}
                      </span>
                      <span className="text-foreground">{h}</span>
                      <span className="min-w-0 truncate text-muted-foreground">{headers[h] ?? "missing"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Reading…</p>
            )}
          </section>

          {version && (
            <section className="mt-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-primary">Build</h3>
              <dl className="mt-2">
                <Row label="Commit">{version.sha}</Row>
                <Row label="Built">{version.builtAt ? new Date(version.builtAt).toLocaleString() : "unknown"}</Row>
                <Row label="Environment">{version.env === "local" ? "local build" : version.env}</Row>
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
