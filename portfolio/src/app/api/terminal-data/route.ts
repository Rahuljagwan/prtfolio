import { NextResponse } from "next/server";
import { SECTIONS } from "@/content/sections";
import { hasCaseStudy } from "@/lib/projects/utils";
import { getPortfolio } from "@/lib/portfolio";
import type { CommandData } from "@/lib/commands/types";

// What the terminal knows about the site. Built from the same getPortfolio() as the pages (so confidential projects are
// already redacted to their public summary, and samples are flagged), pre-rendered, and refreshed by publish().
export async function GET() {
  const { profile, projects, contacts, resume } = await getPortfolio();
  const data: CommandData = {
    profile: { name: profile.name, role: profile.role, headline: profile.headline, location: profile.location, availability: profile.availability },
    sections: SECTIONS.map((s) => ({ id: s.id, label: s.label })),
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      role: p.role,
      status: p.status,
      stack: p.stack,
      hasCaseStudy: hasCaseStudy(p),
      sample: p.sample,
      confidential: !!p.confidential,
      live: p.links?.live,
    })),
    contacts,
    resume,
  };
  return NextResponse.json(data);
}
