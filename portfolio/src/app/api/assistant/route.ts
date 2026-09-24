import { NextResponse } from "next/server";
import { z } from "zod";
import { answer } from "@/lib/assistant/llm";
import { getPortfolio } from "@/lib/portfolio";
import { rateLimit } from "@/lib/rate-limit";
import type { Portfolio } from "@/lib/types";

// Public endpoint. It reads only the public portfolio content (the same data the site renders), answers from it,
// and returns text. It touches no admin data, stores nothing, and calls no external service unless the optional LLM
// mode is enabled with ASSISTANT_LLM_API_KEY (see lib/assistant/llm.ts).
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 300;
const body = z.object({ question: z.string().trim().min(1).max(MAX_QUESTION_CHARS) });

// Short cache so a burst of questions does not repeat the database reads, while CMS edits still show within seconds.
let cache: { at: number; data: Portfolio } | null = null;
async function content(): Promise<Portfolio> {
  if (cache && Date.now() - cache.at < 5_000) return cache.data;
  const data = await getPortfolio({ samples: false }); // the assistant only ever knows real content
  cache = { at: Date.now(), data };
  return data;
}

const reply = (payload: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  // Only this site's own pages may call it from a browser.
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return reply({ error: "Bad origin" }, 403);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(`assistant:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return reply({ error: "You're asking quickly. Please wait a moment and try again." }, 429, { "Retry-After": String(limit.retryAfter) });
  }

  if (Number(req.headers.get("content-length") ?? 0) > 2048) return reply({ error: "Request too large" }, 413);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return reply({ error: `Ask a question of up to ${MAX_QUESTION_CHARS} characters.` }, 400);

  return reply(await answer(await content(), parsed.data.question));
}
