// The sound engine. Every sound on the site is synthesised here, live, with the Web Audio API: there are no audio files (the same rule as the
// 3D world's geometry: nothing to download, nothing to license, and it can follow the page exactly).
//
// The palette is classical and warm. Everything is in D major (see NOTE and CHORDS in mix.ts), so nothing can clash:
//   - chimes are bells: a sine with a few inharmonic partials and an exponential decay, into a soft room;
//   - the bed under the journey is a slow string-like pad (detuned triangle and saw voices through a low-pass), one chord per zone, with
//     the chords cross-fading as you travel, plus a filtered-noise "air" that changes character from place to place and opens up with
//     scroll speed;
//   - the helicopter is a real little synth: a rotor loop of discrete blade slaps (thump, pitched slap, crack, whomp, tail-rotor buzz) whose
//     playback rate follows rotor speed (beat and pitch rise together), an engine rumble, a turbine whine and rotor air, all heard
//     through distance (louder, brighter and drier near; quieter, duller and more echoing far; pitch bending as it moves) and panned to
//     where it is on screen;
//   - the interface has the smallest sounds: a tick on hover, a soft tock on click, a typed key.
//
// It only runs for a visitor who has turned sound on (a browser will not allow it before a gesture anyway), and the controller
// (components/audio/SoundController.tsx) feeds it events. Nothing here touches the DOM.

import { INCIDENT_TIMING, REQUEST_TRAVEL_SECONDS } from "@/lib/world/events";
import { motionState } from "@/lib/world/motion";
import { stationsState } from "@/lib/world/stations";
import { audioScene } from "./state";
import { CHORDS, CLIMB, GATES, NOTE, bedMix, crossed, heliMix, padBrightness } from "./mix";

type AC = typeof AudioContext;
const getAC = (): AC | undefined => (typeof window === "undefined" ? undefined : (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext));

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const MASTER = 0.85;

interface Out {
  pan?: number;
  wet?: number;
  gain?: number;
}

/** A room: stereo noise that dies away exponentially and gets darker as it does (a one-pole low-pass that closes), with a short pre-delay. */
function makeImpulse(ctx: AudioContext, seconds = 2.8): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  const pre = Math.floor(rate * 0.014);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      lp += (Math.random() * 2 - 1 - lp) * (0.08 + 0.85 * (1 - t) * (1 - t));
      d[i] = lp * Math.pow(1 - t, 2.6) * 0.9;
    }
  }
  return buf;
}

function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** The string-like pad: one chord at a time, cross-fading to the next when the zone changes. */
class Pad {
  private readonly lp: BiquadFilterNode;
  private readonly out: GainNode;
  private layer: { g: GainNode; oscs: OscillatorNode[] } | null = null;

  constructor(private readonly ctx: AudioContext, bus: AudioNode, send: AudioNode) {
    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 900;
    this.lp.Q.value = 0.4;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.lp.connect(this.out);
    this.out.connect(bus);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.out.connect(wet);
    wet.connect(send);
    // A very slow breathing in the filter, so a held chord is never static.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    lfo.connect(depth);
    depth.connect(this.lp.frequency);
    lfo.start();
  }

  start() {
    this.out.gain.setTargetAtTime(0.05, this.ctx.currentTime, 1.8);
  }

  stop() {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
  }

  setBrightness(b: number) {
    this.lp.frequency.setTargetAtTime(480 + 1900 * b, this.ctx.currentTime, 0.6);
  }

  setChord(freqs: readonly number[]) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const old = this.layer;
    if (old) {
      old.g.gain.setTargetAtTime(0, now, 1.1);
      old.oscs.forEach((o) => {
        try {
          o.stop(now + 7);
        } catch {
          /* already stopped */
        }
      });
      old.oscs[0].onended = () => old.g.disconnect();
    }
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.lp);
    const oscs: OscillatorNode[] = [];
    freqs.forEach((f, i) => {
      const v = ctx.createGain();
      v.gain.value = 0.15 / (1 + i * 0.12);
      v.connect(g);
      const a = ctx.createOscillator();
      a.type = "triangle";
      a.frequency.value = f;
      a.connect(v);
      const b = ctx.createOscillator();
      b.type = "sawtooth";
      b.frequency.value = f;
      b.detune.value = i % 2 ? 7 : -7;
      const bg = ctx.createGain();
      bg.gain.value = 0.35;
      b.connect(bg);
      bg.connect(v);
      a.start(now);
      b.start(now);
      oscs.push(a, b);
    });
    g.gain.setTargetAtTime(1, now, 0.9);
    this.layer = { g, oscs };
  }
}

/** The "air" of the place: band-passed noise whose centre and level the mix tables set (see bedMix). */
class Bed {
  private readonly bp: BiquadFilterNode;
  private readonly out: GainNode;

  constructor(private readonly ctx: AudioContext, noise: AudioBuffer, bus: AudioNode) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    this.bp = ctx.createBiquadFilter();
    this.bp.type = "bandpass";
    this.bp.Q.value = 0.6;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    src.connect(this.bp);
    this.bp.connect(this.out);
    this.out.connect(bus);
    src.start(0, Math.random() * 1.5);
  }

  set(freq: number, gain: number) {
    const now = this.ctx.currentTime;
    this.bp.frequency.setTargetAtTime(freq, now, 0.35);
    this.out.gain.setTargetAtTime(gain, now, 0.45);
  }

  mute() {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }
}

/**
 * One short loop of rotor, built sample by sample. A real rotor is not a smooth hum that pulses: each blade, as it passes, slaps the air, and
 * between slaps there is relative quiet. Each blade pass here is three things layered: a low THUMP (a sine that falls a little in pitch as it
 * dies, with its upper harmonics so small speakers still hear it), a pitched slap and a CRACK (a burst of noise filtered to about 2 kHz that
 * rises in 1.5 ms and dies in 16 ms) and a WHOMP (a slower swell of noise, about 500 Hz, over 70 ms). The two blades are not identical (one a little louder, a little off the exact half turn) and every revolution
 * is slightly different, so it does not sound like a machine gun; the tail rotor adds five short high buzzes per revolution.
 * The loop is three revolutions at full speed (5.5 a second, so 11 blade passes a second) and wraps seamlessly: it is played back at a
 * variable rate, which changes the beat and the pitch together, as a rotor turning faster really does.
 */
function makeRotorLoop(ctx: AudioContext): AudioBuffer {
  const fs = ctx.sampleRate;
  const REV = 1 / 5.5;
  const REVS = 3;
  const len = Math.round(fs * REV * REVS);
  const buf = ctx.createBuffer(1, len, fs);
  const d = buf.getChannelData(0);
  const put = (i: number, v: number) => {
    d[((i % len) + len) % len] += v; // wraps, so an event near the end continues at the start
  };
  const rnd = () => Math.random() * 2 - 1;

  const slap = (t0: number, amp: number) => {
    const s0 = Math.round(t0 * fs);
    const n = Math.round(fs * 0.14);
    let phase = 0;
    let crackLp = 0;
    let bodyLp = 0;
    for (let k = 0; k < n; k++) {
      const t = k / fs;
      phase += (2 * Math.PI * (80 + 40 * Math.exp(-t / 0.03))) / fs;
      // The thump carries its 2nd and 3rd harmonics (about 160 to 360 Hz): a laptop or phone speaker cannot play the 80 to 120 Hz fundamental,
      // but the ear hears the pitch from the harmonics anyway (the "missing fundamental"), so it still reads as a low thump on small speakers.
      const thump = (Math.sin(phase) + 0.9 * Math.sin(2 * phase) + 0.6 * Math.sin(3 * phase)) * Math.exp(-t / 0.045) * (1 - Math.exp(-t / 0.003));
      // A short pitched slap (about 420 Hz, dies in 9 ms) and the crack (noise to about 2 kHz, dies in 16 ms): the part that makes it a rotor.
      const tone = Math.sin(2 * Math.PI * 420 * t) * Math.exp(-t / 0.009) * (1 - Math.exp(-t / 0.001));
      crackLp += (rnd() - crackLp) * 0.3;
      const crack = crackLp * (1 - Math.exp(-t / 0.0015)) * Math.exp(-t / 0.016);
      // The whomp: a slower swell of noise around 500 Hz, over 70 ms.
      bodyLp += (rnd() - bodyLp) * 0.07;
      const whomp = bodyLp * Math.pow(Math.sin(Math.PI * Math.min(1, t / 0.07)), 2);
      put(s0 + k, amp * (0.3 * thump + 0.5 * tone + 2.6 * crack + 4.5 * whomp));
    }
  };

  const buzz = (t0: number, amp: number) => {
    const s0 = Math.round(t0 * fs);
    const n = Math.round(fs * 0.02);
    let lp = 0;
    for (let k = 0; k < n; k++) {
      const t = k / fs;
      const x = rnd();
      lp += (x - lp) * 0.08;
      put(s0 + k, amp * (x - lp) * (1 - Math.exp(-t / 0.0006)) * Math.exp(-t / 0.006));
    }
  };

  for (let r = 0; r < REVS; r++) {
    for (let b = 0; b < 2; b++) {
      slap((r + b * 0.5) * REV + rnd() * 0.003, (b === 0 ? 1 : 0.8) * (0.93 + 0.14 * Math.random()));
    }
  }
  for (let k = 0; k < 5 * REVS; k++) buzz((k * REV) / 5 + rnd() * 0.0008, 0.3 * (0.85 + 0.3 * Math.random()));

  // Take out any drift (a one-pole high-pass), then set the peak.
  let px = 0;
  let py = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const y = d[i] - px + 0.995 * py;
    px = d[i];
    py = y;
    d[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  const norm = peak > 0 ? 0.9 / peak : 1;
  for (let i = 0; i < len; i++) d[i] *= norm;
  return buf;
}

/**
 * The helicopter. One persistent little synth, built once and silent until the rotors turn:
 *  - the ROTOR: the slap loop above, played back at a rate that follows rotor speed (so spooling up speeds the beat and lifts the pitch
 *    together, and Doppler rides on the same number);
 *  - the ENGINE: a low rumble (noise through a 130 Hz low-pass);
 *  - the TURBINE: a thin sawtooth whine through a narrow band-pass that tracks its pitch (about 1.1 kHz at idle to 3.4 kHz at full speed),
 *    with a gentle vibrato and a fifth above it, as a jet turbine sounds;
 *  - the AIR: the hiss of the rotor tips.
 * It all goes through a low-pass that distance closes (far sound is dull), a panner that follows the helicopter across the screen, and a
 * small echo send.
 */
class HeliVoice {
  private readonly rotor: AudioBufferSourceNode;
  private readonly rotorG: GainNode;
  private readonly rumbleG: GainNode;
  private readonly whineA: OscillatorNode;
  private readonly whineB: OscillatorNode;
  private readonly whineBp: BiquadFilterNode;
  private readonly whineG: GainNode;
  private readonly airG: GainNode;
  private readonly lp: BiquadFilterNode;
  private readonly pan: StereoPannerNode | null;
  private readonly out: GainNode;
  private readonly wet: GainNode;

  constructor(private readonly ctx: AudioContext, noise: AudioBuffer, bus: AudioNode, send: AudioNode) {
    const mix = ctx.createGain();

    this.rotor = ctx.createBufferSource();
    this.rotor.buffer = makeRotorLoop(ctx);
    this.rotor.loop = true;
    this.rotor.playbackRate.value = 0.4;
    this.rotorG = ctx.createGain();
    this.rotorG.gain.value = 0;
    this.rotor.connect(this.rotorG);
    this.rotorG.connect(mix);

    const n1 = ctx.createBufferSource();
    n1.buffer = noise;
    n1.loop = true;
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = "lowpass";
    rumbleLp.frequency.value = 130;
    rumbleLp.Q.value = 0.7;
    this.rumbleG = ctx.createGain();
    this.rumbleG.gain.value = 0;
    n1.connect(rumbleLp);
    rumbleLp.connect(this.rumbleG);
    this.rumbleG.connect(mix);

    this.whineA = ctx.createOscillator();
    this.whineA.type = "sawtooth";
    this.whineB = ctx.createOscillator();
    this.whineB.type = "sine";
    this.whineA.frequency.value = 1100;
    this.whineB.frequency.value = 1100 * 1.503;
    this.whineBp = ctx.createBiquadFilter();
    this.whineBp.type = "bandpass";
    this.whineBp.frequency.value = 1100;
    this.whineBp.Q.value = 6;
    this.whineG = ctx.createGain();
    this.whineG.gain.value = 0;
    const fifth = ctx.createGain();
    fifth.gain.value = 0.5;
    this.whineA.connect(this.whineBp);
    this.whineBp.connect(this.whineG);
    this.whineB.connect(fifth);
    fifth.connect(this.whineG);
    this.whineG.connect(mix);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 9; // cents
    vib.connect(vibDepth);
    vibDepth.connect(this.whineA.detune);
    vibDepth.connect(this.whineB.detune);

    const n2 = ctx.createBufferSource();
    n2.buffer = noise;
    n2.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2400;
    this.airG = ctx.createGain();
    this.airG.gain.value = 0;
    n2.connect(hp);
    hp.connect(this.airG);
    this.airG.connect(mix);

    this.lp = ctx.createBiquadFilter();
    this.lp.type = "lowpass";
    this.lp.frequency.value = 3000;
    this.lp.Q.value = 0.5;
    mix.connect(this.lp);
    this.pan = typeof ctx.createStereoPanner === "function" ? ctx.createStereoPanner() : null;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    if (this.pan) {
      this.lp.connect(this.pan);
      this.pan.connect(this.out);
    } else {
      this.lp.connect(this.out);
    }
    this.out.connect(bus);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.1;
    this.out.connect(this.wet);
    this.wet.connect(send);

    const t = ctx.currentTime;
    this.rotor.start(t);
    n1.start(t, Math.random() * 1.5);
    n2.start(t, Math.random() * 1.5);
    this.whineA.start(t);
    this.whineB.start(t);
    vib.start(t);
  }

  update(m: ReturnType<typeof heliMix>, pan: number) {
    const now = this.ctx.currentTime;
    this.out.gain.setTargetAtTime(m.level, now, 0.12);
    this.lp.frequency.setTargetAtTime(m.cutoff, now, 0.15);
    this.wet.gain.setTargetAtTime(m.wet, now, 0.25);
    this.rotor.playbackRate.setTargetAtTime(m.rate, now, 0.08);
    this.rotorG.gain.setTargetAtTime(m.rotor, now, 0.12);
    this.rumbleG.gain.setTargetAtTime(m.rumble, now, 0.2);
    this.whineA.frequency.setTargetAtTime(m.whine, now, 0.1);
    this.whineB.frequency.setTargetAtTime(m.whine * 1.503, now, 0.1);
    this.whineBp.frequency.setTargetAtTime(m.whine, now, 0.1);
    this.whineG.gain.setTargetAtTime(m.whineGain, now, 0.2);
    this.airG.gain.setTargetAtTime(m.air, now, 0.2);
    this.pan?.pan.setTargetAtTime(clamp(pan * 0.85, -0.9, 0.9), now, 0.1);
  }

  mute() {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
  }
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus!: GainNode;
  private master!: GainNode;
  private send!: GainNode;
  private noise!: AudioBuffer;
  private pad: Pad | null = null;
  private bed: Bed | null = null;
  private heli: HeliVoice | null = null;
  private active = false;
  private padOn = false;
  private lastU = 0;
  private lastZone = -1;
  private lastDist = 0;
  private lastDistAt = 0;
  private radial = 0;
  private visible = true;
  private next = { ping: 0, courier: 0, car: 0, pings: 0 };

  /** True while sound is on and the browser has let the audio run. */
  isRunning() {
    return this.active && !!this.ctx && this.ctx.state === "running";
  }

  private build() {
    const AudioCtor = getAC();
    if (!AudioCtor) return false;
    const ctx = new AudioCtor({ latencyHint: "interactive" });
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    comp.connect(this.master);
    this.master.connect(ctx.destination);
    this.bus = ctx.createGain();
    this.bus.connect(comp);
    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx);
    const wetOut = ctx.createGain();
    wetOut.gain.value = 0.9;
    reverb.connect(wetOut);
    wetOut.connect(comp);
    this.send = ctx.createGain();
    this.send.connect(reverb);
    this.noise = makeNoise(ctx);
    this.pad = new Pad(ctx, this.bus, this.send);
    this.bed = new Bed(ctx, this.noise, this.bus);
    this.heli = new HeliVoice(ctx, this.noise, this.bus, this.send);
    return true;
  }

  /** Turns sound on. Must be called from a user gesture the first time (a browser will not start audio otherwise). Safe to call again. */
  enable() {
    if (this.active && this.ctx?.state === "running") return;
    // Where the browser has it, ask for "playback" audio so the ringer switch on an iPhone does not silence it.
    try {
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {
      /* not supported */
    }
    if (!this.ctx && !this.build()) return;
    const ctx = this.ctx!;
    const first = !this.active;
    this.active = true;
    void ctx.resume().then(() => {
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(MASTER, now, 0.25);
      if (first) this.cue("welcome");
    });
  }

  /** Turns sound off: a short falling note, then the whole thing fades and the audio is suspended (it costs nothing while off). */
  disable() {
    const ctx = this.ctx;
    if (!this.active || !ctx) {
      this.active = false;
      return;
    }
    if (ctx.state === "running") {
      const t = ctx.currentTime + 0.01;
      this.bell(NOTE.A5, t, { gain: 0.07, decay: 0.7, wet: 0.3 });
      this.bell(NOTE.D5, t + 0.11, { gain: 0.07, decay: 0.9, wet: 0.35 });
    }
    this.active = false;
    this.padOn = false;
    this.lastZone = -1;
    this.pad?.stop();
    this.bed?.mute();
    this.heli?.mute();
    this.master.gain.setTargetAtTime(0, ctx.currentTime + 0.5, 0.18);
    window.setTimeout(() => {
      if (!this.active && this.ctx) void this.ctx.suspend();
    }, 1400);
  }

  /** Called when the tab is hidden or shown: a hidden tab stops making sound. */
  setVisible(visible: boolean) {
    this.visible = visible;
    const ctx = this.ctx;
    if (!ctx || !this.active) return;
    if (visible) void ctx.resume();
    else void ctx.suspend();
  }

  // ---- routing and voices ------------------------------------------------------------------------------------------------------------

  private route(node: AudioNode, o: Out = {}) {
    const ctx = this.ctx!;
    let tail: AudioNode = node;
    if (o.gain !== undefined) {
      const g = ctx.createGain();
      g.gain.value = o.gain;
      tail.connect(g);
      tail = g;
    }
    if (o.pan !== undefined && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(o.pan, -1, 1);
      tail.connect(p);
      tail = p;
    }
    tail.connect(this.bus);
    if (o.wet) {
      const w = ctx.createGain();
      w.gain.value = o.wet;
      tail.connect(w);
      w.connect(this.send);
    }
  }

  /** A bell: a sine and three inharmonic partials, each dying at its own rate. */
  private bell(freq: number, at: number, o: { gain?: number; decay?: number; wet?: number; pan?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(at, ctx.currentTime);
    const decay = o.decay ?? 1.6;
    const peak = o.gain ?? 0.1;
    const parts: [number, number, number][] = [
      [1, 1, 1],
      [2.0, 0.4, 0.62],
      [2.76, 0.2, 0.38],
      [5.4, 0.07, 0.2],
    ];
    const sum = ctx.createGain();
    for (const [ratio, amp, share] of parts) {
      if (freq * ratio > 11000) continue;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      const g = ctx.createGain();
      const end = t + decay * share + 0.05;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak * amp, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g);
      g.connect(sum);
      osc.start(t);
      osc.stop(end + 0.02);
    }
    this.route(sum, { pan: o.pan, wet: o.wet ?? 0.4 });
  }

  /** A single tone with an envelope; it can glide (`end`), swell slowly (`attack`) and be softened (`cutoff`). */
  private tone(freq: number, at: number, dur: number, o: { type?: OscillatorType; gain?: number; end?: number; attack?: number; wet?: number; pan?: number; cutoff?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(at, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.end) osc.frequency.exponentialRampToValueAtTime(o.end, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.1, t + Math.min(o.attack ?? 0.004, dur * 0.8));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    let tail: AudioNode = g;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = o.cutoff;
      g.connect(f);
      tail = f;
    }
    osc.start(t);
    osc.stop(t + dur + 0.03);
    this.route(tail, { pan: o.pan, wet: o.wet });
  }

  /** Air moving: noise through a band-pass that sweeps from `f0` up through `mid` and on to `f1`, swelling in the middle. */
  private whoosh(at: number, dur: number, f0: number, f1: number, o: { gain?: number; q?: number; mid?: number; pan0?: number; pan1?: number; wet?: number; peakAt?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(at, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = o.q ?? 0.9;
    bp.frequency.setValueAtTime(f0, t);
    const peakAt = o.peakAt ?? 0.4;
    if (o.mid) {
      bp.frequency.exponentialRampToValueAtTime(o.mid, t + dur * peakAt);
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    } else {
      bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t + dur * peakAt);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    let tail: AudioNode = g;
    if (o.pan0 !== undefined && typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(clamp(o.pan0, -1, 1), t);
      p.pan.linearRampToValueAtTime(clamp(o.pan1 ?? o.pan0, -1, 1), t + dur);
      g.connect(p);
      tail = p;
    }
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    this.route(tail, { wet: o.wet });
  }

  /** A very short burst of filtered noise: the "click" part of a click. */
  private noiseHit(at: number, dur: number, freq: number, gain: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = Math.max(at, ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp);
    bp.connect(g);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
    this.route(g);
  }

  // ---- the cues ----------------------------------------------------------------------------------------------------------------------

  /** Plays a named sound. `i` is an index for sounds that climb a scale; the rest of the options belong to the sound that reads them. */
  cue(name: string, i = 0, o: { dark?: boolean; dur?: number; kind?: string } = {}) {
    const ctx = this.ctx;
    if (!this.active || !ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.005;
    const climb = CLIMB[((i % CLIMB.length) + CLIMB.length) % CLIMB.length];
    switch (name) {
      case "hover":
        this.tone(2300, t, 0.03, { gain: 0.011, end: 1900 });
        break;
      case "card":
        this.tone(1500, t, 0.06, { gain: 0.016, end: 1250, wet: 0.25 });
        break;
      case "click":
        this.noiseHit(t, 0.012, 1800, 0.05);
        this.tone(660, t, 0.08, { type: "triangle", gain: 0.04, end: 430 });
        break;
      case "type":
        this.noiseHit(t, 0.01, 2600, 0.03);
        this.tone(1400 + (i % 5) * 60, t, 0.025, { gain: 0.012 });
        break;
      case "enter":
        this.noiseHit(t, 0.014, 1400, 0.05);
        this.tone(520, t, 0.1, { type: "triangle", gain: 0.05, end: 780, wet: 0.2 });
        break;
      case "welcome":
        this.bell(NOTE.D5, t, { gain: 0.085, decay: 2.2, wet: 0.55 });
        this.bell(NOTE.A5, t + 0.12, { gain: 0.075, decay: 2.2, wet: 0.55 });
        this.bell(NOTE.D6, t + 0.24, { gain: 0.065, decay: 2.6, wet: 0.6 });
        this.tone(NOTE.D3, t, 2.2, { gain: 0.06, attack: 0.5, wet: 0.6, cutoff: 900 });
        break;
      case "theme":
        if (o.dark) {
          this.bell(NOTE.D5, t, { gain: 0.07, decay: 1.4 });
          this.bell(NOTE.A4, t + 0.14, { gain: 0.07, decay: 1.8 });
          this.tone(NOTE.D3, t, 1.6, { gain: 0.07, attack: 0.4, wet: 0.5, cutoff: 700 });
        } else {
          this.bell(NOTE.A4, t, { gain: 0.07, decay: 1.2 });
          this.bell(NOTE.D5, t + 0.12, { gain: 0.07, decay: 1.4 });
          this.bell(NOTE.A5, t + 0.24, { gain: 0.06, decay: 1.8 });
        }
        break;
      case "palette":
        this.noiseHit(t, 0.012, 2200, 0.04);
        this.whoosh(t, 0.28, 900, 3200, { gain: 0.05, wet: 0.3 });
        this.bell(NOTE.A5, t + 0.05, { gain: 0.045, decay: 0.9, wet: 0.4 });
        break;
      case "open":
        this.whoosh(t, 0.42, 400, 2400, { gain: 0.07, pan0: -0.3, pan1: 0.3, wet: 0.35 });
        this.bell(NOTE.A5, t + 0.12, { gain: 0.05, decay: 1.2, wet: 0.5 });
        break;
      case "panel":
        this.tone(480, t, 0.12, { type: "triangle", gain: 0.05, end: 720, wet: 0.3 });
        break;
      case "stage":
        this.bell(climb, t, { gain: 0.07, decay: 1.1, wet: 0.45, pan: -0.2 });
        break;
      case "station":
        this.whoosh(t, 0.45, 380, 950, { gain: 0.06, pan0: -0.25, pan1: 0.25, wet: 0.35 });
        this.bell(climb, t + 0.18, { gain: 0.07, decay: 1.2, wet: 0.5 });
        break;
      case "travel":
        this.travel(t, o.dur ?? 1.5);
        break;
      case "zone": {
        const notes = [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.B5, NOTE.D6, NOTE.A6];
        this.bell(notes[clamp(i, 0, notes.length - 1)], t, { gain: 0.055, decay: 2.2, wet: 0.65 });
        break;
      }
      case "gate":
        this.gate(t, o.kind ?? "gate", i > 0);
        break;
      case "request":
        this.request(t);
        break;
      case "incident":
        this.incident(t);
        break;
    }
  }

  /** The send-a-request sequence, in step with the hero guide and the 3D packet (the same clock: REQUEST_TRAVEL_SECONDS). */
  private request(t: number) {
    const T = REQUEST_TRAVEL_SECONDS;
    // Press and launch.
    this.tone(220, t, 0.18, { type: "triangle", gain: 0.07, end: 523, wet: 0.2 });
    this.tone(110, t, 0.3, { gain: 0.16, end: 48 });
    this.whoosh(t, 0.8, 320, 3400, { gain: 0.15, q: 1.1, pan0: -0.15, pan1: 0.25, wet: 0.3 });
    // The journey: a stream of air and a low hum that climbs.
    this.whoosh(t + 0.4, T - 0.6, 600, 2600, { gain: 0.055, q: 0.7, pan0: 0.2, pan1: -0.15, wet: 0.4, peakAt: 0.55 });
    this.tone(196, t + 0.1, T - 0.3, { type: "triangle", gain: 0.035, end: 392, attack: 1.2, wet: 0.5, cutoff: 900 });
    // One note for each stage it passes (the hero guide lights the same five, at the same moments).
    for (let k = 0; k < 5; k++) {
      const at = t + (k / 5) * T;
      this.bell(CLIMB[k], at, { gain: 0.1, decay: 1.2, wet: 0.5, pan: -0.4 + k * 0.2 });
      this.tone(CLIMB[k] * 2, at, 0.04, { gain: 0.02, wet: 0.2 });
    }
    // It arrives: "200 OK", a bright chord rising to the top, with a low swell under it.
    const end = t + T;
    [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.D6].forEach((f, k) => this.bell(f, end + k * 0.07, { gain: 0.11, decay: 2.2, wet: 0.6 }));
    this.bell(NOTE.A6, end + 0.3, { gain: 0.045, decay: 2.4, wet: 0.7 });
    this.tone(NOTE.D3, end, 1.8, { gain: 0.07, attack: 0.3, wet: 0.6, cutoff: 800 });
    this.tone(NOTE.A3, end, 1.8, { gain: 0.05, attack: 0.3, wet: 0.6, cutoff: 800 });
  }

  /** The incident sequence in the Stack: an alert, a hold, a reroute, a restart, and back to nominal (timed with INCIDENT_TIMING). */
  private incident(t: number) {
    const I = INCIDENT_TIMING;
    this.tone(NOTE.E4, t + I.alert, 0.2, { type: "triangle", gain: 0.08, cutoff: 1800, wet: 0.3 });
    this.tone(NOTE.E4, t + I.alert + 0.26, 0.2, { type: "triangle", gain: 0.08, cutoff: 1800, wet: 0.3 });
    this.tone(NOTE.B3, t + I.alert, I.reroute - I.alert, { gain: 0.05, attack: 0.4, wet: 0.5, cutoff: 700 });
    this.whoosh(t + I.reroute, 0.9, 500, 2800, { gain: 0.08, pan0: -0.4, pan1: 0.4, wet: 0.4 });
    this.bell(NOTE.A4, t + I.reroute + 0.1, { gain: 0.07, decay: 1.2 });
    this.bell(NOTE.D5, t + I.reroute + 0.3, { gain: 0.07, decay: 1.4 });
    [NOTE.D4, NOTE.Fs4, NOTE.A4].forEach((f, k) => this.bell(f, t + I.restart + k * 0.14, { gain: 0.07, decay: 1.2, wet: 0.5 }));
    [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.D6].forEach((f, k) => this.bell(f, t + I.nominal + k * 0.06, { gain: 0.09, decay: 2.2, wet: 0.6 }));
  }

  /** Travelling along the route to a section a link jumped to: a rush that builds and dies away as the move eases in and out. */
  private travel(t: number, dur: number) {
    const d = clamp(dur, 0.9, 3.2);
    this.whoosh(t, d, 160, 260, { gain: 0.1, mid: 2400, q: 0.8, pan0: -0.5, pan1: 0.5, wet: 0.35, peakAt: 0.5 });
    this.tone(110, t, d, { type: "triangle", gain: 0.03, end: 220, attack: d * 0.45, wet: 0.5, cutoff: 700 });
    this.bell(NOTE.D5, t + d * 0.9, { gain: 0.045, decay: 1.6, wet: 0.6 });
  }

  /** Flying through a gate: a short rush past, and a chime in the gate's own colour (the CI gates amber and softer, the CD gates green and brighter). */
  private gate(t: number, kind: string, forward: boolean) {
    const k = forward ? 1 : 0.6;
    this.whoosh(t, 0.5, 600, 2600, { gain: 0.085 * k, q: 1, pan0: -0.6, pan1: 0.6, wet: 0.3 });
    if (kind === "gate") {
      this.bell(NOTE.D4, t + 0.08, { gain: 0.06 * k, decay: 2.0, wet: 0.6 });
      this.bell(NOTE.A4, t + 0.2, { gain: 0.05 * k, decay: 2.2, wet: 0.6 });
    } else if (kind === "ci") {
      this.bell(NOTE.A4, t + 0.08, { gain: 0.055 * k, decay: 1.3, wet: 0.5 });
      this.bell(NOTE.E5, t + 0.2, { gain: 0.045 * k, decay: 1.5, wet: 0.5 });
    } else {
      [NOTE.D5, NOTE.A5, NOTE.D6].forEach((f, n) => this.bell(f, t + 0.08 + n * 0.09, { gain: 0.05 * k, decay: 1.6, wet: 0.55 }));
    }
  }

  // ---- the clock ---------------------------------------------------------------------------------------------------------------------

  /** Called about twenty times a second by the controller while sound is on: follows the journey, the helicopter and the ambient life. */
  update(nowMs: number) {
    const ctx = this.ctx;
    if (!this.active || !ctx || ctx.state !== "running" || !this.pad || !this.bed || !this.heli || !this.visible) return;
    const s = audioScene;
    const sceneOn = s.frameAt > 0; // the 3D world has drawn at least once (the static page never does: no pad, no air, no helicopter)
    const fresh = sceneOn && nowMs - s.frameAt < 9000;
    const speed = motionState.speed;
    const u = s.u;
    const zone = clamp(Math.round(u), 0, CHORDS.length - 1);

    if (sceneOn) {
      if (!this.padOn) {
        this.padOn = true;
        this.pad.start();
        this.pad.setChord(CHORDS[zone]);
        this.lastZone = zone;
        this.lastU = u;
      }
      if (zone !== this.lastZone) {
        this.pad.setChord(CHORDS[zone]);
        if (fresh) this.cue("zone", zone);
        this.lastZone = zone;
      }
      for (const g of GATES) if (crossed(this.lastU, u, g.u)) this.cue("gate", u > this.lastU ? 1 : 0, { kind: g.kind });
      this.lastU = u;
      this.pad.setBrightness(padBrightness(zone, speed));
      const b = bedMix(u, speed);
      this.bed.set(b.freq, fresh ? b.gain : 0);
    }

    // The helicopter, heard from the camera: it fades away by itself once the world has stopped drawing (a still page does not drone).
    const h = s.heli;
    const stale = clamp((nowMs - h.at - 5000) / 2500, 0, 1);
    const dt = this.lastDistAt ? (nowMs - this.lastDistAt) / 1000 : 0;
    if (dt > 0.01) {
      this.radial += ((h.dist - this.lastDist) / dt - this.radial) * 0.35;
      this.lastDist = h.dist;
      this.lastDistAt = nowMs;
    } else if (!this.lastDistAt) {
      this.lastDist = h.dist;
      this.lastDistAt = nowMs;
    }
    const spool = h.on ? h.spool * (1 - stale) : 0;
    const thrust = clamp(0.45 + 0.4 * h.rise + 0.15 * Math.min(1, h.speed / 1.2), 0, 1); // the rotor bites harder as it lifts and in fast flight
    this.heli.update(heliMix(h.dist, spool, this.radial, thrust), h.pan);

    if (fresh) this.ambient(nowMs, u);
  }

  /** Life in the places: cars passing in the city, couriers handing over in Deployments, a sonar ping from the beacon. Only while the world is drawing. */
  private ambient(nowMs: number, u: number) {
    const n = this.next;
    if (u > 1.3 && u < 3.0 && nowMs >= n.car) {
      n.car = nowMs + 2500 + Math.random() * 3500;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const t = this.ctx!.currentTime;
      this.whoosh(t, 0.9, dir > 0 ? 220 : 700, dir > 0 ? 700 : 220, { gain: 0.04, q: 0.6, pan0: -0.8 * dir, pan1: 0.8 * dir, wet: 0.3, peakAt: 0.5 });
    }
    if (u > 2.6 && u < 3.9 && stationsState.weight < 0.5 && nowMs >= n.courier) {
      n.courier = nowMs + 700 + Math.random() * 1400;
      const f = [NOTE.D6, NOTE.E6, NOTE.Fs6, NOTE.A6][Math.floor(Math.random() * 4)];
      this.bell(f, this.ctx!.currentTime, { gain: 0.03, decay: 0.55, wet: 0.55, pan: Math.random() * 1.4 - 0.7 });
    }
    if (u > 4.3 && nowMs >= n.ping) {
      n.ping = nowMs + 1500;
      n.pings++;
      const t = this.ctx!.currentTime;
      this.bell(NOTE.D4, t, { gain: 0.055, decay: 2.4, wet: 0.8 });
      if (n.pings % 4 === 0) this.bell(NOTE.D6, t + 0.05, { gain: 0.02, decay: 2.2, wet: 0.8, pan: 0.4 });
    }
  }
}

/** The one engine. Built lazily: nothing is created until sound is turned on. */
export const engine = new SoundEngine();
