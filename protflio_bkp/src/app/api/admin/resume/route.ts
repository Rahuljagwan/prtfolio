import { prisma } from "@/lib/db";
import { guard, json } from "@/lib/admin/api";

/** Metadata only. The file bytes are never sent to the admin UI. */
export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;

  const files = await prisma.resumeFile.findMany({ select: { kind: true, filename: true, size: true, updatedAt: true } });
  return json(files);
}
