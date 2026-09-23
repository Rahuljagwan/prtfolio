import { z } from "zod";

// The admin is driven entirely by this file. Each resource describes its fields once, and the same
// description powers the edit form, the API validation and the list title.
// To add a new section type, see docs/EXTENDING.md: it is one Prisma model plus one entry here.

export type Field =
  | { name: string; label: string; type: "text"; max?: number; hint?: string; optional?: boolean }
  | { name: string; label: string; type: "textarea"; max?: number; hint?: string; optional?: boolean }
  | { name: string; label: string; type: "select"; options: string[] }
  | { name: string; label: string; type: "list"; hint?: string; style?: "chips" | "rows" } // string[]. style defaults to "rows"; "chips" suits genuinely tag-like fields.
  | { name: string; label: string; type: "objects"; of: Field[]; hint?: string }; // [{...}] with sub-fields

export interface Resource {
  /** URL segment and key: /api/admin/<key> */
  key: string;
  label: string;
  singular: string;
  /** Prisma delegate name on the client, e.g. prisma.project */
  delegate: "project" | "experience" | "skillGroup" | "contactLink" | "education" | "journeyMilestone";
  /** Field shown as the row title in the list */
  titleField: string;
  /** Field shown as the row subtitle in the list (optional) */
  subtitleField?: string;
  fields: Field[];
}

const CONTACT_TYPES = ["email", "phone", "whatsapp", "linkedin", "github"];

export const RESOURCES: Resource[] = [
  {
    key: "projects",
    label: "Projects",
    singular: "project",
    delegate: "project",
    titleField: "title",
    subtitleField: "role",
    fields: [
      { name: "title", label: "Title", type: "text", max: 120 },
      { name: "summary", label: "Summary", type: "textarea", max: 600 },
      { name: "role", label: "Your role", type: "text", max: 120 },
      { name: "highlights", label: "Highlights", type: "list", hint: "One point per line item" },
      { name: "stack", label: "Tech stack", type: "list", hint: "One technology per item", style: "chips" },
      { name: "challenge", label: "Case study: the challenge (optional)", type: "textarea", max: 600, optional: true, hint: "What problem did this solve? Fill any of the three case-study fields to show a Case study button on the card." },
      { name: "approach", label: "Case study: what I did (optional)", type: "list", hint: "One step per item" },
      { name: "outcome", label: "Case study: the outcome (optional)", type: "textarea", max: 600, optional: true },
    ],
  },
  {
    key: "experience",
    label: "Experience",
    singular: "role",
    delegate: "experience",
    titleField: "role",
    subtitleField: "organisation",
    fields: [
      { name: "role", label: "Job title", type: "text", max: 120 },
      { name: "organisation", label: "Organisation", type: "text", max: 120 },
      { name: "period", label: "Period", type: "text", max: 60, hint: "e.g. Dec 2025 – Present" },
      { name: "location", label: "Location", type: "text", max: 80 },
      { name: "bullets", label: "Responsibilities and achievements", type: "list" },
      { name: "stack", label: "Tech used", type: "list", style: "chips" },
    ],
  },
  {
    key: "skills",
    label: "Skills",
    singular: "skill group",
    delegate: "skillGroup",
    titleField: "name",
    fields: [
      { name: "name", label: "Group name", type: "text", max: 60 },
      { name: "skills", label: "Skills", type: "list", style: "chips" },
    ],
  },
  {
    key: "education",
    label: "Education",
    singular: "education entry",
    delegate: "education",
    titleField: "degree",
    subtitleField: "institution",
    fields: [
      { name: "degree", label: "Degree / qualification", type: "text", max: 160 },
      { name: "institution", label: "Institution", type: "text", max: 160 },
      { name: "period", label: "Year / duration", type: "text", max: 60, hint: "e.g. 2021 – 2025" },
      { name: "description", label: "Notes (optional)", type: "textarea", max: 500, optional: true },
    ],
  },
  {
    key: "milestones",
    label: "Journey milestones",
    singular: "milestone",
    delegate: "journeyMilestone",
    titleField: "title",
    subtitleField: "period",
    fields: [
      { name: "title", label: "Title", type: "text", max: 120 },
      { name: "period", label: "Label / period", type: "text", max: 60, hint: "e.g. Going live, Now, Next" },
      { name: "description", label: "Description", type: "textarea", max: 400 },
      { name: "tags", label: "Tags", type: "list", hint: "Technologies or themes", style: "chips" },
      { name: "status", label: "Status", type: "select", options: ["done", "current", "next"] },
    ],
  },
  {
    key: "contacts",
    label: "Contact links",
    singular: "contact link",
    delegate: "contactLink",
    titleField: "type",
    subtitleField: "value",
    fields: [
      { name: "type", label: "Type", type: "select", options: CONTACT_TYPES },
      { name: "value", label: "Value", type: "text", max: 200, hint: "Phone and WhatsApp with country code, e.g. +91-9876543210" },
    ],
  },
];

export const PROFILE_FIELDS: Field[] = [
  { name: "name", label: "Name", type: "text", max: 80 },
  { name: "role", label: "Role", type: "text", max: 120 },
  { name: "headline", label: "Headline", type: "textarea", max: 300 },
  { name: "location", label: "Location", type: "text", max: 80 },
  { name: "availability", label: "Availability badge", type: "text", max: 80 },
  { name: "bio", label: "About paragraphs", type: "list" },
  {
    name: "facts",
    label: "Quick facts",
    type: "objects",
    of: [
      { name: "label", label: "Label", type: "text", max: 40 },
      { name: "value", label: "Value", type: "text", max: 120 },
    ],
  },
  {
    name: "highlights",
    label: "Highlight cards",
    type: "objects",
    of: [
      { name: "title", label: "Title", type: "text", max: 80 },
      { name: "text", label: "Text", type: "textarea", max: 240 },
    ],
  },
];

/** Heading and story for the "Path into Automation" section (single row, edited in the Journey tab). */
export const JOURNEY_FIELDS: Field[] = [
  { name: "heading", label: "Section heading", type: "text", max: 140 },
  { name: "story", label: "Story paragraphs", type: "list", hint: "Two or three short paragraphs work best" },
];

export const getResource = (key: string) => RESOURCES.find((r) => r.key === key);

/** Builds a strict zod schema from a field list. Unknown keys are rejected. */
export function schemaFor(fields: Field[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    switch (f.type) {
      case "text":
      case "textarea":
        // Optional text is stored as null when left empty.
        shape[f.name] = f.optional
          ? z.string().trim().max(f.max ?? 500).nullish().transform((v) => v || null)
          : z.string().trim().min(1, `${f.label} is required`).max(f.max ?? 500);
        break;
      case "select":
        shape[f.name] = z.enum(f.options as [string, ...string[]]);
        break;
      case "list":
        shape[f.name] = z.array(z.string().trim().min(1).max(600)).max(40);
        break;
      case "objects":
        shape[f.name] = z.array(schemaFor(f.of)).max(20);
        break;
    }
  }
  return z.strictObject(shape);
}
