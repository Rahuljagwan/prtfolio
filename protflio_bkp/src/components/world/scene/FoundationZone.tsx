"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import { makeCityMaterial } from "./CityZone";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const GROUND_Y = -2.7;

/** Tiny seeded PRNG so the layout is identical on every load (no random popping between visits). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface Footing {
  x: number;
  z: number;
  /** World y of the bottom of this block (the ground, or the top of the tower it crowns). */
  y0: number;
  w: number;
  h: number;
  d: number;
}

interface Mast {
  x: number;
  y: number;
  z: number;
}

/**
 * A low-rise district along both sides of the corridor: blocks tall enough to show windows, the taller ones with a stepped
 * crown, and a few with a rooftop mast. Same shader as the city that follows (see makeCityMaterial), so the two read as one
 * place. Deterministic.
 */
function makeDistrict(): { blocks: Footing[]; masts: Mast[] } {
  const rand = rng(7);
  const blocks: Footing[] = [];
  const masts: Mast[] = [];
  for (let i = 0; i < 32; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (5 + rand() * 16);
    const z = -8 - rand() * 34;
    const w = 1.5 + rand() * 2.4;
    const d = 1.5 + rand() * 2.4;
    const h = 0.9 + rand() * rand() * 4.6; // mostly low-rise, a few taller
    blocks.push({ x, z, y0: GROUND_Y, w, h, d });
    if (h > 2.4 && rand() < 0.75) {
      const th = h * (0.2 + rand() * 0.12);
      blocks.push({ x, z, y0: GROUND_Y + h, w: w * 0.62, h: th, d: d * 0.62 });
      if (h > 3.4 && rand() < 0.7) masts.push({ x, y: GROUND_Y + h + th + 0.6, z });
    }
  }
  return { blocks, masts };
}

const lineGeo = (a: number[]) => new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(a), 3));

/** Ground grid as two LineSegments: fine cells and brighter major lines every 5th. Two draw calls in total. */
function makeGrid(extentX: number, zNear: number, zFar: number, step: number) {
  const fine: number[] = [];
  const major: number[] = [];
  for (let x = -extentX; x <= extentX; x += step) {
    (Math.round(x / step) % 5 === 0 ? major : fine).push(x, 0, zNear, x, 0, zFar);
  }
  for (let z = zNear; z >= zFar; z -= step) {
    (Math.round(z / step) % 5 === 0 ? major : fine).push(-extentX, 0, z, extentX, 0, z);
  }
  return { fine: lineGeo(fine), major: lineGeo(major) };
}

/** Every box's 12 edges merged into one geometry, so all footing outlines are a single draw call. */
function makeEdges(footings: Footing[]) {
  const pts: number[] = [];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  for (const f of footings) {
    const x0 = f.x - f.w / 2;
    const x1 = f.x + f.w / 2;
    const z0 = f.z - f.d / 2;
    const z1 = f.z + f.d / 2;
    const y0 = f.y0;
    const y1 = f.y0 + f.h;
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
      [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
    ];
    for (const k of e) pts.push(c[k][0], c[k][1], c[k][2]);
  }
  return lineGeo(pts);
}

/** Concentric rings plus a crosshair lying flat on the ground, like a survey datum. */
function makeRings(radii: number[]) {
  const pts: number[] = [];
  const y = GROUND_Y + 0.01;
  const seg = 96;
  for (const r of radii) {
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const b = ((i + 1) / seg) * Math.PI * 2;
      pts.push(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(b) * r, y, Math.sin(b) * r);
    }
  }
  const R = radii[radii.length - 1] + 1.2;
  pts.push(-R, y, 0, R, y, 0, 0, y, -R, 0, y, R);
  return lineGeo(pts);
}

type Mats = {
  fine?: THREE.LineBasicMaterial;
  major?: THREE.LineBasicMaterial;
  edges?: THREE.LineBasicMaterial;
  rings?: THREE.LineBasicMaterial;
  ants?: THREE.MeshBasicMaterial;
  horizon?: THREE.MeshBasicMaterial;
};

/**
 * Zone 2, "Foundation": the ground everything else is built on. A wireframe blueprint grid running to a glowing
 * horizon, a survey datum (concentric rings) under the route, and a low-rise district of lit blocks at the edges of the corridor.
 * Fades in as you leave the hero so the first screen stays a calm void.
 */
export function FoundationZone({ palette, dark, shared }: { palette: WorldPalette; dark: boolean; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const rings = useRef<THREE.LineSegments>(null);
  const boxes = useRef<InstancedMesh>(null);
  const antMesh = useRef<InstancedMesh>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);

  const { blocks: footings, masts } = useMemo(makeDistrict, []);
  const { material: cityMat, uni } = useMemo(makeCityMaterial, []);
  const grid = useMemo(() => makeGrid(44, 6, -52, 2), []);
  const edges = useMemo(() => makeEdges(footings), [footings]);
  const ringGeo = useMemo(() => makeRings([1.6, 3.2, 5.2, 8]), []);
  const boxGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const horizonGeo = useMemo(() => {
    // Gradient band: strong at the ground line, fading upward. Alpha comes from the 4-component vertex colour.
    const w = 120;
    const h = 14;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([-w, 0, 0, w, 0, 0, w, h, 0, -w, h, 0]), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array([1, 1, 1, 0.9, 1, 1, 1, 0.9, 1, 1, 1, 0, 1, 1, 1, 0]), 4));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    return g;
  }, []);

  useEffect(() => {
    const m = boxes.current;
    if (!m) return;
    const tmp = new Matrix4();
    const q = new Quaternion();
    footings.forEach((f, i) => {
      tmp.compose(new Vector3(f.x, f.y0 + f.h / 2, f.z), q, new Vector3(f.w, f.h, f.d));
      m.setMatrixAt(i, tmp);
    });
    m.instanceMatrix.needsUpdate = true;
    const a = antMesh.current;
    if (a) {
      masts.forEach((p, i) => {
        tmp.compose(new Vector3(p.x, p.y, p.z), q, new Vector3(0.05, 1.2, 0.05));
        a.setMatrixAt(i, tmp);
      });
      a.instanceMatrix.needsUpdate = true;
    }
  }, [footings, masts]);

  useEffect(() => {
    const M = mats.current;
    M.fine?.color.set(palette.grid);
    M.major?.color.set(palette.primary);
    M.edges?.color.set(palette.primary);
    M.rings?.color.set(palette.accent);
    cityMat.color.set(dark ? "#151a38" : "#f1eadb");
    uni.uGlass.value.set(dark ? "#0a0d22" : "#93a7cf");
    uni.uWinA.value.set(dark ? "#ffb35a" : "#ffcf86");
    uni.uWinB.value.set(dark ? "#7fd6ff" : "#b7cdfa");
    uni.uWinI.value = dark ? 1.15 : 0.4;
    uni.uRim.value.set(palette.primary);
    M.ants?.color.set(palette.accent);
    M.horizon?.color.set(palette.accent);
    fade.current = -1; // force opacity refresh
  }, [palette, dark, cityMat, uni]);

  useEffect(
    () => () => {
      cityMat.dispose();
      grid.fine.dispose();
      grid.major.dispose();
      edges.dispose();
      ringGeo.dispose();
      horizonGeo.dispose();
      boxGeo.dispose();
    },
    [grid, edges, ringGeo, horizonGeo, boxGeo, cityMat],
  );

  useFrame((_, delta) => {
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    g.visible = !!shared.current.warm || (u > 0.05 && u < 2.7); // costs nothing outside its own stretch of the journey
    if (!g.visible) return;
    const inn = Math.min(1, Math.max(0, (u - 0.1) / 0.7));
    const out = 1 - Math.min(1, Math.max(0, (u - 1.7) / 0.9));
    const f = inn * inn * (3 - 2 * inn) * out;
    if (Math.abs(f - fade.current) > 0.002) {
      fade.current = f;
      const M = mats.current;
      if (M.fine) M.fine.opacity = 0.32 * f;
      if (M.major) M.major.opacity = 0.55 * f;
      if (M.edges) M.edges.opacity = 0.9 * f;
      if (M.rings) M.rings.opacity = 0.75 * f;
      uni.uFade.value = f; // opaque and depth-tested; dissolves with a dither, and is fully in by the About plateau
      if (M.ants) M.ants.opacity = 0.9 * f;
      if (M.horizon) M.horizon.opacity = 0.35 * f;
    }
    if (rings.current) rings.current.rotation.y += Math.min(delta, 0.05) * 0.05; // the zone's only motion
  });

  const bind = <K extends keyof Mats>(key: K) => (m: Mats[K] | null) => void (mats.current[key] = (m ?? undefined) as Mats[K]);

  return (
    <group ref={root} visible={false}>
      {/* Grid geometry is built at y = 0; lift it to the ground plane. */}
      <lineSegments geometry={grid.fine} position={[0, GROUND_Y, 0]}>
        <lineBasicMaterial ref={bind("fine")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={grid.major} position={[0, GROUND_Y, 0]}>
        <lineBasicMaterial ref={bind("major")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <group position={[0, 0, -14]}>
        <lineSegments ref={rings} geometry={ringGeo}>
          <lineBasicMaterial ref={bind("rings")} transparent opacity={0} depthWrite={false} />
        </lineSegments>
      </group>

      <instancedMesh ref={boxes} args={[boxGeo, cityMat, footings.length]} frustumCulled={false} />
      <instancedMesh ref={antMesh} args={[boxGeo, undefined, masts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("ants")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <lineSegments geometry={edges} frustumCulled={false}>
        <lineBasicMaterial ref={bind("edges")} transparent opacity={0} depthWrite={false} />
      </lineSegments>

      {/* Horizon glow, unaffected by fog so it stays readable at distance. */}
      <mesh geometry={horizonGeo} position={[0, GROUND_Y, -60]}>
        <meshBasicMaterial ref={bind("horizon")} vertexColors transparent opacity={0} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}
