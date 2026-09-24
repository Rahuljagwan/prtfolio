/* eslint-disable no-console */
// Replaces the projects in the DATABASE with the ones in src/content/seed.ts (the resume's projects).
//   npm run db:sync-projects            shows what would change and writes nothing
//   npm run db:sync-projects -- --apply backs the current rows up to prisma/backups/, then replaces them
//
// Why a separate script: `npm run db:seed` never overwrites a table that already has rows (so it can never clobber edits made in
// /admin), which also means it cannot swap the old placeholder projects for new ones. This does exactly one table, after a backup.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { withConnectTimeout } from "../src/lib/db-resilience";
import { seed } from "../src/content/seed";

const apply = process.argv.includes("--apply");
const url = withConnectTimeout(process.env.DATABASE_URL);
const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

async function main() {
  const current = await prisma.project.findMany({ orderBy: { order: "asc" } });
  console.log(`Database has ${current.length} project(s):`);
  for (const r of current) console.log(`  - ${r.title}`);
  console.log(`\nseed.ts has ${seed.projects.length} project(s):`);
  for (const p of seed.projects) console.log(`  - ${p.title}`);

  if (!apply) {
    console.log("\nNothing written. Run again with --apply to back the current rows up and replace them.");
    return;
  }

  const dir = join(__dirname, "..", "prisma", "backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `projects-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(current, null, 2));
  console.log(`\nBacked up ${current.length} row(s) to ${file}`);

  await prisma.$transaction([
    prisma.project.deleteMany({}),
    prisma.project.createMany({
      data: seed.projects.map(({ id: _id, challenge, outcome, approach, ...p }, order) => ({ ...p, challenge: challenge ?? null, outcome: outcome ?? null, approach: approach ?? [], order })),
    }),
  ]);
  const after = await prisma.project.count();
  console.log(`Replaced. The database now has ${after} project(s).`);
  console.log("A deployed site refreshes on the next publish from /admin (or a redeploy); local dev shows it immediately.");
}

main()
  .catch((e) => {
    console.error(String(e.message ?? e).split("\n").slice(-3).join("\n"));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
