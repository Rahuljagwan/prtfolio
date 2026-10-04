import { createRow, listRows } from "@/lib/admin/repo";
import { guard, json, publish } from "@/lib/admin/api";
import { getResource, schemaFor } from "@/lib/admin/resources";

type Ctx = { params: { resource: string } };

export async function GET(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;

  const resource = getResource(params.resource);
  if (!resource) return json({ error: "Unknown resource" }, 404);
  return json(await listRows(resource));
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;

  const resource = getResource(params.resource);
  if (!resource) return json({ error: "Unknown resource" }, 404);

  const parsed = schemaFor(resource.fields).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid data", issues: parsed.error.issues }, 400);

  const created = await createRow(resource, parsed.data);
  publish();
  return json(created, 201);
}
