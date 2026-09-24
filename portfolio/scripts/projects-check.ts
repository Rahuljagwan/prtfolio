/* eslint-disable no-console */
// Checks for the project enrichment layer. Run with:  npm run test:projects
// The gates that matter: confidential text never survives redaction, samples never reach the assistant's data, slugs are
// stable and unique, and unknown ownership stays unknown.
import "./_env-samples";
import { seed } from "../src/content/seed";
import { SAMPLE_PROJECTS } from "../src/content/projects-samples";
import { enrichProjects, redactProject, slugify } from "../src/lib/projects/enrich";
import { buildChunks } from "../src/lib/assistant/knowledge";
import { architectureFor, canDrawArchitecture, describeArchitecture, rackLayers } from "../src/lib/projects/architecture";
import { hasCaseStudy, motifOf, timelineGroup } from "../src/lib/projects/utils";
import { EXHIBITS, EXHIBIT_KEYS, captionFor, isExhibitKey } from "../src/lib/projects/exhibits";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}

const withSamples = enrichProjects(seed.projects, { samples: true });
const withoutSamples = enrichProjects(seed.projects, { samples: false });

check("slugify: plain title", slugify("Enterprise Workflow Platform") === "enterprise-workflow-platform");
check("slugify: symbols and accents", slugify("  R&D: Café -- Ops!! ") === "r-and-d-cafe-ops");
check("slugify: empty input still yields a slug", slugify("!!!") === "project");

check("real projects keep their count without samples", withoutSamples.length === seed.projects.length, String(withoutSamples.length));
check("all six sample projects are on for these checks", withSamples.length === seed.projects.length + 6, String(withSamples.length));
check("no sample project when samples are off", withoutSamples.every((p) => !p.sample));
check("no sample-flagged sections when samples are off", withoutSamples.every((p) => !p.sampleFields?.length && !p.decisions?.length));
check("samples are appended after the real projects", withSamples.slice(0, seed.projects.length).every((p) => !p.sample));
check("sample projects are flagged", withSamples.slice(seed.projects.length).every((p) => p.sample === true));
check("every project has a unique slug", new Set(withSamples.map((p) => p.slug)).size === withSamples.length);
check("real project slugs are the short pinned ones", withSamples.slice(0, 8).map((p) => p.slug).join() === "saarthi,infradesk,soochna,sakshar,print-tracker,dellcube,jmd,cvearity", withSamples.slice(0, 8).map((p) => p.slug).join());
check("the real projects carry no sample flags at all", withSamples.slice(0, seed.projects.length).every((p) => !p.sample && !p.sampleFields?.length));

// The real projects come from the resume: nothing may be invented, and what the resume does not state stays unstated.
const real = withoutSamples;
check("the resume's eight projects are all there", real.length === 8 && ["Saarthi", "InfraDesk", "Soochna", "Sakshar", "Print Tracker", "DellCube", "JMD", "CVEarity"].every((n) => real.some((p) => p.title.includes(n))));
check("no status, dates, links or metrics are made up (the resume states none)", real.every((p) => !p.status && !p.lastDeployed && !p.links && !p.metrics && !p.decisions && !p.retrospective));
check("every real project opens as a case study (its resume bullets are the approach)", real.every((p) => hasCaseStudy(p) && (p.approach ?? []).length > 0));
check("every real project lists a stack and a role", real.every((p) => p.stack.length >= 4 && p.role.length > 0));
check("the five SBFC projects carry the resume's key learnings, the freelance ones do not", real.slice(0, 5).every((p) => (p.learnings ?? "").length > 40) && real.slice(5).every((p) => !p.learnings));
check("projects are grouped by the period the resume gives: SBFC first, then Freelance", new Set(real.map(timelineGroup)).size === 2 && timelineGroup(real[0]).startsWith("SBFC Finance Limited") && timelineGroup(real[7]) === "Freelance");
check("an undated project is 'Not dated', never given a made-up period", timelineGroup({ ...real[0], period: undefined }) === "Not dated");
check("covers: explicit motifs are used and 'none' means the plain cover", motifOf(real[1], 1) === "pipeline" && motifOf(real[2], 2) === "vault" && motifOf(real[4], 4) === undefined && motifOf(real[7], 7) === undefined);

// Unknown ownership must stay unknown, never be guessed.
check("ownership: the run stage is never claimed (the resume does not say)", real.every((p) => p.ownership?.run === undefined));
check("ownership: InfraDesk's resume says the backend was deployed as a systemd service, so ship is claimed", real[1].ownership?.ship === true && real[1].ownership?.build === true);
check("ownership: nothing else claims ship (not stated for the others)", real.filter((p) => p.ownership?.ship).length === 1);

// Duplicate titles get -2, -3.
const dup = enrichProjects([seed.projects[0], { ...seed.projects[0], id: "dup" }], { samples: false });
check("duplicate titles get distinct slugs", dup[0].slug !== dup[1].slug && dup[1].slug?.endsWith("-2") === true, `${dup[0].slug} / ${dup[1].slug}`);

// Confidentiality: nothing private may be present anywhere in the serialised object.
const confidential = withSamples.find((p) => p.confidential);
check("a confidential sample project exists to test", !!confidential);
if (confidential) {
  const def = SAMPLE_PROJECTS.find((d) => d.base.title === confidential.title)!;
  const json = JSON.stringify(confidential);
  const privateBits = [def.base.summary, ...def.base.highlights, def.base.challenge ?? "", ...(def.base.approach ?? []), def.base.outcome ?? ""];
  check("confidential: no private text in the serialised project", privateBits.every((t) => t.length === 0 || !json.includes(t)));
  check("confidential: only the public summary is shown", confidential.summary === confidential.confidential?.publicSummary);
  check("confidential: highlights, case study and decisions are gone", confidential.highlights.length === 0 && !confidential.challenge && !confidential.outcome && !(confidential.approach ?? []).length && !confidential.decisions && !confidential.metrics);
  check("confidential: blackout bars are bounded percentages", (confidential.confidential?.bars ?? []).length > 0 && (confidential.confidential?.bars ?? []).every((b) => b >= 28 && b <= 96));
}

const direct = redactProject({ ...seed.projects[0], slug: "x" }, "Public.");
check("redactProject drops the summary text", !JSON.stringify(direct).includes(seed.projects[0].summary));

// The assistant must never see samples.
const chunks = buildChunks({ ...seed, projects: withSamples });
check("assistant knowledge skips sample projects", chunks.filter((c) => c.kind === "project").length === seed.projects.length, String(chunks.filter((c) => c.kind === "project").length));
check("assistant knowledge has no sample title", !chunks.some((c) => SAMPLE_PROJECTS.some((d) => c.title === d.base.title)));

// Architecture: drawn from the tech list only; never guesses.
{
  const a = architectureFor(["Flask", "Gunicorn", "React", "Vite", "Nginx", "PostgreSQL", "AWS EC2"]);
  check("architecture: layers come out in request order", a.layers.map((l) => l.key).join(",") === "client,proxy,app,data", a.layers.map((l) => l.key).join(","));
  check("architecture: each technology lands in its layer", a.layers[0].items.join() === "React,Vite" && a.layers[1].items.join() === "Nginx" && a.layers[2].items.join() === "Flask,Gunicorn" && a.layers[3].items.join() === "PostgreSQL");
  check("architecture: hosting goes to the platform band, not the path", a.platform.join() === "AWS EC2");
  const hr = architectureFor(["Flask", "React", "PostgreSQL"]);
  check("architecture: a layer nobody listed is not invented (no proxy)", hr.layers.map((l) => l.key).join(",") === "client,app,data");
  check("architecture: MongoDB is data, not the Go language", architectureFor(["MongoDB"]).layers[0]?.key === "data");
  check("architecture: unknown technologies are kept aside, not guessed", architectureFor(["Pandas", "Figma"]).other.join() === "Pandas,Figma" && architectureFor(["Pandas"]).layers.length === 0);
  check("architecture: duplicates and blanks are dropped", architectureFor(["React", "react", " ", "React "]).layers[0].items.length === 1);
  check("architecture: one layer is not a path (nothing to draw)", !canDrawArchitecture(architectureFor(["React"])) && !canDrawArchitecture(architectureFor([])) && canDrawArchitecture(hr));
  check("architecture: description names every layer in order", describeArchitecture(hr).startsWith("Typical request path for this stack: Browser (React), then Application (Flask), then Data (PostgreSQL)."), describeArchitecture(hr));
  const kinds = (i: number) => architectureFor(withoutSamples[i].stack).layers.map((l) => l.key).join(",");
  check("architecture: Saarthi is browser, application, data", kinds(0) === "client,app,data", kinds(0));
  check("architecture: Soochna also has its Nginx proxy", kinds(2) === "client,proxy,app,data", kinds(2));
  check("architecture: a frontend-only freelance project is one layer, so no path is invented", kinds(7) === "client" && !canDrawArchitecture(architectureFor(withoutSamples[7].stack)));
  const sakshar = rackLayers(architectureFor(withoutSamples[3].stack));
  check("rack: Sakshar's slabs are its layers top to bottom, then platform, then libraries", sakshar.map((l) => l.label).join() === "Browser,Application,Data,Platform", sakshar.map((l) => l.label).join());
  check("rack: cloud services land in Platform, and every technology is in exactly one slab", sakshar.find((l) => l.label === "Platform")?.items.join() === "AWS Bedrock" && sakshar.flatMap((l) => l.items).length === withoutSamples[3].stack.length, JSON.stringify(sakshar));
  check("rack: every real project has between one and six slabs", withoutSamples.every((p) => { const n = rackLayers(architectureFor(p.stack)).length; return n >= 1 && n <= 6; }));
  check("rack: a project's technologies are never dropped or duplicated across slabs", withoutSamples.every((p) => rackLayers(architectureFor(p.stack)).flatMap((l) => l.items).length === new Set(p.stack.map((s) => s.trim().toLowerCase())).size));
}

// Each real project draws its own schematic on the flight (its "exhibit"), described by the resume, not a generic picture of its stack.
{
  const dir = join(process.cwd(), "src", "components", "world", "scene", "exhibits");
  const index = existsSync(join(dir, "index.ts")) ? readFileSync(join(dir, "index.ts"), "utf8") : "";
  check("exhibits: every key has a file that exists, an export, a registration and a caption of its own", EXHIBIT_KEYS.every((k) => {
    const { file, caption } = EXHIBITS[k];
    return existsSync(join(dir, `${file}.tsx`)) && new RegExp(`export function ${file}\\b`).test(readFileSync(join(dir, `${file}.tsx`), "utf8")) && index.includes(`"${k}"`) && index.includes(file) && caption.length > 40 && caption.trim().endsWith(".");
  }));
  check("exhibits: captions are all different, and the keys and files are unique", new Set(EXHIBIT_KEYS.map((k) => EXHIBITS[k].caption)).size === EXHIBIT_KEYS.length && new Set(EXHIBIT_KEYS.map((k) => EXHIBITS[k].file)).size === EXHIBIT_KEYS.length);
  check("exhibits: every real project has its own exhibit, and no two share one", real.every((p) => isExhibitKey(p.exhibit)) && new Set(real.map((p) => p.exhibit)).size === real.length, real.map((p) => p.exhibit).join());
  check("exhibits: a project's caption is found by its key, and an unknown or missing key falls back to the generic rack", real.every((p) => !!captionFor(p.exhibit)) && captionFor("nope") === undefined && captionFor(undefined) === undefined && captionFor("") === undefined && !isExhibitKey("nope") && !isExhibitKey(null));
  check("exhibits: sample projects draw the generic rack (they have no schematic of their own)", withSamples.filter((p) => p.sample).every((p) => !p.exhibit));
}

if (failures > 0) {
  console.log(`\n${failures} FAILED`);
  process.exit(1);
}
console.log("\nALL PASSED");
