# Portfolio v2: projects, flight, proof and engineering pages

What was added on top of "The Living System", where it lives, and the rules it follows.

## What is new

| Feature | Where | Notes |
|---|---|---|
| Projects section: Flight, Grid, Timeline, Matrix views, filters, redacted-reveal card, live-demo dot | `src/components/projects/*` | SSR renders the Grid, so phones, reduced motion and no-JS get the full section. Flight is offered only while the 3D world runs. |
| 3D project flight | `src/components/world/scene/ProjectStations.tsx`, `src/lib/world/station-math.ts`, `src/lib/world/stations.ts` | Each real project has its own 3D schematic on the right (an "exhibit", see below). A project without one gets a generic rack of slabs, one per layer of its own stack (Browser, Reverse proxy, Application, Data, Platform). An additive camera follower: it blends a pose over the rig each frame. `rig-math`, `rig-path`, `zones` and `RigDriver` are untouched. |
| Editorial sections | `src/components/sections/*`, `src/components/ui/editorial.tsx`, the Editorial block of `src/app/globals.css` | No section is a box. Each is composed for what it says (see below) and sits directly on the 3D world. |
| Motion engine | `src/lib/scroll-state.ts`, `src/components/layout/SmoothScroll.tsx` | Sub-pixel scroll for the camera, wheel smoothing by exponential approach, eased anchor glides, a capped frame clock. |
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
npm run test:tunnel       the per-section camera shots, the glide between them, the speed reaction, sway, the smoothing, scroll durations, the Skills/Education boundary
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

## Editorial sections (no boxes)

Every section used to be the same rounded, blurred card. Now each is laid out for its content, on the page directly, with the world visible behind it:

| Section | Composition |
|---|---|
| About | A dossier: a poster-sized statement, the bio as a lead paragraph and a body, a spec sheet of facts (corner ticks, hairline rows) set lower on the right, three numbered principles closing it |
| Experience | A log: the heading holds still on the left, entries scroll on the right, every bullet is an added line in a diff, the stack is a row of tokens |
| Journey | A pipeline: the story, a From to Now line, then stages alternating either side of a central spine whose nodes light as the line reaches them (done filled, in progress amber, up next dashed). Its motion is the original one: fade-ups, the spine drawing itself, every stage sliding in from the right as it scrolls into view |
| Projects | Unchanged (the flight); only its header lost its panel |
| Skills | A tower: heading and incident drill hold still on the left, tiers on the right (narrower at the top), every tool with a live dot |
| Education | A vault: records in a ledger, each with a seal, a combination dial turning behind the heading |
| Resume | A dispatch: two sheets with a light passing over them, the actions as large rows |
| Contact | The beacon: a huge closing line, the address as a headline that underlines itself, channels as rows, the WhatsApp code inside pulsing rings |

How they stay readable without a backing box: a `.veil` is a soft cloud of page colour behind a text block that fades into the world on every side (no border, no blur, no hard edge), and every glyph inside carries a halo of page colour. Both only apply once the world is showing (`html[data-world="ready"]`), so the static page (phones, reduced motion, no WebGL) keeps its plain look. `.veil-l` and `.veil-r` anchor a veil to one side of the screen, `.veil-soft` and `.veil-strong` change its strength.

`<main>` has `overflow-x: clip` because the backdrops behind text reach past the screen edge on purpose (clip, not hidden, so sticky columns keep working). Every headline is the same size (`text-5xl md:text-7xl`), including Contact's.

Shared pieces are in `src/components/ui/editorial.tsx` (`Chapter`, `Headline` with masked lines, `SectionShell`) and `Reveal` (variants: up, fade, left, right, bare). Anything marked `data-parallax="0.3"` drifts against the scroll as its section passes (started by `ScrollJourney`, desktop only). The chapter numbers match the journey rail (About 02 ... Contact 08). The Stack zone in the 3D scene now measures where Skills ends and Education begins from the real section positions (`boundaryLocal`), so the two sections can be any height.

## Motion engine

- **Sub-pixel scroll.** `window.scrollY` is a whole number of pixels, so a camera driven by it steps while the page decelerates. `getScrollY()` (lib/scroll-state) returns Lenis's fractional position while it glides; the rig, the tunnel camera and the project flight use it.
- **Wheel feel.** Lenis smooths by exponential approach (`lerp`), not by restarting a fixed-length tween on every wheel tick, which is what made a notched wheel feel steppy.
- **Capped clock.** The Lenis loop sleeps while the page is still. Lenis is fed its own clock (real frame time, capped at 100 ms; one ordinary frame after a sleep), so the first frame after a pause can no longer complete a glide in one step.
- **Anchor glides.** Same-page links, the command palette, the terminal and the project rail scroll with an eased, distance-aware glide (`smoothScrollTo`: 0.9 s for a hop up to about 3 s across the page), so the camera travels the route.
- **Sway and streaks.** While the page moves the camera sways slightly (`swayAt`, zero at rest) and motes along the route stretch into short lines along the direction of travel (`SpeedStreaks`, hidden and free at rest).
- **No large backdrop blurs, no blurred text shadows on body text.** The old section panels blurred a full-width area over a canvas that redraws on every scroll frame. Later, a three-layer blurred halo on every line of text turned out to be the most expensive thing on the page to scroll (about six times the raster work in a measured A/B, with dropped frames; without it a 150-frame scroll ran at a steady 60 fps). Only the big headlines keep one light halo now.
- **Decorative loops rest while scrolling.** `SmoothScroll` marks the page `html.is-scrolling` (and clears it 160 ms after the last scroll); the drifting background blobs, the live dots, the vault dial, the beacon rings, the resume scan and the flow lines pause meanwhile (see `.is-scrolling` in globals.css). The live dots animate transform and opacity on a pseudo-element, not a box-shadow (a box-shadow animation repaints every dot on every frame).
- **A resting page rests.** Two ambient animations (the Build zone's light bars and the packets on the route) used to ask for a redraw on every frame, so the GPU never idled while they were on screen. They now go through `ambientInvalidate` (25 frames a second, and none once the page has been still for 12 s, the same rule the render scheduler already follows).
- **Resolution governor.** While scrolling, `useAdaptiveDpr` feeds frame times to `lib/world/quality.ts`, which steps the canvas's pixel ratio down (x0.85, never below 0.6) when frames are genuinely slow (over 36 ms, so a display locked at 30 fps is left alone) and returns it after a long calm. Changes are at least 1.5 s apart, and it may not raise the ratio for 30 s after lowering it, so there is no flicker.
- **Measuring.** The A/B used Chrome tracing over a scripted 150-frame scroll with the 3D world off (a headless machine has no GPU, so canvas numbers would mean nothing). Results are noisy from run to run, but the ordering was the same every time.

## The hero guide

The hero's 3D scene (a green ball, a route, a "send a request" button) means nothing to someone who has never seen a system diagram, so `src/components/hero/HeroGuide.tsx` explains it in this portfolio's own terms. It is a horizontal route strip at the lower right of the hero on wide screens (1280px and up), in the same row as the hero's buttons and clear of the ball, which stays exactly where it always was (vertically centred):

- what the ball is (you, a visitor's request arriving at the portfolio) and what the ring around it does;
- the six stages of the route as a strip of nodes joined by a line, in the order the 3D world lays them out, each mapped to the part of the portfolio it stands for and linked to it: Origin (you arrive), The Gate (about me), The Build (experience, journey), Deployments (projects), The Stack (skills, education), Signal out (contact me);
- what the button does. Pressing "send a request" fills the strip node by node and line by line on the same clock as the 3D packet (`REQUEST_TRAVEL_SECONDS` in `lib/world/events.ts`), names the stage it is passing, and ends with "200 OK".

The 3D labels were renamed in plain language ("you, the request starts here"; "the route, scroll to follow it"); the ball itself is untouched. The copy about the ball is hidden when the 3D world is not running (`.world-only`), so the static page still reads sensibly. On a short screen (under 790px high) the intro sentence is dropped and only the strip remains.

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
