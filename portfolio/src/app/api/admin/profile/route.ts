import { getProfile, saveProfile } from "@/lib/admin/repo";
import { guard, json, publish } from "@/lib/admin/api";
import { PROFILE_FIELDS, schemaFor } from "@/lib/admin/resources";

const schema = schemaFor(PROFILE_FIELDS);

export async function GET(req: Request) {
  const denied = guard(req);
  if (denied) return denied;
  return json(await getProfile());
}

export async function PUT(req: Request) {
  const denied = guard(req);
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid data", issues: parsed.error.issues }, 400);

  const saved = await saveProfile(parsed.data);
  publish();
  return json(saved);
}
