import { contactHref } from "@/lib/contact";
import { ageLabel, statusLine } from "@/lib/ops";
import { resumeHref } from "@/lib/resume";
import { PAGES, findPage } from "./pages";
import type { CommandActions, CommandData, CommandEnv, ProjectRef } from "./types";

// The terminal's command interpreter. Pure: it takes the input line, the data, and the `actions`/`env` it may use, and returns
// the lines to print. It touches no DOM, so it is tested in scripts/commands-check.ts with fakes.
//
// Everything it says about the site is either data the site already shows, or a live answer from /api/health and /api/version.
// It never claims a deployment or an uptime it has not measured.

export type Tone = "dim" | "err" | "ok" | "accent";

export interface OutLine {
  text: string;
  tone?: Tone;
  /** Makes the whole line a link. A path starting with "/" is a page of this site; anything else opens in a new tab. */
  href?: string;
}

export interface TermCtx {
  data: CommandData;
  actions: CommandActions;
  env: CommandEnv;
  /** Lines the visitor has entered this session, oldest first. */
  history: string[];
}

export interface RunResult {
  lines: OutLine[];
  clear?: boolean;
  close?: boolean;
}

const out = (text: string, tone?: Tone, href?: string): OutLine => ({ text, tone, href });
const err = (text: string): RunResult => ({ lines: [out(text, "err")] });
const pad = (s: string, n: number) => s.padEnd(n, " ");

interface Command {
  name: string;
  usage: string;
  summary: string;
  run(args: string[], ctx: TermCtx): Promise<RunResult> | RunResult;
}

/** Splits a line into words, honouring simple "double quotes". */
export function parseInput(input: string): { name: string; args: string[] } {
  const words: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.trim()))) words.push(m[1] ?? m[2]);
  return { name: (words[0] ?? "").toLowerCase(), args: words.slice(1) };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** A project by slug, id, or a unique fragment of its title. */
export function findProject(data: CommandData, query: string): ProjectRef | undefined {
  const q = norm(query);
  if (!q) return undefined;
  const exact = data.projects.find((p) => p.slug === q || norm(p.id) === q || norm(p.title) === q);
  if (exact) return exact;
  const partial = data.projects.filter((p) => (p.slug ?? norm(p.title)).includes(q) || norm(p.title).includes(q));
  return partial.length === 1 ? partial[0] : undefined;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const HEALTH_FAIL = "could not reach /api/health";

async function readHealth(ctx: TermCtx, deep: boolean) {
  try {
    return await ctx.env.fetchJson(`/api/health${deep ? "?deep=1" : ""}`);
  } catch {
    return null;
  }
}

const COMMANDS: Command[] = [
  {
    name: "help",
    usage: "help [command]",
    summary: "list the commands, or explain one",
    run: (args) => {
      if (args[0]) {
        const c = COMMANDS.find((x) => x.name === args[0].toLowerCase());
        return c ? { lines: [out(c.usage, "accent"), out(c.summary)] } : err(`no such command: ${args[0]}`);
      }
      return {
        lines: [
          out("commands", "dim"),
          ...COMMANDS.map((c) => out(`  ${pad(c.usage.split(" ")[0], 10)}${c.summary}`)),
          out(""),
          out("Tab completes. Up and down browse your history. Esc closes.", "dim"),
        ],
      };
    },
  },
  {
    name: "whoami",
    usage: "whoami",
    summary: "who runs this site",
    run: (_a, { data }) => {
      const p = data.profile;
      if (!p) return { lines: [out("Rahul Jagwan, Software Engineer")] };
      return { lines: [out(p.name, "accent"), out(p.role), out(p.headline, "dim"), out(`${p.location} · ${p.availability}`, "dim")] };
    },
  },
  {
    name: "ls",
    usage: "ls [projects|pages|sections]",
    summary: "list projects, pages or sections",
    run: (args, { data }) => {
      const what = (args[0] ?? "sections").toLowerCase();
      if (what === "projects" || what === "project") {
        if (data.projects.length === 0) return { lines: [out("no projects", "dim")] };
        return {
          lines: data.projects.map((p) => out(`  ${pad(p.slug ?? norm(p.title), 34)}${p.title}${p.sample ? "  [sample]" : ""}${p.confidential ? "  [confidential]" : ""}`, undefined, p.slug ? `/projects/${p.slug}` : undefined)),
        };
      }
      if (what === "pages" || what === "page") return { lines: PAGES.map((p) => out(`  ${pad(p.id, 14)}${p.title}${p.sample ? "  [sample]" : ""}`, undefined, p.path)) };
      if (what === "sections" || what === "section") return { lines: data.sections.map((s) => out(`  ${pad(s.id, 12)}${s.label}`)) };
      return err(`ls: unknown target "${what}". Try: ls projects, ls pages, ls sections`);
    },
  },
  {
    name: "cat",
    usage: "cat <project>",
    summary: "read a project's summary (see ls projects)",
    run: (args, { data }) => {
      if (!args[0]) return err("cat: which project? Try: ls projects");
      const p = findProject(data, args.join(" "));
      if (!p) return err(`cat: no project matching "${args.join(" ")}". Try: ls projects`);
      const lines: OutLine[] = [out(p.title, "accent")];
      const flags = [p.status, p.sample ? "sample" : "", p.confidential ? "confidential" : ""].filter(Boolean).join(" · ");
      if (flags) lines.push(out(flags, "dim"));
      lines.push(out(p.summary));
      lines.push(out(`role   ${p.role}`, "dim"));
      if (p.stack.length) lines.push(out(`stack  ${p.stack.join(", ")}`, "dim"));
      if (p.live) lines.push(out(`demo   ${p.live}`, undefined, p.live));
      if (p.slug) lines.push(out(`page   /projects/${p.slug}`, undefined, `/projects/${p.slug}`));
      return { lines };
    },
  },
  {
    name: "open",
    usage: "open <project|page>",
    summary: "open a project's case study or a page",
    run: (args, ctx) => {
      const q = args.join(" ");
      if (!q) return err("open: open what? Try: ls projects, ls pages");
      if (["hood", "under-the-hood", "underthehood"].includes(norm(q))) {
        ctx.actions.openHood();
        return { lines: [out("opening the under-the-hood panel", "dim")], close: true };
      }
      const page = findPage(q);
      if (page) {
        ctx.actions.navigate(page.path);
        return { lines: [out(`opening ${page.title}`, "dim", page.path)], close: true };
      }
      const project = findProject(ctx.data, q);
      if (project) {
        // The case-study overlay only exists on the home page; anywhere else the project's own page is the destination.
        if (project.hasCaseStudy && ctx.env.path === "/") {
          ctx.actions.openProject(project.id);
          return { lines: [out(`opening the case study for ${project.title}`, "dim")], close: true };
        }
        if (project.slug) {
          ctx.actions.navigate(`/projects/${project.slug}`);
          return { lines: [out(`opening ${project.title}`, "dim")], close: true };
        }
      }
      return err(`open: nothing matches "${q}". Try: ls projects, ls pages`);
    },
  },
  {
    name: "goto",
    usage: "goto <section>",
    summary: "scroll to a section of the home page",
    run: (args, { data, actions }) => {
      const q = norm(args[0] ?? "");
      if (!q) return err(`goto: which section? ${data.sections.map((s) => s.id).join(", ")}`);
      const s = data.sections.find((x) => x.id === q || norm(x.label) === q);
      if (!s) return err(`goto: no section "${args[0]}". Sections: ${data.sections.map((x) => x.id).join(", ")}`);
      actions.scrollTo(s.id);
      return { lines: [out(`scrolling to ${s.label}`, "dim")], close: true };
    },
  },
  {
    name: "theme",
    usage: "theme [light|dark|toggle]",
    summary: "switch the colour theme",
    run: (args, { actions }) => {
      const a = (args[0] ?? "toggle").toLowerCase();
      if (a === "light" || a === "dark") actions.setTheme(a);
      else if (a === "toggle") actions.toggleTheme();
      else return err("theme: use light, dark or toggle");
      return { lines: [out(`theme: ${a === "toggle" ? "toggled" : a}`, "dim")] };
    },
  },
  {
    name: "health",
    usage: "health [--deep]",
    summary: "call this site's /api/health and time it",
    run: async (args, ctx) => {
      const deep = args.includes("--deep");
      const r = await readHealth(ctx, deep);
      if (!r) return err(HEALTH_FAIL);
      const body = (r.json ?? {}) as { status?: string; checks?: { db?: { status?: string; ms?: number } } };
      const lines: OutLine[] = [out(`GET /api/health${deep ? "?deep=1" : ""}  ->  ${r.status}  (${r.ms} ms round trip)`, r.ok ? "ok" : "err")];
      lines.push(out(`status: ${body.status ?? "unknown"}`, body.status === "ok" ? "ok" : "err")); // amber, never red
      if (deep) {
        const db = body.checks?.db;
        lines.push(out(`database: ${db?.status ?? "not reported"}${db?.ms !== undefined ? ` (${db.ms} ms)` : ""}`, db?.status === "ok" ? "ok" : db?.status === "unconfigured" ? "dim" : "err"));
        if (db?.status === "unconfigured") lines.push(out("no database is configured, so the site serves its built-in content. That is a valid mode, not a failure.", "dim"));
        if (db?.status === "down") lines.push(out("the database did not answer in time. The site is still serving (it falls back to built-in content), so this is degraded, not down.", "dim"));
      }
      return { lines };
    },
  },
  {
    name: "version",
    usage: "version",
    summary: "the build that is running (from /api/version)",
    run: async (_a, ctx) => {
      try {
        const r = await ctx.env.fetchJson("/api/version");
        const v = (r.json ?? {}) as { sha?: string; builtAt?: string | null; env?: string; region?: string };
        const built = v.builtAt ? ageLabel(Date.parse(v.builtAt), Date.now()) : "";
        return {
          lines: [
            out(`build   ${v.sha ?? "unknown"}`, "accent"),
            out(`built   ${v.builtAt ?? "unknown"}${built ? ` (${built})` : ""}`),
            out(`where   ${statusLine({ env: v.env ?? "", region: v.region })}`),
          ],
        };
      } catch {
        return err("could not reach /api/version");
      }
    },
  },
  {
    name: "status",
    usage: "status",
    summary: "health and build in one line",
    run: async (_a, ctx) => {
      const [h, v] = await Promise.all([readHealth(ctx, false), ctx.env.fetchJson("/api/version").catch(() => null)]);
      if (!h || !h.ok) return { lines: [out("health check failed", "err")] };
      const ver = (v?.json ?? {}) as { sha?: string; env?: string; region?: string };
      return { lines: [out(`operational · ${h.ms} ms round trip · build ${ver.sha ?? "unknown"} · ${statusLine({ env: ver.env ?? "", region: ver.region })}`, "ok")] };
    },
  },
  {
    name: "deploy",
    usage: "deploy",
    summary: "open the pipeline playground (a simulation)",
    run: (_a, { actions }) => {
      actions.navigate("/engineering/pipeline");
      return { lines: [out("opening the pipeline playground", "dim", "/engineering/pipeline"), out("It is a simulation of a production pipeline, not this site's own.", "dim")], close: true };
    },
  },
  {
    name: "incident",
    usage: "incident",
    summary: "trigger the incident sequence on the home page",
    run: (_a, { actions }) => {
      const ok = actions.triggerIncident();
      return ok ? { lines: [out("incident triggered: watch the Stack section. A node fails, traffic reroutes, it restarts.", "accent")], close: true } : { lines: [out("the incident sequence lives in the 3D world on the home page (desktop). Try: goto skills", "dim")] };
    },
  },
  {
    name: "contact",
    usage: "contact",
    summary: "how to reach me",
    run: (_a, { data }) => (data.contacts.length === 0 ? { lines: [out("no contact links are set", "dim")] } : { lines: data.contacts.map((c) => out(`  ${pad(c.type, 10)}${c.value}`, undefined, contactHref(c))) }),
  },
  {
    name: "resume",
    usage: "resume",
    summary: "download links for the resume",
    run: (_a, { data }) => {
      const lines: OutLine[] = [];
      if (data.resume.pdf) lines.push(out("  pdf   view in the browser", undefined, resumeHref("pdf", data.resume.pdf, "view")), out("  pdf   download", undefined, resumeHref("pdf", data.resume.pdf, "download")));
      if (data.resume.docx) lines.push(out("  docx  download", undefined, resumeHref("docx", data.resume.docx, "download")));
      return { lines: lines.length ? lines : [out("no resume has been uploaded yet", "dim")] };
    },
  },
  {
    name: "history",
    usage: "history",
    summary: "what you have typed this session",
    run: (_a, { history }) => ({ lines: history.length ? history.map((h, i) => out(`  ${pad(String(i + 1), 4)}${h}`, "dim")) : [out("nothing yet", "dim")] }),
  },
  { name: "clear", usage: "clear", summary: "clear the screen", run: () => ({ lines: [], clear: true }) },
  { name: "exit", usage: "exit", summary: "close the terminal", run: () => ({ lines: [], close: true }) },
];

export const COMMAND_NAMES = COMMANDS.map((c) => c.name);
const ALIASES: Record<string, string> = { quit: "exit", ll: "ls", man: "help", "?": "help", cls: "clear" };

/** Runs one line. Unknown commands get a "did you mean" when something is close. */
export async function runCommand(input: string, ctx: TermCtx): Promise<RunResult> {
  const { name: raw, args } = parseInput(input);
  if (!raw) return { lines: [] };
  const name = ALIASES[raw] ?? raw;
  const cmd = COMMANDS.find((c) => c.name === name);
  if (!cmd) {
    const near = COMMAND_NAMES.map((n) => ({ n, d: levenshtein(raw, n) })).sort((a, b) => a.d - b.d)[0];
    return err(`command not found: ${raw}.${near && near.d <= 2 ? ` Did you mean "${near.n}"?` : ""} Type "help".`);
  }
  try {
    return await cmd.run(args, ctx);
  } catch {
    return err(`${cmd.name}: something went wrong`);
  }
}

function commonPrefix(xs: string[]): string {
  if (xs.length === 0) return "";
  let p = xs[0];
  for (const x of xs) while (!x.startsWith(p)) p = p.slice(0, -1);
  return p;
}

/** Tab completion: command names first, then the arguments each command takes. */
export function complete(input: string, data: CommandData): { value: string; options: string[] } {
  const endsWithSpace = /\s$/.test(input);
  const parts = input.replace(/^\s+/, "").split(/\s+/);
  if (parts.length === 1 && !endsWithSpace) {
    const matches = COMMAND_NAMES.filter((n) => n.startsWith(parts[0].toLowerCase()));
    if (matches.length === 1) return { value: `${matches[0]} `, options: [] };
    return { value: commonPrefix(matches) || parts[0], options: matches.length > 1 ? matches : [] };
  }
  const cmd = (ALIASES[parts[0].toLowerCase()] ?? parts[0]).toLowerCase();
  const word = endsWithSpace ? "" : parts[parts.length - 1].toLowerCase();
  const head = endsWithSpace ? input : input.slice(0, input.length - word.length);
  const pool: string[] =
    cmd === "cat" ? data.projects.map((p) => p.slug ?? norm(p.title))
    : cmd === "open" ? [...data.projects.map((p) => p.slug ?? norm(p.title)), ...PAGES.map((p) => p.id), "hood"]
    : cmd === "goto" ? data.sections.map((s) => s.id)
    : cmd === "ls" ? ["projects", "pages", "sections"]
    : cmd === "theme" ? ["light", "dark", "toggle"]
    : cmd === "health" ? ["--deep"]
    : cmd === "help" ? COMMAND_NAMES
    : [];
  const matches = pool.filter((x) => x.startsWith(word));
  if (matches.length === 1) return { value: `${head}${matches[0]} `, options: [] };
  return { value: `${head}${commonPrefix(matches) || word}`, options: matches.length > 1 ? matches : [] };
}
