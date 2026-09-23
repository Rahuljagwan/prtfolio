"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Matrix4, MeshBasicMaterial, Quaternion, TubeGeometry, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { ZONES } from "@/lib/world/zones";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const ROUTE_DROP = 1.3; // how far below the camera path the route line/tube/flow all sit -- must match every zone's own use of this same offset

const ROUTE_HERO_STRENGTH = 0.28; // fraction of full route brightness while the hero copy is on screen
/** Route brightness multiplier for the camera's current u: quiet at the hero, full by roughly the Gate. */
function routeStrength(u: number) {
  const s = Math.min(1, Math.max(0, (u - 0.05) / 0.5));
  return ROUTE_HERO_STRENGTH + (1 - ROUTE_HERO_STRENGTH) * s * s * (3 - 2 * s);
}

/**
 * The pipeline itself: a glowing tube following the camera path, slightly below it, so you can see the route ahead
 * through every zone -- the thread that ties the whole journey together. "Glowing" without any post-processing: a
 * slim bright core tube plus a wider, fainter halo tube around it, the same two-layer trick every other glow in this
 * world uses (a small opaque mesh plus a bigger transparent one), just swept along a curve instead of held at a point.
 */
export function RouteLine({ curves, palette, shared }: { curves: RigCurves; palette: WorldPalette; shared: MutableRefObject<RigShared> }) {
  const core = useMemo(() => new TubeGeometry(curves.position, 400, 0.032, 6, false), [curves]);
  const halo = useMemo(() => new TubeGeometry(curves.position, 400, 0.11, 6, false), [curves]);
  const coreMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false }), []);
  const haloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false }), []);
  const lastK = useRef(-1);

  useEffect(() => {
    coreMat.color.set(palette.route);
    haloMat.color.set(palette.route);
  }, [palette, coreMat, haloMat]);

  // The hero's copy sits directly on the world (no card behind it), and the route runs straight through that column
  // of text. Held quiet while the hero is on screen, and brought up to full strength as the visitor scrolls toward it.
  useFrame(() => {
    const k = routeStrength(shared.current.u);
    if (Math.abs(k - lastK.current) < 0.002) return;
    lastK.current = k;
    coreMat.opacity = 0.95 * k;
    haloMat.opacity = 0.22 * k;
  });

  useEffect(
    () => () => {
      core.dispose();
      halo.dispose();
      coreMat.dispose();
      haloMat.dispose();
    },
    [core, halo, coreMat, haloMat],
  );

  return (
    <group position={[0, -ROUTE_DROP, 0]}>
      <mesh geometry={halo} material={haloMat} frustumCulled={false} />
      <mesh geometry={core} material={coreMat} frustumCulled={false} />
    </group>
  );
}

const FLOW_COUNT = 16;
const FLOW_PERIOD = 7; // seconds for one packet to travel the visible stretch of the route
// Ambient flow only animates across the ground-based stretch (Signal through Build/into Deployments): the same
// "costs nothing outside its own stretch" rule every zone already follows, since it needs invalidate() every frame
// it runs. Past this the route is still fully visible (the tube above has zero per-frame cost everywhere), and later
// zones carry their own local "traffic" motif instead (Deployments' hairlines, Stack's inter-layer links, Signal
// Out's own signal line).
const FLOW_U_MIN = -0.15;
const FLOW_U_MAX = 3.45;

/**
 * Ambient background traffic: small bright packets continuously flowing along the route, evenly spaced and looping,
 * distinct from the one visitor-triggered request in RequestOriginZone. This is what makes "a request travels this
 * path" readable at a glance in any single frame, not just when you personally send one.
 */
export function RouteFlow({ curves, palette, shared }: { curves: RigCurves; palette: WorldPalette; shared: MutableRefObject<RigShared> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const last = ZONES.length - 1; // same u -> curve-parameter conversion every zone uses to place things on this curve (t = u / last)
  const tmpM = useMemo(() => new Matrix4(), []);
  const tmpQ = useMemo(() => new Quaternion(), []);
  const tmpS = useMemo(() => new Vector3(0.06, 0.06, 0.06), []);
  const tmpP = useMemo(() => new Vector3(), []);

  useEffect(() => {
    mat.current?.color.set(palette.route);
  }, [palette]);

  useFrame((state) => {
    const g = mesh.current;
    if (!g) return;
    const u = shared.current.u;
    const visible = !!shared.current.warm || (u > FLOW_U_MIN && u < FLOW_U_MAX);
    g.visible = visible;
    if (!visible) return;
    const t = state.clock.elapsedTime;
    const span = FLOW_U_MAX - FLOW_U_MIN;
    for (let i = 0; i < FLOW_COUNT; i++) {
      const phase = (t / FLOW_PERIOD + i / FLOW_COUNT) % 1;
      const curveT = Math.min(1, Math.max(0, (FLOW_U_MIN + phase * span) / last));
      tmpP.copy(curves.position.getPoint(curveT));
      tmpP.y -= ROUTE_DROP;
      tmpM.compose(tmpP, tmpQ, tmpS);
      g.setMatrixAt(i, tmpM);
    }
    g.instanceMatrix.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.85 * routeStrength(u); // same hero-quiet ramp as the tube itself
    state.invalidate();
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, FLOW_COUNT]} frustumCulled={false} renderOrder={1200}>
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial ref={mat} transparent opacity={0.85} depthTest={false} depthWrite={false} fog={false} />
    </instancedMesh>
  );
}

// Ground-based stretch (Signal through Build) where this reads as "atmosphere behind a skyline" only when it stays
// almost entirely invisible -- a starfield's defining trait is being scattered evenly across an empty sky, which is
// exactly what this dust looked like before it had a floor to sit under. Outside that stretch it's allowed to be a
// faint depth cue again (Deployments' floating cards, Stack's climb, Signal Out's open sky all still want *something*
// to pass, per the zone that follows this stretch's own reasoning below).
const DUST_GROUND_MIN = -0.6;
const DUST_GROUND_MAX = 3.3;
const DUST_FAINT = 0.22; // outside the ground stretch: still "at most a faint dust", not the original 0.7
const DUST_HIDDEN = 0.035; // inside it: near-invisible rather than gone outright, so travel still reads as motion

/**
 * Sparse dust scattered around the whole route (never inside the corridor the camera flies through). It gives the
 * eye something to pass, which is what makes travel between zones read as movement and depth -- but it must stay
 * near-invisible while the ground-based zones are on screen (see DUST_GROUND_MIN/MAX): those zones now have a real
 * floor and skyline, and even a dim, fog-toned dust field scattered across the whole sky above them reads as a
 * starfield again by sheer density and position, regardless of colour. A single opacity fade keyed to the camera's
 * own u is enough (not a per-particle fade): only the dust near wherever the camera currently is actually renders at
 * meaningful size before fog dissolves the rest, so this cheaply approximates "the dust near this zone" without
 * tracking each particle's own position.
 */
export function RouteDust({ curves, palette, count, shared }: { curves: RigCurves; palette: WorldPalette; count: number; shared: MutableRefObject<RigShared> }) {
  const points = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const fade = useRef(-1);
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

  useEffect(() => {
    mat.current?.color.set(palette.dust);
    fade.current = -1;
  }, [palette]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    if (points.current) points.current.rotation.y += Math.min(delta, 0.05) * 0.004; // slow drift, not a static field
    const u = shared.current.u;
    const inGround = u > DUST_GROUND_MIN && u < DUST_GROUND_MAX;
    const target = inGround ? DUST_HIDDEN : DUST_FAINT;
    if (Math.abs(target - fade.current) > 0.001 && mat.current) {
      fade.current = target;
      mat.current.opacity = target;
    }
  });

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial ref={mat} size={0.09} sizeAttenuation transparent opacity={DUST_FAINT} depthWrite={false} />
    </points>
  );
}
