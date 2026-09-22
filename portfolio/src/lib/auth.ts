import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Single-admin auth. The password lives in ADMIN_PASSWORD, and a successful login sets an
// httpOnly cookie holding an expiry timestamp signed with AUTH_SECRET (HMAC-SHA256).
// Nothing is stored server-side, so it works on serverless hosting.

const COOKIE = "admin_session";
const TTL_SECONDS = 60 * 60 * 24 * 7;

export const authConfigured = () => Boolean(process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET);

const sign = (value: string) => createHmac("sha256", process.env.AUTH_SECRET ?? "").update(value).digest("hex");

const safeEqual = (a: string, b: string) => {
  // Hash first so both buffers have equal length; timingSafeEqual throws otherwise.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
};

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(input, expected);
}

export function startSession() {
  const exp = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  cookies().set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export function endSession() {
  cookies().delete(COOKIE);
}

export function isAdmin(): boolean {
  if (!authConfigured()) return false;
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;

  const [exp, signature] = raw.split(".");
  if (!exp || !signature || !safeEqual(signature, sign(exp))) return false;
  return Number(exp) > Date.now() / 1000;
}

/** Simple in-memory limiter for login attempts. Per server instance, so it slows guessing but is not a hard global limit. */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function loginAllowed(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return true;
  return entry.count < MAX_ATTEMPTS;
}

export function recordLoginFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export function clearLoginFailures(key: string) {
  attempts.delete(key);
}
