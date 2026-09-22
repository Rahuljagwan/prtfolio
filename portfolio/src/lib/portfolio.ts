import { seed } from "@/content/seed";
import { hasDatabase, prisma } from "./db";
import { isResumeKind } from "./resume";
import { publicResume } from "./resume-public";
import type { ContactLink, MilestoneStatus, Portfolio, Profile, ResumeInfo } from "./types";

/** Drops database bookkeeping columns the UI does not use. */
const stripMeta = <T extends { order: number; updatedAt: Date }>({ order, updatedAt, ...rest }: T) => {
  void order;
  void updatedAt;
  return rest;
};

/**
 * Single data access point for the public site.
 * - No DATABASE_URL, or the database has not been seeded yet: serves seed.ts content.
 * - Otherwise: reads everything from Postgres.
 * A database error is logged and falls back to seed content so the public site never goes blank.
 */
async function loadPortfolio(): Promise<Portfolio> {
  if (!hasDatabase()) return seed;

  try {
    const [profile, contacts, experience, projects, skillGroups, education, intro, milestones, resumeFiles] = await Promise.all([
      prisma.profile.findUnique({ where: { id: 1 } }),
      prisma.contactLink.findMany({ orderBy: { order: "asc" } }),
      prisma.experience.findMany({ orderBy: { order: "asc" } }),
      prisma.project.findMany({ orderBy: { order: "asc" } }),
      prisma.skillGroup.findMany({ orderBy: { order: "asc" } }),
      prisma.education.findMany({ orderBy: { order: "asc" } }),
      prisma.journeyIntro.findUnique({ where: { id: 1 } }),
      prisma.journeyMilestone.findMany({ orderBy: { order: "asc" } }),
      // Metadata only: the bytes stay in the database and are served by /resume/[kind].
      prisma.resumeFile.findMany({ select: { kind: true, filename: true, size: true, updatedAt: true } }),
    ]);

    if (!profile) return seed; // database exists but has not been seeded yet

    const resume: ResumeInfo = {};
    for (const f of resumeFiles) {
      if (isResumeKind(f.kind)) resume[f.kind] = { filename: f.filename, size: f.size, updatedAt: f.updatedAt.toISOString(), source: "upload" };
    }

    return {
      profile: {
        name: profile.name,
        role: profile.role,
        headline: profile.headline,
        location: profile.location,
        availability: profile.availability,
        bio: profile.bio,
        facts: profile.facts as Profile["facts"],
        highlights: profile.highlights as Profile["highlights"],
      },
      contacts: contacts.map((c) => ({ type: c.type as ContactLink["type"], value: c.value })),
      experience: experience.map(stripMeta),
      projects: projects.map(stripMeta),
      skillGroups: skillGroups.map(stripMeta),
      education: education.map(stripMeta),
      journey: {
        heading: intro?.heading ?? seed.journey.heading,
        story: intro?.story ?? seed.journey.story,
        milestones: milestones.map((m) => ({ ...stripMeta(m), status: m.status as MilestoneStatus })),
      },
      resume,
    };
  } catch (error) {
    console.error("getPortfolio: database read failed, serving seed content", error);
    return seed;
  }
}

/**
 * Everything the public site renders. Resume files uploaded in /admin win; for any kind not uploaded, a file dropped in
 * public/resume/ (resume.pdf, resume.docx) is used instead.
 */
export async function getPortfolio(): Promise<Portfolio> {
  const [portfolio, fromPublic] = await Promise.all([loadPortfolio(), publicResume()]);
  return { ...portfolio, resume: { ...fromPublic, ...portfolio.resume } };
}
