// security.txt (RFC 9116) from the portfolio's own contact details. Pure, so it is tested (scripts/ops-check.ts).
//
// It is served only when there is a real contact to put in it. The seed content ships a placeholder address, and a
// security.txt pointing at one would send a researcher's report into the void, so a placeholder means "no file" (404).

const PLACEHOLDER_HOST = /@(example\.(com|org|net)|.*\.(test|invalid|localhost|example))$/i;
const PLACEHOLDER_WORD = /placeholder|changeme|your[-_. ]?email|xxx/i;

export function isPlaceholderEmail(value: string): boolean {
  const v = value.trim();
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || PLACEHOLDER_HOST.test(v) || PLACEHOLDER_WORD.test(v);
}

export interface SecurityTxtInput {
  email: string | undefined;
  /** Origin, for the Canonical line. Omitted when the site's URL is not configured. */
  canonical?: string;
  now?: Date;
}

/** The file body, or null when there is no usable contact. Expires is 300 days out (RFC 9116 wants under a year). */
export function buildSecurityTxt({ email, canonical, now = new Date() }: SecurityTxtInput): string | null {
  if (!email || isPlaceholderEmail(email)) return null;
  const expires = new Date(now.getTime() + 300 * 24 * 60 * 60 * 1000);
  const lines = [`Contact: mailto:${email.trim()}`, `Expires: ${expires.toISOString()}`, "Preferred-Languages: en"];
  if (canonical) lines.push(`Canonical: ${canonical}/.well-known/security.txt`);
  return `${lines.join("\n")}\n`;
}
