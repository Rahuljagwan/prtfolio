import type { Metadata } from "next";
import { AssistantExperience } from "@/components/assistant/AssistantExperience";
import type { ClusterInfo } from "@/components/assistant/bridge";
import { suggestQuestions } from "@/lib/assistant/engine";
import { llmEnabled } from "@/lib/assistant/llm";
import { getPortfolio } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Ask about my work",
  description: "Ask questions about projects, skills, experience and career path. Answers come only from this portfolio.",
};

// This route is separate from the home page on purpose: the chat and the 3D scene are only downloaded by people who open it,
// so they add nothing to the home page's weight. Content edits in /admin refresh it (see publish()).
export default async function AssistantPage() {
  const portfolio = await getPortfolio({ samples: false }); // the assistant only ever knows real content

  // One cluster per section the assistant can answer from, sized by the real amount of content behind it.
  const clusters: ClusterInfo[] = [
    { anchor: "about", label: "About", count: 3 }, // location, focus, core stack
    { anchor: "experience", label: "Experience", count: portfolio.experience.length },
    { anchor: "journey", label: "Journey", count: portfolio.journey.milestones.length },
    { anchor: "projects", label: "Projects", count: portfolio.projects.length },
    { anchor: "skills", label: "Skills", count: portfolio.skillGroups.reduce((n, g) => n + g.skills.length, 0) },
    { anchor: "education", label: "Education", count: portfolio.education.length },
    { anchor: "contact", label: "Contact", count: portfolio.contacts.length },
  ].filter((c) => c.count > 0);

  return <AssistantExperience name={portfolio.profile.name} suggestions={suggestQuestions(portfolio)} llm={llmEnabled()} clusters={clusters} />;
}
