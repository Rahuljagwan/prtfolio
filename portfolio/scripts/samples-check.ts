/* eslint-disable no-console */
// Lists every piece of illustrative ("sample") content still in the portfolio.
//   npm run check:samples            prints the list
//   npm run check:samples -- --strict   also exits 1 while anything remains (run this before publishing)
import { SAMPLE_PROJECTS } from "../src/content/projects-samples";
import { PROJECT_EXTRAS } from "../src/content/projects-meta";
import { SAMPLE_PROJECT_COUNT } from "../src/lib/samples";
import { POSTMORTEMS } from "../src/content/postmortems";
import { CONFIGS } from "../src/content/configs";
import { ROADMAP } from "../src/content/roadmap";
import { NOTES } from "../src/content/notes";

const found: string[] = [];

for (const s of SAMPLE_PROJECTS.slice(0, SAMPLE_PROJECT_COUNT)) found.push(`project: ${s.base.title} (whole project is a sample)`);

for (const [slug, extras] of Object.entries(PROJECT_EXTRAS)) {
  for (const key of Object.keys(extras.sampleExtras ?? {})) found.push(`project section: ${slug} -> ${key}`);
}

for (const p of POSTMORTEMS) found.push(`post-incident review: ${p.title}`);
for (const c of CONFIGS) found.push(`config example: ${c.title}`);
for (const n of NOTES) found.push(`note: ${n.title}`);
if (ROADMAP.length > 0) found.push(`roadmap: ${ROADMAP.length} detail items under "The detail, by area"`);

if (found.length === 0) {
  console.log("No sample content left.");
} else {
  console.log(`${found.length} sample item(s) still in the portfolio:\n`);
  for (const line of found) console.log(`  - ${line}`);
  console.log("\nSet NEXT_PUBLIC_SHOW_SAMPLES=0 to hide them, or replace them with real content.");
}

if (process.argv.includes("--strict") && found.length > 0) process.exit(1);
