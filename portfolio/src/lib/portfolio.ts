import { cache } from "react";
import { seed } from "@/content/seed";
import { enrichProjects } from "./projects/enrich";
import { SHOW_SAMPLES } from "./samples";
import { hasDatabase, prisma } from "./db";
import { createBreaker, describeDbError, isConnectionError } from "./db-resilience";
import { isResumeKind } from "./resume";
import { publicResume } from "./resume-public";
import type { ContactLink, MilestoneStatus, Portfolio, Profile, ResumeInfo } from "./types";

/** Drops database bookkeeping columns the UI does not use. */
const stripMeta = <T extends { order: number; updatedAt: Date }>({ order, updatedAt, ...rest }: T) => {
  void order;
  void updatedAt;
  return rest;
};

// After a connection failure, skip the database for a short while so each request is served at once from the built-in
// content instead of every one of them waiting out its own connect timeout.
const dbBreaker = createBreaker(30_000);

/**
 * Single data access point for the public site.
 * - No DATABASE_URL, or the database has not been seeded yet: serves seed.ts content.
 * - Otherwise: reads everything from Postgres.
 * A database error is logged and falls back to seed content so the public site never goes blank.
 */
async function loadPortfolio(): Promise<Portfolio> {
  if (!hasDatabase() || dbBreaker.isOpen()) return seed;

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
    if (isConnectionError(error)) {
      // Expected on a machine that cannot reach the database, or while a sleeping Neon database is still waking. One line, once.
      if (dbBreaker.trip()) console.warn(`getPortfolio: database unavailable (${describeDbError(error)}). Serving built-in content and not retrying for 30 s.`);
    } else {
      console.error("getPortfolio: database read failed, serving seed content", error);
    }
    return seed;
  }
}

async function buildPortfolio(samples: boolean): Promise<Portfolio> {
  const [portfolio, fromPublic] = await Promise.all([loadPortfolio(), publicResume()]);
  return {
    ...portfolio,
    projects: enrichProjects(portfolio.projects, { samples }),
    resume: { ...fromPublic, ...portfolio.resume },
  };
}

// React cache() de-duplicates within one server render (page + generateMetadata + sitemap share one read). The key is a
// primitive on purpose: cache() compares arguments by identity, so an options object would never hit.
const cachedPortfolio = cache(buildPortfolio);

/**
 * Everything the public site renders. Resume files uploaded in /admin win; for any kind not uploaded, a file dropped in
 * public/resume/ (resume.pdf, resume.docx) is used instead. Projects come back enriched (slug, status, ownership, ...) and
 * with confidential ones already redacted. Pass `{ samples: false }` for anything that must not contain illustrative content
 * (the assistant): it then gets no sample projects and no sample-flagged sections.
 */
export function getPortfolio(opts: { samples?: boolean } = {}): Promise<Portfolio> {
  return cachedPortfolio(opts.samples ?? SHOW_SAMPLES);
}
