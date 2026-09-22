import { Prisma } from "@prisma/client";
import { deleteRow, updateRow } from "@/lib/admin/repo";
import { guard, json, publish } from "@/lib/admin/api";
import { getResource, schemaFor } from "@/lib/admin/resources";

type Ctx = { params: { resource: string; id: string } };

const isNotFound = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;

  const resource = getResource(params.resource);
  if (!resource) return json({ error: "Unknown resource" }, 404);

  const parsed = schemaFor(resource.fields).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid data", issues: parsed.error.issues }, 400);

  try {
    const updated = await updateRow(resource, params.id, parsed.data);
    publish();
    return json(updated);
  } catch (e) {
    if (isNotFound(e)) return json({ error: "Not found" }, 404);
    throw e;
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;

  const resource = getResource(params.resource);
  if (!resource) return json({ error: "Unknown resource" }, 404);

  try {
    await deleteRow(resource, params.id);
    publish();
    return json({ ok: true });
  } catch (e) {
    if (isNotFound(e)) return json({ error: "Not found" }, 404);
    throw e;
  }
}
