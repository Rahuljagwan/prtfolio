"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, type Group, type InstancedMesh, LineBasicMaterial, Matrix4, MeshBasicMaterial, type Mesh, Quaternion, Vector3 } from "three";
import type { RigShared } from "../RigDriver";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, smooth, usePodStage, type PodShared } from "./usePodStage";

const NODES = 5;
const TRAIL = 7;
const CYCLE = 7.2; // seconds per full run
const START = 0.6; // packet waits at the first node this long
const SEG = 1.35; // seconds per hop between nodes
const MOVE = 0.72; // fraction of a hop spent travelling; the rest is a dwell where the node stamps
const ARRIVE = [0.2, ...Array.from({ length: NODES - 1 }, (_, i) => START + i * SEG + SEG * MOVE)]; // when each node is reached
const GRID_HALF_W = 2.5;

const COLORS = {
  dark: { dim: "#5b70ac", lit: "#5eead4", ring: "#93b8ff", packet: "#eafffb", track: "#41598f", grid: "#6f8bd0" },
  light: { dim: "#b7c1d6", lit: "#2b9c90", ring: "#5a84e6", packet: "#2f5fd0", track: "#b3bdd3", grid: "#7c93c9" },
};

/** Path position (0 = first node, 4 = last) at time t within the cycle. Eases in and out of every hop. */
function pathAt(t: number) {
  if (t <= START) return 0;
  const q = Math.min(t - START, (NODES - 1) * SEG);
  if (q >= (NODES - 1) * SEG) return NODES - 1;
  const s = Math.floor(q / SEG);
  const f = (q - s * SEG) / SEG;
  return s + easeInOutCubic(clamp01(f / MOVE));
}

const mat = () => new MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });

/**
 * Pod for the enterprise workflow project: an approval pipeline. A packet (a request) hops through five stages; every
 * stage it reaches lights up and stamps a ring outward (the audit trail), and the last one bursts and draws a check
 * mark. Then the run fades and starts over. Hovering the card speeds the run up (1.5x). Everything eases; nothing is linear.
 */
export function PipelinePod({ index, dark, shared, pod }: { index: number; dark: boolean; shared: MutableRefObject<RigShared>; pod: PodShared }) {
  const { group, ctl } = usePodStage(index, shared, pod);
  const inner = useRef<Group>(null);
  const nodeGroups = useRef<(Group | null)[]>([]);
  const nodeSolids = useRef<(Mesh | null)[]>([]);
  const stamps = useRef<(Mesh | null)[]>([]);
  const trail = useRef<InstancedMesh>(null);
  const packet = useRef<Group>(null);
  const trackBase = useRef<Mesh>(null);
  const trackDone = useRef<Mesh>(null);
  const gridGroup = useRef<Group>(null);
  const check = useRef<Group>(null);
  const clock = useRef(0);

  const m = useMemo(
    () => ({
      trackBase: mat(),
      trackDone: mat(),
      grid: new LineBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false }),
      nodes: Array.from({ length: NODES }, mat),
      rings: Array.from({ length: NODES }, mat),
      stamps: Array.from({ length: NODES }, mat),
      drops: Array.from({ length: NODES }, mat),
      packet: mat(),
      halo: mat(),
      trail: mat(),
      check: mat(),
    }),
    [],
  );

  const gridGeo = useMemo(() => {
    const pts: number[] = [];
    const y = -0.62;
    for (let z = -1.2; z <= 0.61; z += 0.45) pts.push(-GRID_HALF_W, y, z, GRID_HALF_W, y, z);
    for (let x = -GRID_HALF_W; x <= GRID_HALF_W + 0.01; x += 0.5) pts.push(x, y, -1.2, x, y, 0.6);
    return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
  }, []);

  useEffect(() => () => gridGeo.dispose(), [gridGeo]);

  // Mark the card as having a pod, so CSS clears the cover and card background and the pod shows through.
  useEffect(() => {
    const el = document.querySelectorAll<HTMLElement>("[data-pod-stage]")[index];
    el?.setAttribute("data-pod", "on");
    return () => el?.removeAttribute("data-pod");
  }, [index]);

  useEffect(() => {
    const C = dark ? COLORS.dark : COLORS.light;
    m.trackBase.color.set(C.track);
    m.trackDone.color.set(C.lit);
    m.grid.color.set(C.grid);
    m.nodes.forEach((x) => x.color.set(C.dim));
    m.rings.forEach((x) => x.color.set(C.ring));
    m.stamps.forEach((x) => x.color.set(C.lit));
    m.drops.forEach((x) => x.color.set(C.track));
    m.packet.color.set(C.packet);
    m.halo.color.set(C.lit);
    m.trail.color.set(C.lit);
    m.check.color.set(C.packet);
  }, [dark, m]);

  useEffect(
    () => () => {
      Object.values(m).forEach((v) => (Array.isArray(v) ? v.forEach((x) => x.dispose()) : v.dispose()));
    },
    [m],
  );

  const tmpM = useMemo(() => new Matrix4(), []);
  const tmpQ = useMemo(() => new Quaternion(), []);
  const tmpV = useMemo(() => new Vector3(), []);
  const tmpS = useMemo(() => new Vector3(), []);
  const litColor = useMemo(() => ({ dim: new Color(), lit: new Color() }), []);

  useFrame((_, delta) => {
    const c = ctl.current;
    const g = group.current;
    if (!g?.visible) return;
    const dt = Math.min(delta, 0.05);
    const C = dark ? COLORS.dark : COLORS.light;
    litColor.dim.set(C.dim);
    litColor.lit.set(C.lit);

    clock.current += dt * (1 + c.hover * 0.5); // 1.5x while hovered
    const tc = clock.current % CYCLE;
    const a = c.intro * c.dim; // overall opacity
    const W = c.aspect * 0.82; // fills the window: half-width in pod units is about aspect / 0.86 (see FIT)
    const fadeOut = 1 - smooth((tc - 6.5) / 0.6); // the whole run dims before it restarts

    // Slow tilt and pointer parallax, so the pod reads as an object in space rather than a flat drawing.
    const inr = inner.current;
    if (inr) {
      inr.rotation.y = Math.sin(c.time * 0.5) * 0.1 + pod.pointer.current.x * (0.18 + c.hover * 0.14);
      inr.rotation.x = -0.27 + pod.pointer.current.y * 0.08;
      inr.position.y = 0.15 + (1 - c.intro) * -0.7; // sits slightly high in the window: the floor grid fills the lower part
    }

    // Track: dim base line the full width, bright line following the packet.
    const P = pathAt(tc);
    if (trackBase.current) {
      trackBase.current.scale.set(W * 2, 0.035, 1);
      m.trackBase.opacity = 0.9 * a;
    }
    if (trackDone.current) {
      const len = Math.max(0.0001, (P / (NODES - 1)) * W * 2);
      trackDone.current.scale.set(len, 0.05, 1);
      trackDone.current.position.x = -W + len / 2;
      m.trackDone.opacity = a * fadeOut;
    }
    if (gridGroup.current) gridGroup.current.scale.x = (W + 0.45) / GRID_HALF_W;
    m.grid.opacity = 0.32 * a;

    // Nodes: assemble in one after another, light when reached, pop on arrival, stamp a ring outward.
    for (let i = 0; i < NODES; i++) {
      const ng = nodeGroups.current[i];
      if (!ng) continue;
      const appear = easeOutBack(clamp01(c.intro * 1.5 - i * 0.14));
      const age = tc - ARRIVE[i];
      const lit = smooth((age + 0.1) / 0.3) * fadeOut;
      const pop = age > 0 && age < 0.45 ? Math.sin((age / 0.45) * Math.PI) * 0.28 : 0;
      ng.position.x = -W + (i / (NODES - 1)) * W * 2;
      ng.scale.setScalar(Math.max(0.0001, appear) * (1 + lit * 0.18 + pop));
      const solid = nodeSolids.current[i];
      if (solid) {
        solid.rotation.y += dt * (0.5 + lit * 0.9);
        (solid.material as MeshBasicMaterial).color.copy(litColor.dim).lerp(litColor.lit, lit);
      }
      m.nodes[i].opacity = a;
      m.rings[i].opacity = (0.35 + lit * 0.5) * a * (dark ? 1 : 0.72); // lighter touch on the light theme
      m.drops[i].opacity = 0.5 * a;

      // Stamp ring: expands and fades over ~0.8 s after arrival. The last node's is bigger and slower (the burst).
      const last = i === NODES - 1;
      const dur = last ? 1.1 : 0.8;
      const sp = age > 0 ? clamp01(age / dur) : 1;
      const stamp = stamps.current[i];
      if (stamp) {
        const s = 1 + easeOutCubic(sp) * (last ? 1.2 : 0.9); // largest ring radius 0.36 x 2.2, inside the window
        stamp.scale.setScalar(s);
        m.stamps[i].opacity = age > 0 && sp < 1 ? (1 - sp) * (1 - sp) * (last ? 0.4 : 0.6) * a : 0;
      }
    }

    // Packet and its trail: the trail samples the same easing function a little earlier in time, so it lags naturally.
    const packetScale = smooth((tc - 0.05) / 0.3) * (1 - smooth((tc - ARRIVE[NODES - 1] - 0.05) / 0.3));
    const px = (t: number) => -W + (pathAt(t) / (NODES - 1)) * W * 2;
    const py = (t: number) => Math.sin(Math.PI * (pathAt(t) % 1)) * 0.22;
    if (packet.current) {
      packet.current.position.set(px(tc), py(tc), 0.05);
      packet.current.scale.setScalar(Math.max(0.0001, packetScale) * (1 + c.hover * 0.2));
    }
    m.packet.opacity = a;
    m.halo.opacity = 0.28 * a;
    m.trail.opacity = 0.55 * a;
    const tr = trail.current;
    if (tr) {
      for (let k = 0; k < TRAIL; k++) {
        const t = tc - (k + 1) * 0.055;
        const s = 0.075 * (1 - k / TRAIL) * packetScale;
        tmpV.set(px(t), py(t), 0.02);
        tmpS.set(s, s, s);
        tmpM.compose(tmpV, tmpQ, tmpS);
        tr.setMatrixAt(k, tmpM);
      }
      tr.instanceMatrix.needsUpdate = true;
    }

    // Check mark above the last node once the packet has been stamped through.
    const ck = check.current;
    if (ck) {
      const age = tc - ARRIVE[NODES - 1];
      // Draws inside the final node once the packet has settled into it, so it reads as that stage completing.
      const s = age > 0.3 ? easeOutCubic(clamp01((age - 0.3) / 0.4)) * fadeOut : 0;
      ck.position.set(W, 0, 0.08);
      ck.scale.setScalar(Math.max(0.0001, s * 0.8));
      m.check.opacity = 0.85 * a;
    }
  });

  return (
    <group ref={group} visible={false}>
      <group ref={inner}>
        {/* Floor grid and drop lines give depth once the group tilts */}
        <group ref={gridGroup}>
          <lineSegments geometry={gridGeo} renderOrder={1000} material={m.grid} />
        </group>

        <mesh ref={trackBase} renderOrder={1001} material={m.trackBase}>
          <planeGeometry args={[1, 1]} />
        </mesh>
        <mesh ref={trackDone} renderOrder={1002} material={m.trackDone}>
          <planeGeometry args={[1, 1]} />
        </mesh>

        {Array.from({ length: NODES }, (_, i) => (
          <group key={i} ref={(el) => void (nodeGroups.current[i] = el)}>
            <mesh position={[0, -0.31, 0]} scale={[0.014, 0.62, 1]} renderOrder={1001} material={m.drops[i]}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh ref={(el) => void (nodeSolids.current[i] = el)} renderOrder={1004} material={m.nodes[i]}>
              <octahedronGeometry args={[0.2, 0]} />
            </mesh>
            <mesh renderOrder={1003} material={m.rings[i]}>
              <torusGeometry args={[0.36, dark ? 0.014 : 0.009, 6, 64]} />
            </mesh>
            <mesh ref={(el) => void (stamps.current[i] = el)} renderOrder={1003} material={m.stamps[i]}>
              <torusGeometry args={[0.36, 0.018, 6, 64]} />
            </mesh>
          </group>
        ))}

        <instancedMesh ref={trail} args={[undefined, undefined, TRAIL]} frustumCulled={false} renderOrder={1005} material={m.trail}>
          <sphereGeometry args={[1, 10, 8]} />
        </instancedMesh>
        <group ref={packet}>
          <mesh renderOrder={1007} material={m.halo}>
            <sphereGeometry args={[0.26, 14, 10]} />
          </mesh>
          <mesh renderOrder={1008} material={m.packet}>
            <sphereGeometry args={[0.095, 14, 10]} />
          </mesh>
        </group>

        <group ref={check}>
          <mesh position={[-0.07, -0.05, 0]} rotation={[0, 0, -Math.PI / 4]} renderOrder={1008} material={m.check}>
            <planeGeometry args={[0.13, 0.04]} />
          </mesh>
          <mesh position={[0.05, 0.02, 0]} rotation={[0, 0, Math.PI / 4]} renderOrder={1008} material={m.check}>
            <planeGeometry args={[0.28, 0.04]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
