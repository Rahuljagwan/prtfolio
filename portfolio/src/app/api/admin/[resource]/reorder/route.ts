import { z } from "zod";
import { reorderRows } from "@/lib/admin/repo";
import { guard, json, publish } from "@/lib/admin/api";
import { getResource } from "@/lib/admin/resources";

const body = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) });

export async function POST(req: Request, { params }: { params: { resource: string } }) {
  const denied = guard(req);
  if (denied) return denied;

  const resource = getResource(params.resource);
  if (!resource) return json({ error: "Unknown resource" }, 404);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid data" }, 400);

  await reorderRows(resource, parsed.data.ids);
  publish();
  return json({ ok: true });
}
