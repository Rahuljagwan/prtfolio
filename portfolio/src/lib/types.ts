// Shapes of everything the portfolio renders. In Stage 3 these map 1:1 to Prisma models,
// so the UI never needs to change when content moves from seed data to the database.

export interface Profile {
  name: string;
  role: string;
  headline: string;
  location: string;
  availability: string;
  bio: string[];
  facts: { label: string; value: string }[];
  highlights: { title: string; text: string }[];
}

export type ContactType = "email" | "phone" | "whatsapp" | "linkedin" | "github";

export interface ContactLink {
  type: ContactType;
  value: string;
}

export interface Experience {
  id: string;
  role: string;
  organisation: string;
  period: string;
  location: string;
  bullets: string[];
  stack: string[];
}

export interface Project {
  id: string;
  title: string;
  summary: string;
  role: string;
  highlights: string[];
  stack: string[];
  /** Case study fields. All optional: a project without any of them has no "Case study" button. */
  challenge?: string | null;
  approach?: string[];
  outcome?: string | null;
}

export interface SkillGroup {
  id: string;
  name: string;
  skills: string[];
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  period: string;
  description?: string | null;
}

export type MilestoneStatus = "done" | "current" | "next";

export interface JourneyMilestone {
  id: string;
  title: string;
  period: string;
  description: string;
  tags: string[];
  status: MilestoneStatus;
}

export interface Journey {
  heading: string;
  story: string[];
  milestones: JourneyMilestone[];
}

export interface ResumeFileInfo {
  filename: string;
  size: number;
  updatedAt: string;
  /** "upload": uploaded in /admin and stored in the database. "public": a file dropped in public/resume/. */
  source?: "upload" | "public";
}

/** Which resume files exist. Empty when nothing has been uploaded, and the resume buttons stay hidden. */
export interface ResumeInfo {
  pdf?: ResumeFileInfo;
  docx?: ResumeFileInfo;
}

export interface Portfolio {
  profile: Profile;
  contacts: ContactLink[];
  experience: Experience[];
  projects: Project[];
  skillGroups: SkillGroup[];
  education: EducationEntry[];
  journey: Journey;
  resume: ResumeInfo;
}
