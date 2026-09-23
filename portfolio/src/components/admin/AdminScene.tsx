"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, Fog } from "three";
import type * as THREE from "three";
import { PALETTE } from "@/components/world/scene/palette";
import { getAdminStatus, subscribeAdminStatus } from "@/lib/admin/status";

/** Matches the fog to the page background, same reasoning as the public world: distant points dissolve into the
 * HTML behind the canvas instead of ending in a hard edge. Imperative (scene.fog), not a declarative <fog> node --
 * same pattern WorldScene.tsx uses. */
function SceneFog({ color }: { color: string }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.fog = new Fog(color, 12, 40);
  }, [scene, color]);
  return null;
}

const COUNT = 260;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** A restrained ambient field, not a narrative: a few hundred slow-drifting points, tinted by theme and by whatever
 * the admin is currently doing (idle/pending/success/error), via the same status store StatusOrb reads. No rig, no
 * zones, no per-resource showcase -- this exists purely as atmosphere behind the forms. */
function Points({ dark }: { dark: boolean }) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const palette = dark ? PALETTE.dark : PALETTE.light;
  const status = useSyncExternalStore(subscribeAdminStatus, getAdminStatus, () => "idle" as const);
  const target = useMemo(() => new Color(), []);
  const current = useMemo(() => new Color(), []);

  const geometry = useMemo(() => {
    const rand = rng(7);
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3] = (rand() - 0.5) * 40;
      arr[i * 3 + 1] = (rand() - 0.5) * 24;
      arr[i * 3 + 2] = (rand() - 0.5) * 30 - 8;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    if (points.current) points.current.rotation.y += Math.min(delta, 0.05) * 0.006; // felt, not watched
    if (mat.current) {
      target.set(status === "pending" ? palette.accent : status === "error" ? "#e3392f" : palette.primary);
      current.copy(mat.current.color).lerp(target, 0.06);
      mat.current.color.copy(current);
    }
    state.invalidate(); // demand-mode: the slow drift + colour lerp both need a redraw every frame while mounted
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial ref={mat} size={0.05} sizeAttenuation transparent opacity={0.5} depthWrite={false} />
    </points>
  );
}

export default function AdminScene({ dark }: { dark: boolean }) {
  const palette = dark ? PALETTE.dark : PALETTE.light;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ fov: 45, near: 0.1, far: 80, position: [0, 0, 18] }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power", failIfMajorPerformanceCaveat: true }}
    >
      <SceneFog color={palette.fog} />
      <Points dark={dark} />
    </Canvas>
  );
}
