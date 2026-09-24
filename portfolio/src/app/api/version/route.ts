import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * What is running. sha and builtAt are inlined at build time (next.config.mjs); env is "local" unless the host says it is a
 * deployment (Vercel sets VERCEL_ENV); region appears only if the host provides one. Nothing here is guessed.
 */
export function GET() {
  const region = process.env.VERCEL_REGION;
  return NextResponse.json(
    {
      sha: process.env.NEXT_PUBLIC_BUILD_SHA || "dev",
      builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || null,
      env: process.env.NEXT_PUBLIC_DEPLOY_ENV || "local",
      ...(region ? { region } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
