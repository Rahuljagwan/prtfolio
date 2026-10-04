"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, LineBasicMaterial, Matrix4, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import type * as THREE from "three";
import { smootherstep } from "@/lib/world/rig-math";
import { BEACON } from "@/lib/world/zones";
import { ambientInvalidate } from "./ambient";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

// Three small satellites on tilted orbits round the closing beacon. Their orbits stay inside radius 4.4: the beacon's own rings reach 2.75
// and the helicopter circles it at about 5.3 (lib/world/heli-math.ts), so nothing here can ever touch either.
const SATS = [
  { radius: 3.6, tilt: 0.45, node: 0.3, speed: 0.34, start: 0.2 },
  { radius: 4.0, tilt: -0.7, node: 2.1, speed: -0.27, start: 2.4 },
  { radius: 4.4, tilt: 1.05, node: 4.0, speed: 0.21, start: 4.4 },
] as const;
const [BX, BY, BZ] = BEACON;

/** Orthonormal basis (e1, e2 in the orbit plane, n its normal) of an orbit tilted by `tilt` about the node line at angle `node`. */
function basis(node: number, tilt: number) {
  const e1 = new Vector3(Math.cos(node), 0, Math.sin(node));
  const flat = new Vector3(-Math.sin(node), 0, Math.cos(node));
  const e2 = flat.multiplyScalar(Math.cos(tilt)).add(new Vector3(0, Math.sin(tilt), 0));
  return { e1, e2, n: new Vector3().crossVectors(e1, e2) };
}

/**
 * Satellites for the "signal out" at the end of the route: the beacon is a transmitter, and these are the things that carry the
 * signal on. Each is a small body with two panels, flying its own faint orbit trace round the beacon. They appear with the beacon (the
 * same fade as SignalOutZone) and are ambient (a calm 25 frames a second, resting once the page has been still).
 */
export function BeaconSatellites({ palette, dark, shared }: { palette: WorldPalette; dark: boolean; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const sats = useRef<(THREE.Group | null)[]>([]);
  const body = useMemo(() => new BoxGeometry(0.26, 0.16, 0.16), []);
  const panel = useMemo(() => new BoxGeometry(0.5, 0.02, 0.2), []);
  const light = useMemo(() => new SphereGeometry(0.035, 8, 6), []);
  const orbits = useMemo(
    () =>
      SATS.map((o) => {
        const { e1, e2 } = basis(o.node, o.tilt);
        const pts: number[] = [];
        for (let i = 0; i < 96; i++) {
          const a = (i / 96) * Math.PI * 2;
          pts.push(BX + o.radius * (Math.cos(a) * e1.x + Math.sin(a) * e2.x), BY + o.radius * (Math.cos(a) * e1.y + Math.sin(a) * e2.y), BZ + o.radius * (Math.cos(a) * e1.z + Math.sin(a) * e2.z));
        }
        return new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
      }),
    [],
  );
  const mats = useMemo(
    () => ({
      body: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      panel: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      light: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      trace: new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  );
  const tmp = useMemo(() => ({ pos: new Vector3(), tan: new Vector3(), rad: new Vector3(), m: new Matrix4() }), []);

  useEffect(() => {
    mats.body.color.set(dark ? "#d7e3df" : "#33413b");
    mats.panel.color.set(palette.accent);
    mats.light.color.set(palette.primary);
    mats.trace.color.set(palette.dust);
  }, [mats, palette, dark]);

  useEffect(
    () => () => {
      body.dispose();
      panel.dispose();
      light.dispose();
      orbits.forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => m.dispose());
    },
    [body, panel, light, orbits, mats],
  );

  useFrame((state) => {
    const g = root.current;
    const u = shared.current.u;
    if (!g) return;
    g.visible = !!shared.current.warm || u > 3.9;
    if (!g.visible) return;
    const e = smootherstep((u - 4.1) / 0.9); // the same arrival as the beacon itself
    mats.body.opacity = e;
    mats.panel.opacity = 0.9 * e;
    mats.light.opacity = e;
    mats.trace.opacity = 0.22 * e;
    if (e <= 0.002) return;

    const time = state.clock.elapsedTime;
    const { pos, tan, rad, m } = tmp;
    SATS.forEach((o, i) => {
      const sat = sats.current[i];
      if (!sat) return;
      const { e1, e2, n } = basis(o.node, o.tilt);
      const a = o.start + time * o.speed;
      const c = Math.cos(a);
      const s = Math.sin(a);
      rad.set(c * e1.x + s * e2.x, c * e1.y + s * e2.y, c * e1.z + s * e2.z); // outward from the beacon
      tan.set(-s * e1.x + c * e2.x, -s * e1.y + c * e2.y, -s * e1.z + c * e2.z).multiplyScalar(Math.sign(o.speed)); // the way it is moving
      pos.set(BX, BY, BZ).addScaledVector(rad, o.radius);
      // Panels span the orbit normal, the body's long axis follows the motion, its top faces away from the beacon.
      const right = new Vector3().copy(n);
      const up = rad;
      const fwd = new Vector3().crossVectors(right, up);
      if (fwd.dot(tan) < 0) right.negate();
      m.makeBasis(right, up, new Vector3().crossVectors(right, up));
      sat.position.copy(pos);
      sat.quaternion.setFromRotationMatrix(m);
    });
    ambientInvalidate(state.invalidate);
  });

  return (
    <group ref={root} visible={false}>
      {orbits.map((geo, i) => (
        <lineLoop key={`o${i}`} geometry={geo} material={mats.trace} frustumCulled={false} />
      ))}
      {SATS.map((o, i) => (
        <group key={i} ref={(el) => void (sats.current[i] = el)} frustumCulled={false}>
          <mesh geometry={body} material={mats.body} />
          <mesh geometry={panel} material={mats.panel} position={[0.38, 0, 0]} />
          <mesh geometry={panel} material={mats.panel} position={[-0.38, 0, 0]} />
          <mesh geometry={light} material={mats.light} position={[0, 0.11, 0]} />
        </group>
      ))}
    </group>
  );
}
