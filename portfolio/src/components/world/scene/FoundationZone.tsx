"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Euler, type InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { ZONES } from "@/lib/world/zones";
import { makeCityMaterial } from "./CityZone";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const GROUND_Y = -2.7;

// ---- the gate: the single structure the whole site's narrative pivots on ("a request now has to be let in"). See the
// big comment on the component below for the full reasoning. Members are deliberately slender (a wide opening, thin
// pillars) — a "wall" reading up close comes from member thickness, not height, so that is the lever this pulls first.
const GATE_U = 0.92;
const GATE_HALF_WIDTH = 4.4;
const GATE_HEIGHT = 3.2;
const PILLAR_W = 0.2; // well under opening/6 (~1.47), so it reads as a slender frame even at close range
const PILLAR_LOWER_FRAC = 0.8; // fraction of the height that is the wider lower segment, before it tapers
const PILLAR_TAPER = 0.78; // the upper segment's width, as a fraction of the lower one
const LINTEL_H = 0.2;

// ---- the occasional 403: an ambient packet that approaches the gate off-centre and gets turned away. Same visual
// technique as the visitor's own request in RequestOriginZone (sphere + halo + short instanced trail, eased in and
// out) reused locally here, not a shared instance — the two live in different zones and never overlap on screen.
const REJECT_DURATION = 1.7;
const REJECT_TRAIL = 6;
const REJECT_GAP: [number, number] = [5, 9]; // seconds between attempts, randomised

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

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

interface GateLayout {
  /** Two pillars and the lintel, as one instanced mesh. */
  parts: Matrix4[];
  /** The status bar under the lintel gets its own mesh (it pulses on its own), so its transform is kept separately. */
  statusBar: Matrix4;
  base: Vector3;
  forward: Vector3;
  right: Vector3;
}

/**
 * The gate: two pillars, a lintel, and a status bar, built directly on the route curve the camera and every packet
 * ride — GATE_U sits just short of the Foundation pose (u = 1) so the camera has already threaded the archway by the
 * time it settles to read the About content, rather than idling inside it. Same technique as CityZone's milestone
 * gates (a base transform from the curve's point + tangent there, every part composed relative to it) — proven to
 * track the route precisely, so it is reused rather than re-derived.
 */
function buildGate(curves: RigCurves, last: number): GateLayout {
  const t = GATE_U / last;
  const p = curves.position.getPoint(t);
  const tan = curves.position.getTangent(t).clone();
  tan.y = 0;
  tan.normalize();
  const angle = Math.atan2(tan.x, tan.z);
  const tanQ = new Quaternion().setFromEuler(new Euler(0, angle, 0));
  const base = new Matrix4().compose(new Vector3(p.x, GROUND_Y, p.z), tanQ, new Vector3(1, 1, 1));
  const part = (x: number, y: number, sx: number, sy: number, sz: number) =>
    new Matrix4().multiplyMatrices(base, new Matrix4().compose(new Vector3(x, y, 0), new Quaternion(), new Vector3(sx, sy, sz)));
  // Each pillar is two stacked segments, the upper one narrower, so it reads as a tapered structure rather than a
  // monolith even though both segments share the same height as before.
  const lowerH = GATE_HEIGHT * PILLAR_LOWER_FRAC;
  const upperH = GATE_HEIGHT - lowerH;
  const upperW = PILLAR_W * PILLAR_TAPER;
  const parts: Matrix4[] = [];
  for (const side of [-1, 1]) {
    const x = side * GATE_HALF_WIDTH;
    parts.push(part(x, lowerH / 2, PILLAR_W, lowerH, PILLAR_W));
    parts.push(part(x, lowerH + upperH / 2, upperW, upperH, upperW));
  }
  parts.push(part(0, GATE_HEIGHT, GATE_HALF_WIDTH * 2 + PILLAR_W, LINTEL_H, PILLAR_W));
  const statusBar = part(0, GATE_HEIGHT - 0.4, GATE_HALF_WIDTH * 2 - 0.6, 0.06, 0.06);
  return { parts, statusBar, base: new Vector3(p.x, GROUND_Y, p.z), forward: new Vector3(Math.sin(angle), 0, Math.cos(angle)), right: new Vector3(Math.cos(angle), 0, -Math.sin(angle)) };
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
  gate?: THREE.MeshBasicMaterial;
  statusBar?: THREE.MeshBasicMaterial;
};

/**
 * Zone 2, "The Gate": the request has left the browser and now has to be let in. A wireframe blueprint grid running
 * to a glowing horizon, a survey datum (concentric rings) under the route, a low-rise district at the edges of the
 * corridor — and, straddling the route itself, the gate every packet visibly passes through (see buildGate above).
 * A status bar under the lintel pulses to say the gate is open; every so often an ambient, unrelated request
 * approaches off-centre and is turned away with an amber flash — a 403, not the visitor's own request, which always
 * goes through untouched. Fades in as you leave the hero so the first screen stays a calm void.
 */
export function FoundationZone({ palette, dark, curves, shared }: { palette: WorldPalette; dark: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const rings = useRef<THREE.LineSegments>(null);
  const boxes = useRef<InstancedMesh>(null);
  const antMesh = useRef<InstancedMesh>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);
  const invalidate = useThree((s) => s.invalidate);

  const { blocks: footings, masts } = useMemo(makeDistrict, []);
  const { material: cityMat, uni } = useMemo(makeCityMaterial, []);
  const grid = useMemo(() => makeGrid(44, 6, -52, 2), []);
  const edges = useMemo(() => makeEdges(footings), [footings]);
  const ringGeo = useMemo(() => makeRings([1.6, 3.2, 5.2, 8]), []);
  const boxGeo = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const gateLayout = useMemo(() => buildGate(curves, ZONES.length - 1), [curves]);
  const gateMesh = useRef<InstancedMesh>(null);
  const statusBar = useRef<THREE.Mesh>(null);
  const statusColor = useMemo(() => new Color(), []);

  // ---- the occasional 403 (see the component comment above).
  const reject = useRef({ t: -1, next: 4 + Math.random() * 3 });
  const rejectPts = useRef({ a: new Vector3(), d: new Vector3(), b: new Vector3() });
  const rejectGroup = useRef<THREE.Group>(null);
  const rejectTrailMesh = useRef<InstancedMesh>(null);
  const rejectPacketMat = useMemo(() => new MeshBasicMaterial({ color: "#fff3d9", transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const rejectHaloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const rejectTrailMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const rejectAccent = useMemo(() => new Color(), []);
  const rejectFlashColor = useMemo(() => new Color(), []);
  const tmpRP = useMemo(() => new Vector3(), []);
  const tmpRP2 = useMemo(() => new Vector3(), []);
  const tmpRM = useMemo(() => new Matrix4(), []);
  const tmpRQ = useMemo(() => new Quaternion(), []);
  const tmpRS = useMemo(() => new Vector3(), []);

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
    const m = gateMesh.current;
    if (!m) return;
    gateLayout.parts.forEach((mtx, i) => m.setMatrixAt(i, mtx));
    m.instanceMatrix.needsUpdate = true;
    const sb = statusBar.current;
    if (sb) {
      sb.matrixAutoUpdate = false;
      sb.matrix.copy(gateLayout.statusBar);
    }
  }, [gateLayout]);

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
    M.gate?.color.set(palette.primary);
    // Blended toward white, the same reason RequestOriginZone blends its completion flash: the raw "healthy" green is
    // the same hue as the gate structure itself, so a same-hue status light barely reads as lit against it.
    statusColor.set(palette.primary).lerp(new Color("#ffffff"), 0.5);
    M.statusBar?.color.copy(statusColor);
    rejectAccent.set(palette.accent);
    rejectFlashColor.set(palette.accent).lerp(new Color("#ffffff"), 0.55);
    rejectHaloMat.color.copy(rejectAccent);
    rejectTrailMat.color.copy(rejectAccent);
    fade.current = -1; // force opacity refresh
  }, [palette, dark, cityMat, uni, statusColor, rejectAccent, rejectFlashColor, rejectHaloMat, rejectTrailMat]);

  useEffect(
    () => () => {
      cityMat.dispose();
      grid.fine.dispose();
      grid.major.dispose();
      edges.dispose();
      ringGeo.dispose();
      horizonGeo.dispose();
      boxGeo.dispose();
      rejectPacketMat.dispose();
      rejectHaloMat.dispose();
      rejectTrailMat.dispose();
    },
    [grid, edges, ringGeo, horizonGeo, boxGeo, cityMat, rejectPacketMat, rejectHaloMat, rejectTrailMat],
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
      if (M.gate) M.gate.opacity = 0.85 * f;
    }
    if (rings.current) rings.current.rotation.y += Math.min(delta, 0.05) * 0.05; // the zone's only motion

    // The status bar under the lintel: a slow pulse, saying the gate is open, independent of the zone's own fade-in.
    const sbMat = mats.current.statusBar;
    if (sbMat) {
      const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0016));
      sbMat.opacity = f * pulse;
    }

    // The occasional 403: on a timer, an ambient request approaches the gate off-centre and gets turned away.
    const rj = reject.current;
    if (rj.t < 0) {
      rj.next -= delta; // real elapsed time between attempts, not clamped: it should stay roughly REJECT_GAP seconds apart
      if (rj.next <= 0) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const { base, forward, right } = gateLayout;
        const y = base.y + 0.85;
        const inset = GATE_HALF_WIDTH * 0.45; // off-centre but still inside the opening, approaching
        const kicked = GATE_HALF_WIDTH * 1.3; // beyond the pillars, after the deflect
        rejectPts.current.a.copy(base).addScaledVector(forward, -5.4).addScaledVector(right, side * inset).setY(y);
        rejectPts.current.d.copy(base).addScaledVector(forward, -1.05).addScaledVector(right, side * inset).setY(y);
        rejectPts.current.b.copy(base).addScaledVector(forward, -0.25).addScaledVector(right, side * kicked).setY(y);
        rj.t = 0;
        rj.next = REJECT_GAP[0] + Math.random() * (REJECT_GAP[1] - REJECT_GAP[0]);
      }
    } else {
      rj.t += Math.min(delta, 0.1) / REJECT_DURATION;
      invalidate(); // demand-mode: keep the loop alive while this short animation is running, same as the hero's own packet
      if (rj.t >= 1) rj.t = -1;
    }
    if (rj.t >= 0) {
      const tt = rj.t;
      const P = rejectPts.current;
      const atSeg = (k: number) => (k < 0.6 ? tmpRP.copy(P.a).lerp(P.d, smooth(k / 0.6)) : tmpRP.copy(P.d).lerp(P.b, smooth((k - 0.6) / 0.4)));
      const pos = atSeg(tt);
      if (rejectGroup.current) rejectGroup.current.position.copy(pos);
      const edge = Math.min(1, tt * 9) * Math.min(1, (1 - tt) * 5);
      const flash = tt > 0.55 && tt < 0.8;
      rejectPacketMat.opacity = edge * 0.8;
      rejectHaloMat.opacity = edge * (flash ? 0.85 : 0.3);
      rejectHaloMat.color.copy(flash ? rejectFlashColor : rejectAccent);
      const tm = rejectTrailMesh.current;
      if (tm) {
        for (let k = 0; k < REJECT_TRAIL; k++) {
          const ttk = Math.max(0, tt - (k + 1) * 0.02);
          const k2 = ttk < 0.6 ? tmpRP2.copy(P.a).lerp(P.d, smooth(ttk / 0.6)) : tmpRP2.copy(P.d).lerp(P.b, smooth((ttk - 0.6) / 0.4));
          const s = 0.075 * (1 - k / REJECT_TRAIL) * edge;
          tmpRM.compose(k2, tmpRQ, tmpRS.set(s, s, s));
          tm.setMatrixAt(k, tmpRM);
        }
        tm.instanceMatrix.needsUpdate = true;
        rejectTrailMat.opacity = edge * 0.55;
        rejectTrailMat.color.copy(flash ? rejectFlashColor : rejectAccent);
      }
    } else {
      rejectPacketMat.opacity = 0;
      rejectHaloMat.opacity = 0;
      rejectTrailMat.opacity = 0;
    }
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

      {/* The gate: two pillars and a lintel, straddling the route curve every packet (and the camera) rides through. */}
      <instancedMesh ref={gateMesh} args={[boxGeo, undefined, gateLayout.parts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("gate")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <mesh ref={statusBar} geometry={boxGeo}>
        <meshBasicMaterial ref={bind("statusBar")} transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* The occasional 403: an ambient packet with its own short trail, independent of the visitor's own request. */}
      <instancedMesh ref={rejectTrailMesh} args={[undefined, undefined, REJECT_TRAIL]} frustumCulled={false} renderOrder={1800} material={rejectTrailMat}>
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
      <group ref={rejectGroup}>
        <mesh renderOrder={1801} material={rejectHaloMat}>
          <sphereGeometry args={[0.14, 12, 9]} />
        </mesh>
        <mesh renderOrder={1802} material={rejectPacketMat}>
          <sphereGeometry args={[0.055, 12, 9]} />
        </mesh>
      </group>
    </group>
  );
}
