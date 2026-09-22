import { endSession } from "@/lib/auth";
import { json } from "@/lib/admin/api";

export async function POST() {
  endSession();
  return json({ ok: true });
}
