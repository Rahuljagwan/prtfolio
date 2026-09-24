"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, Euler, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { stationsState } from "@/lib/world/stations";
import { ZONES } from "@/lib/world/zones";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const SLABS = 18;
const ROUTE_DROP = 1.3; // the route line runs this far below the camera path

/** Tiny seeded PRNG: identical layout on every load. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Corners of a unit box, and the 12 edges between them.
const CORNERS: [number, number, number][] = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
];
const EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];

interface Layout {
  slabs: Matrix4[];
  bars: Matrix4[]; // three "UI rows" per slab
  lights: Matrix4[]; // one status light per slab
  edges: BufferGeometry;
  links: BufferGeometry;
}

/**
 * A field of floating "deployment cards" either side of the route, at many depths, with a hairline from each back to
 * the pipeline. Placed along the route between the city and the stack so the camera weaves between them.
 */
function buildLayout(curves: RigCurves): Layout {
  const rand = rng(21);
  const slabs: Matrix4[] = [];
  const bars: Matrix4[] = [];
  const lights: Matrix4[] = [];
  const edgePts: number[] = [];
  const linkPts: number[] = [];
  const v = new Vector3();

  const deployU = ZONES.findIndex((z) => z.id === "deployments");
  const last = ZONES.length - 1;

  for (let i = 0; i < SLABS; i++) {
    const along = i / (SLABS - 1);
    const t = (deployU - 0.85 + along * 1.9) / last; // from just before the zone to just past it
    const p = curves.position.getPoint(Math.min(1, t));
    const side = i % 2 === 0 ? -1 : 1;
    const near = i % 3 === 0; // some cards close to the corridor for strong parallax, the rest further out
    const dx = side * (near ? 4.8 + rand() * 1.8 : 7.5 + rand() * 6);
    const dy = (rand() - 0.45) * (near ? 3.2 : 6.5);
    const dz = (rand() - 0.5) * 2.5;
    const pos = new Vector3(p.x + dx, p.y + dy, p.z + dz);

    const s = 0.8 + rand() * 0.75;
    const scale = new Vector3(4.2 * s, 2.6 * s, 0.16);
    const rot = new Quaternion().setFromEuler(new Euler((rand() - 0.5) * 0.2, -side * (0.25 + rand() * 0.45), (rand() - 0.5) * 0.12));
    const m = new Matrix4().compose(pos, rot, scale);
    slabs.push(m);

    // Unit-box space children (scaled by the slab's own matrix): a header bar and two content rows, plus a status light.
    const child = (x: number, y: number, w: number, h: number) =>
      new Matrix4().multiplyMatrices(m, new Matrix4().compose(new Vector3(x, y, 0.5), new Quaternion(), new Vector3(w, h, 0.6)));
    bars.push(child(0, 0.36, 0.86, 0.09), child(-0.1, 0.05, 0.66, 0.07), child(-0.2, -0.15, 0.46, 0.07));
    lights.push(child(0.38, -0.36, 0.09, 0.14));

    for (const k of EDGES) {
      const c = CORNERS[k];
      v.set(c[0], c[1], c[2]).applyMatrix4(m);
      edgePts.push(v.x, v.y, v.z);
    }
    // Hairline back to the pipeline, ending on the route line itself.
    linkPts.push(pos.x, pos.y, pos.z, p.x, p.y - ROUTE_DROP, p.z);
  }

  const mk = (a: number[]) => new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(a), 3));
  return { slabs, bars, lights, edges: mk(edgePts), links: mk(linkPts) };
}

type Mats = {
  solid?: THREE.MeshStandardMaterial;
  bars?: THREE.MeshBasicMaterial;
  lights?: THREE.MeshBasicMaterial;
  edges?: THREE.LineBasicMaterial;
  links?: THREE.LineBasicMaterial;
};

function fill(mesh: InstancedMesh | null, matrices: Matrix4[]) {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Zone 4, "Deployments": your projects as shipped releases. Floating cards at varying depths around the route, each
 * with a header, content rows and a status light, tethered to the pipeline by a hairline. The camera weaves
 * between them, so nearer cards sweep past faster than far ones. That is the parallax; there is no per-frame animation.
 */
export function DeploymentsZone({ palette, dark, curves, shared }: { palette: WorldPalette; dark: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const slabMesh = useRef<InstancedMesh>(null);
  const barMesh = useRef<InstancedMesh>(null);
  const lightMesh = useRef<InstancedMesh>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);

  const layout = useMemo(() => buildLayout(curves), [curves]);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);

  useEffect(() => {
    fill(slabMesh.current, layout.slabs);
    fill(barMesh.current, layout.bars);
    fill(lightMesh.current, layout.lights);
  }, [layout]);

  useEffect(() => {
    const M = mats.current;
    M.solid?.color.set(dark ? "#171a36" : "#fdfbf6");
    M.bars?.color.set(palette.primary);
    M.lights?.color.set(palette.accent);
    M.edges?.color.set(palette.primary);
    M.links?.color.set(palette.route);
    fade.current = -1;
  }, [palette, dark]);

  useEffect(
    () => () => {
      layout.edges.dispose();
      layout.links.dispose();
      box.dispose();
    },
    [layout, box],
  );

  useFrame(() => {
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    // While the Projects flight is on, the racks are the subject: these decorative cards fade out completely and stop being drawn.
    // (Transparent, but they write depth: even nearly invisible, one in front of a rack would hide the rack behind it.)
    const flight = stationsState.weight;
    g.visible = !!shared.current.warm || (u > 1.9 && u < 5.3 && flight < 0.99);
    if (!g.visible) return;
    const inn = Math.min(1, Math.max(0, (u - 2.2) / 1));
    const out = 1 - Math.min(1, Math.max(0, (u - 4.3) / 0.9));
    const f = inn * inn * (3 - 2 * inn) * out * (1 - flight);
    if (mats.current.solid) mats.current.solid.depthWrite = flight < 0.01;
    if (Math.abs(f - fade.current) > 0.002) {
      fade.current = f;
      const M = mats.current;
      if (M.solid) M.solid.opacity = 0.85 * f;
      if (M.bars) M.bars.opacity = 0.35 * f;
      if (M.lights) M.lights.opacity = f;
      if (M.edges) M.edges.opacity = 0.9 * f;
      if (M.links) M.links.opacity = 0.35 * f;
    }
  });

  const bind = <K extends keyof Mats>(key: K) => (m: Mats[K] | null) => void (mats.current[key] = (m ?? undefined) as Mats[K]);

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={slabMesh} args={[box, undefined, SLABS]} frustumCulled={false}>
        <meshStandardMaterial ref={bind("solid")} flatShading transparent opacity={0} roughness={0.85} metalness={0.05} />
      </instancedMesh>
      <instancedMesh ref={barMesh} args={[box, undefined, SLABS * 3]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("bars")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={lightMesh} args={[box, undefined, SLABS]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("lights")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <lineSegments geometry={layout.edges} frustumCulled={false}>
        <lineBasicMaterial ref={bind("edges")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={layout.links} frustumCulled={false}>
        <lineBasicMaterial ref={bind("links")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
