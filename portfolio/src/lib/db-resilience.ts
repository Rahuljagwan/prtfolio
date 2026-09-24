// Small pure helpers that keep a slow or sleeping database from hurting the site. No Prisma import, so they are tested on
// their own (scripts/ops-check.ts).
//
// Why: Neon suspends an idle database and wakes it on the next connection, which takes several seconds (measured here:
// about 5 s for the first connection). Prisma gives up after 5 s by default, so the first request after a quiet spell could
// fail with "Can't reach database server" even though the database was fine a moment later.

/** Prisma's own default is 5 s, which a waking Neon database can exceed. */
export const CONNECT_TIMEOUT_SECONDS = 15;

/** Adds `connect_timeout` to a connection string unless it already has one. A string that does not parse is returned untouched. */
export function withConnectTimeout(url: string | undefined, seconds = CONNECT_TIMEOUT_SECONDS): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", String(seconds));
    return u.toString();
  } catch {
    return url;
  }
}

const CONNECTION_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

/** True for "the database could not be reached / timed out / hung up" (as opposed to a bug in a query). */
export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; errorCode?: unknown; name?: unknown; message?: unknown };
  const code = typeof e.errorCode === "string" ? e.errorCode : typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  return CONNECTION_CODES.has(code) || e.name === "PrismaClientInitializationError" || /can't reach database server|timed out fetching a new connection|connection.*(closed|reset|refused)/i.test(message);
}

/** One line for the log: what went wrong, without the stack trace and without ever including a connection string. */
export function describeDbError(error: unknown): string {
  const message = error && typeof error === "object" && "message" in error ? String((error as { message: unknown }).message) : String(error);
  const reach = /can't reach database server at `?([^`\s]+)`?/i.exec(message);
  if (reach) return `cannot reach ${reach[1].replace(/:\d+$/, "")}`;
  const first = message.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "unknown error";
  return first.replace(/postgres(ql)?:\/\/\S+/gi, "<connection string>").slice(0, 160);
}

/**
 * A "circuit breaker": after a connection failure, stay away from the database for `ttlMs` so every request in that window
 * is served instantly from the built-in content instead of each one waiting out its own timeout. `now` is injectable for tests.
 */
export function createBreaker(ttlMs: number, now: () => number = Date.now) {
  let openUntil = 0;
  return {
    isOpen: () => now() < openUntil,
    /** Opens the breaker. Returns true only when it was closed before (so callers log once, not on every request). */
    trip: () => {
      const wasOpen = now() < openUntil;
      openUntil = now() + ttlMs;
      return !wasOpen;
    },
    reset: () => {
      openUntil = 0;
    },
  };
}
