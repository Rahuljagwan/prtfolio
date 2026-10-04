import type { Metadata } from "next";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { PageHeader } from "@/components/engineering/parts";
import { SiteDiagram } from "@/components/engineering/SiteDiagram";

export const metadata: Metadata = {
  title: "How this site is built | Rahul Jagwan",
  description: "The real architecture of this portfolio: static pages, a content layer with a seed fallback, Postgres, a lazy 3D world, and the decision behind each.",
};

export default function HowThisSiteIsBuilt() {
  return (
    <SubpageShell current="Engineering">
      <PageHeader
        eyebrow="Engineering"
        title="How this site is built"
        intro="Pick a part to see what it does, why it is that way, and which files prove it. Everything on this page describes the code as it is; nothing is illustrative."
      />
      <div className="mt-12">
        <SiteDiagram deployEnv={process.env.NEXT_PUBLIC_DEPLOY_ENV ?? ""} />
      </div>
    </SubpageShell>
  );
}
