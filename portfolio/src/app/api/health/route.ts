import { NextResponse, type NextRequest } from "next/server";
import { hasDatabase, prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Long enough for a sleeping Neon database to wake (about 5 s), so a cold start is not reported as "down".
const DEEP_TIMEOUT_MS = 8000;
const DEEP_TTL_MS = 30_000;

type DbState = { status: "ok" | "down" | "unconfigured"; ms?: number };
let deepCache: { at: number; db: DbState } | null = null;

async function probeDb(): Promise<DbState> {
  if (deepCache && Date.now() - deepCache.at < DEEP_TTL_MS) return deepCache.db;
  let db: DbState;
  if (!hasDatabase()) {
    db = { status: "unconfigured" }; // the site serves its seed content; that is a legitimate mode, not a failure
  } else {
    const t0 = Date.now();
    try {
      await Promise.race([prisma.$queryRaw`SELECT 1`, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), DEEP_TIMEOUT_MS))]);
      db = { status: "ok", ms: Date.now() - t0 };
    } catch {
      db = { status: "down", ms: Date.now() - t0 };
    }
  }
  deepCache = { at: Date.now(), db };
  return db;
}

/**
 * Liveness by default: answering at all means the app is up, and it touches nothing else. `?deep=1` also probes the
 * database (8 s timeout, cached 30 s so it cannot be used to hammer it). A down database reports "degraded", not an error:
 * the public site falls back to its seed content, so it is still serving.
 */
async function handle(req: NextRequest, head: boolean) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limited = rateLimit(`health:${ip}`, 60, 60_000);
  const headers = { "Cache-Control": "no-store" };
  if (!limited.ok) return NextResponse.json({ status: "rate-limited" }, { status: 429, headers: { ...headers, "Retry-After": String(limited.retryAfter) } });

  const deep = req.nextUrl.searchParams.get("deep") === "1";
  const checks: Record<string, unknown> = { app: "ok" };
  let status: "ok" | "degraded" = "ok";
  if (deep) {
    const db = await probeDb();
    checks.db = db;
    if (db.status === "down") status = "degraded";
  }
  const body = { status, time: new Date().toISOString(), checks };
  return head ? new NextResponse(null, { status: 200, headers }) : NextResponse.json(body, { headers });
}

export const GET = (req: NextRequest) => handle(req, false);
export const HEAD = (req: NextRequest) => handle(req, true);
