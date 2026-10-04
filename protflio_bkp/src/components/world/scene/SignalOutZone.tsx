"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, MeshBasicMaterial } from "three";
import type * as THREE from "three";
import { ZONES } from "@/lib/world/zones";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const PULSES = 4;
const PULSE_PERIOD = 6; // seconds for one ring to travel out and fade
const BEACON_X = 4.6; // right of centre, like the hero core, so the contact text keeps the middle
const BEACON_Y = 16.2;
const BEACON_Z = -91;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Zone 6, "Signal Out": the journey ends in open sky. The core from the hero returns as a beacon on a column of light,
 * rings of signal pulse outward from it, a soft dawn glow sits behind, and a fine field of stars fills the sky.
 * The route's last stretch points straight at it: the signal you started with, now sent out.
 *
 * Every mesh here sets frustumCulled={false}: the beacon is far outside the camera frustum during the warm-up pass, and a
 * culled mesh is never drawn, so its shader would otherwise compile mid-scroll the first time it comes into view.
 */
export function SignalOutZone({ palette, shared }: { palette: WorldPalette; dark?: boolean; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const pulses = useRef<(THREE.Mesh | null)[]>([]);
  const fade = useRef(-1);
  const mats = useRef<{
    core?: THREE.MeshStandardMaterial;
    shell?: THREE.MeshBasicMaterial;
    ringA?: THREE.MeshBasicMaterial;
    ringB?: THREE.MeshBasicMaterial;
    beam?: THREE.MeshBasicMaterial;
    beamWide?: THREE.MeshBasicMaterial;
    glow?: THREE.MeshBasicMaterial;
    stars?: THREE.PointsMaterial;
    signal?: THREE.LineBasicMaterial;
  }>({});

  const pulseMats = useMemo(() => Array.from({ length: PULSES }, () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), []);

  const stars = useMemo(() => {
    const rand = rng(91);
    const n = 900;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (rand() - 0.5) * 90;
      a[i * 3 + 1] = 6 + rand() * 42;
      a[i * 3 + 2] = -55 - rand() * 60;
    }
    return new BufferGeometry().setAttribute("position", new BufferAttribute(a, 3));
  }, []);

  // Route end (camera pose minus the route drop) to the beacon: the last leg of the pipeline.
  const signal = useMemo(() => {
    const p = ZONES[ZONES.length - 1].camera.position;
    return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array([p[0], p[1] - 1.3, p[2], BEACON_X, BEACON_Y, BEACON_Z]), 3));
  }, []);

  // Radial glow: opaque at the centre, transparent at the rim, from the 4-component vertex colour (a fan of triangles).
  const glow = useMemo(() => {
    const seg = 48;
    const pos = [0, 0, 0];
    const col = [1, 1, 1, 0.6];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(Math.cos(a), Math.sin(a), 0);
      col.push(1, 1, 1, 0);
    }
    const idx: number[] = [];
    for (let i = 1; i <= seg; i++) idx.push(0, i, i + 1);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    g.setIndex(idx);
    return g;
  }, []);

  useEffect(() => {
    const M = mats.current;
    M.core?.color.set(palette.primary);
    M.shell?.color.set(palette.accent);
    M.ringA?.color.set(palette.primary);
    M.ringB?.color.set(palette.accent);
    M.beam?.color.set(palette.accent);
    M.beamWide?.color.set(palette.accent);
    M.glow?.color.set(palette.accent);
    M.stars?.color.set(palette.dust);
    M.signal?.color.set(palette.route);
    pulseMats.forEach((m) => m.color.set(palette.accent));
    fade.current = -1;
  }, [palette, pulseMats]);

  useEffect(
    () => () => {
      stars.dispose();
      signal.dispose();
      glow.dispose();
      pulseMats.forEach((m) => m.dispose());
    },
    [stars, signal, glow, pulseMats],
  );

  useFrame((state, delta) => {
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    g.visible = !!shared.current.warm || u > 3.9;
    if (!g.visible) return;

    const f = Math.min(1, Math.max(0, (u - 4.1) / 0.9));
    const e = f * f * (3 - 2 * f);
    if (Math.abs(e - fade.current) > 0.002) {
      fade.current = e;
      const M = mats.current;
      if (M.core) M.core.opacity = e; // stays transparent: flipping it would compile a second (OPAQUE) shader variant mid-scroll
      if (M.shell) M.shell.opacity = 0.4 * e;
      if (M.ringA) M.ringA.opacity = 0.8 * e;
      if (M.ringB) M.ringB.opacity = 0.5 * e;
      if (M.beam) M.beam.opacity = 0.55 * e;
      if (M.beamWide) M.beamWide.opacity = 0.09 * e;
      if (M.glow) M.glow.opacity = 0.34 * e;
      if (M.stars) M.stars.opacity = 0.8 * e;
      if (M.signal) M.signal.opacity = 0.7 * e;
    }

    const dt = Math.min(delta, 0.05);
    if (core.current) {
      core.current.rotation.y += dt * 0.25;
      core.current.rotation.x += dt * 0.1;
    }
    if (shell.current) shell.current.rotation.copy(core.current!.rotation);
    if (ringA.current) ringA.current.rotation.z += dt * 0.18;
    if (ringB.current) ringB.current.rotation.z -= dt * 0.12;

    // Signal pulses: each ring eases outward (fast at first, then slowing) while fading. Staggered evenly.
    const t = state.clock.elapsedTime;
    for (let i = 0; i < PULSES; i++) {
      const m = pulses.current[i];
      if (!m) continue;
      const p = ((t / PULSE_PERIOD + i / PULSES) % 1 + 1) % 1;
      const eased = 1 - (1 - p) * (1 - p) * (1 - p);
      const s = 2.2 + eased * 9;
      m.scale.set(s, s, s);
      pulseMats[i].opacity = 0.5 * e * (1 - p) * (1 - p);
    }
  });

  const bind = <K extends keyof NonNullable<typeof mats.current>>(key: K) => (m: NonNullable<typeof mats.current>[K] | null) => void (mats.current[key] = (m ?? undefined) as never);

  return (
    <group ref={root} visible={false}>
      {/* Stars */}
      <points geometry={stars} frustumCulled={false}>
        <pointsMaterial ref={bind("stars")} size={0.14} sizeAttenuation transparent opacity={0} depthWrite={false} />
      </points>

      {/* Last leg of the route into the beacon */}
      <lineSegments geometry={signal} frustumCulled={false}>
        <lineBasicMaterial ref={bind("signal")} transparent opacity={0} />
      </lineSegments>

      {/* Dawn glow behind the beacon, unaffected by fog */}
      <mesh geometry={glow} position={[BEACON_X, BEACON_Y, BEACON_Z - 6]} scale={16} frustumCulled={false}>
        <meshBasicMaterial ref={bind("glow")} vertexColors transparent opacity={0} depthWrite={false} fog={false} />
      </mesh>

      <group position={[BEACON_X, BEACON_Y, BEACON_Z]}>
        {/* Column of light: a thin bright core and a wide faint halo */}
        <mesh position={[0, 6, 0]} frustumCulled={false}>
          <cylinderGeometry args={[0.05, 0.05, 80, 8, 1, true]} />
          <meshBasicMaterial ref={bind("beam")} transparent opacity={0} depthWrite={false} />
        </mesh>
        <mesh position={[0, 6, 0]} frustumCulled={false}>
          <cylinderGeometry args={[0.55, 0.55, 80, 16, 1, true]} />
          <meshBasicMaterial ref={bind("beamWide")} transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* The core returns */}
        <group scale={0.9}>
          <mesh ref={core} frustumCulled={false}>
            <icosahedronGeometry args={[1.5, 1]} />
            <meshStandardMaterial ref={bind("core")} flatShading metalness={0.35} roughness={0.35} transparent opacity={0} />
          </mesh>
          <mesh ref={shell} scale={1.04} frustumCulled={false}>
            <icosahedronGeometry args={[1.5, 1]} />
            <meshBasicMaterial ref={bind("shell")} wireframe transparent opacity={0} />
          </mesh>
          <mesh ref={ringA} frustumCulled={false} rotation={[Math.PI / 2.4, 0.3, 0]}>
            <torusGeometry args={[2.5, 0.012, 8, 160]} />
            <meshBasicMaterial ref={bind("ringA")} transparent opacity={0} />
          </mesh>
          <mesh ref={ringB} frustumCulled={false} rotation={[Math.PI / 3, -0.6, 0.4]}>
            <torusGeometry args={[3.05, 0.01, 8, 160]} />
            <meshBasicMaterial ref={bind("ringB")} transparent opacity={0} />
          </mesh>
        </group>

        {/* Expanding signal rings, flat like ripples */}
        {pulseMats.map((m, i) => (
          <mesh key={i} ref={(el) => void (pulses.current[i] = el)} rotation={[Math.PI / 2, 0, 0]} material={m} frustumCulled={false}>
            <torusGeometry args={[1, 0.006, 6, 96]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
