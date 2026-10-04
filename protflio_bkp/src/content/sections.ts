// Single source of truth for the section list, used by the nav, the page and
// (in Stage 3) seeded into the database so order/visibility become editable.

export type SectionId =
  | "hero"
  | "about"
  | "experience"
  | "journey"
  | "projects"
  | "skills"
  | "education"
  | "resume"
  | "contact";

export interface SectionMeta {
  id: SectionId;
  label: string;
  inNav: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { id: "hero", label: "Home", inNav: true },
  { id: "about", label: "About", inNav: true },
  { id: "experience", label: "Experience", inNav: true },
  { id: "journey", label: "Journey", inNav: true },
  { id: "projects", label: "Projects", inNav: true },
  { id: "skills", label: "Skills", inNav: true },
  { id: "education", label: "Education", inNav: true },
  // Reachable from the hero Resume menu and the command palette, so it stays out of the (already full) nav pill.
  { id: "resume", label: "Resume", inNav: false },
  { id: "contact", label: "Contact", inNav: true },
];
