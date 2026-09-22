import type { Metadata } from "next";
import { Dashboard } from "@/components/admin/Dashboard";
import { LoginForm } from "@/components/admin/LoginForm";
import type { Row } from "@/components/admin/client";
import type { ResumeMeta } from "@/components/admin/ResumeManager";
import { RESOURCES } from "@/lib/admin/resources";
import { getJourneyIntro, getProfile, listRows } from "@/lib/admin/repo";
import { authConfigured, isAdmin } from "@/lib/auth";
import { hasDatabase, prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Reads the auth cookie and live data, so this page must never be cached or prerendered.
export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-md rounded-2xl border border-border bg-card p-8">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Round-trips through JSON so Dates and Prisma types become plain values safe to pass to client components. */
const plain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export default async function AdminPage() {
  if (!authConfigured()) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Notice title="Admin is not configured">
          <p>
            Set <code>ADMIN_PASSWORD</code> and <code>AUTH_SECRET</code> in your environment, then restart.
          </p>
        </Notice>
      </main>
    );
  }

  if (!isAdmin()) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <LoginForm />
      </main>
    );
  }

  if (!hasDatabase()) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Notice title="Database not connected">
          <p>
            Set <code>DATABASE_URL</code> and <code>DIRECT_URL</code>, run the migration and seed, then reload. Steps are in
            docs/STAGE3-SETUP.md.
          </p>
          <p>Until then the public site shows the built-in seed content.</p>
        </Notice>
      </main>
    );
  }

  const [profile, journeyIntro, resumeFiles, ...lists] = await Promise.all([
    getProfile(),
    getJourneyIntro(),
    prisma.resumeFile.findMany({ select: { kind: true, filename: true, size: true, updatedAt: true } }),
    ...RESOURCES.map((r) => listRows(r)),
  ]);

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <Notice title="Database is empty">
          <p>
            Run <code>npx prisma db seed</code> to load your existing content, then reload.
          </p>
        </Notice>
      </main>
    );
  }

  const rows: Record<string, Row[]> = Object.fromEntries(RESOURCES.map((r, i) => [r.key, plain(lists[i]) as Row[]]));

  return (
    <main className="min-h-screen">
      <Dashboard profile={plain(profile)} journeyIntro={plain(journeyIntro ?? {})} resumeFiles={plain(resumeFiles) as unknown as ResumeMeta[]} rows={rows} />
    </main>
  );
}
