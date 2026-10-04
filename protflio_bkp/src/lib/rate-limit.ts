// Small in-memory sliding-window limiter. It is per server instance, so on serverless hosting it slows abuse
// down rather than enforcing a strict global cap. That is enough here because the assistant does no paid work.

const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Keep memory bounded: occasionally drop keys with no recent activity.
  if (hits.size > 2000) {
    hits.forEach((times, k) => {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    });
  }
  return { ok: true, retryAfter: 0 };
}
