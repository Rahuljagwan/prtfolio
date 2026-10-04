/* eslint-disable no-console */
// Replaces the portfolio's CONTENT in the DATABASE with what is in src/content/seed.ts (which follows the resume): the profile, the
// experience, the skills, the education and the journey (its intro and its milestones).
//   npm run db:sync-content            shows what would change and writes nothing
//   npm run db:sync-content -- --apply backs the current rows up to prisma/backups/, then replaces them
//
// Why a separate script: `npm run db:seed` never overwrites a table that already has rows (so it can never clobber edits made in /admin),
// which also means it cannot bring existing content in line with a changed resume. This does exactly these tables, after a backup.
// It never touches the contact links (the resume's own are placeholders: keep what /admin has), the projects (`npm run db:sync-projects`
// does those), or the uploaded resume files.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { withConnectTimeout } from "../src/lib/db-resilience";
import { seed } from "../src/content/seed";

const apply = process.argv.includes("--apply");
const url = withConnectTimeout(process.env.DATABASE_URL);
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

// Compared with the keys sorted: Postgres stores JSON with its own key order, so a plain string compare reports a difference where there is none.
const stable = (v: unknown): unknown => (Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, stable(x)])) : v);
// A row without its seed id: the database makes its own.
const dropId = <T extends { id: string }>(row: T) => {
  const { id, ...rest } = row;
  void id;
  return rest;
};
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

async function main() {
  const [profile, experience, skillGroups, education, intro, milestones] = await Promise.all([
    prisma.profile.findUnique({ where: { id: 1 } }),
    prisma.experience.findMany({ orderBy: { order: "asc" } }),
    prisma.skillGroup.findMany({ orderBy: { order: "asc" } }),
    prisma.education.findMany({ orderBy: { order: "asc" } }),
    prisma.journeyIntro.findUnique({ where: { id: 1 } }),
    prisma.journeyMilestone.findMany({ orderBy: { order: "asc" } }),
  ]);

  const s = seed;
  console.log("What the database has now, and what seed.ts (the resume) has:\n");
  if (profile) {
    for (const k of ["name", "role", "headline", "location", "availability"] as const) {
      const a = profile[k];
      const b = s.profile[k];
      console.log(`  profile.${k.padEnd(12)} ${a === b ? "same:   " : "CHANGES:"} ${a === b ? b : `${a}  ->  ${b}`}`);
    }
    console.log(`  profile.bio          ${same(profile.bio, s.profile.bio) ? "same" : "CHANGES"}`);
    console.log(`  profile.facts        ${same(profile.facts, s.profile.facts) ? "same" : "CHANGES"}`);
    console.log(`  profile.highlights   ${same(profile.highlights, s.profile.highlights) ? "same" : "CHANGES"}`);
  } else {
    console.log("  profile              (none in the database) -> will be created");
  }
  const row = (name: string, have: string[], want: string[]) =>
    console.log(`\n  ${name}: database ${have.length}, resume ${want.length}\n    now:  ${have.join(" | ") || "(none)"}\n    then: ${want.join(" | ")}`);
  row("experience", experience.map((e) => `${e.role}, ${e.organisation}`), s.experience.map((e) => `${e.role}, ${e.organisation}`));
  row("skill groups", skillGroups.map((g) => g.name), s.skillGroups.map((g) => g.name));
  row("education", education.map((e) => e.degree), s.education.map((e) => e.degree));
  console.log(`\n  journey intro: ${intro ? `"${intro.heading}"` : "(none)"}  ->  "${s.journey.heading}"`);
  row("journey milestones", milestones.map((m) => m.title), s.journey.milestones.map((m) => m.title));

  if (!apply) {
    console.log("\nNothing written. Run again with --apply to back the current rows up and replace them.");
    return;
  }

  const dir = join(__dirname, "..", "prisma", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ profile, experience, skillGroups, education, intro, milestones }, null, 2));
  console.log(`\nBacked up the current rows to ${file}`);

  const p = s.profile;
  await prisma.$transaction([
    prisma.profile.upsert({
      where: { id: 1 },
      update: { name: p.name, role: p.role, headline: p.headline, location: p.location, availability: p.availability, bio: p.bio, facts: p.facts, highlights: p.highlights },
      create: { id: 1, name: p.name, role: p.role, headline: p.headline, location: p.location, availability: p.availability, bio: p.bio, facts: p.facts, highlights: p.highlights },
    }),
    prisma.experience.deleteMany({}),
    prisma.experience.createMany({ data: s.experience.map((e, order) => ({ ...dropId(e), order })) }),
    prisma.skillGroup.deleteMany({}),
    prisma.skillGroup.createMany({ data: s.skillGroups.map((g, order) => ({ ...dropId(g), order })) }),
    prisma.education.deleteMany({}),
    prisma.education.createMany({ data: s.education.map((e, order) => ({ ...dropId(e), description: e.description ?? null, order })) }),
    prisma.journeyIntro.upsert({
      where: { id: 1 },
      update: { heading: s.journey.heading, story: s.journey.story },
      create: { id: 1, heading: s.journey.heading, story: s.journey.story },
    }),
    prisma.journeyMilestone.deleteMany({}),
    prisma.journeyMilestone.createMany({ data: s.journey.milestones.map((m, order) => ({ ...dropId(m), order })) }),
  ]);
  console.log("Replaced. A deployed site picks the new content up on its next deploy (the pages are built from the database), or when you save once in /admin; local dev shows it immediately.");
}

main()
  .catch((e) => {
    console.error(String(e.message ?? e).split("\n").slice(-3).join("\n"));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
