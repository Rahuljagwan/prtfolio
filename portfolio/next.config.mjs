import { execSync } from "node:child_process";

/** Short commit id for the build badge: the host's own value when it provides one, else git, else "dev". Never throws. */
function buildSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    // "+dirty" when tracked files differ from that commit, so the badge never claims a commit the build does not match.
    const dirty = execSync("git status --porcelain --untracked-files=no", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() !== "";
    return sha ? `${sha}${dirty ? "+dirty" : ""}` : "dev";
  } catch {
    return "dev";
  }
}

// No nonce-based CSP: it would force every page to render dynamically. Only frame-ancestors is set from CSP (it is safe on its
// own and it is the directive that stops clickjacking); the rest are the standard response headers.
// microphone=(self): the admin editor's voice dictation needs it.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), microphone=(self)" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a production build run beside a live dev server without clobbering its .next cache.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Inlined at build time. NEXT_PUBLIC_DEPLOY_ENV is empty unless the host says so (Vercel sets VERCEL_ENV), which is how the
  // status badge tells a real deployment from a local build without ever guessing.
  env: {
    NEXT_PUBLIC_BUILD_SHA: buildSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_DEPLOY_ENV: process.env.VERCEL_ENV || "",
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
