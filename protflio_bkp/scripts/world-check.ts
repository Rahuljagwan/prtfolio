/* eslint-disable no-console */
// Checks for the scroll -> camera maths and the camera path. Run with:  npm run test:world
// No browser or GPU needed. Add a case here whenever the rig misbehaves.
import { Vector3 } from "three";
import { computeRig, projectsWeave, WEAVE, type ZoneLayout } from "../src/lib/world/rig-math";
import { makeCurves, sampleRig } from "../src/lib/world/rig-path";
import { ZONES } from "../src/lib/world/zones";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;
const u = (c: number, l: ZoneLayout[]) => computeRig(c, l).u;

// small seeded RNG so failures are reproducible
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

// ---- basic behaviour
check("no zones: u = 0", u(500, []) === 0);
check("one zone: u = 0 everywhere", u(-100, [{ top: 0, bottom: 900 }]) === 0 && u(450, [{ top: 0, bottom: 900 }]) === 0 && u(99999, [{ top: 0, bottom: 900 }]) === 0);

const two: ZoneLayout[] = [
  { top: 0, bottom: 1000 },
  { top: 1000, bottom: 2000 },
];
check("two zones: centre of zone 1 is exactly 0", u(500, two) === 0);
check("two zones: hold (plateau) end of zone 1 is still 0", u(750, two) === 0);
check("two zones: the boundary is exactly halfway (0.5)", near(u(1000, two), 0.5));
check("two zones: centre of zone 2 is exactly 1", u(1500, two) === 1);
check("two zones: past the end clamps to 1, before the start to 0", u(9e6, two) === 1 && u(-9e6, two) === 0);

// ---- the camera holds its pose while a zone is on screen, then travels
{
  const l: ZoneLayout[] = [
    { top: 0, bottom: 800 },
    { top: 800, bottom: 2400 },
    { top: 2400, bottom: 3000 },
  ];
  check("plateau: whole middle half of a tall zone stays exactly on its pose", [1200, 1600, 2000].every((c) => u(c, l) === 1));
  const r = computeRig(1000, l);
  check("local drift: reported inside the active zone, within [-0.5, 0.5]", r.zone === 1 && r.local >= -0.5 && r.local <= 0.5);
}

// ---- monotonic, bounded and continuous for 400 random page layouts
{
  let bad = "";
  for (let k = 0; k < 400 && !bad; k++) {
    const n = 1 + Math.floor(rnd() * 7);
    const layouts: ZoneLayout[] = [];
    let y = Math.floor(rnd() * 200);
    for (let i = 0; i < n; i++) {
      const h = Math.floor(20 + rnd() * 2500); // tiny to very tall zones
      const gap = rnd() < 0.3 ? Math.floor(rnd() * 120) : 0; // sometimes gaps between sections
      layouts.push({ top: y, bottom: y + h });
      y += h + gap;
    }
    let prev = -1;
    let maxStep = 0;
    for (let c = -200; c <= y + 200; c += 7) {
      const val = u(c, layouts);
      if (!Number.isFinite(val)) bad = `NaN/Inf at layout ${k}, c=${c}`;
      else if (val < 0 || val > n - 1) bad = `out of range ${val} (n=${n}) layout ${k}`;
      else if (val < prev - 1e-9) bad = `went backwards ${prev} -> ${val} at c=${c}, layout ${k}`;
      if (prev >= 0) maxStep = Math.max(maxStep, val - prev);
      prev = val;
    }
    // continuity: no jump larger than what a 7px step can cause across the narrowest travel gap
    const minGap = Math.min(...layouts.slice(0, -1).map((z, i) => (z.bottom - z.top) * 0.25 + (layouts[i + 1].bottom - layouts[i + 1].top) * 0.25), Infinity);
    if (!bad && n > 1 && maxStep > (7 / minGap) * 2 + 1e-6) bad = `jump ${maxStep.toFixed(3)} > allowed in layout ${k}`;
  }
  check("400 random layouts: u is finite, in range, monotonic and continuous", bad === "", bad);
}

// ---- hostile input
{
  const hostile: ZoneLayout[] = [
    { top: NaN, bottom: 100 },
    { top: 500, bottom: 200 }, // bottom above top
    { top: 300, bottom: 300 }, // zero height
    { top: -50, bottom: 1e9 }, // absurdly tall, overlapping everything
  ];
  const vals = [-1e9, -1, 0, 150, 300, 5e8, 1e9, NaN, Infinity, -Infinity].map((c) => u(c, hostile));
  check("hostile layouts and inputs never produce NaN or out-of-range values", vals.every((v) => Number.isFinite(v) && v >= 0 && v <= 3), JSON.stringify(vals));
  const r = computeRig(NaN, two);
  check("NaN scroll position is treated as 0", r.u === 0 && Number.isFinite(r.local));

  const overlap: ZoneLayout[] = [
    { top: 0, bottom: 1000 },
    { top: 500, bottom: 1500 }, // overlaps the first
  ];
  let prev = -1;
  let mono = true;
  for (let c = 0; c <= 1500; c += 5) {
    const v = u(c, overlap);
    if (v < prev - 1e-9) mono = false;
    prev = v;
  }
  check("overlapping zones still give a monotonic path", mono);

  const zeroH: ZoneLayout[] = [
    { top: 0, bottom: 0 },
    { top: 0, bottom: 0 },
    { top: 0, bottom: 0 },
  ];
  check("zero-height zones are safe", [-10, 0, 10].every((c) => Number.isFinite(u(c, zeroH))));
}

// ---- missing zones are filled by the caller with zero-height layouts at the neighbouring boundary
{
  const withGap: ZoneLayout[] = [
    { top: 0, bottom: 900 },
    { top: 900, bottom: 900 }, // zone with no sections on the page
    { top: 900, bottom: 1800 },
  ];
  const vs: number[] = [];
  for (let c = 0; c <= 1800; c += 10) vs.push(u(c, withGap));
  check("a zone with no page section is passed through smoothly (0 -> 2 monotonic)", vs[0] === 0 && vs[vs.length - 1] === 2 && vs.every((v, i) => i === 0 || v >= vs[i - 1] - 1e-9));
}

// ---- camera path
{
  const curves = makeCurves(ZONES);
  const p = new Vector3();
  const t = new Vector3();
  let exact = true;
  ZONES.forEach((z, i) => {
    sampleRig(i, ZONES.length, curves, p, t);
    const [px, py, pz] = z.camera.position;
    const [tx, ty, tz] = z.camera.target;
    if (!(near(p.x, px, 1e-4) && near(p.y, py, 1e-4) && near(p.z, pz, 1e-4) && near(t.x, tx, 1e-4) && near(t.y, ty, 1e-4) && near(t.z, tz, 1e-4))) exact = false;
  });
  check("path: every integer u lands exactly on that zone's camera pose and target", exact);

  const total = ZONES.length - 1;
  let prevP: Vector3 | null = null;
  let maxStep = 0;
  let maxTurn = 0;
  let prevDir: Vector3 | null = null;
  for (let i = 0; i <= 2000; i++) {
    sampleRig((i / 2000) * total, ZONES.length, curves, p, t);
    if (prevP) {
      maxStep = Math.max(maxStep, p.distanceTo(prevP));
      const dir = p.clone().sub(prevP).normalize();
      if (prevDir) maxTurn = Math.max(maxTurn, Math.acos(Math.min(1, Math.max(-1, dir.dot(prevDir)))));
      prevDir = dir;
    }
    prevP = p.clone();
  }
  check("path: smooth and continuous (no jumps between samples)", maxStep < 0.2, `max step ${maxStep.toFixed(3)}`);
  check("path: no sharp kinks (max turn between samples under 6 degrees)", maxTurn < (6 * Math.PI) / 180, `max turn ${((maxTurn * 180) / Math.PI).toFixed(2)} deg`);

  sampleRig(-5, ZONES.length, curves, p, t);
  const first = new Vector3(...ZONES[0].camera.position);
  sampleRig(999, ZONES.length, curves, t, t);
  check("path: out-of-range u is clamped to the first and last pose", near(p.distanceTo(first), 0, 1e-4));
}

// ---- Projects camera weave
{
  const z = (l: number, d = 1) => projectsWeave(l, d);
  const zero = (o: ReturnType<typeof z>) => Math.abs(o.sway) < 1e-9 && Math.abs(o.lift) < 1e-9 && Math.abs(o.targetX) < 1e-9 && Math.abs(o.bank) < 1e-9;
  check("weave: zero displacement at both zone boundaries (local = -0.5 and +0.5)", zero(z(-0.5)) && zero(z(0.5)));
  check("weave: zero whenever dwell is 0 (travel between zones)", zero(z(0.2, 0)) && zero(z(-0.37, 0)) && zero(z(0, 0)));
  let maxSlopeChange = 0;
  let prev = z(-0.5).lift;
  let prevSlope = 0;
  const N = 2000;
  for (let i = 1; i <= N; i++) {
    const lift = z(-0.5 + i / N).lift;
    const slope = (lift - prev) * N;
    if (i > 1) maxSlopeChange = Math.max(maxSlopeChange, Math.abs(slope - prevSlope));
    prev = lift;
    prevSlope = slope;
  }
  check("weave: lift is one smooth arch (no kink: slope never jumps)", maxSlopeChange < 0.02, "max slope change " + maxSlopeChange.toFixed(4));
  check("weave: lift peaks at the middle, not at the ends", z(0).lift > z(0.25).lift && z(0.25).lift > z(0.45).lift);
  const peakBankDeg = (Math.abs(z(0.25).bank) * 180) / Math.PI;
  check("weave: peak bank is about 1 degree", peakBankDeg > 0.9 && peakBankDeg < 1.1, peakBankDeg.toFixed(3) + " deg");
  check("weave: peak sway matches the configured amplitude", near(Math.abs(z(0.25).sway), WEAVE.sway, 1e-9));
}

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
