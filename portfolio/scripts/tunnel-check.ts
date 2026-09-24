/* eslint-disable no-console */
// Checks for the tunnel run's maths (per-section camera shots, the glide between them, the speed reaction, the smoothing).
// Run with:  npm run test:tunnel     No browser or GPU needed.
import {
  FX,
  HOP,
  POSE_KEYS,
  SHOTS,
  SHOT_ORDER,
  ZERO_POSE,
  damp,
  dampPose,
  focalDistance,
  fovKick,
  fxWeight,
  leanFor,
  makePoseState,
  poseAt,
  sectionProgress,
  settled,
  shotPose,
  speedNorm,
  type Pose,
  type SectionExtent,
} from "../src/lib/world/tunnel-math";
import { ZONES } from "../src/lib/world/zones";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const mag = (p: Pose) => POSE_KEYS.reduce((m, k) => Math.max(m, Math.abs(p[k])), 0);
const diff = (a: Pose, b: Pose) => POSE_KEYS.reduce((m, k) => Math.max(m, Math.abs(a[k] - b[k])), 0);
const finitePose = (p: Pose) => POSE_KEYS.every((k) => Number.isFinite(p[k]));

let seed = 424242;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// A page like the real one: the hero, then the sections in order (Projects is the tall Flight track).
const PAGE: SectionExtent[] = [
  { id: "hero", top: 0, bottom: 900 },
  { id: "about", top: 900, bottom: 1900 },
  { id: "experience", top: 1900, bottom: 3200 },
  { id: "journey", top: 3200, bottom: 4500 },
  { id: "projects", top: 4500, bottom: 11000 },
  { id: "skills", top: 11000, bottom: 12000 },
  { id: "education", top: 12000, bottom: 13000 },
  { id: "resume", top: 13000, bottom: 13800 },
  { id: "contact", top: 13800, bottom: 14800 },
];
const mid = (id: string) => {
  const s = PAGE.find((x) => x.id === id)!;
  return (s.top + s.bottom) / 2;
};

// ---- the camera book
check("shots: one for every section on the page", SHOT_ORDER.every((k) => k in SHOTS) && SHOT_ORDER.length === 9);
check("shots: the hero and Projects are left exactly alone", mag(SHOTS.hero.base) === 0 && mag(SHOTS.hero.drift) === 0 && mag(SHOTS.projects.base) === 0 && mag(SHOTS.projects.drift) === 0);
{
  const tracked = SHOT_ORDER.filter((k) => k !== "hero" && k !== "projects");
  const bounded = tracked.every((k) => {
    const s = SHOTS[k];
    return [0, 0.5, 1].every((p) => {
      const q = shotPose(s, p);
      return Math.abs(q.dx) <= 4 && Math.abs(q.dy) <= 3 && Math.abs(q.dz) <= 6 && Math.abs(q.yaw) <= 10 && Math.abs(q.pitch) <= 8 && Math.abs(q.roll) <= 8 && Math.abs(q.fov) <= 5;
    });
  });
  check("shots: every move stays within a few units and a few degrees", bounded);
  check("shots: the base is the framing at the middle of the section", tracked.every((k) => diff(shotPose(SHOTS[k], 0.5), SHOTS[k].base) < 1e-12));
  check("shots: every section has a different base framing", new Set(tracked.map((k) => JSON.stringify(SHOTS[k].base))).size === tracked.length);
  const order = ["about", "experience", "journey", "skills", "education", "resume", "contact"] as const;
  check(
    "shots: every boundary is a real change of angle (yaw and roll differ by at least 3 degrees)",
    order.every((k, i) => i === 0 || k === "skills" || Math.abs(SHOTS[k].base.yaw - SHOTS[order[i - 1]].base.yaw) + Math.abs(SHOTS[k].base.roll - SHOTS[order[i - 1]].base.roll) >= 3),
  );
  check("shots: a section's move is noticeable but not wild (some travel, never more than 8 units)", tracked.every((k) => { const d = SHOTS[k].drift; const m = Math.hypot(d.dx, d.dy, d.dz); return m >= 2 && m <= 8; }));
}

// ---- where the camera is at a given page position
check("pose: no sections gives no offset", mag(poseAt(500, [])) === 0);
check("pose: unknown section ids are ignored", mag(poseAt(500, [{ id: "footer", top: 0, bottom: 1000 }])) === 0);
check("pose: garbage positions never produce garbage", [NaN, Infinity, -Infinity, -1e9, 1e9].every((c) => finitePose(poseAt(c, PAGE))));
check("pose: over the hero (away from the first boundary) the camera is left exactly as the rig has it", [0, 200, 500].every((c) => mag(poseAt(c, PAGE)) === 0));
check("pose: over the middle of Projects it is exactly the rig's too", [6000, 7750, 9500].every((c) => mag(poseAt(c, PAGE)) === 0));
check("pose: mid-section it is exactly the section's own framing", (["about", "experience", "journey", "skills", "education", "resume", "contact"] as const).every((k) => diff(poseAt(mid(k), PAGE), SHOTS[k].base) < 1e-9));
{
  // Where a hop is over, the pose is exactly the incoming section's own shot at that point of its move.
  const about = PAGE[1];
  const c = about.top + 0.6 * (about.bottom - about.top); // well clear of both hops
  const want = shotPose(SHOTS.about, sectionProgress(c, about.top, about.bottom));
  check("pose: clear of a hop it is exactly the section's shot at its progress", diff(poseAt(c, PAGE), want) < 1e-9, JSON.stringify(poseAt(c, PAGE)));
}
{
  // Continuity and smoothness: walk the whole page a pixel at a time.
  let maxStep = 0;
  let maxBend = 0;
  let prev = poseAt(0, PAGE);
  let prevStep: Pose | null = null;
  for (let c = 1; c <= 15000; c++) {
    const p = poseAt(c, PAGE);
    maxStep = Math.max(maxStep, diff(p, prev));
    const step = { dx: p.dx - prev.dx, dy: p.dy - prev.dy, dz: p.dz - prev.dz, yaw: p.yaw - prev.yaw, pitch: p.pitch - prev.pitch, roll: p.roll - prev.roll, fov: p.fov - prev.fov };
    if (prevStep) maxBend = Math.max(maxBend, diff(step, prevStep));
    prevStep = step;
    prev = p;
  }
  check(`pose: continuous across the whole page (largest change per pixel ${maxStep.toFixed(4)})`, maxStep < 0.06, String(maxStep));
  check(`pose: smooth, with no kink in its speed either (largest change of speed ${maxBend.toExponential(1)})`, maxBend < 0.002, String(maxBend));
}
{
  // Every boundary glides: half way through a hop the pose is between the two shots, and it is at rest at both ends of the hop.
  const results = PAGE.slice(0, -1).map((a, i) => {
    const b = PAGE[i + 1];
    const boundary = (a.bottom + b.top) / 2;
    const half = Math.min(HOP.max, Math.max(HOP.min, HOP.fraction * Math.min(a.bottom - a.top, b.bottom - b.top)));
    const before = poseAt(boundary - half, PAGE);
    const after = poseAt(boundary + half, PAGE);
    const at = poseAt(boundary, PAGE);
    const eps = 0.5;
    const slopeBefore = diff(poseAt(boundary - half - eps, PAGE), before);
    const slopeAfter = diff(poseAt(boundary + half + eps, PAGE), after);
    return { at, before, after, slopeBefore, slopeAfter, half };
  });
  check("hops: each is a real move (half way through, the pose has left where it started and not yet reached where it is going)", results.every((r) => diff(r.at, r.before) > 0.05 && diff(r.at, r.after) > 0.05), JSON.stringify(results.map((r) => [diff(r.at, r.before), diff(r.at, r.after)])));
  check("hops: they start and end at rest (a smootherstep has no speed at its ends)", results.every((r) => r.slopeBefore < 0.01 && r.slopeAfter < 0.02), JSON.stringify(results.map((r) => [r.slopeBefore, r.slopeAfter])));
}
{
  // A page without some sections (no Education, no Resume): the neighbours simply meet, and it stays continuous.
  const short = PAGE.filter((s) => s.id !== "education" && s.id !== "resume");
  let worst = 0;
  let prev = poseAt(0, short);
  for (let c = 1; c <= 15000; c += 1) {
    const p = poseAt(c, short);
    worst = Math.max(worst, diff(p, prev));
    prev = p;
  }
  check("pose: a page with sections missing is still continuous", worst < 0.06, String(worst));
  check("pose: and still holds the hero and its neighbours' framing", mag(poseAt(300, short)) === 0);
}
{
  // Fuzz: random page layouts (short, huge, gaps) never give a non-finite, out-of-range or jumping camera.
  let bad = "";
  for (let k = 0; k < 300 && !bad; k++) {
    const ids = SHOT_ORDER.filter(() => rnd() < 0.85);
    const page: SectionExtent[] = [];
    let y = Math.floor(rnd() * 100);
    for (const id of ids) {
      const h = Math.floor(150 + rnd() * 3000);
      page.push({ id, top: y, bottom: y + h });
      y += h + (rnd() < 0.3 ? Math.floor(rnd() * 200) : 0);
    }
    let prev = poseAt(-500, page);
    const stepPx = Math.max(1, Math.floor(y / 4000));
    for (let c = -500; c < y + 500 && !bad; c += stepPx) {
      const p = poseAt(c, page);
      if (!finitePose(p)) bad = `non-finite at ${c} in ${JSON.stringify(page)}`;
      else if (Math.abs(p.dx) > 4.5 || Math.abs(p.dz) > 6.5 || Math.abs(p.roll) > 9 || Math.abs(p.fov) > 5.5) bad = `out of range at ${c}: ${JSON.stringify(p)}`;
      else if (diff(p, prev) > 0.15 * stepPx + 0.05) bad = `jump at ${c}: ${diff(p, prev)} in ${JSON.stringify(page)}`;
      prev = p;
    }
  }
  check("pose: 300 random page layouts give a finite, bounded, continuous camera", bad === "", bad);

  // Degenerate layouts (zero-height sections, sections stacked on one line, shuffled order) stay finite and in range.
  let worse = "";
  for (let k = 0; k < 300 && !worse; k++) {
    const page: SectionExtent[] = SHOT_ORDER.map((id) => {
      const top = Math.floor(rnd() * 3000);
      return { id, top, bottom: top + (rnd() < 0.5 ? 0 : Math.floor(rnd() * 400)) };
    });
    for (let c = -200; c < 3600 && !worse; c += 37) {
      const p = poseAt(c, page);
      if (!finitePose(p) || Math.abs(p.dx) > 4.5 || Math.abs(p.dz) > 6.5 || Math.abs(p.roll) > 9 || Math.abs(p.fov) > 5.5) worse = `bad at ${c}: ${JSON.stringify(p)} in ${JSON.stringify(page)}`;
    }
  }
  check("pose: zero-height, overlapping and shuffled sections still give a finite, bounded camera", worse === "", worse);
}

// ---- section progress
check("progress: 0 before a section, 1 after it, eased in between", sectionProgress(-5, 0, 100) === 0 && sectionProgress(500, 0, 100) === 1 && near(sectionProgress(50, 0, 100), 0.5) && sectionProgress(10, 0, 100) < 0.1);
check("progress: a section with no height rests at the middle of its move", sectionProgress(10, 50, 50) === 0.5 && sectionProgress(NaN, 0, 100) === 0);

// ---- the pivot
{
  const zoneDist = ZONES.map((z) => Math.hypot(z.camera.target[0] - z.camera.position[0], z.camera.target[1] - z.camera.position[1], z.camera.target[2] - z.camera.position[2]));
  check("pivot: at each zone's pose it is that zone's own look-at distance", zoneDist.every((d, i) => near(focalDistance(i), d, 1e-9)));
  check("pivot: always a sensible distance, blended between zones and clamped outside them", [-3, 0.5, 2.25, 4.99, 5, 99, NaN].every((u) => { const d = focalDistance(u); return Number.isFinite(d) && d > 5 && d < 30; }));
}

// ---- reacting to speed
check("speed: signed, clamped to -1..1, zero at rest", speedNorm(0) === 0 && speedNorm(FX.fullSpeed) === 1 && speedNorm(-FX.fullSpeed * 9) === -1 && speedNorm(NaN) === 0 && speedNorm(FX.fullSpeed / 2) === 0.5);
{
  let mono = true;
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const k = fovKick(i / 100);
    mono = mono && k >= prev - 1e-12;
    prev = k;
  }
  check("lens: no change at rest, widens smoothly with speed, and never past the limit", fovKick(0) === 0 && mono && near(fovKick(1), FX.maxFov) && fovKick(9) <= FX.maxFov && fovKick(-0.6) === fovKick(0.6));
  const a = leanFor(0.7);
  const b = leanFor(-0.7);
  check("lean: none at rest, forward and into the motion when scrolling down, mirrored when scrolling up, bounded", leanFor(0).dz === 0 && leanFor(0).roll === 0 && a.dz > 0 && a.roll > 0 && near(a.dz, -b.dz) && near(a.roll, -b.roll) && Math.abs(leanFor(5).dz) <= FX.leanDolly && Math.abs(leanFor(-5).roll) <= FX.leanRoll);
  check("weight: the speed reaction is off over the hero and full once the visitor has left it", fxWeight(0) === 0 && fxWeight(0.3) === 0 && fxWeight(0.9) === 1 && fxWeight(5) === 1 && fxWeight(0.6) > 0 && fxWeight(0.6) < 1 && fxWeight(NaN) === 0);
}

// ---- smoothing
{
  const s = { x: 0, v: 0 };
  let over = false;
  let mono = true;
  let prev = 0;
  for (let i = 0; i < 400; i++) {
    damp(s, 1, 1 / 60, 6);
    over = over || s.x > 1 + 1e-9;
    mono = mono && s.x >= prev - 1e-12;
    prev = s.x;
  }
  check("damp: glides to the target without overshooting, and arrives", !over && mono && near(s.x, 1, 1e-6));
  const one = damp({ x: 0.3, v: -0.4 }, 1.7, 0.2, 5);
  const two = damp(damp({ x: 0.3, v: -0.4 }, 1.7, 0.1, 5), 1.7, 0.1, 5);
  check("damp: exact at any step size (two half steps equal one whole step)", near(one.x, two.x, 1e-12) && near(one.v, two.v, 1e-12));
  const jump = damp({ x: 2, v: 0.5 }, -50, 0, 8);
  check("damp: a change of target never moves it by itself (no jump), and a zero step changes nothing", jump.x === 2 && jump.v === 0.5);
  const huge = damp({ x: 0, v: 0 }, 3, 500, 6);
  check("damp: stable for absurd frame times, garbage stays finite", Number.isFinite(huge.x) && Math.abs(huge.x) <= 3.001 && Number.isFinite(damp({ x: 1, v: 0 }, NaN, NaN, NaN).x));
  const state = makePoseState();
  const target = poseAt(mid("journey"), PAGE);
  check("pose state: not settled while it has somewhere to go, settled once it arrives", !settled(state, target) && (() => { for (let i = 0; i < 600; i++) dampPose(state, target, 1 / 60, 5.2); return settled(state, target); })());
  check("pose state: starting on a shot starts at rest on it", settled(makePoseState(target), target) && settled(makePoseState(), ZERO_POSE));
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
