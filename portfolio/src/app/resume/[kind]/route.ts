import { NextResponse } from "next/server";
import { hasDatabase, prisma } from "@/lib/db";
import { isResumeKind } from "@/lib/resume";

// Public download endpoint:
//   /resume/pdf              opens the PDF in the browser (inline)
//   /resume/pdf?download=1   downloads the PDF
//   /resume/docx             downloads the DOCX (browsers cannot display Word files inline)
export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(req: Request, { params }: { params: { kind: string } }) {
  if (!hasDatabase() || !isResumeKind(params.kind)) return notFound();

  const file = await prisma.resumeFile.findUnique({ where: { kind: params.kind } });
  if (!file) return notFound();

  // Cheap revalidation: replacing the file changes size or updatedAt, which changes the ETag.
  const etag = `"${file.size}-${file.updatedAt.getTime()}"`;
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag } });

  const asDownload = params.kind === "docx" || new URL(req.url).searchParams.has("download");

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${file.filename}"`,
      "X-Content-Type-Options": "nosniff",
      // Short cache so a replaced resume shows up quickly, with revalidation via ETag.
      "Cache-Control": "public, max-age=60, must-revalidate",
      ETag: etag,
    },
  });
}
