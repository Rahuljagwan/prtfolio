# Portfolio v2: projects, flight, proof and engineering pages

What was added on top of "The Living System", where it lives, and the rules it follows.

## What is new

| Feature | Where | Notes |
|---|---|---|
| Projects section: Flight, Grid, Timeline, Matrix views, filters, redacted-reveal card, live-demo dot | `src/components/projects/*` | SSR renders the Grid, so phones, reduced motion and no-JS get the full section. Flight is offered only while the 3D world runs. |
| 3D project flight | `src/components/world/scene/ProjectStations.tsx`, `src/lib/world/station-math.ts`, `src/lib/world/stations.ts` | Each real project has its own 3D schematic on the right (an "exhibit", see below). A project without one gets a generic rack of slabs, one per layer of its own stack (Browser, Reverse proxy, Application, Data, Platform). An additive camera follower: it blends a pose over the rig each frame. `rig-math`, `rig-path`, `zones` and `RigDriver` are untouched. |
| Tunnel run: a camera shot per section | `src/components/world/scene/TunnelCamera.tsx`, `src/lib/world/tunnel-math.ts` | Every section except Home and Projects has its own camera angle and a slow move that plays as it scrolls by; the shots glide into one another at the section boundaries, and the lens widens, the camera leans and the canvas edges darken with scroll speed. Additive on the rig (see below). |
| Project pages | `src/app/projects/[slug]` | Blocks render only if the project has content for them. Samples are `noindex`. |
| Ops proof | `next.config.mjs`, `src/app/api/{health,version}`, `StatusBadge`, `UnderTheHood` | Security headers, a real health check, the build the site is running, live web vitals. |
| Engineering pages | `src/app/engineering/*`, `src/app/notes/*` | How this site is built, config gallery, reviews, roadmap, notes, pipeline playground. |
| Command palette and terminal | `src/lib/commands/*`, `src/components/terminal/*` | One registry feeds Ctrl+K and the terminal (Ctrl+`). |
| `security.txt`, `robots`, `sitemap` | `src/app/.well-known/security.txt`, `robots.ts`, `sitemap.ts` | `security.txt` 404s while the contact email is a placeholder. |

## Environment variables

| Name | Effect |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | The public origin (for example `https://example.com`). Without it the site makes no absolute-URL claims: the sitemap is empty, there is no `metadataBase`, and `security.txt` has no `Canonical` line. |
| `NEXT_PUBLIC_SHOW_SAMPLES` | `0` hides every sample: sample projects, sample sections, and the sample-only pages (reviews, configs, notes, the roadmap detail). Default: shown. |
| `NEXT_PUBLIC_SAMPLE_PROJECTS` | How many sample projects to show next to the real ones, 0 to 6 (default 0: the real projects are in). |
| `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `VERCEL_REGION` | Set by Vercel. They are how the status badge tells a real deployment from a local build. Nothing claims "deployed" without them. |

`NEXT_PUBLIC_*` values are inlined at build time: change one, rebuild.

## Honesty rules (enforced by the checks)

- Every invented entry carries `sample: true` and shows a "Sample" chip. `npm run check:samples` lists what is left; `npm run check:samples -- --strict` fails while anything remains (run it before publishing).
- Samples never reach the assistant, the sitemap or search indexing.
- A confidential project is redacted on the server (`redactProject`), so hidden text is never in the page.
- Unknown ownership stays unknown (a dashed stage), never a guess.
- The live-demo dot says "reachable", never "up". The status badge says "local build" unless the host reports an environment.
- The hero counter is labelled "simulated traffic". The pipeline playground is labelled a simulation, and says what this site's own build really runs.
- Red is reserved for the incident sequence on the home page. Failure states elsewhere are amber.

## Checks

```
npm run test:world        camera rig maths (unchanged)
npm run test:stations     the project-flight maths and the exhibit animation helpers
npm run test:tunnel       the per-section camera shots, the glide between them, the speed reaction, the smoothing
npm run test:projects     enrichment, redaction, architecture classifier, the exhibit registry
npm run test:ops          security.txt, build age, vitals ratings
npm run test:engineering  content flags, highlighter, architecture claims against the code
npm run test:pipeline     the pipeline simulation model
npm run test:commands     palette builder, terminal interpreter, completion
npm run check:samples     what is still illustrative
```

## Where the projects come from

The eight projects are the ones in the resume (`resume/resume.html`), word for word, in `src/content/seed.ts`. What the resume states and nothing more: no status, dates, links or metrics are made up, and the Build / Ship / Run bar claims only what the text supports (Build for all; Ship for InfraDesk, whose resume entry says the backend was deployed as a systemd service; Run for none).

Extra structured fields (the period label, categories, ownership, the resume's "Key learnings", which 3D cover to use) are in `src/content/projects-meta.ts`, matched by slug.

The database is what the site reads when it is reachable, so changing `seed.ts` alone does not change a database that already has rows (`npm run db:seed` never overwrites a filled table). To push the seed's projects into the database:

```
npm run db:sync-projects            # shows what would change, writes nothing
npm run db:sync-projects -- --apply # backs the current rows up to prisma/backups/, then replaces them
```

## The per-project schematics (exhibits)

On the flight, the right-hand side of each project is a small animated 3D schematic of **what that project does**, built from its resume description rather than from its tech stack. They are illustrations (the HUD label says "schematic"), not screenshots or measurements, and they state nothing the resume does not.

| Project | Key | Shows |
|---|---|---|
| Saarthi | `branch-ops` | The portal's modules around one hub; scope-based access (a user sees only their branches) |
| InfraDesk | `approval-flow` | A request through Manager, IT and Admin dispatch, an approve / reject email at each stage, an SLA timer that escalates |
| Soochna | `notice-lifecycle` | A notice from intake to closure approval, SLA reminders, overdue alert, escalation chain, audit trail, deny-by-default |
| Sakshar | `training-flow` | Admin assigns, employee watches and takes the quiz (written by an AWS Bedrock agent), PDF certificate, daily reminder |
| Print Tracker | `print-analytics` | A dashboard answered from Redis, going to PostgreSQL only on a miss |
| DellCube | `goods-table` | Debounced search, the goods table, server-side pagination, item masters, a detail drawer |
| JMD | `shop-dashboard` | Role-based access, the shop-owner day (orders, employees and salary, stock, offers) and analytics widgets |
| CVEarity | `cve-log` | Search, sort and severity filters over a CVE log; severity is amber |

- The key is `exhibit` in `PROJECT_EXTRAS` (`src/content/projects-meta.ts`). The keys, the caption shown in the text panel, and the drawing file are in `src/lib/projects/exhibits.ts` (pure, so the DOM side and the tests never load three.js). A project with no key, or an unknown one, falls back to the generic rack.
- Each drawing is a component in `src/components/world/scene/exhibits/`, registered in that folder's `index.ts`, and built from the small kit in `kit.tsx` (`Plate`, `Bar`, `Dot`, `Wire`, `Mover`, `Flow`, `Tag`). They animate on repeating clocks (`cyc`, `win`, `ramp` in `src/lib/world/exhibit-math.ts`), are mounted only while the flight is on screen and the camera is within 1.5 stations of them (otherwise nothing of them exists in the scene).
- To add one: write the component, add its key + caption + file to `EXHIBITS`, register it in `index.ts`, and set `exhibit` on the project. `npm run test:projects` fails if any of the three is missing or a real project has no schematic.
- Labels are real DOM, so they stay crisp. The canvas itself is decorative: the text panel beside it carries the caption (what the schematic shows) for screen readers.

## The tunnel run (a camera shot per section)

The rig (`rig-math`, `RigDriver`, untouched) carries the camera along the route and holds one pose per zone, so a section used to sit in a still frame while its text scrolled. The tunnel run adds a camera **direction** on top, so travelling down the page feels like moving through a tunnel:

- **A shot per section.** About, Experience, Journey, Skills, Education, Resume and Contact each have a base framing and a slow move (truck, crane, dolly, pan, tilt, roll, lens) that plays as that section scrolls past. The camera moves in its own frame, then turns back onto the point the rig was looking at, so the subject stays in view and the angle onto it changes (an arc, not a slide). The hero and Projects are left exactly alone (Projects has its own flight).
- **Glides at the boundaries.** Between two sections the shots blend over a hop centred on the boundary (a smootherstep, so it starts and ends at rest; hops never overlap). Signs alternate from section to section, so every boundary is a change of angle.
- **Reacts to speed.** The faster the page moves, the wider the lens (up to +6.5 degrees), the further the camera is thrown forward (or back when scrolling up) and the more it leans into the motion, and the canvas edges darken toward the page colour (`--tunnel`, CSS only). It rises quickly and lets go slowly. Clicking a far section in the nav therefore plays as a short warp.
- **Weight.** Everything is critically damped (about 0.8 s to settle), so a jump, a reload part-way down the page or a change of layout never snaps. Nothing is drawn extra: the layer only moves the camera, and stops requesting frames once it has settled.

Where things are: the shots are the `SHOTS` table in `src/lib/world/tunnel-math.ts` (degrees and world units; edit them there). The section positions come from `useZoneLayouts`, which now also reports each section's extent (hidden sections are skipped). `TunnelCamera` is mounted right after `RigDriver` and before the flight in `WorldScene`; the flight blends over whatever it leaves, and the speed reaction fades out under the flight. The maths is pure and tested (`npm run test:tunnel`: continuity, no kink in the speed, bounds, garbage and degenerate layouts, damping exactness).

If a camera move ever shows something it should not (a gate or building too close to the lens), lower that section's `base`/`drift` values; `data-tunnel` on the canvas host shows the live offsets (`dx,dy,dz,yaw,pitch,roll,fov`).

## Replacing the samples

- Projects: `src/content/projects-samples.ts` (whole sample projects, shown only if `NEXT_PUBLIC_SAMPLE_PROJECTS` is above 0) and the `sampleExtras` in `src/content/projects-meta.ts` (sample sections on a real project). Real per-project details (status, ownership, links, metrics) go in `PROJECT_EXTRAS`; remove the matching `sampleFields` entry when a section becomes real.
- Reviews, configs, roadmap detail, notes: `src/content/{postmortems,configs,roadmap,notes}.ts`. Set `sample` accordingly (the types currently require `true`; relax them when you add real entries).

## Known limits

- Project extras are static modules, not admin-editable (a Prisma migration was deliberately avoided; an unmigrated column would silently drop the whole site to seed content).
- No OpenGraph image route: `next/og` fails on Windows in the Node runtime, and it could not be verified here.
- Web vitals are measured in the visitor's browser. The slowest-interaction row is a simplification of INP, and is labelled that way.
