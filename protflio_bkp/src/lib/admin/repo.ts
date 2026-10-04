import "server-only";
import { prisma } from "@/lib/db";
import type { Resource } from "./resources";

// One generic CRUD layer for every ordered list resource. Prisma's generated delegates have
// different types per model, so they are cast once here to the small shape we actually use.

type Row = { id: string; order: number } & Record<string, unknown>;

interface Delegate {
  findMany(args: { orderBy: { order: "asc" } }): Promise<Row[]>;
  aggregate(args: { _max: { order: true } }): Promise<{ _max: { order: number | null } }>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Row>;
  delete(args: { where: { id: string } }): Promise<Row>;
}

const delegateFor = (resource: Resource) => prisma[resource.delegate] as unknown as Delegate;

export const listRows = (resource: Resource) => delegateFor(resource).findMany({ orderBy: { order: "asc" } });

export async function createRow(resource: Resource, data: Record<string, unknown>) {
  const d = delegateFor(resource);
  const { _max } = await d.aggregate({ _max: { order: true } });
  return d.create({ data: { ...data, order: (_max.order ?? -1) + 1 } });
}

export const updateRow = (resource: Resource, id: string, data: Record<string, unknown>) =>
  delegateFor(resource).update({ where: { id }, data });

export const deleteRow = (resource: Resource, id: string) => delegateFor(resource).delete({ where: { id } });

/** Rewrites `order` to match the given id sequence in a single transaction. */
export async function reorderRows(resource: Resource, ids: string[]) {
  const d = delegateFor(resource);
  await prisma.$transaction(ids.map((id, order) => d.update({ where: { id }, data: { order } }) as never));
}

export async function getProfile() {
  return prisma.profile.findUnique({ where: { id: 1 } });
}

export async function saveProfile(data: Record<string, unknown>) {
  return prisma.profile.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data } as never,
  });
}

export async function getJourneyIntro() {
  return prisma.journeyIntro.findUnique({ where: { id: 1 } });
}

export async function saveJourneyIntro(data: Record<string, unknown>) {
  return prisma.journeyIntro.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data } as never,
  });
}
