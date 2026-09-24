import { PrismaClient } from "@prisma/client";
import { withConnectTimeout } from "./db-resilience";

// Reuse one client across hot reloads in development so we do not exhaust connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// The connect timeout is raised (see db-resilience.ts): Neon wakes an idle database on the first connection, and that can
// take longer than Prisma's 5 s default. A URL that already sets connect_timeout keeps its own value.
const url = withConnectTimeout(process.env.DATABASE_URL);

export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** True when a database is configured. Without it the site falls back to seed content. */
export const hasDatabase = () => Boolean(process.env.DATABASE_URL);
