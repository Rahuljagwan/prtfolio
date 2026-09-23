"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { JOURNEY_FIELDS, PROFILE_FIELDS, getResource, type Resource } from "@/lib/admin/resources";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { adminFetch, type Row } from "./client";
import { ResourceManager } from "./ResourceManager";
import { ResumeManager, type ResumeMeta } from "./ResumeManager";
import { SingletonEditor } from "./SingletonEditor";
import { ToastProvider } from "./ui/Toast";
import { StatusOrb } from "./ui/StatusOrb";
import { AdminBackdrop } from "./AdminBackdrop";
import { CommandPalette } from "./CommandPalette";
import { cn } from "@/lib/utils";

interface DashboardProps {
  profile: Record<string, unknown>;
  journeyIntro: Record<string, unknown>;
  resumeFiles: ResumeMeta[];
  rows: Record<string, Row[]>;
}

// Tab order. "profile" and "journey" are custom tabs; every other key is a resource in lib/admin/resources.ts.
const TABS: { key: string; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "experience", label: "Experience" },
  { key: "journey", label: "Journey" },
  { key: "projects", label: "Projects" },
  { key: "skills", label: "Skills" },
  { key: "education", label: "Education" },
  { key: "contacts", label: "Contact links" },
  { key: "resume", label: "Resume" },
];

export function Dashboard({ profile, journeyIntro, resumeFiles, rows }: DashboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("profile");
  const resource: Resource | undefined = getResource(tab);
  const milestones = getResource("milestones");

  const logout = async () => {
    await adminFetch("/api/admin/logout", "POST");
    router.refresh();
  };

  return (
    <ToastProvider>
      <AdminBackdrop />
      <CommandPalette tabs={TABS} onSelect={setTab} />
      <div className="container relative max-w-4xl py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Portfolio admin</h1>
            <p className="text-sm text-muted-foreground">
              Edit content, reorder it, and it goes live on save. <kbd className="rounded border border-border px-1 py-0.5 text-xs">Ctrl K</kbd> to jump to a section.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusOrb />
            <ThemeToggle />
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
              View site <ExternalLink size={14} />
            </a>
            <button type="button" onClick={logout} className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm hover:bg-muted">
              Log out <LogOut size={14} />
            </button>
          </div>
        </header>

      <div role="tablist" aria-label="Sections" className="mb-8 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
              tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "profile" && (
          <SingletonEditor
            fields={PROFILE_FIELDS}
            initial={profile}
            endpoint="/api/admin/profile"
            submitLabel="Save profile"
            savedMessage="Profile saved. The site is updated."
          />
        )}

        {tab === "journey" && milestones && (
          <div className="space-y-12">
            <section aria-labelledby="journey-intro">
              <h2 id="journey-intro" className="mb-4 text-lg font-semibold">
                Story
              </h2>
              <SingletonEditor
                fields={JOURNEY_FIELDS}
                initial={journeyIntro}
                endpoint="/api/admin/journey-intro"
                submitLabel="Save story"
                savedMessage="Story saved. The site is updated."
              />
            </section>
            <section aria-labelledby="journey-milestones">
              <h2 id="journey-milestones" className="mb-4 text-lg font-semibold">
                Milestones
              </h2>
              <ResourceManager resource={milestones} initialRows={rows[milestones.key] ?? []} />
            </section>
          </div>
        )}

        {tab === "resume" && <ResumeManager initial={resumeFiles} />}

        {resource && tab !== "journey" && <ResourceManager key={resource.key} resource={resource} initialRows={rows[resource.key] ?? []} />}
      </div>
      </div>
    </ToastProvider>
  );
}
