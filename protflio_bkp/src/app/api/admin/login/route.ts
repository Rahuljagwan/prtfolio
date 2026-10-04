import { z } from "zod";
import {
  authConfigured,
  checkPassword,
  clearLoginFailures,
  loginAllowed,
  recordLoginFailure,
  startSession,
} from "@/lib/auth";
import { json } from "@/lib/admin/api";

const body = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!authConfigured()) return json({ error: "Admin is not configured. Set ADMIN_PASSWORD and AUTH_SECRET." }, 503);

  const key = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!loginAllowed(key)) return json({ error: "Too many attempts. Try again later." }, 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Password is required" }, 400);

  if (!checkPassword(parsed.data.password)) {
    recordLoginFailure(key);
    return json({ error: "Incorrect password" }, 401);
  }

  clearLoginFailures(key);
  startSession();
  return json({ ok: true });
}
