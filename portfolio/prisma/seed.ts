/* eslint-disable no-console */
// Copies src/content/seed.ts into the database. Safe to run repeatedly:
// the profile is upserted, and each list is only filled when its table is empty,
// so it never overwrites edits you made in the admin.
import { PrismaClient } from "@prisma/client";
import { seed } from "../src/content/seed";

const prisma = new PrismaClient();

async function main() {
  const { profile, contacts, experience, projects, skillGroups, education, journey } = seed;

  await prisma.profile.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: profile.name,
      role: profile.role,
      headline: profile.headline,
      location: profile.location,
      availability: profile.availability,
      bio: profile.bio,
      facts: profile.facts,
      highlights: profile.highlights,
    },
  });

  if ((await prisma.contactLink.count()) === 0) {
    await prisma.contactLink.createMany({
      data: contacts.map((c, order) => ({ type: c.type, value: c.value, order })),
    });
  }

  if ((await prisma.experience.count()) === 0) {
    await prisma.experience.createMany({
      data: experience.map(({ id: _id, ...e }, order) => ({ ...e, order })),
    });
  }

  if ((await prisma.project.count()) === 0) {
    await prisma.project.createMany({
      data: projects.map(({ id: _id, ...p }, order) => ({ ...p, order })),
    });
  }

  // Projects seeded before case studies existed: fill them in, but only for rows that are still completely empty,
  // so anything you wrote in /admin is never overwritten.
  for (const p of projects) {
    await prisma.project.updateMany({
      where: { title: p.title, challenge: null, outcome: null, approach: { isEmpty: true } },
      data: { challenge: p.challenge ?? null, approach: p.approach ?? [], outcome: p.outcome ?? null },
    });
  }

  if ((await prisma.skillGroup.count()) === 0) {
    await prisma.skillGroup.createMany({
      data: skillGroups.map(({ id: _id, ...g }, order) => ({ ...g, order })),
    });
  }

  if ((await prisma.education.count()) === 0) {
    await prisma.education.createMany({
      data: education.map(({ id: _id, ...e }, order) => ({ ...e, order })),
    });
  }

  await prisma.journeyIntro.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, heading: journey.heading, story: journey.story },
  });

  if ((await prisma.journeyMilestone.count()) === 0) {
    await prisma.journeyMilestone.createMany({
      data: journey.milestones.map(({ id: _id, ...m }, order) => ({ ...m, order })),
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
