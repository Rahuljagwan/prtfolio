"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BoxGeometry, BufferGeometry, Color, EdgesGeometry, Float32BufferAttribute, LineBasicMaterial, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type Group } from "three";
import { pointAlong, smooth, type V3 } from "@/lib/world/exhibit-math";
import type { WorldPalette } from "../palette";

// A tiny kit for the per-project 3D schematics on the Projects flight. An exhibit is a small scene made of glass plates,
// thin bars, dots, wires, moving tokens and text tags, animated by a repeating clock. Everything here reads the exhibit's
// shared state (how visible it is, the time, the theme colours) from context, so an exhibit file is just layout and timing.
//
// Conventions: local space is x right, y up, z toward the camera; an exhibit spans about x -2.3..2.3 and y -1.6..1.6.
// Text is real DOM (drei Html), so it stays crisp. Failure/attention tones are amber; red is never used.

export type Lit = (time: number) => number;
export type Tone = "primary" | "accent" | "muted";

interface Colors {
  primary: Color;
  accent: Color;
  muted: Color;
  body: Color;
}

interface ExCtx {
  /** How visible this exhibit is right now, 0 to 1 (the flight weight, dimmed for neighbours). */
  fade: MutableRefObject<number>;
  /** Seconds since the world started. */
  time: MutableRefObject<number>;
  colors: Colors;
}

const Ctx = createContext<ExCtx | null>(null);
function useEx(): ExCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("exhibit primitive used outside <ExhibitRoot>");
  return c;
}

const SPHERE = new SphereGeometry(1, 18, 12);
const PLANE = new PlaneGeometry(1, 1);

const toneColor = (c: Colors, tone: Tone) => (tone === "accent" ? c.accent : tone === "muted" ? c.muted : c.primary);

export interface FlightRef {
  t: number;
  w: number;
}

/**
 * Places an exhibit at its station and decides when it exists. It is mounted (children and all) only while the camera is within
 * about one station of it, so eight exhibits cost the same as two. Neighbours fade to a faint ghost during a hop.
 */
export function ExhibitRoot({ index, position, flight, palette, dark, children }: { index: number; position: V3; flight: MutableRefObject<FlightRef>; palette: WorldPalette; dark: boolean; children: ReactNode }) {
  const group = useRef<Group>(null);
  const [live, setLive] = useState(false);
  const liveRef = useRef(false);
  const fade = useRef(0);
  const time = useRef(0);
  const colors = useMemo<Colors>(() => ({ primary: new Color(), accent: new Color(), muted: new Color(), body: new Color() }), []);

  useEffect(() => {
    colors.primary.set(palette.primary);
    colors.accent.set(palette.accent);
    colors.muted.set(dark ? "#5b6b64" : "#9a9580");
    colors.body.set(dark ? "#122019" : "#fbf8ef");
  }, [palette, dark, colors]);

  const ctx = useMemo<ExCtx>(() => ({ fade, time, colors }), [colors]);

  useFrame((state) => {
    const f = flight.current;
    const d = Math.abs(f.t - index);
    const want = f.w > 0.002 && d < 1.5;
    if (want !== liveRef.current) {
      liveRef.current = want;
      setLive(want);
    }
    fade.current = f.w * smooth(1 - d * 0.8);
    time.current = state.clock.elapsedTime;
    if (group.current) group.current.visible = want;
  });

  return (
    <group ref={group} position={position} visible={false}>
      {/* A slight turn and tilt so the flat schematic reads as an object in the world, and layers at different depths show parallax. */}
      <group rotation={[0.05, -0.15, 0]}>{live && <Ctx.Provider value={ctx}>{children}</Ctx.Provider>}</group>
    </group>
  );
}

/** A glass plate with a thin bright edge. `lit` (0 to 1) brightens it: the edge, the fill and a hint of colour. */
export function Plate({ p, s, d = 0.06, lit, tone = "primary", solid = 1, children }: { p: V3; s: [number, number]; d?: number; lit?: Lit; tone?: Tone; solid?: number; children?: ReactNode }) {
  const ex = useEx();
  const [w, h] = s;
  const box = useMemo(() => new BoxGeometry(w, h, d), [w, h, d]);
  const edges = useMemo(() => new EdgesGeometry(box), [box]);
  const mat = useMemo(() => new MeshStandardMaterial({ flatShading: true, transparent: true, opacity: 0, roughness: 0.85, metalness: 0.06, depthWrite: false }), []);
  const line = useMemo(() => new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(
    () => () => {
      box.dispose();
      edges.dispose();
      mat.dispose();
      line.dispose();
    },
    [box, edges, mat, line],
  );
  useFrame(() => {
    const l = lit ? lit(ex.time.current) : 0;
    const f = ex.fade.current;
    const base = toneColor(ex.colors, tone);
    mat.opacity = f * (0.62 + 0.3 * l) * solid;
    mat.color.copy(ex.colors.body).lerp(base, 0.2 * l);
    line.color.copy(base).multiplyScalar(0.5 + 0.5 * l);
    line.opacity = f * (0.62 + 0.38 * l) * Math.min(1, solid + 0.3);
  });
  return (
    <group position={p}>
      <mesh geometry={box} material={mat} renderOrder={1} />
      <lineSegments geometry={edges} material={line} renderOrder={2} />
      {children}
    </group>
  );
}

/**
 * A flat bar (a line of skeleton content, a progress fill, a chart bar). `anchor` picks the edge that stays put when `grow` (0 to 1)
 * scales it: "left" grows to the right, "bottom" grows upward. `p` is the anchor point.
 */
export function Bar({ p, s, lit, tone = "primary", base = 0.35, extra = 0.55, grow, anchor = "center" }: { p: V3; s: [number, number]; lit?: Lit; tone?: Tone; base?: number; extra?: number; grow?: Lit; anchor?: "center" | "left" | "bottom" }) {
  const ex = useEx();
  const g = useRef<Group>(null);
  const mat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  useFrame(() => {
    const l = lit ? lit(ex.time.current) : 0;
    mat.color.copy(toneColor(ex.colors, tone));
    mat.opacity = ex.fade.current * (base + extra * l);
    if (g.current && grow) {
      const k = Math.max(0.0001, grow(ex.time.current));
      if (anchor === "bottom") g.current.scale.set(1, k, 1);
      else g.current.scale.set(k, 1, 1);
    }
  });
  const off: V3 = anchor === "left" ? [s[0] / 2, 0, 0] : anchor === "bottom" ? [0, s[1] / 2, 0] : [0, 0, 0];
  return (
    <group ref={g} position={p}>
      <mesh geometry={PLANE} material={mat} position={off} scale={[s[0], s[1], 1]} renderOrder={3} />
    </group>
  );
}

/** A small glowing sphere. `halo` adds a soft outer glow. */
export function Dot({ p, r = 0.06, lit, tone = "primary", base = 0.5, halo = false }: { p: V3; r?: number; lit?: Lit; tone?: Tone; base?: number; halo?: boolean }) {
  const ex = useEx();
  const core = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  const glow = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), []);
  useEffect(
    () => () => {
      core.dispose();
      glow.dispose();
    },
    [core, glow],
  );
  useFrame(() => {
    const l = lit ? lit(ex.time.current) : 1;
    const c = toneColor(ex.colors, tone);
    core.color.copy(c);
    glow.color.copy(c);
    core.opacity = ex.fade.current * (base + (1 - base) * l);
    glow.opacity = ex.fade.current * 0.22 * l;
  });
  return (
    <group position={p}>
      <mesh geometry={SPHERE} material={core} scale={r} renderOrder={5} />
      {halo && <mesh geometry={SPHERE} material={glow} scale={r * 2.6} renderOrder={4} />}
    </group>
  );
}

/** A thin line through points. */
export function Wire({ pts, lit, tone = "primary", base = 0.4, extra = 0.45 }: { pts: V3[]; lit?: Lit; tone?: Tone; base?: number; extra?: number }) {
  const ex = useEx();
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    const flat: number[] = [];
    for (let i = 1; i < pts.length; i++) flat.push(...pts[i - 1], ...pts[i]);
    g.setAttribute("position", new Float32BufferAttribute(flat, 3));
    return g;
  }, [pts]);
  const mat = useMemo(() => new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);
  useEffect(
    () => () => {
      geo.dispose();
      mat.dispose();
    },
    [geo, mat],
  );
  useFrame(() => {
    const l = lit ? lit(ex.time.current) : 0;
    mat.color.copy(toneColor(ex.colors, tone));
    mat.opacity = ex.fade.current * (base + extra * l);
  });
  return <lineSegments geometry={geo} material={mat} renderOrder={2} />;
}

/** A group that follows `at(time)`: for tokens that carry other primitives (a dot, a small plate) along a path. */
export function Mover({ at, children }: { at: (time: number) => V3; children: ReactNode }) {
  const ex = useEx();
  const g = useRef<Group>(null);
  useFrame(() => {
    const p = at(ex.time.current);
    g.current?.position.set(p[0], p[1], p[2]);
  });
  return <group ref={g}>{children}</group>;
}

/** A dot travelling along a polyline once per `period` seconds (after `delay`), fading in and out at the ends. */
export function Flow({ pts, period, delay = 0, r = 0.055, tone = "primary" }: { pts: V3[]; period: number; delay?: number; r?: number; tone?: Tone }) {
  const at = (time: number): V3 => pointAlong(pts, (((time - delay) % period) + period) % period / period);
  const u = (time: number) => (((time - delay) % period) + period) % period / period;
  const visible: Lit = (time) => {
    const x = u(time);
    return smooth(x / 0.08) * (1 - smooth((x - 0.92) / 0.08));
  };
  return (
    <Mover at={at}>
      <Dot p={[0, 0, 0]} r={r} tone={tone} lit={visible} base={0} halo />
    </Mover>
  );
}

/**
 * A text label (real DOM, so it is crisp). `align` says which side of the anchor the text sits on. `lit` raises it from its resting
 * brightness (`base`, default 0.82; 0 makes it appear only while lit). The name is small caps; `sub` is a lighter second line. `w` (in rem) makes long text wrap to that width.
 */
export function Tag({ p, name, sub, align = "center", w, lit, base = 0.82 }: { p: V3; name: string; sub?: string; align?: "left" | "center" | "right"; w?: number; lit?: Lit; base?: number }) {
  const ex = useEx();
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (!el.current) return;
    const l = lit ? lit(ex.time.current) : 0;
    const f = ex.fade.current;
    el.current.style.opacity = String(f * f * (base + (1 - base) * l));
  });
  return (
    <group position={p}>
      <Html wrapperClass="pointer-events-none" zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div ref={el} className="ex-tag" data-align={align} style={{ opacity: 0, width: w ? `${w}rem` : undefined }}>
          <span className="ex-tag__name">{name}</span>
          {sub && <span className="ex-tag__sub">{sub}</span>}
        </div>
      </Html>
    </group>
  );
}
