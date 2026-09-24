// Shared shapes for the command palette (Ctrl+K) and the terminal (Ctrl+`). Both are built from the same data and act
// through the same `actions`, so a project, a page or a section is defined once and is reachable from either.
// This folder imports nothing from React, the DOM or three.js: everything is pure and tested (scripts/commands-check.ts).

import type { ContactLink, ResumeInfo } from "@/lib/types";

export interface SectionRef {
  id: string;
  label: string;
}

/** Just what the commands need of a project. Confidential projects arrive already redacted (only the public summary). */
export interface ProjectRef {
  id: string;
  slug?: string;
  title: string;
  summary: string;
  role: string;
  status?: string;
  stack: string[];
  hasCaseStudy: boolean;
  sample?: boolean;
  confidential?: boolean;
  live?: string;
}

/** The slice of a project the palette needs (it lists projects and opens them; the terminal needs more). */
export type PaletteProject = Pick<ProjectRef, "id" | "slug" | "title" | "hasCaseStudy" | "sample">;

export interface PaletteData {
  sections: SectionRef[];
  projects: PaletteProject[];
  contacts: ContactLink[];
  resume: ResumeInfo;
}

export interface CommandData extends Omit<PaletteData, "projects"> {
  profile?: { name: string; role: string; headline: string; location: string; availability: string };
  projects: ProjectRef[];
}

/** Everything a command can DO. The UI supplies the real implementations; tests supply fakes. */
export interface CommandActions {
  navigate(path: string): void;
  /** Scroll to a home-page section (navigating to /#id first when not on the home page). */
  scrollTo(sectionId: string): void;
  openProject(id: string): void;
  toggleTheme(): void;
  setTheme(mode: "light" | "dark"): void;
  currentTheme(): "light" | "dark";
  openHood(): void;
  openTerminal(): void;
  /** Starts the Stack section's incident sequence. Returns false when there is nothing to show it on (not the home page, or no 3D world). */
  triggerIncident(): boolean;
  /** Opens a URL: a new tab, or this one (mailto:, tel:). */
  open(url: string, target: "blank" | "self"): void;
  download(url: string): void;
}

export interface FetchResult {
  ok: boolean;
  status: number;
  ms: number;
  json: unknown;
}

export interface CommandEnv {
  /** The current pathname. */
  path: string;
  fetchJson(path: string): Promise<FetchResult>;
}

export type PaletteGroup = "Go to" | "Actions" | "Projects" | "Pages" | "Contact" | "Resume";

export interface PaletteCommand {
  id: string;
  label: string;
  group: PaletteGroup;
  run: () => void;
}
