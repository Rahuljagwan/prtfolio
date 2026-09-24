/* eslint-disable no-console */
// Checks for the engineering pages' content and helpers. Run with:  npm run test:engineering
// The gates that matter: every illustrative entry is flagged as a sample, the architecture page only points at files that
// exist (and only claims what the code does), code annotations point at real lines, and the highlighter never alters text.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIGS } from "../src/content/configs";
import { POSTMORTEMS } from "../src/content/postmortems";
import { ROADMAP, ROADMAP_AREAS } from "../src/content/roadmap";
import { NOTES } from "../src/content/notes";
import { DIAGRAM, EDGES, NODES, NODE_H, NODE_W, hostNote } from "../src/content/site-architecture";
import { highlight, highlightLine } from "../src/lib/highlight";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}
const root = join(__dirname, "..");
const unique = <T,>(xs: T[]) => new Set(xs).size === xs.length;

// ---- everything illustrative is flagged
check("postmortems: every entry is a flagged sample", POSTMORTEMS.every((p) => p.sample === true));
check("configs: every entry is a flagged sample", CONFIGS.every((c) => c.sample === true));
check("roadmap: every detail item is a flagged sample", ROADMAP.every((r) => r.sample === true));
check("notes: every entry is a flagged sample", NOTES.every((n) => n.sample === true));
check("slugs and ids are unique", unique(POSTMORTEMS.map((p) => p.slug)) && unique(CONFIGS.map((c) => c.id)) && unique(ROADMAP.map((r) => r.id)) && unique(NOTES.map((n) => n.slug)));
check("postmortems: severities are known and dates are ISO dates", POSTMORTEMS.every((p) => ["sev1", "sev2", "sev3"].includes(p.severity) && /^\d{4}-\d{2}-\d{2}$/.test(p.date)));
check("postmortems: each has a timeline, a cause, a fix and prevention", POSTMORTEMS.every((p) => p.timeline.length >= 3 && p.rootCause && p.fix && p.prevention.length > 0 && p.wentWell.length > 0 && p.wentBadly.length > 0));
check("roadmap: areas used are all declared", ROADMAP.every((r) => ROADMAP_AREAS.includes(r.area)));
check("notes: bodies are typed blocks with the fields they need", NOTES.every((n) => n.body.length > 0 && n.body.every((b) => (b.type === "list" ? b.items.length > 0 : b.type === "code" ? b.text.length > 0 : b.text.length > 0))));
check("no red in the content: severity is amber (no 'red' colour words used as a status)", !JSON.stringify(POSTMORTEMS).toLowerCase().includes("status: red"));

// ---- the highlighter
for (const c of CONFIGS) {
  const lines = c.code.split("\n");
  const tokens = highlight(c.code, c.lang);
  check(`highlight ${c.id}: lossless (every line's tokens join back to the line)`, tokens.every((t, i) => t.map((x) => x.text).join("") === lines[i]), lines.find((l, i) => tokens[i].map((x) => x.text).join("") !== l));
  check(`config ${c.id}: notes point at real, non-blank lines, in order`, c.notes.every((n, i) => n.line >= 1 && n.line <= lines.length && lines[n.line - 1].trim() !== "" && (i === 0 || n.line > c.notes[i - 1].line)), JSON.stringify(c.notes.map((n) => n.line)));
}
{
  const kinds = (line: string, lang: "nginx" | "ini" | "yaml" | "bash") => highlightLine(line, lang).map((t) => `${t.kind}:${t.text}`);
  check("highlight: an nginx directive is a key and its number is a number", kinds("    client_max_body_size 10m;", "nginx").some((k) => k === "key:client_max_body_size") && kinds("    expires 7d;", "nginx").some((k) => k === "number:7d"));
  check("highlight: a comment is one comment token", kinds("    # Static files", "nginx").at(-1) === "comment:# Static files");
  check("highlight: a # inside a string is not a comment", highlightLine('echo "a # b"', "bash").every((t) => t.kind !== "comment"));
  check("highlight: an ini section header and key", kinds("[Service]", "ini")[0] === "keyword:[Service]" && kinds("User=app", "ini")[0] === "key:User");
  check("highlight: a yaml key, a list item and a quoted string", kinds("  python-version: \"3.12\"", "yaml").some((k) => k === "key:python-version") && kinds("  - run: pytest -q", "yaml").some((k) => k === "key:run") && highlightLine('x: "3.12"', "yaml").some((t) => t.kind === "string"));
  check("highlight: empty and whitespace-only lines are safe", highlightLine("", "yaml").length === 0 && highlightLine("   ", "nginx").map((t) => t.text).join("") === "   ");
}

// ---- the architecture page describes real code
{
  const missing = NODES.flatMap((n) => n.refs.filter((r) => !existsSync(join(root, r))).map((r) => `${n.id}: ${r}`));
  check("architecture: every referenced file exists", missing.length === 0, missing.join(", "));
  check("architecture: node ids are unique and every edge joins two real nodes", unique(NODES.map((n) => n.id)) && EDGES.every((e) => NODES.some((n) => n.id === e.from) && NODES.some((n) => n.id === e.to)));
  check("architecture: every node has at least one file reference", NODES.every((n) => n.refs.length > 0));
  check("architecture: nodes fit the diagram", NODES.every((n) => n.x >= 0 && n.y >= 0 && n.x + NODE_W <= DIAGRAM.w && n.y + NODE_H <= DIAGRAM.h));
  // Edge labels sit at the middle of their edge; a horizontal neighbour gap needs room for the longest of them.
  check("architecture: neighbouring boxes in a row leave room for an edge label (>= 50px)", NODES.every((a) => NODES.every((b) => a === b || a.y !== b.y || b.x < a.x + NODE_W || b.x - (a.x + NODE_W) >= 50 || b.x - (a.x + NODE_W) < 0)));
  const overlap = NODES.some((a, i) => NODES.some((b, j) => j > i && a.x < b.x + NODE_W && b.x < a.x + NODE_W && a.y < b.y + NODE_H && b.y < a.y + NODE_H));
  check("architecture: no two nodes overlap", !overlap);

  // Claims that the text makes about the code, checked against the code.
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  check('claim: "the assistant is rate limited" (route uses rateLimit)', read("src/app/api/assistant/route.ts").includes("rateLimit"));
  check('claim: "security headers are set in the Next.js config"', read("next.config.mjs").includes("Strict-Transport-Security") && read("next.config.mjs").includes("frame-ancestors"));
  check('claim: "falls back to seed content" (portfolio.ts returns seed)', /return seed/.test(read("src/lib/portfolio.ts")));
  check('claim: "revalidatePath on admin save" (publish revalidates)', read("src/lib/admin/api.ts").includes("revalidatePath"));
  check('claim: "the health endpoint only probes the database on ?deep=1"', read("src/app/api/health/route.ts").includes('"deep"') && read("src/app/api/health/route.ts").includes("probeDb"));
  check('claim: "two connection strings" (schema has url and directUrl)', /directUrl/.test(read("prisma/schema.prisma")));
  check("host note: a local build never claims a deployment", !/deployed|live at/i.test(hostNote("")) && hostNote("").includes("local build") && hostNote("production").includes("production"));
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
