/* eslint-disable no-console */
// Checks for the Projects flight maths (station layout, camera pose, easing, blend weight). Run with:  npm run test:stations
// No browser or GPU needed.
import {
  ACTIVE_HYSTERESIS,
  RACK,
  STATION,
  activeIndex,
  flightWeight,
  focusAt,
  indexFromProgress,
  progressForIndex,
  progressFromRect,
  rackFloorY,
  rackTopY,
  restPose,
  slabCount,
  slabWidth,
  slabY,
  stationLayout,
  stepEase,
  trackHeightVh,
  type Vec3,
} from "../src/lib/world/station-math";
import { clamp01, cyc, pointAlong, polylineLength, ramp, smooth, stepAlong, win, type V3 } from "../src/lib/world/exhibit-math";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const finite3 = (v: Vec3) => v.every(Number.isFinite);

// ---- layout
check("layout: n = 0 is empty, n = 1 is one station on the axis", stationLayout(0).length === 0 && stationLayout(1).length === 1 && near(stationLayout(1)[0][0], 0));
check("layout: NaN and negative counts are empty", stationLayout(NaN).length === 0 && stationLayout(-3).length === 0);
for (const n of [2, 3, 7, 9]) {
  const l = stationLayout(n);
  check(`layout n=${n}: symmetric about x = 0`, near(l[0][0], -l[n - 1][0]) && near(l.reduce((s, p) => s + p[0], 0), 0, 1e-9));
  check(`layout n=${n}: neighbours exactly one spacing apart in x`, l.every((p, i) => i === 0 || near(p[0] - l[i - 1][0], STATION.spacing)));
  check(`layout n=${n}: all finite, all beyond the Deployments camera plateau (z < -40)`, l.every((p) => finite3(p) && p[2] < -40));
}

// ---- stepEase
{
  const xs = Array.from({ length: 401 }, (_, i) => i / 400);
  check("stepEase: 0 at 0 and 1 at 1", stepEase(0) === 0 && stepEase(1) === 1);
  check("stepEase: monotonic non-decreasing", xs.every((x, i) => i === 0 || stepEase(x) >= stepEase(xs[i - 1]) - 1e-12));
  check("stepEase: stays in [0, 1]", xs.every((x) => stepEase(x) >= 0 && stepEase(x) <= 1));
  const hold = 0.5;
  check("stepEase: flat plateaus at both ends (hold 0.5 = 0.25 each)", stepEase(0.25, hold) === 0 && stepEase(0.75, hold) === 1 && stepEase(0.1, hold) === 0 && stepEase(0.9, hold) === 1);
  check("stepEase: hold 0 is a plain smootherstep (half-way = 0.5)", near(stepEase(0.5, 0), 0.5));
  check("stepEase: symmetric, e(x) + e(1 - x) = 1", xs.every((x) => near(stepEase(x) + stepEase(1 - x), 1, 1e-9)));
  check("stepEase: garbage input is safe", [NaN, Infinity, -Infinity, -5, 5].every((x) => Number.isFinite(stepEase(x)) && stepEase(x) >= 0 && stepEase(x) <= 1));
  check("stepEase: an absurd hold is clamped (still reaches both ends)", stepEase(0, 5) === 0 && stepEase(1, 5) === 1);
}

// ---- focusAt: continuity, rest, bounds
for (const n of [1, 2, 3, 7, 9]) {
  const steps = Math.max(1, (n - 1) * 400);
  let maxJump = 0;
  let allFinite = true;
  let prev = focusAt(0, n);
  for (let k = 1; k <= steps; k++) {
    const t = (k / steps) * (n - 1);
    const f = focusAt(t, n);
    allFinite = allFinite && finite3(f.position) && finite3(f.target);
    maxJump = Math.max(maxJump, dist(f.position, prev.position), dist(f.target, prev.target));
    prev = f;
  }
  // 400 samples per hop: even a full 7.5-unit hop should never move more than a few percent of itself between samples.
  check(`focus n=${n}: finite everywhere`, allFinite);
  check(`focus n=${n}: continuous (largest step between samples ${maxJump.toFixed(4)} units)`, maxJump < 0.2, String(maxJump));

  const l = stationLayout(n);
  let onStations = true;
  for (let i = 0; i < n; i++) {
    const f = focusAt(i, n);
    const r = restPose(l, i);
    onStations = onStations && dist(f.position, r.position) < 1e-9 && dist(f.target, r.target) < 1e-9 && f.travel === 0 && f.direction === 0;
  }
  check(`focus n=${n}: rests exactly on each station's pose at integer t`, onStations);
}
{
  // The plateau: while the camera rests on a station it does not move at all, so a station holds still while the text is read.
  const n = 5;
  const a = focusAt(2, n);
  const b = focusAt(2 + STATION.hold / 2 - 1e-6, n);
  check("focus: still resting at the end of the hold window", dist(a.position, b.position) < 1e-6 && dist(a.target, b.target) < 1e-6);
  const mid = focusAt(2.5, n);
  check("focus: mid-hop is lifted and pulled back (the reveal move)", mid.position[1] > (a.position[1] + focusAt(3, n).position[1]) / 2 + STATION.liftMid - 1e-6 && mid.travel > 0.999);
  check("focus: hop direction follows the chain (+1 going right, -1 never on the way there)", mid.direction === 1);
  check("focus: t is clamped to [0, n - 1]", dist(focusAt(-4, n).position, focusAt(0, n).position) === 0 && dist(focusAt(99, n).position, focusAt(n - 1, n).position) === 0);
  check("focus: NaN t is safe", finite3(focusAt(NaN, n).position));
  check("focus: n = 0 is a neutral pose, not a crash", finite3(focusAt(1, 0).position) && finite3(focusAt(1, 0).target));
}

// ---- the framing: the station lands right of centre (clear of the text on the left)
{
  const r = restPose(stationLayout(3), 1);
  const station = stationLayout(3)[1];
  check("framing: camera is left of the rack and back from it", r.position[0] < station[0] && r.position[2] > station[2]);
  check("framing: it looks at a point left of the rack, so the rack sits right of centre", r.target[0] < station[0]);
}

// ---- activeIndex hysteresis
{
  const n = 7;
  check("active: at an integer it is that station", [0, 1, 4, 6].every((i) => activeIndex(i, n, i) === i));
  check("active: it does not flip at exactly the halfway point", activeIndex(2.5, n, 2) === 2 && activeIndex(2.5, n, 3) === 3);
  check("active: it flips once past halfway + hysteresis", activeIndex(2.5 + ACTIVE_HYSTERESIS + 0.01, n, 2) === 3 && activeIndex(2.5 - ACTIVE_HYSTERESIS - 0.01, n, 3) === 2);
  // Jitter around the halfway point must not make the answer oscillate.
  let flips = 0;
  let cur = 2;
  for (let k = 0; k < 200; k++) {
    const t = 2.5 + Math.sin(k * 0.9) * ACTIVE_HYSTERESIS * 0.9;
    const next = activeIndex(t, n, cur);
    if (next !== cur) flips++;
    cur = next;
  }
  check("active: jitter around the halfway point never flips it", flips === 0, String(flips));
  check("active: a big jump snaps to the nearest station", activeIndex(5.9, n, 0) === 6 && activeIndex(0.1, n, 6) === 0);
  check("active: out-of-range and garbage input stays in range", activeIndex(-3, n, 2) === 0 && activeIndex(99, n, 2) === 6 && activeIndex(NaN, n, NaN) >= 0 && activeIndex(1, 0, 0) === 0);
}

// ---- progress and weight
{
  const vh = 900;
  const h = trackHeightVh(7) / 100 * vh; // 7 stations
  check("track height: 100vh for one project, plus 85vh per hop after that", trackHeightVh(1) === 100 && trackHeightVh(0) === 100 && trackHeightVh(7) === 100 + 6 * 85);
  check("progress: 0 before the pin starts and 1 after it ends", progressFromRect(500, h, vh) === 0 && progressFromRect(0, h, vh) === 0 && progressFromRect(-(h - vh), h, vh) === 1 && progressFromRect(-1e6, h, vh) === 1);
  check("progress: half-way through the pin is 0.5", near(progressFromRect(-(h - vh) / 2, h, vh), 0.5));
  check("progress: a track no taller than the screen never divides by zero", Number.isFinite(progressFromRect(-10, vh, vh)) && Number.isFinite(progressFromRect(-10, 0, 0)));
  check("index from progress round-trips with progress for index", [0, 1, 3, 6].every((i) => near(indexFromProgress(progressForIndex(i, 7), 7), i)));
  check("progress for index: one station is 0", progressForIndex(0, 1) === 0);

  // weight
  check("weight: 0 while the track is below the screen", flightWeight(vh, vh + h, vh) === 0 && flightWeight(vh * 3, vh * 3 + h, vh) === 0);
  check("weight: 1 while the track is pinned", flightWeight(0, h, vh) === 1 && flightWeight(-(h - vh) / 2, h - (h - vh) / 2, vh) === 1 && flightWeight(-(h - vh), vh, vh) === 1);
  check("weight: 0 once the track has left the top", flightWeight(-h, 0, vh) === 0 && flightWeight(-h * 2, -h, vh) === 0);
  let mono = true;
  let last = -1;
  for (let top = vh; top >= 0.2 * vh; top -= 5) {
    const w = flightWeight(top, top + h, vh);
    mono = mono && w >= last - 1e-12;
    last = w;
  }
  check("weight: ramps up monotonically as the track scrolls in", mono && near(last, 1, 1e-6));
  last = 2;
  mono = true;
  for (let bottom = vh; bottom >= 0.2 * vh; bottom -= 5) {
    const w = flightWeight(bottom - h, bottom, vh);
    mono = mono && w <= last + 1e-12;
    last = w;
  }
  check("weight: ramps down monotonically as the track scrolls out", mono && near(last, 0, 1e-6));
  check("weight: always in [0, 1], even for garbage", [NaN, Infinity, -Infinity, 1e9, -1e9].every((x) => flightWeight(x, x, vh) >= 0 && flightWeight(x, x, vh) <= 1) && flightWeight(0, 0, 0) >= 0);
  // A short page: the track is exactly one screen tall (one project), it must still fade in and out instead of popping.
  check("weight: a one-screen track ramps in and out", flightWeight(vh * 0.6, vh * 1.6, vh) > 0 && flightWeight(vh * 0.6, vh * 1.6, vh) < 1 && flightWeight(0, vh, vh) === 1);
}


// ---- a rack is one slab per layer of the project's stack
{
  check("rack: slab count follows the layers, clamped to 1..6, with a plain default when unknown", slabCount(4) === 4 && slabCount(1) === 1 && slabCount(99) === RACK.maxSlabs && slabCount(0) === RACK.defaultSlabs && slabCount(-3) === RACK.defaultSlabs && slabCount(NaN) === RACK.defaultSlabs);
  check("rack: a slab is thinner than the pitch, so slabs never touch", RACK.slab < RACK.pitch);
  for (let k = 1; k <= RACK.maxSlabs; k++) {
    const ys = Array.from({ length: k }, (_, j) => slabY(0, k, j));
    check(`rack k=${k}: slabs run top to bottom at an even pitch, centred on the rack`, ys.every((y, j) => j === 0 || near(ys[j - 1] - y, RACK.pitch)) && near(ys[0] + ys[k - 1], 0));
    check(`rack k=${k}: the floor is below the lowest slab and the top above the highest`, rackFloorY(0, k) < ys[k - 1] - RACK.slab / 2 && rackTopY(0, k) > ys[0] + RACK.slab / 2 - 1e-9 && near(rackTopY(0, k), ys[0] + RACK.slab / 2));
  }
  check("rack: more layers make a taller rack, and the floor drops as it grows", rackTopY(0, 5) - rackFloorY(0, 5) > rackTopY(0, 2) - rackFloorY(0, 2) && rackFloorY(0, 5) < rackFloorY(0, 2));
  check("rack: slab widths vary a little but stay within a fixed range", Array.from({ length: 12 * 6 }, (_, i) => slabWidth(Math.floor(i / 6), i % 6)).every((w) => w >= 2.55 && w <= 2.55 + 3 * 0.19 + 1e-9));
  // The follower frames the rack centre, so every rack (whatever its height) must sit inside the camera's view of it.
  const halfHeight = Math.max(...[1, 2, 3, 4, 5, 6].map((k) => (rackTopY(0, k) - rackFloorY(0, k)) / 2));
  const view = STATION.camOffset[2] * Math.tan((42 * Math.PI) / 360); // half the visible height at rack distance for a 42 degree lens
  check(`rack: even the tallest rack (${(halfHeight * 2).toFixed(1)} units) fits in the frame (${(view * 2).toFixed(1)} units visible)`, halfHeight < view * 0.8);
}

// ---- exhibit maths: the repeating clocks, windows and paths the per-project schematics are animated with
{
  check("exhibit: cyc stays in [0, 1) for any time, including negative, huge and garbage", [-1e9, -37.5, -0.0001, 0, 0.5, 11.999, 12, 1e9, NaN, Infinity].every((t) => { const v = cyc(t, 12); return v >= 0 && v < 1; }));
  check("exhibit: cyc wraps at the period and is continuous across it", near(cyc(0, 12), 0) && near(cyc(12, 12), 0) && near(cyc(6, 12), 0.5) && near(cyc(-3, 12), 0.75) && cyc(11.999, 12) > 0.999);
  check("exhibit: cyc survives a zero, negative or NaN period", [0, -5, NaN].every((p) => { const v = cyc(3, p); return Number.isFinite(v) && v >= 0 && v < 1; }));
  check("exhibit: smooth and ramp are 0 before, 1 after, monotonic between", smooth(-1) === 0 && smooth(2) === 1 && near(smooth(0.5), 0.5) && ramp(0.1, 0.2, 0.4) === 0 && ramp(0.5, 0.2, 0.4) === 1 && ramp(0.3, 0.2, 0.4) > ramp(0.25, 0.2, 0.4));
  check("exhibit: clamp01 tames garbage", clamp01(NaN) === 0 && clamp01(-4) === 0 && clamp01(9) === 1 && clamp01(0.3) === 0.3);
  let rising = true;
  let prev = -1;
  for (let i = 0; i <= 100; i++) {
    const v = ramp(i / 100, 0.2, 0.7);
    rising = rising && v >= prev - 1e-12;
    prev = v;
  }
  check("exhibit: ramp rises monotonically", rising);
  check("exhibit: win is 0 outside, 1 inside its window, and within 0..1 everywhere", win(0.05, 0.2, 0.6) === 0 && win(0.95, 0.2, 0.6) === 0 && near(win(0.4, 0.2, 0.6), 1) && Array.from({ length: 101 }, (_, i) => win(i / 100, 0.2, 0.6, 0.05)).every((v) => v >= 0 && v <= 1));
  check("exhibit: win with a zero-width or reversed window does not blow up", [win(0.5, 0.5, 0.5), win(0.5, 0.6, 0.4), win(0.5, 0.5, 0.5, 0)].every((v) => Number.isFinite(v) && v >= 0 && v <= 1));

  const line: V3[] = [[0, 0, 0], [2, 0, 0], [2, 2, 0]];
  check("exhibit: polylineLength sums the segments", near(polylineLength(line), 4) && polylineLength([]) === 0 && polylineLength([[1, 1, 1]]) === 0);
  check("exhibit: pointAlong runs from the first to the last point by length", pointAlong(line, 0).every((v, i) => near(v, line[0][i])) && pointAlong(line, 1).every((v, i) => near(v, line[2][i])) && pointAlong(line, 0.5).every((v, i) => near(v, line[1][i])) && near(pointAlong(line, 0.25)[0], 1));
  check("exhibit: pointAlong clamps and handles degenerate paths", pointAlong(line, -3)[0] === 0 && pointAlong(line, 7)[1] === 2 && pointAlong([], 0.5).every((v) => v === 0) && pointAlong([[3, 4, 5]], 0.5).join() === "3,4,5" && pointAlong([[1, 1, 0], [1, 1, 0]], 0.5).every(Number.isFinite));
  const stops = [-2, 0, 3];
  const legs: [number, number][] = [[0.1, 0.3], [0.5, 0.7]];
  check("exhibit: stepAlong dwells at each stop and moves only inside its leg", near(stepAlong(0, stops, legs), -2) && near(stepAlong(0.4, stops, legs), 0) && near(stepAlong(0.9, stops, legs), 3) && near(stepAlong(0.2, stops, legs), -1));
  let inside = true;
  for (let i = 0; i <= 200; i++) {
    const x = stepAlong(i / 200, stops, legs);
    inside = inside && x >= -2 - 1e-9 && x <= 3 + 1e-9;
  }
  check("exhibit: stepAlong never leaves the span of its stops", inside && stepAlong(0.5, [], []) === 0);
}

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
