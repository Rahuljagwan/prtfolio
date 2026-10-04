"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, DoubleSide, Euler, type InstancedMesh, Matrix4, OctahedronGeometry, PlaneGeometry, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const LAYERS = 9;
const NODES_PER_LAYER = 11;
const LAYER_SIZE = 22;
const FIRST_Y = 2.6;
const LAYER_GAP = 1.6;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const lineGeo = (a: number[]) => new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(a), 3));

interface Layout {
  layers: Matrix4[];
  nodes: Matrix4[];
  halos: Matrix4[];
  frames: BufferGeometry; // layer outlines plus inner grid
  links: BufferGeometry; // node-to-node lines between adjacent layers
}

/**
 * Layers are horizontal sheets the rising camera passes through. Each is centred on the camera path at the height where
 * the camera crosses it, so the route threads every layer near its middle and nodes sit around the corridor, not in it.
 */
function buildLayout(curves: RigCurves): Layout {
  const rand = rng(33);
  const samples = curves.position.getPoints(600);
  const centreAt = (y: number) => samples.find((p, i) => i > 300 && p.y >= y) ?? samples[samples.length - 1];

  const layers: Matrix4[] = [];
  const nodes: Matrix4[] = [];
  const halos: Matrix4[] = [];
  const framePts: number[] = [];
  const linkPts: number[] = [];
  const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  const id = new Quaternion();
  const half = LAYER_SIZE / 2;
  const cell = LAYER_SIZE / 8;

  let prev: Vector3[] = [];
  for (let k = 0; k < LAYERS; k++) {
    const y = FIRST_Y + k * LAYER_GAP;
    const c = centreAt(y);
    const cx = c.x;
    const cz = c.z;
    layers.push(new Matrix4().compose(new Vector3(cx, y, cz), flat, new Vector3(1, 1, 1)));

    // Outline, then a coarse inner grid (7 lines each way).
    const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
    framePts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    for (let g = 1; g < 8; g++) {
      framePts.push(x0 + g * cell, y, z0, x0 + g * cell, y, z1, x0, y, z0 + g * cell, x1, y, z0 + g * cell);
    }

    const here: Vector3[] = [];
    for (let n = 0; n < NODES_PER_LAYER; n++) {
      const a = rand() * Math.PI * 2;
      const r = 3.8 + rand() * 7; // never in the corridor the camera uses
      const p = new Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      const s = 0.12 + rand() * rand() * 0.34;
      here.push(p);
      nodes.push(new Matrix4().compose(p, id, new Vector3(s, s, s)));
      halos.push(new Matrix4().compose(p, id, new Vector3(s * 3.2, s * 3.2, s * 3.2)));
    }
    // Link each node up to the nearest node (in plan) on the layer below, like dependencies between tiers.
    if (prev.length) {
      for (const p of here) {
        let best = prev[0];
        let bd = Infinity;
        for (const q of prev) {
          const d = (p.x - q.x) ** 2 + (p.z - q.z) ** 2;
          if (d < bd) { bd = d; best = q; }
        }
        linkPts.push(p.x, p.y, p.z, best.x, best.y, best.z);
      }
    }
    prev = here;
  }
  return { layers, nodes, halos, frames: lineGeo(framePts), links: lineGeo(linkPts) };
}

type Mats = {
  layers?: THREE.MeshBasicMaterial;
  frames?: THREE.LineBasicMaterial;
  links?: THREE.LineBasicMaterial;
  nodes?: THREE.MeshBasicMaterial;
  halos?: THREE.MeshBasicMaterial;
};

function fill(mesh: InstancedMesh | null, matrices: Matrix4[]) {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Zone 5, "The Stack": tiers of translucent sheets (infrastructure, services, application) with glowing nodes on each
 * and dependency lines between them. The camera rises straight up through the layers, so each sheet slides past as a
 * shimmering plane. Static geometry, five draw calls.
 */
export function StackZone({ palette, curves, shared }: { palette: WorldPalette; dark?: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const layerMesh = useRef<InstancedMesh>(null);
  const nodeMesh = useRef<InstancedMesh>(null);
  const haloMesh = useRef<InstancedMesh>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);

  const layout = useMemo(() => buildLayout(curves), [curves]);
  const plane = useMemo(() => new PlaneGeometry(LAYER_SIZE, LAYER_SIZE), []);
  const node = useMemo(() => new OctahedronGeometry(1, 0), []);

  useEffect(() => {
    fill(layerMesh.current, layout.layers);
    fill(nodeMesh.current, layout.nodes);
    fill(haloMesh.current, layout.halos);
  }, [layout]);

  useEffect(() => {
    const M = mats.current;
    M.layers?.color.set(palette.primary);
    M.frames?.color.set(palette.primary);
    M.links?.color.set(palette.route);
    M.nodes?.color.set(palette.accent);
    M.halos?.color.set(palette.accent);
    fade.current = -1;
  }, [palette]);

  useEffect(
    () => () => {
      layout.frames.dispose();
      layout.links.dispose();
      plane.dispose();
      node.dispose();
    },
    [layout, plane, node],
  );

  useFrame(() => {
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    g.visible = !!shared.current.warm || (u > 3.3 && u < 5.8);
    if (!g.visible) return;
    const inn = Math.min(1, Math.max(0, (u - 3.5) / 0.9));
    const out = 1 - Math.min(1, Math.max(0, (u - 5.0) / 0.8));
    const f = inn * inn * (3 - 2 * inn) * out;
    if (Math.abs(f - fade.current) > 0.002) {
      fade.current = f;
      const M = mats.current;
      if (M.layers) M.layers.opacity = 0.07 * f;
      if (M.frames) M.frames.opacity = 0.4 * f;
      if (M.links) M.links.opacity = 0.3 * f;
      if (M.nodes) M.nodes.opacity = 0.95 * f;
      if (M.halos) M.halos.opacity = 0.12 * f;
    }
  });

  const bind = <K extends keyof Mats>(key: K) => (m: Mats[K] | null) => void (mats.current[key] = (m ?? undefined) as Mats[K]);

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={layerMesh} args={[plane, undefined, LAYERS]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("layers")} side={DoubleSide} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <lineSegments geometry={layout.frames} frustumCulled={false}>
        <lineBasicMaterial ref={bind("frames")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={layout.links} frustumCulled={false}>
        <lineBasicMaterial ref={bind("links")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={haloMesh} args={[node, undefined, layout.halos.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("halos")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={nodeMesh} args={[node, undefined, layout.nodes.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("nodes")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
