"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, Euler, type InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { worldTier } from "@/lib/world/capability";
import { smootherstep } from "@/lib/world/rig-math";
import type { RigCurves } from "@/lib/world/rig-path";
import { ZONES } from "@/lib/world/zones";
import { ambientInvalidate } from "./ambient";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const GROUND_Y = -2.7;
const PER_LANE = 12;
// The stretch of route with a floor under it (Foundation through Build): the traffic runs along it, in two lanes either side of the route.
const S_FROM = 1.2;
const S_TO = 3.3;
// Gate pillars stand 3 from the route and the nearest buildings 2.9 or more, so a lane at 2.1 runs clear of both (and under the gates).
const LANE = 2.1;
const PERIOD = 15; // seconds for the slowest car to run the whole stretch

/** Tiny seeded PRNG: the same cars on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Traffic in the city: light trails driving along the ground in two lanes either side of the route, the same direction as the packets
 * on the route in the right lane (amber, tail-lights going away) and against it in the left (cool, headlights coming at you), so the city
 * reads as alive and busy rather than a model. Each car is a bright streak with a soft halo, shrinking in and out at the ends of its run
 * so none ever pops. Ambient (a calm 25 frames a second, resting when the page has been still: see ambient.ts), only drawn while the
 * ground is, and clear of every building, gate and of the route line itself.
 */
export function CityTraffic({ palette, dark, curves, shared }: { palette: WorldPalette; dark: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const bodies = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const halos = [useRef<InstancedMesh>(null), useRef<InstancedMesh>(null)];
  const last = ZONES.length - 1;
  const perLane = useMemo(() => (worldTier() === "lite" ? 7 : PER_LANE), []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const mats = useMemo(
    () => ({
      body: [0, 1].map(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })),
      halo: [0, 1].map(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })),
    }),
    [],
  );
  // Per car: where in its run it starts, how fast it goes, how long it is.
  const cars = useMemo(() => {
    const rand = rng(17);
    return [0, 1].map(() => Array.from({ length: perLane }, (_, i) => ({ phase: (i + rand() * 0.6) / perLane, speed: 0.8 + rand() * 0.5, len: 0.7 + rand() * 0.7 })));
  }, [perLane]);
  const tmp = useMemo(() => ({ p: new Vector3(), t: new Vector3(), m: new Matrix4(), q: new Quaternion(), e: new Euler(), s: new Vector3(), pos: new Vector3() }), []);

  useEffect(() => {
    // Outbound (right lane, with the traffic on the route): amber. Oncoming (left lane): a cool light, the ink green in the light theme.
    mats.body[0].color.set(palette.accent);
    mats.halo[0].color.set(palette.accent);
    mats.body[1].color.set(dark ? "#d9fff0" : palette.primary);
    mats.halo[1].color.set(dark ? palette.dust : palette.primary);
  }, [mats, palette, dark]);

  useEffect(
    () => () => {
      box.dispose();
      [...mats.body, ...mats.halo].forEach((m) => m.dispose());
    },
    [box, mats],
  );

  useFrame((state) => {
    const u = shared.current.u;
    const on = !!shared.current.warm || (u > 0.9 && u < 3.5);
    for (let l = 0; l < 2; l++) {
      const b = bodies[l].current;
      const h = halos[l].current;
      if (b) b.visible = on;
      if (h) h.visible = on;
    }
    if (!on) return;
    const fade = smootherstep((u - 0.9) / 0.6) * (1 - smootherstep((u - 2.8) / 0.6));
    for (let l = 0; l < 2; l++) {
      mats.body[l].opacity = 0.95 * fade;
      mats.halo[l].opacity = 0.2 * fade;
    }
    if (fade <= 0.002) return;

    const time = state.clock.elapsedTime;
    const { p, t, m, q, e, s, pos } = tmp;
    for (let l = 0; l < 2; l++) {
      const dir = l === 0 ? 1 : -1; // 1: with the route, -1: against it
      const side = l === 0 ? 1 : -1; // right lane, left lane
      for (let i = 0; i < perLane; i++) {
        const c = cars[l][i];
        const run = (((time * c.speed) / PERIOD + c.phase) % 1 + 1) % 1;
        const along = dir === 1 ? run : 1 - run;
        const sRoute = S_FROM + (S_TO - S_FROM) * along;
        curves.position.getPoint(Math.min(1, sRoute / last), p);
        curves.position.getTangent(Math.min(1, sRoute / last), t);
        const len = Math.hypot(t.x, t.z) || 1;
        // The right of the direction of travel (+x when the route runs along -z).
        pos.set(p.x - (t.z / len) * LANE * side, GROUND_Y + 0.07, p.z + (t.x / len) * LANE * side);
        e.set(0, Math.atan2(t.x, t.z), 0);
        q.setFromEuler(e);
        const grow = smootherstep(run / 0.07) * smootherstep((1 - run) / 0.07); // shrinks away at both ends of its run
        const g = Math.max(grow, 0.0001);
        m.compose(pos, q, s.set(0.15 * g, 0.07 * g, c.len * g));
        bodies[l].current?.setMatrixAt(i, m);
        m.compose(pos, q, s.set(0.5 * g, 0.22 * g, c.len * 1.9 * g));
        halos[l].current?.setMatrixAt(i, m);
      }
      if (bodies[l].current) bodies[l].current!.instanceMatrix.needsUpdate = true;
      if (halos[l].current) halos[l].current!.instanceMatrix.needsUpdate = true;
    }
    ambientInvalidate(state.invalidate);
  });

  return (
    <>
      {[0, 1].map((l) => (
        <group key={l}>
          <instancedMesh ref={halos[l]} args={[box, mats.halo[l], perLane]} frustumCulled={false} renderOrder={5} />
          <instancedMesh ref={bodies[l]} args={[box, mats.body[l], perLane]} frustumCulled={false} renderOrder={6} />
        </group>
      ))}
    </>
  );
}
