// The pure maths of the mix: how loud and how bright things are for a distance, a rotor speed, a place on the route. No DOM, no Web Audio,
// so it can be checked as numbers (scripts are free to import it). The engine only applies what these return.

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(x) ? x : lo));
const clamp01 = (x: number) => clamp(x, 0, 1);
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/** D major (and its relatives): every note the sound design uses, so nothing it plays can clash. Hz. */
export const NOTE = {
  D2: 73.42, G2: 98, A2: 110, B2: 123.47, D3: 146.83, E3: 164.81, A3: 220, B3: 246.94,
  D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88,
  D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880, B5: 987.77,
  D6: 1174.66, E6: 1318.51, Fs6: 1479.98, A6: 1760,
} as const;

/** The pentatonic run the chimes climb: stages of a request, stages of the journey, projects in the flight. */
export const CLIMB = [NOTE.D5, NOTE.E5, NOTE.Fs5, NOTE.A5, NOTE.B5, NOTE.D6] as const;

/** One slow chord per zone of the journey (Hero, Gate, Build, Deployments, Stack, Signal Out). Voices in Hz; the last resolves back up to D. */
export const CHORDS: readonly (readonly number[])[] = [
  [73.42, 146.83, 220, 329.63, 369.99], //  Dmaj9
  [98, 146.83, 246.94, 369.99, 440], //     Gmaj9
  [123.47, 185, 220, 277.18, 329.63], //    Bm11
  [110, 164.81, 246.94, 277.18, 329.63], // Aadd9
  [92.5, 138.59, 220, 277.18, 329.63], //   F#m7
  [146.83, 220, 277.18, 369.99, 440], //    Dmaj7, higher and airier: the resolution
];

/**
 * The helicopter as heard from where the camera is. Louder when close, much quieter and duller when far (air takes the top end out of
 * distant sound), more of it as room echo the further it goes, and its pitch bends as it moves toward or away (a Doppler shift).
 *  - dist: world units from the camera; spool: rotor speed 0..1; radialSpeed: units per second moving away (+) or toward (-);
 *  - thrust: 0..1, how hard the rotor is working (it bites harder as it lifts off and again in fast flight).
 *
 * Rotor speed is one thing in a real machine and so it is here: `rate` is the playback rate of the recorded-style rotor loop, which speeds the
 * blade slap up AND raises its pitch together as the rotors spin up (and Doppler multiplies into the same number), exactly as a real rotor does.
 */
export function heliMix(dist: number, spool: number, radialSpeed: number, thrust = 0.7) {
  const d = Math.max(0, Number.isFinite(dist) ? dist : 99);
  const sp = clamp01(spool);
  const th = clamp01(thrust);
  const base = 0.4 + 0.6 * Math.pow(sp, 0.8);
  const doppler = 1 - clamp(radialSpeed * 0.008, -0.09, 0.09);
  const turbine = 1100 + 2300 * Math.pow(sp, 1.2);
  return {
    /** 0..1: an inverse-distance curve, steep up close and long-tailed (6.5 units: 0.58, 10: 0.38, 18: 0.19, 30: 0.09), soft-limited near the camera. */
    level: Math.min(0.95, 1.45 / (1 + Math.pow(d / 5, 1.5))) * smooth(sp * 1.15),
    /** Low-pass cutoff (Hz): bright near, dull far. */
    cutoff: 500 + 7000 * Math.exp(-d / 16),
    /** Room echo send, 0..1: a little near, more far (it is outdoors, so never much). */
    wet: 0.08 + 0.4 * (1 - Math.exp(-d / 22)),
    /** Playback rate of the rotor loop: 0.4 (turning over slowly) to 1 (full speed), with Doppler. */
    rate: base * doppler,
    /** The blade-pass rate in Hz (two blades at 5.5 revolutions a second is 11 Hz at full speed): informational. */
    chop: 11 * base,
    /** How loud the blade slap is, before distance: it works harder as it lifts and in fast flight. */
    rotor: (0.35 + 0.65 * Math.pow(sp, 0.6)) * (0.6 + 0.4 * th),
    /** The engine's low rumble. */
    rumble: 0.2 * Math.pow(sp, 1.2) * (0.7 + 0.3 * th),
    /** Turbine whine, before and after Doppler (Hz), and its level. */
    turbine,
    whine: turbine * doppler,
    whineGain: 0.12 * Math.pow(sp, 1.7),
    /** The hiss of the rotor tips. */
    air: 0.1 * sp * sp * (0.4 + 0.6 * th),
    doppler,
  };
}

/**
 * The sound of the place on the route: a filtered-noise bed that changes character from zone to zone (airy sky, a low hum under the Gate, a
 * city murmur, bright sparkle at the Deployments, the tower's resonance, open sky at the end), and that opens up and gets louder with scroll
 * speed, a quiet rush like moving through a tunnel.
 */
const BED_FREQ = [900, 380, 260, 1400, 520, 2200];
const BED_GAIN = [0.008, 0.011, 0.02, 0.011, 0.013, 0.011];
export function bedMix(u: number, speed: number) {
  const x = clamp(u, 0, BED_FREQ.length - 1);
  const i = Math.min(BED_FREQ.length - 2, Math.floor(x));
  const f = smooth(x - i);
  const sp = clamp01(Math.abs(speed));
  return {
    freq: (BED_FREQ[i] + (BED_FREQ[i + 1] - BED_FREQ[i]) * f) * (1 + 0.9 * sp),
    gain: BED_GAIN[i] + (BED_GAIN[i + 1] - BED_GAIN[i]) * f + 0.045 * sp * sp,
  };
}

/** How bright the pad is (0 to 1): a little more open further along the journey and while the page is moving. */
export const padBrightness = (zone: number, speed: number) => clamp01(0.25 + 0.1 * zone + 0.45 * clamp01(Math.abs(speed)));

/** The camera positions (u) of the gates it flies through: the Foundation gate, then the five pipeline gates (CI, CI, CD, CD, CD). */
export const GATES: readonly { u: number; kind: "gate" | "ci" | "cd" }[] = [
  { u: 0.92, kind: "gate" },
  { u: 1.6, kind: "ci" },
  { u: 1.9, kind: "ci" },
  { u: 2.2, kind: "cd" },
  { u: 2.5, kind: "cd" },
  { u: 2.8, kind: "cd" },
];

/** Did moving from u0 to u1 carry the camera across `at`? A jump (a link to a far section) is not a flight through the gate: it is ignored. */
export const crossed = (u0: number, u1: number, at: number) => Math.abs(u1 - u0) < 0.7 && ((u0 < at && u1 >= at) || (u0 > at && u1 <= at));
