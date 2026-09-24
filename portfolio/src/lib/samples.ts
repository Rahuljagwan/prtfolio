// Sample content policy. Anything illustrative (invented projects, example postmortems, template configs, placeholder
// roadmap items) carries a `sample: true` flag or sits in a `sampleExtras` block, renders a visible "Sample" chip, and is
// left out of the assistant, the sitemap and search indexing. Nothing sample-flagged is ever presented as fact.
//
// To stop showing samples set NEXT_PUBLIC_SHOW_SAMPLES=0 (or change the default here). `npm run check:samples` lists
// everything that is still a sample, and `npm run check:samples -- --strict` fails while any remain: run it before publishing.

export const SHOW_SAMPLES = process.env.NEXT_PUBLIC_SHOW_SAMPLES !== "0";

/** How many sample projects to show next to the real ones (there are six in projects-samples.ts). Default 0: the real projects are in. Raise it to test more. */
export const SAMPLE_PROJECT_COUNT = (() => {
  const n = Number(process.env.NEXT_PUBLIC_SAMPLE_PROJECTS ?? 0);
  return Number.isFinite(n) ? Math.min(6, Math.max(0, Math.round(n))) : 0;
})();
