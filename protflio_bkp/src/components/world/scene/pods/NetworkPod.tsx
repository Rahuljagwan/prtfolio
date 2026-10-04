"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Group, type Mesh, MeshBasicMaterial, Vector3 } from "three";
import type { RigShared } from "../RigDriver";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, smooth, usePodStage, type PodShared } from "./usePodStage";

// The people: an employee at the centre, the people an HR request goes through, and teammates around them.
// Positions are normalised (x -1..1 across the window, y -1..1 down its height); z is a little depth for parallax.
interface Person {
  x: number;
  y: number;
  z: number;
  /** Size of the person glyph relative to a teammate-sized 1. */
  s: number;
}
const PEOPLE: Person[] = [
  { x: 0, y: 0, z: 0, s: 1.35 }, //        0 employee
  { x: -0.5, y: 0.5, z: 0.06, s: 1.05 }, // 1 manager
  { x: 0.45, y: 0.5, z: 0.06, s: 1.05 }, // 2 HR partner
  { x: 0.82, y: -0.12, z: 0.03, s: 1.05 }, // 3 payroll / approver
  { x: -0.86, y: -0.08, z: -0.05, s: 0.82 }, // 4 teammate
  { x: -0.4, y: -0.56, z: -0.08, s: 0.82 }, //  5 teammate
  { x: 0.36, y: -0.56, z: -0.08, s: 0.82 }, //  6 teammate
];
/** The request's route: employee -> manager -> HR -> payroll -> back to the employee (a closed loop = resolved). */
const PATH = [0, 1, 2, 3, 0];
/** Relationships. The first four are the route; the rest are the wider team the request does not touch. */
const EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [0, 4],
  [0, 5],
  [0, 6],
  [1, 4],
  [5, 6],
];
const ROUTE_EDGES = 4;

const CYCLE = 7.2; // seconds per run
const START = 0.7; // the employee raises the request, then it starts to move
const SEG = 1.15; // seconds per hop
const MOVE = 0.7; // fraction of a hop spent travelling; the rest is a dwell where the person takes it in
const ARRIVE = [0.25, ...Array.from({ length: 4 }, (_, k) => START + k * SEG + SEG * MOVE)]; // when each route stop is reached (last = back at the employee)
const RESOLVED_AT = ARRIVE[4];

const COLORS = {
  dark: { dim: "#7b6f99", lit: "#ff9f6b", ring: "#ffb999", packet: "#fff1e6", edge: "#5b4f7e", resolved: "#7be6c0" },
  light: { dim: "#cbc2d8", lit: "#e0762f", ring: "#f0a06a", packet: "#b4431a", edge: "#d6cbe2", resolved: "#2b9c90" },
};

/** Route position (0 = employee, 4 = back at the employee) at time t within the cycle. Eases in and out of every hop. */
function pathAt(t: number) {
  if (t <= START) return 0;
  const q = Math.min(t - START, 4 * SEG);
  if (q >= 4 * SEG) return 4;
  const s = Math.floor(q / SEG);
  const f = (q - s * SEG) / SEG;
  return s + easeInOutCubic(clamp01(f / MOVE));
}

const mat = () => new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });

/**
 * Pod for the HR management project: people and the relationships between them. An employee raises a request; it travels
 * the real chain (manager, HR, payroll) and comes back. Each person it reaches lights up and answers with a soft ripple,
 * and the route glows behind it. When the loop closes, a thin ring settles around the employee: resolved, no burst.
 * The rest of the team stays quietly in the picture. Same interaction language as the other pods: eased motion, 1.5x
 * while hovered, pointer parallax, and it only uses basic materials (no extra shader programs).
 */
export function NetworkPod({ index, dark, shared, pod }: { index: number; dark: boolean; shared: MutableRefObject<RigShared>; pod: PodShared }) {
  const { group, ctl } = usePodStage(index, shared, pod);
  const inner = useRef<Group>(null);
  const people = useRef<(Group | null)[]>([]);
  const edgeMeshes = useRef<(Mesh | null)[]>([]);
  const litMeshes = useRef<(Mesh | null)[]>([]);
  const ripples = useRef<(Mesh | null)[]>([]);
  const backdrop = useRef<(Mesh | null)[]>([]);
  const resolved = useRef<Mesh>(null);
  const packet = useRef<Group>(null);
  const trail = useRef<(Mesh | null)[]>([]);
  const clock = useRef(0);

  const m = useMemo(
    () => ({
      people: PEOPLE.map(mat),
      halos: PEOPLE.map(mat),
      edges: EDGES.map(mat),
      lit: Array.from({ length: ROUTE_EDGES }, mat),
      ripples: Array.from({ length: 4 }, mat),
      backdrop: [mat(), mat()],
      resolved: mat(),
      packet: mat(),
      glow: mat(),
      trail: mat(),
    }),
    [],
  );

  // Mark the card as having a pod, so CSS clears the cover and card background and the pod shows through.
  useEffect(() => {
    const el = document.querySelectorAll<HTMLElement>("[data-pod-stage]")[index];
    el?.setAttribute("data-pod", "on");
    return () => el?.removeAttribute("data-pod");
  }, [index]);

  useEffect(() => {
    const C = dark ? COLORS.dark : COLORS.light;
    m.people.forEach((x) => x.color.set(C.dim));
    m.halos.forEach((x) => x.color.set(C.ring));
    m.edges.forEach((x) => x.color.set(C.edge));
    m.lit.forEach((x) => x.color.set(C.lit));
    m.ripples.forEach((x) => x.color.set(C.lit));
    m.backdrop.forEach((x) => x.color.set(C.edge));
    m.resolved.color.set(C.resolved);
    m.packet.color.set(C.packet);
    m.glow.color.set(C.lit);
    m.trail.color.set(C.lit);
  }, [dark, m]);

  useEffect(
    () => () => {
      Object.values(m).forEach((v) => (Array.isArray(v) ? v.forEach((x) => x.dispose()) : v.dispose()));
    },
    [m],
  );

  const dimColor = useMemo(() => new Color(), []);
  const litColor = useMemo(() => new Color(), []);
  const pos = useMemo(() => PEOPLE.map(() => new Vector3()), []);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_, delta) => {
    const c = ctl.current;
    const g = group.current;
    if (!g?.visible) return;
    const dt = Math.min(delta, 0.05);
    const C = dark ? COLORS.dark : COLORS.light;
    dimColor.set(C.dim);
    litColor.set(C.lit);

    clock.current += dt * (1 + c.hover * 0.5); // 1.5x while hovered
    const tc = clock.current % CYCLE;
    const a = c.intro * c.dim; // overall opacity
    const fadeOut = 1 - smooth((tc - 6.5) / 0.6); // the whole run dims before it restarts
    const A = c.aspect;
    const edgeIn = clamp01(c.intro * 1.7 - 0.55); // relationships draw in after the people have appeared

    // Gentle tilt and pointer parallax. Flatter than the pipeline pod: people glyphs read best nearly face-on.
    const inr = inner.current;
    if (inr) {
      inr.rotation.y = Math.sin(c.time * 0.45) * 0.08 + pod.pointer.current.x * (0.14 + c.hover * 0.1);
      inr.rotation.x = -0.1 + pod.pointer.current.y * 0.06;
      inr.position.y = 0.04 + (1 - c.intro) * -0.6;
    }

    // Where everyone is this frame: spread across the window's width, with a slow individual drift.
    PEOPLE.forEach((p, i) => pos[i].set(p.x * A * 1.05, p.y * 1.25 + Math.sin(c.time * 0.6 + i * 1.7) * 0.022, p.z));

    // Soft rings behind everything: the wider organisation the request lives in.
    backdrop.current.forEach((r, k) => {
      if (!r) return;
      const s = k === 0 ? 0.62 : 1.02;
      r.scale.set(A * s * 1.05, s * 1.25, 1);
      m.backdrop[k].opacity = (k === 0 ? 0.2 : 0.11) * a;
    });

    // Relationships. Route edges get a bright overlay that grows behind the request.
    const P = pathAt(tc);
    EDGES.forEach(([ai, bi], j) => {
      const pa = pos[ai];
      const pb = pos[bi];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const route = j < ROUTE_EDGES;
      const e = edgeMeshes.current[j];
      if (e) {
        e.position.set((pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2);
        e.rotation.z = ang;
        e.scale.set(len, route ? 0.03 : 0.02, 1);
        m.edges[j].opacity = (route ? 0.6 : 0.36) * a * edgeIn;
      }
      const l = route ? litMeshes.current[j] : null;
      if (l) {
        const prog = clamp01(P - j);
        const ll = Math.max(0.0001, len * prog);
        l.position.set(pa.x + (dx / len) * (ll / 2), pa.y + (dy / len) * (ll / 2), pa.z + 0.01);
        l.rotation.z = ang;
        l.scale.set(ll, 0.05, 1);
        m.lit[j].opacity = prog > 0 ? a * fadeOut : 0;
      }
    });

    // People: appear one by one, light up when the request reaches them, answer with a small ripple.
    PEOPLE.forEach((p, i) => {
      const grp = people.current[i];
      if (!grp) return;
      const onRoute = i < 4;
      const age = onRoute ? tc - ARRIVE[i] : -1;
      const lit = onRoute ? smooth((age + 0.1) / 0.3) * fadeOut : 0;
      const pop = onRoute && age > 0 && age < 0.45 ? Math.sin((age / 0.45) * Math.PI) * 0.18 : 0;
      const appear = easeOutBack(clamp01(c.intro * 1.5 - i * 0.1));
      grp.position.copy(pos[i]);
      grp.scale.setScalar(Math.max(0.0001, appear) * p.s * (1 + lit * 0.1 + pop));
      m.people[i].color.copy(dimColor).lerp(litColor, lit);
      m.people[i].opacity = a * (onRoute ? 1 : 0.85);
      m.halos[i].opacity = (0.22 + lit * 0.5) * a * (dark ? 1 : 0.72);
    });
    ripples.current.forEach((r, k) => {
      const grp = people.current[k];
      if (!r || !grp) return;
      const age = tc - ARRIVE[k];
      const sp = age > 0 ? clamp01(age / 0.85) : 1;
      r.position.copy(pos[k]);
      r.scale.setScalar(PEOPLE[k].s * 0.27 * (1 + easeOutCubic(sp) * 0.95));
      m.ripples[k].opacity = age > 0 && sp < 1 ? (1 - sp) * (1 - sp) * 0.5 * a : 0;
    });

    // Resolution: when the request is back, a thin ring settles around the employee and stays until the run fades.
    const rs = resolved.current;
    if (rs) {
      const age = tc - RESOLVED_AT;
      const k = clamp01(age / 0.55);
      rs.position.copy(pos[0]);
      rs.scale.setScalar(PEOPLE[0].s * 0.27 * (0.8 + easeOutCubic(k) * 0.42));
      m.resolved.opacity = age > 0 ? 0.8 * smooth(age / 0.3) * a * fadeOut : 0;
    }

    // The request itself, and a short fading trail behind it.
    const posAt = (t: number, out: Vector3) => {
      const p = pathAt(t);
      const k = Math.min(3, Math.floor(p));
      const f = p - k;
      const pa = pos[PATH[k]];
      const pb = pos[PATH[k + 1]];
      return out.set(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f, Math.max(pa.z, pb.z) + Math.sin(f * Math.PI) * 0.12 + 0.05);
    };
    const packetScale = smooth((tc - 0.3) / 0.25) * (1 - smooth((tc - RESOLVED_AT - 0.05) / 0.25));
    if (packet.current) {
      posAt(tc, tmp);
      packet.current.position.copy(tmp);
      packet.current.scale.setScalar(Math.max(0.0001, packetScale) * (1 + c.hover * 0.2));
    }
    m.packet.opacity = a;
    m.glow.opacity = 0.26 * a;
    m.trail.opacity = 0.5 * a;
    trail.current.forEach((t, k) => {
      if (!t) return;
      posAt(tc - (k + 1) * 0.07, tmp);
      t.position.copy(tmp);
      t.scale.setScalar(Math.max(0.0001, 0.06 * (1 - k / 4) * packetScale));
    });
  });

  return (
    <group ref={group} visible={false}>
      <group ref={inner}>
        {/* The wider organisation: two faint rings the people sit inside, at the back for depth */}
        {m.backdrop.map((mt, k) => (
          <mesh key={k} ref={(el) => void (backdrop.current[k] = el)} position={[0, 0, -0.3]} renderOrder={1000} material={mt}>
            <torusGeometry args={[1, 0.012, 6, 96]} />
          </mesh>
        ))}

        {/* Relationships, and the route glowing on top of them */}
        {EDGES.map((_, j) => (
          <mesh key={j} ref={(el) => void (edgeMeshes.current[j] = el)} renderOrder={1001} material={m.edges[j]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
        {Array.from({ length: ROUTE_EDGES }, (_, j) => (
          <mesh key={j} ref={(el) => void (litMeshes.current[j] = el)} renderOrder={1002} material={m.lit[j]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}

        {/* Ripples the route stops answer with */}
        {m.ripples.map((mt, k) => (
          <mesh key={k} ref={(el) => void (ripples.current[k] = el)} renderOrder={1003} material={mt}>
            <torusGeometry args={[1, 0.04, 6, 56]} />
          </mesh>
        ))}
        <mesh ref={resolved} renderOrder={1003} material={m.resolved}>
          <torusGeometry args={[1, dark ? 0.045 : 0.032, 6, 64]} />
        </mesh>

        {/* People: a head and shoulders each, with a thin halo */}
        {PEOPLE.map((_, i) => (
          <group key={i} ref={(el) => void (people.current[i] = el)}>
            <mesh renderOrder={1003} material={m.halos[i]}>
              <torusGeometry args={[0.27, dark ? 0.012 : 0.009, 6, 48]} />
            </mesh>
            <mesh position={[0, 0.115, 0.01]} scale={0.085} renderOrder={1004} material={m.people[i]}>
              <circleGeometry args={[1, 28]} />
            </mesh>
            <mesh position={[0, -0.13, 0]} scale={0.17} renderOrder={1004} material={m.people[i]}>
              <circleGeometry args={[1, 28, 0, Math.PI]} />
            </mesh>
          </group>
        ))}

        {/* The request and its trail */}
        {Array.from({ length: 4 }, (_, k) => (
          <mesh key={k} ref={(el) => void (trail.current[k] = el)} renderOrder={1006} material={m.trail}>
            <circleGeometry args={[1, 16]} />
          </mesh>
        ))}
        <group ref={packet}>
          <mesh renderOrder={1007} material={m.glow}>
            <circleGeometry args={[0.24, 20]} />
          </mesh>
          <mesh renderOrder={1008} material={m.packet}>
            <circleGeometry args={[0.085, 20]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
