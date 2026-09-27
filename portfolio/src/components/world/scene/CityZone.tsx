"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Euler, MeshStandardMaterial, type InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { ZONES } from "@/lib/world/zones";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";
import { ambientInvalidate } from "./ambient";

const GROUND_Y = -2.7;
const BUILDINGS = 120;
// Five milestone gates the route passes through: Build, Test (CI), then Staging, Canary, Production (CD). No
// on-screen text — colour alone carries the status (amber = in progress, green = deployed/healthy, the same rule as
// everywhere else in this world), so scrolling past them reads as amber, amber, green, green, green: a pipeline
// moving toward production, not five identical arches.
const GATE_U = [1.6, 1.9, 2.2, 2.5, 2.8];
const CI_GATES = 2; // the first CI_GATES entries of GATE_U are CI; the rest are CD
const GATE_HALF_WIDTH = 3;
const GATE_HEIGHT = 5.6;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const CORNERS: [number, number, number][] = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
];
const EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];

const lineGeo = (a: number[]) => new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(a), 3));

interface Layout {
  buildings: Matrix4[];
  strips: Matrix4[]; // lit bands on some building faces
  antennas: Matrix4[]; // rooftop masts on the taller towers
  ciGateParts: Matrix4[]; // pillars, lintel and marker for the two CI gates
  ciLightParts: Matrix4[]; // their light bars, kept separate so it can pulse on its own
  cdGateParts: Matrix4[]; // the three CD gates
  cdLightParts: Matrix4[];
  edges: BufferGeometry;
  ground: BufferGeometry;
}

/** Geometric city along the route, with a gate the route passes through at each milestone. Deterministic layout. */
function buildLayout(curves: RigCurves): Layout {
  const rand = rng(5);
  const last = ZONES.length - 1;
  const buildings: Matrix4[] = [];
  const strips: Matrix4[] = [];
  const antennas: Matrix4[] = [];
  const edgePts: number[] = [];
  const v = new Vector3();
  const qId = new Quaternion();

  const uStart = 1.35;
  const uEnd = 3.0;
  for (let i = 0; i < BUILDINGS; i++) {
    const t = (uStart + (i / (BUILDINGS - 1)) * (uEnd - uStart)) / last;
    const p = curves.position.getPoint(t);
    const side = rand() < 0.5 ? -1 : 1;
    const dx = side * (GATE_HALF_WIDTH + 1.6 + rand() * 15); // never inside the corridor the gates and camera use
    const dz = (rand() - 0.5) * 5;
    const w = 1.2 + rand() * 2.2;
    const d = 1.2 + rand() * 2.2;
    // Mostly low blocks, a few towers, taller the further from the route so the skyline frames the view.
    const h = (0.8 + rand() * rand() * 7) * (1 + Math.abs(dx) / 14);
    const cx = p.x + dx;
    const cz = p.z + dz;
    const m = new Matrix4().compose(new Vector3(cx, GROUND_Y + h / 2, cz), qId, new Vector3(w, h, d));
    buildings.push(m);
    // Taller towers get a stepped crown (a smaller block on top) and sometimes a mast, so the skyline has a real silhouette.
    if (h > 3.6 && rand() < 0.75) {
      const th = h * (0.18 + rand() * 0.12);
      const tm = new Matrix4().compose(new Vector3(cx, GROUND_Y + h + th / 2, cz), qId, new Vector3(w * 0.62, th, d * 0.62));
      buildings.push(tm);
      for (const k of EDGES) {
        const c = CORNERS[k];
        v.set(c[0], c[1], c[2]).applyMatrix4(tm);
        edgePts.push(v.x, v.y, v.z);
      }
      if (h > 5 && rand() < 0.7) antennas.push(new Matrix4().compose(new Vector3(cx, GROUND_Y + h + th + 0.65, cz), qId, new Vector3(0.05, 1.3, 0.05)));
    }

    for (const k of EDGES) {
      const c = CORNERS[k];
      v.set(c[0], c[1], c[2]).applyMatrix4(m);
      edgePts.push(v.x, v.y, v.z);
    }
    if (rand() < 0.3) {
      // A lit band across the face that looks toward the route.
      const y = -0.5 + 0.15 + rand() * 0.7;
      const face = new Matrix4().compose(new Vector3(-side * 0.5, y, 0), qId, new Vector3(0.02, 0.05 + rand() * 0.06, 0.86));
      strips.push(new Matrix4().multiplyMatrices(m, face));
    }
  }

  // Milestone gates: two pillars, a lintel and a diamond marker (structure), plus a light bar kept separate so it
  // can pulse on its own — see GATE_U's comment for the CI/CD split and why there is no text.
  const ciGateParts: Matrix4[] = [];
  const ciLightParts: Matrix4[] = [];
  const cdGateParts: Matrix4[] = [];
  const cdLightParts: Matrix4[] = [];
  const tanQ = new Quaternion();
  GATE_U.forEach((u, gi) => {
    const t = u / last;
    const p = curves.position.getPoint(t);
    const tan = curves.position.getTangent(t);
    tanQ.setFromEuler(new Euler(0, Math.atan2(tan.x, tan.z), 0));
    const base = new Matrix4().compose(new Vector3(p.x, GROUND_Y, p.z), tanQ, new Vector3(1, 1, 1));
    const part = (x: number, y: number, sx: number, sy: number, sz: number, rz = 0) =>
      new Matrix4().multiplyMatrices(base, new Matrix4().compose(new Vector3(x, y, 0), new Quaternion().setFromEuler(new Euler(0, 0, rz)), new Vector3(sx, sy, sz)));
    const structure = gi < CI_GATES ? ciGateParts : cdGateParts;
    const light = gi < CI_GATES ? ciLightParts : cdLightParts;
    structure.push(
      part(-GATE_HALF_WIDTH, GATE_HEIGHT / 2, 0.08, GATE_HEIGHT, 0.08),
      part(GATE_HALF_WIDTH, GATE_HEIGHT / 2, 0.08, GATE_HEIGHT, 0.08),
      part(0, GATE_HEIGHT, GATE_HALF_WIDTH * 2 + 0.08, 0.08, 0.08),
      part(0, GATE_HEIGHT + 0.7, 0.4, 0.4, 0.06, Math.PI / 4),
    );
    // The CI light bar is thicker than CD's: amber reads weaker than green against this green-heavy backdrop (district
    // edges, route line, halos), so its status carrier needs more presence, not just a brighter colour.
    const barH = gi < CI_GATES ? 0.05 : 0.03;
    light.push(part(0, GATE_HEIGHT - 0.5, GATE_HALF_WIDTH * 2 - 0.4, barH, barH));
  });

  // Ground grid under the whole district (the Foundation grid fades out as this one fades in).
  const gp: number[] = [];
  const zNear = -10;
  const zFar = -62;
  const ext = 40;
  for (let x = -ext; x <= ext; x += 4) gp.push(x, GROUND_Y, zNear, x, GROUND_Y, zFar);
  for (let z = zNear; z >= zFar; z -= 4) gp.push(-ext, GROUND_Y, z, ext, GROUND_Y, z);

  return { buildings, strips, antennas, ciGateParts, ciLightParts, cdGateParts, cdLightParts, edges: lineGeo(edgePts), ground: lineGeo(gp) };
}

/**
 * The buildings' material: a normal MeshStandardMaterial (so real lighting and fog still apply) with a few procedural
 * additions injected into its shader. Nothing is a texture, so there is nothing to download.
 *   - windows: a grid on every vertical face, in world space so a crown lines up with its tower; about 40 percent are lit,
 *     warm or cool, the rest read as dark glass;
 *   - a light gradient from a dim base to a brighter crown, so towers rise out of the ground haze;
 *   - a fresnel rim in the theme colour, like sky light catching the edges;
 *   - fading is a screen-door dither (discard by noise) rather than alpha blending, so the material stays opaque and
 *     depth-tested (correct overlap, cheaper) and never switches shader variants.
 */
export function makeCityMaterial() {
  const uni = {
    uFade: { value: 0 },
    uGround: { value: GROUND_Y },
    uGlass: { value: new Color() },
    uWinA: { value: new Color() },
    uWinB: { value: new Color() },
    uWinI: { value: 1 },
    uRim: { value: new Color() },
  };
  const material = new MeshStandardMaterial({ roughness: 0.6, metalness: 0.15 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vWPos;\nvarying vec3 vWNormal;\nvoid main() {")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        vec3 wn3 = objectNormal;
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
          wn3 = mat3(instanceMatrix) * wn3;
        #endif
        vWPos = (modelMatrix * wp4).xyz;
        vWNormal = normalize(mat3(modelMatrix) * wn3);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform float uFade; uniform float uGround; uniform vec3 uGlass; uniform vec3 uWinA; uniform vec3 uWinB; uniform float uWinI; uniform vec3 uRim;
        varying vec3 vWPos; varying vec3 vWNormal;
        void main() {
          float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (ign > uFade) discard;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        vec3 wn = normalize(vWNormal);
        float facade = 1.0 - smoothstep(0.35, 0.65, abs(wn.y));
        vec2 wuv = abs(wn.x) > abs(wn.z) ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y);
        vec2 cellSize = vec2(0.46, 0.62);
        vec2 cid = floor(wuv / cellSize);
        vec2 cf = fract(wuv / cellSize);
        float bid = floor(vWPos.x * 0.31) * 7.13 + floor(vWPos.z * 0.29) * 3.71;
        float rnd = fract(sin(dot(cid + bid, vec2(12.9898, 78.233))) * 43758.5453);
        float winBox = step(0.16, cf.x) * step(cf.x, 0.84) * step(0.2, cf.y) * step(cf.y, 0.8);
        float win = winBox * facade * smoothstep(uGround + 0.35, uGround + 0.9, vWPos.y);
        float lit = step(0.6, rnd);
        float tint = step(0.5, fract(rnd * 7.31));
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, win * 0.75);
        totalEmissiveRadiance += mix(uWinA, uWinB, tint) * win * lit * uWinI * (0.7 + 0.6 * fract(rnd * 3.7));
        float hgrad = smoothstep(uGround, uGround + 9.0, vWPos.y);
        diffuseColor.rgb *= mix(0.55, 1.15, hgrad);
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6);
        totalEmissiveRadiance += uRim * fres * 0.32 * (0.4 + 0.6 * hgrad);`,
      );
  };
  return { material, uni };
}

type Mats = {
  ants?: THREE.MeshBasicMaterial;
  strips?: THREE.MeshBasicMaterial;
  ciGates?: THREE.MeshBasicMaterial;
  ciLight?: THREE.MeshBasicMaterial;
  cdGates?: THREE.MeshBasicMaterial;
  cdLight?: THREE.MeshBasicMaterial;
  edges?: THREE.LineBasicMaterial;
  ground?: THREE.LineBasicMaterial;
};

function fill(mesh: InstancedMesh | null, matrices: Matrix4[]) {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * Zone 3, "The Build": production systems as a city, in two beats sharing one continuous backdrop. Lit towers with
 * stepped crowns and masts frame the route; five milestone gates stand on it for the camera to fly through, the
 * first two amber (CI: build, test), the last three green (CD: staging, canary, production) — see GATE_U's comment.
 * Each gate's light bar pulses on its own, the same "the system is alive" idea as the Gate zone's status bar. The
 * buildings are opaque, depth-tested and shaded with a small procedural shader (window grid, glass, height
 * gradient, sky rim); see makeCityMaterial. Every kind of object is one instanced draw call; only the two light
 * bars animate per frame, so this needs the render scheduler's idle animation (see useRenderScheduler's
 * cityVisible) to keep pulsing while the visitor is reading Experience or Journey without scrolling.
 */
export function CityZone({ palette, dark, curves, shared }: { palette: WorldPalette; dark: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const buildingMesh = useRef<InstancedMesh>(null);
  const stripMesh = useRef<InstancedMesh>(null);
  const ciGateMesh = useRef<InstancedMesh>(null);
  const ciLightMesh = useRef<InstancedMesh>(null);
  const cdGateMesh = useRef<InstancedMesh>(null);
  const cdLightMesh = useRef<InstancedMesh>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);
  const invalidate = useThree((s) => s.invalidate);

  const layout = useMemo(() => buildLayout(curves), [curves]);
  const antMesh = useRef<InstancedMesh>(null);
  const { material: cityMat, uni } = useMemo(makeCityMaterial, []);
  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const ciLightColor = useMemo(() => new Color(), []);
  const cdLightColor = useMemo(() => new Color(), []);

  useEffect(() => {
    fill(buildingMesh.current, layout.buildings);
    fill(stripMesh.current, layout.strips);
    fill(antMesh.current, layout.antennas);
    fill(ciGateMesh.current, layout.ciGateParts);
    fill(ciLightMesh.current, layout.ciLightParts);
    fill(cdGateMesh.current, layout.cdGateParts);
    fill(cdLightMesh.current, layout.cdLightParts);
  }, [layout]);

  useEffect(() => {
    const M = mats.current;
    cityMat.color.set(dark ? "#151a38" : "#f1eadb");
    uni.uGlass.value.set(dark ? "#0a0d22" : "#93a7cf");
    uni.uWinA.value.set(dark ? "#ffb35a" : "#ffcf86");
    uni.uWinB.value.set(dark ? "#7fd6ff" : "#b7cdfa");
    uni.uWinI.value = dark ? 1.15 : 0.4;
    uni.uRim.value.set(palette.primary);
    M.ants?.color.set(palette.accent);
    M.strips?.color.set(palette.accent);
    M.ciGates?.color.set(palette.accent); // CI: amber, in progress
    M.cdGates?.color.set(palette.primary); // CD: green, deployed/healthy
    // Light bars blend toward white, the same reason the Gate zone's status bar and the hero's completion flash do:
    // a pulse in the exact structure colour barely registers against that same-hued structure. CI blends further —
    // this whole district reads green by default (buildings, edges, the route line), so amber needs to be pushed
    // harder to stay legible against it; a screenshot check confirmed the original 0.5 blend read as green, not amber.
    ciLightColor.set(palette.accent).lerp(new Color("#ffffff"), 0.72);
    cdLightColor.set(palette.primary).lerp(new Color("#ffffff"), 0.5);
    M.ciLight?.color.copy(ciLightColor);
    M.cdLight?.color.copy(cdLightColor);
    M.edges?.color.set(palette.primary);
    M.ground?.color.set(palette.grid);
    fade.current = -1;
  }, [palette, dark, cityMat, uni, ciLightColor, cdLightColor]);

  useEffect(
    () => () => {
      cityMat.dispose();
      layout.edges.dispose();
      layout.ground.dispose();
      box.dispose();
    },
    [layout, box, cityMat],
  );

  useFrame(() => {
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    g.visible = !!shared.current.warm || (u > 1.0 && u < 3.0);
    if (!g.visible) return;
    const inn = Math.min(1, Math.max(0, (u - 1.2) / 0.65)); // fully in by u = 1.85, so the Experience plateau (u = 2) is never dithered
    const out = 1 - Math.min(1, Math.max(0, (u - 2.35) / 0.55)); // gone before the Projects zone (u = 3)
    const f = inn * inn * (3 - 2 * inn) * out;
    if (Math.abs(f - fade.current) > 0.002) {
      fade.current = f;
      const M = mats.current;
      uni.uFade.value = f; // buildings are opaque and depth-tested; they dissolve with a dither instead of blending
      if (M.ants) M.ants.opacity = 0.9 * f;
      if (M.strips) M.strips.opacity = 0.45 * f;
      if (M.ciGates) M.ciGates.opacity = 0.6 * f;
      if (M.cdGates) M.cdGates.opacity = 0.6 * f;
      if (M.edges) M.edges.opacity = 0.5 * f;
      if (M.ground) M.ground.opacity = 0.28 * f;
    }
    // The two light bars pulse continuously (independent of the fade-refresh threshold above), same technique as
    // the Gate zone's status bar. Needs a redraw every frame it is visible, hence invalidate().
    const M = mats.current;
    if (M.ciLight || M.cdLight) {
      const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0016));
      if (M.ciLight) M.ciLight.opacity = 0.95 * f * pulse; // brighter peak: amber needs more presence against this green-heavy backdrop
      if (M.cdLight) M.cdLight.opacity = 0.6 * f * pulse;
      ambientInvalidate(invalidate);
    }
  });

  const bind = <K extends keyof Mats>(key: K) => (m: Mats[K] | null) => void (mats.current[key] = (m ?? undefined) as Mats[K]);

  return (
    <group ref={root} visible={false}>
      <lineSegments geometry={layout.ground} frustumCulled={false}>
        <lineBasicMaterial ref={bind("ground")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={buildingMesh} args={[box, cityMat, layout.buildings.length]} frustumCulled={false}>
      </instancedMesh>
      <lineSegments geometry={layout.edges} frustumCulled={false}>
        <lineBasicMaterial ref={bind("edges")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <instancedMesh ref={stripMesh} args={[box, undefined, layout.strips.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("strips")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={antMesh} args={[box, undefined, layout.antennas.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("ants")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ciGateMesh} args={[box, undefined, layout.ciGateParts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("ciGates")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ciLightMesh} args={[box, undefined, layout.ciLightParts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("ciLight")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={cdGateMesh} args={[box, undefined, layout.cdGateParts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("cdGates")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={cdLightMesh} args={[box, undefined, layout.cdLightParts.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("cdLight")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
