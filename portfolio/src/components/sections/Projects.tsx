import { ProjectsClient } from "@/components/projects/ProjectsClient";
import type { Project } from "@/lib/types";

// Re-exported for app/page.tsx (the case-study layer only receives projects that have one).
export { hasCaseStudy } from "@/lib/projects/utils";

/**
 * The Projects section. No scrim or panel around the cards: they are opaque surfaces of their own, so the 3D pods in the
 * cover strips stay visible instead of sitting under a 92% wash. Only the header (title, view toggle, filters) is a small panel.
 */
export function Projects({ items }: { items: Project[] }) {
  return (
    <section id="projects" className="scroll-mt-24 py-24 md:py-32">
      <div className="container">
        <ProjectsClient projects={items} />
      </div>
    </section>
  );
}
