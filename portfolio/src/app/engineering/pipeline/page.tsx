import type { Metadata } from "next";
import { SubpageShell } from "@/components/layout/SubpageShell";
import { PageHeader } from "@/components/engineering/parts";
import { PipelinePlayground } from "@/components/engineering/PipelinePlayground";

export const metadata: Metadata = {
  title: "Pipeline playground | Rahul",
  description: "A simulated release pipeline: push a release through lint, tests, staging and a canary, break a step on purpose, and roll back.",
};

export default function PipelinePage() {
  return (
    <SubpageShell current="Engineering">
      <PageHeader
        eyebrow="Pipeline playground"
        title="Push a release. Break it. Roll it back."
        intro="A simulation of how a production pipeline behaves: stages in order, a failure that halts the run, a canary that reverts itself, and a rollback that restores the previous release."
      />
      <div className="mt-10">
        <PipelinePlayground />
      </div>
    </SubpageShell>
  );
}
