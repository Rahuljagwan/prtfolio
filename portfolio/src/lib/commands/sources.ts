import { contactHref, WHATSAPP_GREETING } from "@/lib/contact";
import { resumeHref } from "@/lib/resume";
import type { ContactLink } from "@/lib/types";
import { PAGES } from "./pages";
import type { CommandActions, PaletteCommand, PaletteData } from "./types";

const CONTACT_LABELS: Record<ContactLink["type"], string> = {
  email: "Send an email",
  phone: "Call",
  whatsapp: "Open WhatsApp",
  linkedin: "Open LinkedIn",
  github: "Open GitHub",
};

/**
 * Every entry the command palette offers, from the site's data. One function, so a new project, page or contact shows up in the
 * palette without touching the palette component. Order is the order they are listed in when the search box is empty.
 */
export function buildPaletteCommands(data: PaletteData, actions: CommandActions): PaletteCommand[] {
  const goTo = data.sections.map<PaletteCommand>((s) => ({ id: `go-${s.id}`, label: s.label, group: "Go to", run: () => actions.scrollTo(s.id) }));

  const app: PaletteCommand[] = [
    { id: "ask", label: "Ask the assistant", group: "Actions", run: () => actions.navigate("/assistant") },
    { id: "terminal", label: "Open the terminal", group: "Actions", run: () => actions.openTerminal() },
    { id: "hood", label: "Under the hood: page performance and build", group: "Actions", run: () => actions.openHood() },
    { id: "theme", label: actions.currentTheme() === "dark" ? "Switch to light theme" : "Switch to dark theme", group: "Actions", run: () => actions.toggleTheme() },
  ];

  const projects = data.projects.map<PaletteCommand>((p) => ({
    id: `project-${p.id}`,
    label: `${p.hasCaseStudy ? "Open case study" : "Go to project"}: ${p.title}${p.sample ? " (sample)" : ""}`,
    group: "Projects",
    run: () => (p.hasCaseStudy ? actions.openProject(p.id) : p.slug ? actions.navigate(`/projects/${p.slug}`) : actions.scrollTo("projects")),
  }));

  const pages = PAGES.filter((p) => p.id !== "assistant").map<PaletteCommand>((p) => ({
    id: `page-${p.id}`,
    label: `${p.title}${p.sample ? " (sample)" : ""}`,
    group: "Pages",
    run: () => actions.navigate(p.path),
  }));

  const resume: PaletteCommand[] = [];
  if (data.resume.pdf) {
    const pdf = data.resume.pdf;
    resume.push({ id: "resume-view", label: "View resume in browser", group: "Resume", run: () => actions.open(resumeHref("pdf", pdf, "view"), "blank") });
    resume.push({ id: "resume-pdf", label: "Download resume (PDF)", group: "Resume", run: () => actions.download(resumeHref("pdf", pdf, "download")) });
  }
  if (data.resume.docx) {
    const docx = data.resume.docx;
    resume.push({ id: "resume-docx", label: "Download resume (DOCX)", group: "Resume", run: () => actions.download(resumeHref("docx", docx, "download")) });
  }

  const contact = data.contacts.map<PaletteCommand>((c) => ({
    id: `contact-${c.type}`,
    label: CONTACT_LABELS[c.type],
    group: "Contact",
    run: () => actions.open(contactHref(c, WHATSAPP_GREETING), c.type === "email" || c.type === "phone" ? "self" : "blank"),
  }));

  return [...goTo, ...app, ...projects, ...pages, ...resume, ...contact];
}

/** Case-insensitive substring filter, the same rule the palette has always used. */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  return q ? commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)) : commands;
}
