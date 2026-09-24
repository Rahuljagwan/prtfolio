"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, type Group, type Mesh, MeshBasicMaterial, Vector3 } from "three";
import type { RigShared } from "../RigDriver";
import { clamp01, easeInOutCubic, easeOutCubic, smooth, usePodStage, type PodShared } from "./usePodStage";

const SLABS = 4;
const HOPS = 5; // lock -> slab0 -> slab1 -> slab2 -> slab3 -> lock

const CYCLE = 7.4;
const START = 0.55; // the lock starts swinging open almost immediately
const SEG = 0.85; // seconds per hop
const MOVE = 0.7; // fraction of a hop spent travelling; the rest is a dwell where the slab is read
const LOCK_OPEN_AT = 0.2;
// One arrival time per stop the marker visits (lock-open, then each slab), plus the final hop back to the lock (closed).
const ARRIVE = [LOCK_OPEN_AT, ...Array.from({ length: 4 }, (_, k) => START + k * SEG + SEG * MOVE)];
const RESOLVED_AT = START + 4 * SEG + SEG * MOVE; // the shackle closes

// Green family (the world's own "healthy/steady" colour -- the 3D Stack zone already uses this same hue for its DB
// Vault), not the purple/magenta this pod used before the palette lock: nothing on this site is pink.
const COLORS = {
  dark: { dim: "#3f5f4e", lit: "#34e08a", ring: "#7dfab5", packet: "#eafff2", track: "#274536", tab: "#4f8a6d" },
  light: { dim: "#c3ded0", lit: "#0e6b48", ring: "#128057", packet: "#08402b", track: "#dceee4", tab: "#5b9678" },
};

/** Path position (0 = lock, HOPS = back at the lock) at time t within the cycle. Eases in and out of every hop. */
function pathAt(t: number) {
  if (t <= START) return 0;
  const q = Math.min(t - START, HOPS * SEG);
  if (q >= HOPS * SEG) return HOPS;
  const s = Math.floor(q / SEG);
  const f = (q - s * SEG) / SEG;
  return s + easeInOutCubic(clamp01(f / MOVE));
}

const mat = () => new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });

/**
 * Pod for the document custody project: a vault. Documents sit stacked below a lock; it swings open, a custody marker
 * travels down through the stack scanning each one (the trail behind it stays lit, a literal record of what was checked),
 * then returns to the lock, which swings shut. That close is the whole payoff: no burst, just secured. Same interaction
 * language as the other pods (eased motion, 1.5x on hover, pointer parallax), only basic materials.
 */
export function VaultPod({ stageKey, dark, shared, pod }: { stageKey: string; dark: boolean; shared: MutableRefObject<RigShared>; pod: PodShared }) {
  const { group, ctl } = usePodStage(stageKey, shared, pod);
  const inner = useRef<Group>(null);
  const slabs = useRef<(Mesh | null)[]>([]);
  const tabs = useRef<(Mesh | null)[]>([]);
  const scans = useRef<(Mesh | null)[]>([]);
  const segments = useRef<(Mesh | null)[]>([]);
  const lockBody = useRef<Mesh>(null);
  const shackle = useRef<Group>(null);
  const glow = useRef<Mesh>(null);
  const marker = useRef<Group>(null);
  const trail = useRef<(Mesh | null)[]>([]);
  const clock = useRef(0);

  const m = useMemo(
    () => ({
      slabs: Array.from({ length: SLABS }, mat),
      tabs: Array.from({ length: SLABS }, mat),
      scans: Array.from({ length: SLABS }, mat),
      segments: Array.from({ length: SLABS }, mat),
      lockBody: mat(),
      shackle: mat(),
      keyhole: mat(),
      glow: mat(),
      packet: mat(),
      halo: mat(),
      trail: mat(),
    }),
    [],
  );


  useEffect(() => {
    const C = dark ? COLORS.dark : COLORS.light;
    m.slabs.forEach((x) => x.color.set(C.dim));
    m.tabs.forEach((x) => x.color.set(C.tab));
    m.scans.forEach((x) => x.color.set(C.lit));
    m.segments.forEach((x) => x.color.set(C.lit));
    m.lockBody.color.set(C.track);
    m.shackle.color.set(C.ring);
    m.keyhole.color.set(C.dim);
    m.glow.color.set(C.ring);
    m.packet.color.set(C.packet);
    m.halo.color.set(C.lit);
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
  const pos = useMemo(() => Array.from({ length: SLABS + 1 }, () => new Vector3()), []); // 0 = lock, 1..4 = slabs
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
    const fadeOut = 1 - smooth((tc - 6.6) / 0.7); // the whole run dims before it restarts
    const A = c.aspect;

    // Gentle tilt and pointer parallax.
    const inr = inner.current;
    if (inr) {
      inr.rotation.y = Math.sin(c.time * 0.4) * 0.07 + pod.pointer.current.x * (0.14 + c.hover * 0.1);
      inr.rotation.x = -0.08 + pod.pointer.current.y * 0.05;
      inr.position.y = 0.02 + (1 - c.intro) * -0.55;
    }

    // Layout: the lock at the top, four slabs stacked below it, fanned slightly left/right like a loose pile.
    const SW = A * 0.5;
    pos[0].set(0, 0.62, 0);
    for (let i = 0; i < SLABS; i++) pos[i + 1].set((i % 2 === 0 ? -0.05 : 0.05) * A, 0.3 - i * 0.29, -i * 0.015);

    // Custody trail: the segment between consecutive stops lights up once the marker has passed it, and stays lit.
    const P = pathAt(tc);
    for (let j = 0; j < SLABS; j++) {
      const s = segments.current[j];
      if (!s) continue;
      const pa = pos[j];
      const pb = pos[j + 1];
      const len = pa.distanceTo(pb);
      const prog = clamp01(P - j);
      const ll = Math.max(0.0001, len * prog);
      s.position.set(pa.x + ((pb.x - pa.x) / len) * (ll / 2), pa.y + ((pb.y - pa.y) / len) * (ll / 2), pa.z);
      s.rotation.z = Math.atan2(pb.y - pa.y, pb.x - pa.x) - Math.PI / 2;
      s.scale.set(0.03, ll, 1);
      m.segments[j].opacity = prog > 0 ? a * fadeOut : 0;
    }

    // Slabs: appear one under another, brighten and get a scan sweep when the marker reaches them.
    for (let i = 0; i < SLABS; i++) {
      const body = slabs.current[i];
      const tab = tabs.current[i];
      if (!body || !tab) continue;
      const appear = easeOutCubic(clamp01(c.intro * 1.6 - i * 0.12));
      const age = tc - ARRIVE[i + 1];
      const lit = smooth((age + 0.1) / 0.3) * fadeOut;
      const p = pos[i + 1];
      body.position.set(p.x, p.y, p.z);
      body.scale.set(Math.max(0.0001, appear) * SW, Math.max(0.0001, appear) * 0.22, 1);
      m.slabs[i].color.copy(dimColor).lerp(litColor, lit);
      m.slabs[i].opacity = a;
      tab.position.set(p.x - SW * 0.32, p.y + 0.14, p.z + 0.01);
      tab.scale.set(Math.max(0.0001, appear) * SW * 0.26, Math.max(0.0001, appear) * 0.09, 1);
      m.tabs[i].opacity = 0.85 * a;

      // Scan sweep: a bright bar crosses the slab once, right after arrival.
      const scan = scans.current[i];
      if (scan) {
        const sp = clamp01(age / 0.4);
        scan.position.set(p.x - SW / 2 + SW * sp, p.y, p.z + 0.02);
        scan.scale.set(0.04 * SW, 0.2, 1);
        m.scans[i].opacity = age > 0 && sp < 1 ? (1 - sp) * a : 0;
      }
    }

    // The lock: the shackle swings open near the start of the run and clicks shut once the marker is back.
    const openK = clamp01((tc - LOCK_OPEN_AT) / 0.4);
    const closeK = tc > RESOLVED_AT ? clamp01((tc - RESOLVED_AT) / 0.35) : 0;
    const swing = easeOutCubic(openK) * (1 - easeOutCubic(closeK)); // 0 = closed, 1 = fully open
    if (lockBody.current) {
      lockBody.current.position.copy(pos[0]);
      lockBody.current.scale.set(0.3, 0.24, 1);
      m.lockBody.opacity = a;
    }
    const sh = shackle.current;
    if (sh) {
      sh.position.set(pos[0].x, pos[0].y + 0.17, pos[0].z + 0.01);
      sh.rotation.z = -swing * 0.55;
      m.shackle.opacity = a;
      m.keyhole.opacity = a;
    }
    const gl = glow.current;
    if (gl) {
      gl.position.copy(pos[0]);
      const pulse = closeK > 0 && closeK < 1 ? Math.sin(closeK * Math.PI) : 0;
      gl.scale.setScalar(0.4 + pulse * 0.22);
      m.glow.opacity = 0.22 * pulse * a * fadeOut;
    }

    // The marker itself, and a short fading trail behind it. p runs the whole path (0 = lock, HOPS = back at the lock);
    // pos[k] is always valid for k in 0..HOPS-1 (index 0 is the lock, 1..SLABS are the slabs), and the final hop
    // (k = HOPS-1) returns to the lock at pos[0], which is why pb falls back to pos[0] once k passes the last slab.
    const posAt = (t: number, out: Vector3) => {
      const p = pathAt(t);
      const k = Math.min(HOPS - 1, Math.floor(p));
      const f = clamp01(p - k);
      const pa = pos[k];
      const pb = k + 1 <= SLABS ? pos[k + 1] : pos[0];
      return out.set(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f, Math.max(pa.z, pb.z) + 0.06);
    };
    const packetScale = smooth((tc - LOCK_OPEN_AT - 0.1) / 0.25) * (1 - smooth((tc - RESOLVED_AT - 0.05) / 0.25));
    if (marker.current) {
      posAt(tc, tmp);
      marker.current.position.copy(tmp);
      marker.current.scale.setScalar(Math.max(0.0001, packetScale) * (1 + c.hover * 0.2));
    }
    m.packet.opacity = a;
    m.halo.opacity = 0.26 * a;
    m.trail.opacity = 0.5 * a;
    trail.current.forEach((t, k) => {
      if (!t) return;
      posAt(tc - (k + 1) * 0.07, tmp);
      t.position.copy(tmp);
      t.scale.setScalar(Math.max(0.0001, 0.055 * (1 - k / 4) * packetScale));
    });
  });

  return (
    <group ref={group} visible={false}>
      <group ref={inner}>
        {/* Custody trail: lights up behind the marker as it visits each slab, and stays lit. */}
        {Array.from({ length: SLABS }, (_, j) => (
          <mesh key={j} ref={(el) => void (segments.current[j] = el)} renderOrder={1000} material={m.segments[j]}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}

        {/* Document slabs, each with a folder tab and a one-off scan sweep on arrival. */}
        {Array.from({ length: SLABS }, (_, i) => (
          <group key={i}>
            <mesh ref={(el) => void (slabs.current[i] = el)} renderOrder={1001} material={m.slabs[i]}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={(el) => void (tabs.current[i] = el)} renderOrder={1002} material={m.tabs[i]}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={(el) => void (scans.current[i] = el)} renderOrder={1003} material={m.scans[i]}>
              <planeGeometry args={[1, 1]} />
            </mesh>
          </group>
        ))}

        {/* The lock: body, keyhole, and a shackle that swings open then clicks shut. */}
        <mesh ref={lockBody} renderOrder={1002} material={m.lockBody}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh position={[0, 0.62, 0.02]} scale={0.045} renderOrder={1004} material={m.keyhole}>
          <circleGeometry args={[1, 16]} />
        </mesh>
        <group ref={shackle}>
          <mesh renderOrder={1004} material={m.shackle}>
            <torusGeometry args={[0.13, dark ? 0.022 : 0.017, 8, 32, Math.PI]} />
          </mesh>
        </group>
        <mesh ref={glow} renderOrder={999} material={m.glow}>
          <circleGeometry args={[1, 24]} />
        </mesh>

        {/* The custody marker and its trail */}
        {Array.from({ length: 4 }, (_, k) => (
          <mesh key={k} ref={(el) => void (trail.current[k] = el)} renderOrder={1005} material={m.trail}>
            <circleGeometry args={[1, 16]} />
          </mesh>
        ))}
        <group ref={marker}>
          <mesh renderOrder={1006} material={m.halo}>
            <circleGeometry args={[0.22, 18]} />
          </mesh>
          <mesh renderOrder={1007} material={m.packet}>
            <circleGeometry args={[0.075, 18]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
