// The site's public origin, for absolute URLs in metadata, the sitemap and security.txt.
// Set NEXT_PUBLIC_SITE_URL (for example https://example.com) in the host's environment. When it is unset the site makes no
// absolute-URL claims at all: no canonical, no sitemap entries, no OG image origin. That is deliberate: a guessed origin
// would be wrong the day the domain changes, and localhost URLs in a shared link help nobody.

const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");

/** The origin, or undefined when it is not configured (or not a valid absolute URL). */
export const SITE_URL: string | undefined = (() => {
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
})();

export const SITE_NAME = "Rahul Jagwan | Software Engineer";
