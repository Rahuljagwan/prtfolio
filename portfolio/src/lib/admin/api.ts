import "server-only";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { hasDatabase } from "@/lib/db";

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/**
 * Shared guard for every admin API route. Returns an error response to send, or null when the request may proceed.
 * - must be an authenticated admin
 * - a database must be configured
 * - mutating requests must come from this site (Origin check), as a CSRF defence on top of SameSite cookies
 */
export function guard(req: Request): NextResponse | null {
  if (!isAdmin()) return json({ error: "Unauthorized" }, 401);
  if (!hasDatabase()) return json({ error: "Database is not configured. Set DATABASE_URL." }, 503);

  if (req.method !== "GET") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return json({ error: "Bad origin" }, 403);
  }
  return null;
}

/** Called after every write so the public page rebuilds with the new content. */
export const publish = () => {
  revalidatePath("/");
  revalidatePath("/assistant"); // its suggested questions are built from the content
  revalidatePath("/projects/[slug]", "page"); // every per-project page
  revalidatePath("/engineering/roadmap"); // shows the journey milestones
  revalidatePath("/api/terminal-data"); // what the terminal knows about the site
  revalidatePath("/sitemap.xml"); // lists the per-project pages
  revalidatePath("/.well-known/security.txt"); // built from the contact email
};
