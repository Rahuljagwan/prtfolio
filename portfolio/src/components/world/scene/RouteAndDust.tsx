"use client";

import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, type InstancedMesh, Line, LineBasicMaterial, Matrix4, Quaternion, TorusGeometry, Vector3 } from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import type { WorldPalette } from "./palette";

/**
 * The pipeline itself: one glowing line following the camera path, slightly below it, so you can see the route ahead.
 * It is the visual thread that ties every zone together.
 */
export function RouteLine({ curves, palette }: { curves: RigCurves; palette: WorldPalette }) {
  const line = useMemo(() => {
    const points = curves.position.getPoints(320).map((p) => p.clone().add(new Vector3(0, -1.3, 0)));
    const geometry = new BufferGeometry().setFromPoints(points);
    return new Line(geometry, new LineBasicMaterial({ transparent: true, opacity: 0.85 }));
  }, [curves]);

  useEffect(() => {
    (line.material as LineBasicMaterial).color.set(palette.route);
  }, [line, palette.route]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

/**
 * Sparse dust scattered around the whole route (never inside the corridor the camera flies through). It gives the
 * eye something to pass, which is what makes travel between zones read as movement and depth.
 */
export function RouteDust({ curves, palette, count }: { curves: RigCurves; palette: WorldPalette; count: number }) {
  const geometry = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const p = curves.position.getPoint(Math.random());
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 13;
      arr[i * 3] = p.x + Math.cos(angle) * radius;
      arr[i * 3 + 1] = p.y + Math.sin(angle) * radius * 0.6;
      arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 4;
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(arr, 3));
    return g;
  }, [curves, count]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color={palette.dust} size={0.09} sizeAttenuation transparent opacity={0.7} depthWrite={false} />
    </points>
  );
}

/**
 * Route-wide "mile markers": thin rings the camera flies through, spaced along the whole path (from just after the
 * hero to the end). Unlike zone content they exist everywhere, so between and inside every zone you still pass
 * something every second or so. That passing is what reads as travel. One InstancedMesh, one draw call.
 */
export function RouteRings({ curves, palette, count = 46 }: { curves: RigCurves; palette: WorldPalette; count?: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new TorusGeometry(2.5, 0.014, 6, 72), []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const tmp = new Matrix4();
    const up = new Vector3(0, 0, 1);
    const q = new Quaternion();
    for (let i = 0; i < count; i++) {
      const t = 0.1 + (i / (count - 1)) * 0.9;
      const p = curves.position.getPoint(t);
      const tan = curves.position.getTangent(t);
      q.setFromUnitVectors(up, tan);
      p.y -= 0.65; // centred between the camera and the route line, so both sit inside the ring
      tmp.compose(p, q, new Vector3(1, 1, 1));
      m.setMatrixAt(i, tmp);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [curves, count]);

  useEffect(() => () => geo.dispose(), [geo]);

  return (
    <instancedMesh ref={mesh} args={[geo, undefined, count]} frustumCulled={false}>
      <meshBasicMaterial color={palette.route} transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  );
}
