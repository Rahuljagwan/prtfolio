import { prisma } from "@/lib/db";
import { guard, json, publish } from "@/lib/admin/api";
import { MAX_RESUME_BYTES, RESUME_TYPES, hasValidContent, isResumeKind, safeFilename } from "@/lib/resume";

type Ctx = { params: { kind: string } };

export async function POST(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  if (!isResumeKind(params.kind)) return json({ error: "Unknown resume type" }, 404);
  const kind = params.kind;

  // Refuse before reading the body when the client declares an oversized upload.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_RESUME_BYTES + 64 * 1024) return json({ error: "File is too large (limit 3 MB)" }, 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a file to upload" }, 400);
  if (file.size === 0) return json({ error: "The file is empty" }, 400);
  if (file.size > MAX_RESUME_BYTES) return json({ error: "File is too large (limit 3 MB)" }, 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasValidContent(kind, bytes)) {
    return json({ error: `That does not look like a real ${RESUME_TYPES[kind].label} file` }, 400);
  }

  const saved = await prisma.resumeFile.upsert({
    where: { kind },
    update: { filename: safeFilename(file.name, kind), mime: RESUME_TYPES[kind].mime, size: bytes.length, data: bytes },
    create: { kind, filename: safeFilename(file.name, kind), mime: RESUME_TYPES[kind].mime, size: bytes.length, data: bytes },
    select: { kind: true, filename: true, size: true, updatedAt: true },
  });
  publish();
  return json(saved);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = guard(req);
  if (denied) return denied;
  if (!isResumeKind(params.kind)) return json({ error: "Unknown resume type" }, 404);

  await prisma.resumeFile.deleteMany({ where: { kind: params.kind } });
  publish();
  return json({ ok: true });
}
