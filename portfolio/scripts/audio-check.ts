/* eslint-disable no-console */
// Checks for the sound design's maths (distance mix, doppler, the journey's bed and chords, the gates). Run with:  npm run test:audio
// No browser, no speakers and no Web Audio needed: the engine only applies what these return.
import { CHORDS, CLIMB, GATES, NOTE, bedMix, crossed, heliMix, padBrightness } from "../src/lib/audio/mix";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? `\n       got: ${detail}` : ""}`);
}

// ---- the helicopter heard from the camera
const dists = [3.5, 5, 6.5, 8, 10, 12, 15, 18, 22, 30, 45, 80];
const full = dists.map((d) => heliMix(d, 1, 0));
check("heli: strictly quieter with every step of distance", full.every((m, i) => i === 0 || m.level < full[i - 1].level), full.map((m) => m.level.toFixed(3)).join(" "));
check("heli: duller with distance (the low-pass closes)", full.every((m, i) => i === 0 || m.cutoff < full[i - 1].cutoff));
check("heli: more echo with distance", full.every((m, i) => i === 0 || m.wet > full[i - 1].wet));
check("heli: close it is at most unity, never louder than the mix can hold", full.every((m) => m.level > 0 && m.level <= 1), `${full[0].level}`);
check("heli: at the take-off distance (6.5) it is clearly heard (above -6 dB) and at 18 it is 8+ dB quieter than that, at 30 over 14 dB quieter", full[2].level > 0.5 && full[2].level / full[7].level > 2.5 && full[2].level / full[9].level > 5, `${full[2].level.toFixed(3)} vs ${full[7].level.toFixed(3)} vs ${full[9].level.toFixed(3)}`);
check("heli: low-pass stays in a sane range (200 Hz to 8 kHz)", full.every((m) => m.cutoff > 200 && m.cutoff < 8000));
const spools = [0, 0.1, 0.25, 0.5, 0.75, 1];
const rising = spools.map((s) => heliMix(6.6, s, 0));
check("heli: silent while parked, and louder with every step of rotor speed", rising[0].level === 0 && rising.every((m, i) => i === 0 || m.level > rising[i - 1].level));
check("heli: chop and turbine climb with rotor speed", rising.every((m, i) => i === 0 || (m.chop > rising[i - 1].chop && m.turbine > rising[i - 1].turbine)));
check("heli: the blade-pass beat stays a rhythm you can hear (4 to 12 Hz)", rising.every((m) => m.chop >= 4 && m.chop <= 12));
check("heli: doppler is below 1 moving away, above 1 coming, bounded at 9%", heliMix(10, 1, 8).doppler < 1 && heliMix(10, 1, -8).doppler > 1 && heliMix(10, 1, 1e6).doppler >= 0.909 && heliMix(10, 1, -1e6).doppler <= 1.091);
check("heli: garbage in, finite out", [NaN, Infinity, -5].every((d) => Object.values(heliMix(d, NaN, NaN)).every(Number.isFinite)));
check("heli: same function, same answer (it is pure)", JSON.stringify(heliMix(9, 0.7, 2)) === JSON.stringify(heliMix(9, 0.7, 2)));

// ---- the rotor loop plays back at a rate that follows rotor speed (beat and pitch together), with Doppler on the same number
check("heli: rotor rate runs from 0.4 (turning over) to 1 (full speed), rising with every step of rotor speed", rising.every((m, i) => i === 0 || m.rate > rising[i - 1].rate) && rising[0].rate >= 0.4 - 1e-9 && rising[5].rate <= 1 + 1e-9);
check("heli: Doppler rides on the rotor rate (away is slower and lower, toward is faster and higher)", heliMix(10, 1, 8).rate < heliMix(10, 1, 0).rate && heliMix(10, 1, -8).rate > heliMix(10, 1, 0).rate);
check("heli: the turbine whine climbs with rotor speed, from about 1.1 kHz to 3.4 kHz", rising.every((m, i) => i === 0 || m.turbine > rising[i - 1].turbine) && rising[0].turbine >= 1100 - 1e-9 && rising[5].turbine <= 3400 + 1e-9);
check("heli: the rotor bites harder with thrust (lifting off, fast flight) and the engine rumbles more", heliMix(8, 1, 0, 1).rotor > heliMix(8, 1, 0, 0.45).rotor && heliMix(8, 1, 0, 1).rumble > heliMix(8, 1, 0, 0.45).rumble);
check("heli: every layer is silent while parked", Object.entries(heliMix(8, 0, 0, 1)).every(([k, v]) => !["level", "whineGain", "air"].includes(k) || v === 0));

// ---- the bed
check("bed: gain grows with scroll speed and the filter opens", [0, 1, 2, 3, 4, 5].every((u) => bedMix(u, 1).gain > bedMix(u, 0).gain && bedMix(u, 1).freq > bedMix(u, 0).freq));
check("bed: continuous along the journey (no jump between neighbouring steps)", Array.from({ length: 500 }, (_, i) => i / 100).every((u, i, a) => i === 0 || Math.abs(bedMix(u, 0).freq - bedMix(a[i - 1], 0).freq) < 40));
check("bed: quiet (never above 0.1) and safe out of range", [-5, 0, 2.5, 5, 99, NaN].every((u) => bedMix(u, 1).gain < 0.1 && Number.isFinite(bedMix(u, 1).freq)));
check("pad: brighter further along and when moving, within 0 to 1", padBrightness(5, 0) > padBrightness(0, 0) && padBrightness(2, 1) > padBrightness(2, 0) && padBrightness(99, 9) <= 1 && padBrightness(-3, -9) >= 0);

// ---- the notes
check("chords: one per zone, five voices each, all between 60 and 500 Hz", CHORDS.length === 6 && CHORDS.every((c) => c.length === 5 && c.every((f) => f > 60 && f < 500)));
const D_MAJOR_FAMILY = [73.42, 98, 110, 123.47, 146.83, 164.81, 220, 246.94, 293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51, 1479.98, 1760];
check("notes: the chime run is D major pentatonic, rising", CLIMB.every((f, i) => i === 0 || f > CLIMB[i - 1]) && CLIMB.every((f) => D_MAJOR_FAMILY.some((n) => Math.abs(n - f) < 0.02)));
check("notes: every named note is a note of the D major family (nothing can clash)", Object.values(NOTE).every((f) => D_MAJOR_FAMILY.some((n) => Math.abs(n - f) < 0.02)));

// ---- the gates
check("gates: six, in order along the route, kinds as built (Foundation, CI, CI, CD, CD, CD)", GATES.length === 6 && GATES.every((g, i) => i === 0 || g.u > GATES[i - 1].u) && GATES.map((g) => g.kind).join() === "gate,ci,ci,cd,cd,cd");
check("gates: crossed forward and backward, not when short of it", crossed(1.55, 1.65, 1.6) && crossed(1.65, 1.55, 1.6) && !crossed(1.5, 1.58, 1.6) && !crossed(1.7, 1.8, 1.6));
check("gates: a jump of a whole section (a link) is not a flight through the gate", !crossed(0.3, 3, 1.6) && !crossed(3, 0.3, 1.6));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
