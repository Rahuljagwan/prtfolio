/* eslint-disable no-console */
// Checks for the command registry, the palette builder and the terminal interpreter. Run with:  npm run test:commands
// Fakes stand in for the router, the theme and the network, so no browser is needed.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SECTIONS } from "../src/content/sections";
import { PAGES, findPage } from "../src/lib/commands/pages";
import { buildPaletteCommands, filterCommands } from "../src/lib/commands/sources";
import { COMMAND_NAMES, complete, findProject, parseInput, runCommand, type TermCtx } from "../src/lib/commands/terminal";
import type { CommandActions, CommandData, FetchResult } from "../src/lib/commands/types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}

// ---- fixtures
const data: CommandData = {
  profile: { name: "Rahul", role: "Full-Stack Developer", headline: "I build and run production web systems.", location: "India", availability: "Open to roles" },
  sections: SECTIONS.map((s) => ({ id: s.id, label: s.label })),
  projects: [
    { id: "p1", slug: "enterprise-nbfc-workflow-platform", title: "Enterprise NBFC Workflow Platform", summary: "Moves requests through approval stages.", role: "Full-stack", status: "live", stack: ["Flask", "React"], hasCaseStudy: true },
    { id: "s1", slug: "release-dashboard", title: "Release Dashboard", summary: "Shows which release runs where.", role: "Full-stack", stack: ["React"], hasCaseStudy: true, sample: true, live: "https://demo.example" },
    { id: "s2", slug: "access-review-portal", title: "Access Review Portal", summary: "Details are confidential.", role: "Full-stack", stack: [], hasCaseStudy: false, sample: true, confidential: true },
  ],
  contacts: [
    { type: "email", value: "me@corp.dev" },
    { type: "linkedin", value: "linkedin.com/in/me" },
  ],
  resume: { pdf: { filename: "cv.pdf", size: 10, updatedAt: "2026-01-01" } },
};

function makeActions() {
  const calls: string[] = [];
  let theme: "light" | "dark" = "dark";
  let incident = true;
  const a: CommandActions = {
    navigate: (p) => void calls.push(`navigate:${p}`),
    scrollTo: (id) => void calls.push(`scroll:${id}`),
    openProject: (id) => void calls.push(`project:${id}`),
    toggleTheme: () => {
      theme = theme === "dark" ? "light" : "dark";
      calls.push("theme:toggle");
    },
    setTheme: (m) => {
      theme = m;
      calls.push(`theme:${m}`);
    },
    currentTheme: () => theme,
    openHood: () => void calls.push("hood"),
    openTerminal: () => void calls.push("terminal"),
    triggerIncident: () => {
      calls.push("incident");
      return incident;
    },
    open: (u, t) => void calls.push(`open:${t}:${u}`),
    download: (u) => void calls.push(`download:${u}`),
  };
  return { a, calls, setIncident: (v: boolean) => (incident = v) };
}

function makeCtx(responses: Record<string, FetchResult | "throw"> = {}, history: string[] = []) {
  const { a, calls, setIncident } = makeActions();
  const ctx: TermCtx = {
    data,
    actions: a,
    history,
    env: {
      path: "/",
      fetchJson: async (p) => {
        const r = responses[p];
        if (!r || r === "throw") throw new Error("network");
        return r;
      },
    },
  };
  return { ctx, calls, setIncident };
}
const text = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join("\n");

// ---- pages
check("pages: every page path has a real route file", PAGES.every((p) => existsSync(join(__dirname, "..", "src/app", p.path, "page.tsx"))), PAGES.filter((p) => !existsSync(join(__dirname, "..", "src/app", p.path, "page.tsx"))).map((p) => p.path).join());
check("pages: ids and aliases never collide", new Set(PAGES.flatMap((p) => [p.id, ...p.aliases])).size === PAGES.flatMap((p) => [p.id, ...p.aliases]).length);
check("pages: found by id, alias or path, case-insensitively", findPage("PIPELINE")?.id === "pipeline" && findPage("deploy")?.id === "pipeline" && findPage("/engineering/roadmap")?.id === "roadmap" && findPage("nope") === undefined);

// ---- the palette
{
  const { a, calls } = makeActions();
  const cmds = buildPaletteCommands(data, a);
  check("palette: unique ids", new Set(cmds.map((c) => c.id)).size === cmds.length);
  check("palette: every section is offered", SECTIONS.every((s) => cmds.some((c) => c.id === `go-${s.id}`)));
  check("palette: every project and every page is offered", data.projects.every((p) => cmds.some((c) => c.id === `project-${p.id}`)) && PAGES.filter((p) => p.id !== "assistant").every((p) => cmds.some((c) => c.id === `page-${p.id}`)));
  check("palette: actions, resume and contact entries are present", ["ask", "terminal", "hood", "theme", "resume-view", "resume-pdf", "contact-email", "contact-linkedin"].every((id) => cmds.some((c) => c.id === id)));
  check("palette: no docx entry when there is no docx", !cmds.some((c) => c.id === "resume-docx"));
  cmds.find((c) => c.id === "project-p1")!.run();
  cmds.find((c) => c.id === "project-s2")!.run();
  cmds.find((c) => c.id === "go-skills")!.run();
  cmds.find((c) => c.id === "contact-email")!.run();
  cmds.find((c) => c.id === "contact-linkedin")!.run();
  check("palette: a case study opens, a project without one goes to its page", calls.includes("project:p1") && calls.includes("navigate:/projects/access-review-portal"));
  check("palette: sections scroll; email opens in place, links in a new tab", calls.includes("scroll:skills") && calls.includes("open:self:mailto:me@corp.dev") && calls.includes("open:blank:https://linkedin.com/in/me"));
  check("palette: samples are labelled in the list", cmds.find((c) => c.id === "project-s1")!.label.includes("(sample)") && !cmds.find((c) => c.id === "project-p1")!.label.includes("(sample)"));
  check("palette: the theme entry says what it will do", cmds.find((c) => c.id === "theme")!.label === "Switch to light theme");
  check("palette: filter is a case-insensitive substring match on label or group", filterCommands(cmds, "NOTIF").length === 0 && filterCommands(cmds, "dashboard").length === 1 && filterCommands(cmds, "resume").every((c) => c.group === "Resume" || c.label.toLowerCase().includes("resume")) && filterCommands(cmds, "  ").length === cmds.length);
}

// ---- parsing and finding
check("parse: words, quotes and case", JSON.stringify(parseInput('  CAT "Release Dashboard" x ')) === JSON.stringify({ name: "cat", args: ["Release Dashboard", "x"] }) && parseInput("   ").name === "");
check("find: by slug, title, and a unique fragment; ambiguous or empty finds nothing", findProject(data, "release-dashboard")?.id === "s1" && findProject(data, "Release Dashboard")?.id === "s1" && findProject(data, "nbfc")?.id === "p1" && findProject(data, "portal")?.id === "s2" && findProject(data, "s") === undefined && findProject(data, "") === undefined);

// ---- the terminal
async function main() {
  {
    const { ctx } = makeCtx();
    const h = await runCommand("help", ctx);
    check("help: lists every command", COMMAND_NAMES.every((n) => text(h).includes(n)));
    check("help <cmd>: explains one; unknown is an error", text(await runCommand("help cat", ctx)).includes("cat <project>") && (await runCommand("help zzz", ctx)).lines[0].tone === "err");
    check("whoami: prints the profile", text(await runCommand("whoami", ctx)).includes("Full-Stack Developer"));
    check("empty input prints nothing", (await runCommand("   ", ctx)).lines.length === 0);
    const bad = await runCommand("hlep", ctx);
    check("unknown command: an error that suggests the closest command", bad.lines[0].tone === "err" && bad.lines[0].text.includes('Did you mean "help"?'), bad.lines[0].text);
    check("unknown command: nothing close means no suggestion", !(await runCommand("qwertyuiop", ctx)).lines[0].text.includes("Did you mean"));
    check("aliases work (quit closes, cls clears)", (await runCommand("quit", ctx)).close === true && (await runCommand("cls", ctx)).clear === true);
  }
  {
    const { ctx } = makeCtx();
    const projects = await runCommand("ls projects", ctx);
    check("ls projects: slugs, titles, and sample and confidential tags", projects.lines.length === 3 && text(projects).includes("[sample]") && text(projects).includes("[confidential]") && projects.lines[0].href === "/projects/enterprise-nbfc-workflow-platform");
    check("ls: sections by default, pages on request, unknown is an error", text(await runCommand("ls", ctx)).includes("projects") && (await runCommand("ls pages", ctx)).lines.length === PAGES.length && (await runCommand("ls nope", ctx)).lines[0].tone === "err");
    const cat = await runCommand("cat release", ctx);
    check("cat: prints summary, stack, demo and page for a project", text(cat).includes("Shows which release runs where.") && text(cat).includes("stack  React") && text(cat).includes("sample") && cat.lines.some((l) => l.href === "https://demo.example"));
    const conf = await runCommand("cat access-review-portal", ctx);
    check("cat: a confidential project shows only its public summary", text(conf).includes("Details are confidential.") && text(conf).includes("confidential"));
    check("cat: missing or unknown project is an error", (await runCommand("cat", ctx)).lines[0].tone === "err" && (await runCommand("cat nope", ctx)).lines[0].tone === "err");
  }
  {
    const { ctx, calls } = makeCtx();
    const o1 = await runCommand("open nbfc", ctx);
    check("open: a project with a case study opens it and closes the terminal", calls.includes("project:p1") && o1.close === true);
    const away = makeCtx();
    away.ctx.env.path = "/engineering";
    await runCommand("open nbfc", away.ctx);
    check("open: away from the home page a project opens its own page (the case-study overlay only exists at /)", away.calls.includes("navigate:/projects/enterprise-nbfc-workflow-platform") && !away.calls.includes("project:p1"));
    await runCommand("open access-review-portal", ctx);
    check("open: a project without one opens its page", calls.includes("navigate:/projects/access-review-portal"));
    await runCommand("open pipeline", ctx);
    await runCommand("open hood", ctx);
    check("open: pages by alias, and the under-the-hood panel", calls.includes("navigate:/engineering/pipeline") && calls.includes("hood"));
    check("open: nothing matching is an error and does nothing", (await runCommand("open zzz", ctx)).lines[0].tone === "err" && (await runCommand("open", ctx)).lines[0].tone === "err");
    const g = await runCommand("goto skills", ctx);
    check("goto: scrolls to a known section (by id or label), closes; unknown lists the sections", calls.includes("scroll:skills") && g.close === true && (await runCommand("goto Contact", ctx)).close === true && text(await runCommand("goto zzz", ctx)).includes("Sections:"));
    await runCommand("theme light", ctx);
    await runCommand("theme", ctx);
    check("theme: sets, toggles, and rejects nonsense", calls.includes("theme:light") && calls.includes("theme:toggle") && (await runCommand("theme purple", ctx)).lines[0].tone === "err");
    const d = await runCommand("deploy", ctx);
    check("deploy: opens the playground and says it is a simulation, not this site's pipeline", calls.includes("navigate:/engineering/pipeline") && /simulation/.test(text(d)) && /not this site's own/.test(text(d)));
  }
  {
    const { ctx, calls, setIncident } = makeCtx();
    check("incident: triggers it and points at the Stack section", text(await runCommand("incident", ctx)).includes("Stack") && calls.includes("incident"));
    setIncident(false);
    check("incident: with no 3D world it says so instead of pretending", text(await runCommand("incident", ctx)).includes("3D world"));
  }
  {
    const ok: FetchResult = { ok: true, status: 200, ms: 31, json: { status: "ok", checks: { app: "ok" } } };
    const deepDown: FetchResult = { ok: true, status: 200, ms: 3010, json: { status: "degraded", checks: { app: "ok", db: { status: "down", ms: 3003 } } } };
    const deepNone: FetchResult = { ok: true, status: 200, ms: 20, json: { status: "ok", checks: { db: { status: "unconfigured" } } } };
    const version: FetchResult = { ok: true, status: 200, ms: 5, json: { sha: "abc1234", builtAt: "2026-09-24T00:00:00Z", env: "local" } };
    const { ctx } = makeCtx({ "/api/health": ok, "/api/health?deep=1": deepDown, "/api/version": version });
    const h = await runCommand("health", ctx);
    check("health: reports the status and the measured round trip", text(h).includes("200") && text(h).includes("31 ms") && text(h).includes("status: ok") && h.lines[0].tone === "ok");
    const hd = await runCommand("health --deep", ctx);
    check("health --deep: a down database is 'degraded', and it explains the fallback", text(hd).includes("database: down") && text(hd).includes("degraded, not down") && hd.lines.some((l) => l.tone === "err"));
    const { ctx: ctx2 } = makeCtx({ "/api/health?deep=1": deepNone });
    check("health --deep: an unconfigured database is a valid mode, not an error", text(await runCommand("health --deep", ctx2)).includes("not a failure"));
    const v = await runCommand("version", ctx);
    check("version: sha, build time and 'local build' (never 'deployed')", text(v).includes("abc1234") && text(v).includes("local build") && !/deployed/i.test(text(v)));
    const s = await runCommand("status", ctx);
    check("status: one honest line", s.lines.length === 1 && s.lines[0].text.startsWith("operational") && s.lines[0].text.includes("build abc1234") && s.lines[0].text.includes("local build") && s.lines[0].tone === "ok");
    const { ctx: dead } = makeCtx({});
    check("health / status / version: an unreachable endpoint is an error, not a crash", (await runCommand("health", dead)).lines[0].tone === "err" && (await runCommand("status", dead)).lines[0].tone === "err" && (await runCommand("version", dead)).lines[0].tone === "err");
    const { ctx: sick } = makeCtx({ "/api/health": { ok: false, status: 503, ms: 12, json: { status: "down" } }, "/api/version": version });
    check("status: an unhealthy response says the check failed", (await runCommand("status", sick)).lines[0].tone === "err");
  }
  {
    const { ctx } = makeCtx({}, ["help", "ls"]);
    check("contact: lists each contact with a real link", (await runCommand("contact", ctx)).lines.some((l) => l.href === "mailto:me@corp.dev"));
    check("resume: lists the links that exist", text(await runCommand("resume", ctx)).includes("pdf") && !text(await runCommand("resume", ctx)).includes("docx"));
    check("history: numbers what was typed; empty says so", text(await runCommand("history", ctx)).includes("1   help") && text(await runCommand("history", makeCtx().ctx)).includes("nothing yet"));
    check("clear and exit return their flags", (await runCommand("clear", ctx)).clear === true && (await runCommand("exit", ctx)).close === true);
  }

  // ---- tab completion
  check("complete: a unique prefix completes and adds a space", complete("hel", data).value === "help " && complete("cle", data).value === "clear ");
  check("complete: an ambiguous prefix completes the shared part and lists options", complete("h", data).options.includes("help") && complete("h", data).options.includes("health") && complete("h", data).value === "h");
  check("complete: arguments: projects for cat, sections for goto, pages for open", complete("cat rel", data).value === "cat release-dashboard " && complete("goto ski", data).value === "goto skills " && complete("open pipe", data).value === "open pipeline ");
  check("complete: an empty argument lists everything for that command", complete("theme ", data).options.length === 3 && complete("ls ", data).options.length === 3);
  check("complete: nothing matches leaves the input alone", complete("zzz", data).value === "zzz" && complete("cat nope", data).value === "cat nope");
  check("complete: garbage is safe", complete("", data).options.length === COMMAND_NAMES.length);

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
