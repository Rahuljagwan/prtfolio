"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { PlaneGeometry } from "three";
import type * as THREE from "three";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const GROUND_Y = -2.7; // matches FoundationZone and CityZone, which build their own grids and gates at this same height
const HALF_X = 44;
const Z_NEAR = 8;
const Z_FAR = -54;

/**
 * A solid floor under the Foundation and Build zones' wireframe grids -- the ground those zones' buildings and gates
 * already sit on mathematically (their base is this same GROUND_Y) but never had visually. Without it, the space
 * between grid lines showed the sky straight through, so a row of buildings read as floating cubes rather than a
 * skyline standing on something. One flat plane, coloured like the fog and left in the fog's care to dissolve at
 * the horizon, closes that gap. It fades in only across the ground-based stretch of the journey (Signal exit through
 * the end of Build) and back out before Deployments, whose floating cards were never meant to read as grounded.
 */
export function GroundPlane({ palette, shared }: { palette: WorldPalette; shared: MutableRefObject<RigShared> }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const fade = useRef(-1);
  const geo = useMemo(() => new PlaneGeometry(HALF_X * 2, Z_NEAR - Z_FAR), []);

  useEffect(() => {
    mat.current?.color.set(palette.fog);
    fade.current = -1;
  }, [palette]);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const u = shared.current.u;
    const g = mesh.current;
    if (!g) return;
    g.visible = !!shared.current.warm || (u > 0.05 && u < 3.3);
    if (!g.visible) return;
    const inn = Math.min(1, Math.max(0, (u - 0.15) / 0.55));
    const out = 1 - Math.min(1, Math.max(0, (u - 2.85) / 0.45));
    const f = inn * inn * (3 - 2 * inn) * out;
    if (Math.abs(f - fade.current) > 0.002 && mat.current) {
      fade.current = f;
      mat.current.opacity = f;
    }
  });

  return (
    <mesh
      ref={mesh}
      geometry={geo}
      position={[0, GROUND_Y - 0.02, (Z_NEAR + Z_FAR) / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      frustumCulled={false}
      visible={false}
    >
      <meshBasicMaterial ref={mat} transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
