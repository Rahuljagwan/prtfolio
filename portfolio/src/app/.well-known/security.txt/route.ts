import { getPortfolio } from "@/lib/portfolio";
import { buildSecurityTxt } from "@/lib/security-txt";
import { SITE_URL } from "@/lib/site";

// Rendered on request (Expires must move forward), cached briefly by the browser.
export const dynamic = "force-dynamic";

export async function GET() {
  const { contacts } = await getPortfolio({ samples: false });
  const body = buildSecurityTxt({ email: contacts.find((c) => c.type === "email")?.value, canonical: SITE_URL });
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
