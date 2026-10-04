"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type * as THREE from "three";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

interface SignalZoneProps {
  palette: WorldPalette;
  shared: MutableRefObject<RigShared>;
}

/**
 * Zone 1, "Signal": the faceted core with two orbiting rings and a shell of drifting particles, in a calm void.
 * This is the existing hero object, now living inside the persistent world. It sits to the right of the headline and
 * reacts softly to the pointer while the hero is the active zone.
 */
export function SignalZone({ palette, shared }: SignalZoneProps) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const cloud = useRef<THREE.Points>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const positions = useMemo(() => {
    const count = 260;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.2 + Math.random() * 2.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const g = group.current;
    if (g) {
      // Sit to the right of the headline: a fixed fraction of the visible half-width at the core's distance.
      const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * 8 * camera.aspect;
      const targetX = Math.min(2.9, halfWidth * 0.52);
      g.position.x += (targetX - g.position.x) * Math.min(1, dt * 4);

      // Pointer parallax only matters while this zone is the one on screen.
      const weight = Math.max(0, 1 - shared.current.u * 2);
      g.rotation.y += (pointer.current.x * 0.5 * weight - g.rotation.y) * Math.min(1, dt * 3);
      g.rotation.x += (-pointer.current.y * 0.3 * weight - g.rotation.x) * Math.min(1, dt * 3);
    }
    if (core.current) {
      core.current.rotation.y += dt * 0.22;
      core.current.rotation.x += dt * 0.1;
    }
    if (ringA.current) ringA.current.rotation.z += dt * 0.18;
    if (ringB.current) ringB.current.rotation.z -= dt * 0.12;
    if (cloud.current) cloud.current.rotation.y += dt * 0.02;
  });

  return (
    <group ref={group} position={[2.6, 0.1, 0]} scale={0.85}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color={palette.primary} flatShading metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh scale={1.04}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial color={palette.accent} wireframe transparent opacity={0.35} />
      </mesh>

      <mesh ref={ringA} rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[2.5, 0.012, 8, 160]} />
        <meshBasicMaterial color={palette.primary} transparent opacity={0.8} />
      </mesh>
      <mesh ref={ringB} rotation={[Math.PI / 3, -0.6, 0.4]}>
        <torusGeometry args={[3.05, 0.01, 8, 160]} />
        <meshBasicMaterial color={palette.accent} transparent opacity={0.5} />
      </mesh>

      <points ref={cloud}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial color={palette.accent} size={0.035} sizeAttenuation transparent opacity={0.7} depthWrite={false} />
      </points>
    </group>
  );
}
