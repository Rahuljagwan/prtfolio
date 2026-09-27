"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { motionState } from "@/lib/world/motion";
import { smootherstep } from "@/lib/world/tunnel-math";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

// Speed streaks: while the page is moving fast, motes of light along the route stretch into short lines pointing down the
// direction of travel, the way dust and sparks streak past a lens at speed. At rest they are invisible (and the whole
// object is hidden, so it costs nothing); the faster the scroll, the longer and brighter they get. They live in a tube around
// the route, outside the corridor the camera flies through, and are drawn as plain GL lines, so a thousand of them are one draw call.

const COUNT = 900;
const MAX_LEN = 2.6; // longest streak, in world units, at full speed
const MAX_OPACITY = 0.55;

/** Deterministic pseudo-random numbers, so the field is the same on every load. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function SpeedStreaks({ curves, palette, shared }: { curves: RigCurves; palette: WorldPalette; shared: MutableRefObject<RigShared> }) {
  const lines = useRef<THREE.LineSegments>(null);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  const fwd = useMemo(() => new Vector3(), []);
  const base = useMemo(() => new Float32Array(COUNT * 3), []);
  const lens = useMemo(() => new Float32Array(COUNT), []);
  const geometry = useMemo(() => {
    const rand = rng(90210);
    for (let i = 0; i < COUNT; i++) {
      const p = curves.position.getPoint(rand());
      const angle = rand() * Math.PI * 2;
      const radius = 2.4 + Math.pow(rand(), 0.7) * 8;
      base[i * 3] = p.x + Math.cos(angle) * radius;
      base[i * 3 + 1] = p.y + Math.sin(angle) * radius * 0.7;
      base[i * 3 + 2] = p.z + (rand() - 0.5) * 5;
      lens[i] = 0.35 + rand() * 0.65; // each streak has its own length, so the field is not a uniform comb
    }
    const g = new BufferGeometry();
    const pos = new Float32Array(COUNT * 2 * 3);
    for (let i = 0; i < COUNT; i++) {
      pos.set([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], i * 6);
      pos.set([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]], i * 6 + 3);
    }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    return g;
  }, [curves, base, lens]);

  useEffect(() => {
    mat.current?.color.set(palette.dust);
  }, [palette]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state) => {
    const l = lines.current;
    if (!l) return;
    const k = smootherstep(Math.abs(motionState.speed)) * motionState.fx;
    const visible = k > 0.015 || !!shared.current.warm;
    l.visible = visible;
    if (!visible) return;
    if (mat.current) mat.current.opacity = MAX_OPACITY * k;

    // Trails point along the direction of travel: away from the camera when scrolling down, toward it when scrolling up.
    state.camera.getWorldDirection(fwd);
    const dir = motionState.speed >= 0 ? 1 : -1;
    const len = MAX_LEN * k * dir;
    const attr = geometry.getAttribute("position") as BufferAttribute;
    const a = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      const n = lens[i] * len;
      const j = i * 6 + 3;
      a[j] = base[i * 3] + fwd.x * n;
      a[j + 1] = base[i * 3 + 1] + fwd.y * n;
      a[j + 2] = base[i * 3 + 2] + fwd.z * n;
    }
    attr.needsUpdate = true;
  });

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false} renderOrder={5} visible={false}>
      <lineBasicMaterial ref={mat} transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}

