"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Sparkles } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  AdditiveBlending,
  Color,
  DynamicDrawUsage,
  Fog,
  type Group,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  NormalBlending,
  type MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { PALETTE } from "@/components/world/scene/palette";
import { ASSISTANT_WAKE, clusterColor, type AssistantBridge, type ClusterInfo } from "../bridge";

// ---- layout constants
const RADIUS = 3.7; // distance from the core to each section's hub
const CAMERA_Z = 13;
const FOV = 40;
const MAX_PULSES = 28;
const CORE_SCALE = 0.85;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

interface NodeDef {
  pos: Vector3;
  cluster: number;
  scale: number;
  seed: number;
  hub: boolean;
}

interface Graph {
  hubs: Vector3[];
  nodes: NodeDef[];
  edgePositions: Float32Array;
  edgeCluster: Uint8Array; // owning cluster of each edge vertex, for colouring
  spokePoints: [number, number, number][]; // core -> hub, as segment pairs for the fat-line renderer
}

/** One constellation per portfolio section, spread evenly on a sphere (Fibonacci lattice) around the core. Deterministic. */
function buildGraph(clusters: ClusterInfo[]): Graph {
  const rand = rng(11);
  const n = clusters.length;
  const hubs: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const y = n > 1 ? (1 - (i / (n - 1)) * 2) * 0.82 : 0;
    const r = Math.sqrt(1 - y * y);
    const theta = i * 2.399963;
    hubs.push(new Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r).multiplyScalar(RADIUS * (0.92 + rand() * 0.16)));
  }

  const nodes: NodeDef[] = [];
  const edges: number[] = [];
  const edgeOwner: number[] = [];
  const push = (a: Vector3, ca: number, b: Vector3, cb: number) => {
    edges.push(a.x, a.y, a.z, b.x, b.y, b.z);
    edgeOwner.push(ca, cb);
  };

  clusters.forEach((c, ci) => {
    const hub = hubs[ci];
    const count = Math.min(12, Math.max(2, c.count)); // one node per item, with a floor and a cap so every section reads as a shape
    nodes.push({ pos: hub.clone(), cluster: ci, scale: 0.26, seed: rand(), hub: true });
    const members: Vector3[] = [];
    for (let k = 1; k < count; k++) {
      const dir = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const p = hub.clone().addScaledVector(dir, 0.62 + rand() * 0.7);
      members.push(p);
      nodes.push({ pos: p, cluster: ci, scale: 0.1 + rand() * 0.09, seed: rand(), hub: false });
      push(hub, ci, p, ci);
    }
    for (let k = 0; k < members.length - 1; k++) if (rand() < 0.4) push(members[k], ci, members[k + 1], ci);
  });
  // A faint ring joins neighbouring hubs so the sections read as one web.
  for (let i = 0; i < n && n > 2; i++) push(hubs[i], i, hubs[(i + 1) % n], (i + 1) % n);

  const spokePoints: [number, number, number][] = [];
  for (const h of hubs) spokePoints.push([0, 0, 0], [h.x, h.y, h.z]);

  return { hubs, nodes, edgePositions: new Float32Array(edges), edgeCluster: Uint8Array.from(edgeOwner), spokePoints };
}

interface Pulse {
  on: boolean;
  cluster: number;
  dir: 1 | -1; // 1: core -> hub, -1: hub -> core
  kind: "scan" | "answer" | "return";
  t: number;
  delay: number;
  dur: number;
}

interface SceneProps {
  clusters: ClusterInfo[];
  dark: boolean;
  bridge: MutableRefObject<AssistantBridge>;
  onReady: () => void;
}

/**
 * The assistant page's scene: a constellation of the portfolio's own content. The core (the hero's faceted core, returning)
 * sits in the middle; each section is a cluster of nodes around it, one node per real item. Asking a question makes the core
 * scan (pulses travel out along the spokes); when the answer arrives, the sections it was built from light up and the whole
 * graph turns to face them, while the rest dim. An unanswerable question leaves everything dim and the core shrugs.
 * That is the assistant's promise, "answers come only from this portfolio", made visible.
 */
function Scene({ clusters, dark, bridge, onReady }: SceneProps) {
  const palette = dark ? PALETTE.dark : PALETTE.light;
  const graph = useMemo(() => buildGraph(clusters), [clusters]);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  // Refs to the things animated every frame
  const root = useRef<Group>(null);
  const tilt = useRef<Group>(null);
  const spin = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const shell = useRef<Mesh>(null);
  const ringA = useRef<Mesh>(null);
  const ringB = useRef<Mesh>(null);
  const coreHalo = useRef<Mesh>(null);
  const coreMat = useRef<MeshStandardMaterial>(null);
  const nodeMesh = useRef<InstancedMesh>(null);
  const haloMesh = useRef<InstancedMesh>(null);
  const pulseMesh = useRef<InstancedMesh>(null);

  // Dynamic state (plain mutable objects; nothing here goes through React)
  const st = useRef({
    lit: new Float32Array(clusters.length),
    target: new Float32Array(clusters.length),
    pop: new Float32Array(clusters.length),
    dimAll: 0,
    dimTarget: 0,
    think: 0,
    scanning: false,
    scanNext: 0,
    scanCount: 0,
    flash: 0,
    wobble: 0,
    version: -1,
    facing: false,
    faceQ: new Quaternion(),
    pulses: Array.from({ length: MAX_PULSES }, (): Pulse => ({ on: false, cluster: 0, dir: 1, kind: "scan", t: 0, delay: 0, dur: 1 })),
    pointer: { x: 0, y: 0 },
    px: 0,
    py: 0,
  });

  const clusterColors = useMemo(() => clusters.map((c) => new Color(clusterColor(c.anchor, dark))), [clusters, dark]);
  // What an "unlit" colour fades toward. Dark theme draws lines additively, so black is invisible; the light theme blends
  // normally, so the cream background colour is invisible. Either way, dim things melt into the page instead of drawing dark lines.
  const fogColor = useMemo(() => (dark ? new Color(0, 0, 0) : new Color(palette.fog)), [dark, palette.fog]);
  const lineBlending = dark ? AdditiveBlending : NormalBlending;

  const edgeGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(graph.edgePositions, 3));
    const colors = new BufferAttribute(new Float32Array(graph.edgePositions.length), 3);
    colors.setUsage(DynamicDrawUsage);
    g.setAttribute("color", colors);
    return g;
  }, [graph]);

  const spokeGeo = useMemo(() => {
    const pos = new Float32Array(graph.spokePoints.length * 3);
    graph.spokePoints.forEach((p, i) => pos.set(p, i * 3));
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    const colors = new BufferAttribute(new Float32Array(pos.length), 3);
    colors.setUsage(DynamicDrawUsage);
    g.setAttribute("color", colors);
    return g;
  }, [graph]);

  useEffect(
    () => () => {
      edgeGeo.dispose();
      spokeGeo.dispose();
    },
    [edgeGeo, spokeGeo],
  );

  // Fog gives the far side of the graph depth without any extra geometry.
  useEffect(() => {
    scene.fog = new Fog(palette.fog, 10, 24);
    invalidate();
  }, [scene, palette.fog, invalidate]);

  // Pointer parallax
  useEffect(() => {
    const move = (e: PointerEvent) => {
      st.current.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      st.current.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // Allocate per-instance colours once and report ready after the first frame.
  useEffect(() => {
    const c = new Color();
    graph.nodes.forEach((n, i) => {
      nodeMesh.current?.setColorAt(i, c.copy(clusterColors[n.cluster]));
      haloMesh.current?.setColorAt(i, c.copy(clusterColors[n.cluster]));
    });
    for (let i = 0; i < MAX_PULSES; i++) pulseMesh.current?.setColorAt(i, c.set("#ffffff"));
    invalidate();
    const id = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(id);
  }, [graph, clusterColors, invalidate, onReady]);

  const tmpM = useMemo(() => new Matrix4(), []);
  const tmpQ = useMemo(() => new Quaternion(), []);
  const tmpP = useMemo(() => new Vector3(), []);
  const tmpS = useMemo(() => new Vector3(), []);
  const tmpC = useMemo(() => new Color(), []);
  const tmpC2 = useMemo(() => new Color(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  const launch = (cluster: number, dir: 1 | -1, kind: Pulse["kind"], delay: number, dur: number) => {
    const p = st.current.pulses.find((x) => !x.on);
    if (p) Object.assign(p, { on: true, cluster, dir, kind, t: 0, delay, dur });
  };

  useFrame((state, delta) => {
    const S = st.current;
    const B = bridge.current;
    const now = performance.now();
    const dt = Math.min(delta, 0.05);
    const time = state.clock.elapsedTime;
    let moving = false;

    // ---- react to a new phase
    if (S.version !== B.version) {
      S.version = B.version;
      S.pulses.forEach((p) => (p.on = false));
      S.target.fill(0);
      S.facing = false;
      S.scanning = false;
      S.dimTarget = 0;
      if (B.phase === "thinking") {
        S.scanning = true;
        S.scanNext = 0;
      } else if (B.phase === "answered") {
        const idx = B.anchors.map((a) => clusters.findIndex((c) => c.anchor === a)).filter((i) => i >= 0);
        if (idx.length) {
          idx.forEach((ci, k) => launch(ci, 1, "answer", k * 0.16, 0.85));
          const centroid = new Vector3();
          idx.forEach((ci) => centroid.add(graph.hubs[ci]));
          centroid.divideScalar(idx.length).normalize();
          // Turn the answering sections toward the front-right (toward the chat), not dead centre, so they do not sit on the core.
          S.faceQ.setFromUnitVectors(centroid, new Vector3(0.75, 0.12, 0.65).normalize());
        } else {
          S.flash = 1; // answered from something with no cluster (for example the hero): just acknowledge
        }
      } else if (B.phase === "nomatch") {
        S.wobble = 1;
        S.dimTarget = 0.7;
      }
    }

    // ---- scanning: a steady stream of pulses to random sections while the assistant is "thinking"
    S.think += ((S.scanning ? 1 : 0) - S.think) * (1 - Math.exp(-dt * 5));
    if (S.scanning) {
      S.scanNext -= dt;
      if (S.scanNext <= 0 && clusters.length) {
        const ci = Math.floor(((S.scanCount++ * 0.618034) % 1) * clusters.length);
        launch(ci, 1, "scan", 0, 0.7);
        S.scanNext = 0.14 + ((S.scanCount * 37) % 7) * 0.02;
      }
    }

    // ---- pulses
    const pm = pulseMesh.current;
    let livePulses = 0;
    S.pulses.forEach((p, i) => {
      if (!p.on) {
        if (pm) {
          tmpM.makeScale(0, 0, 0);
          pm.setMatrixAt(i, tmpM);
        }
        return;
      }
      p.t += dt;
      const k = clamp01((p.t - p.delay) / p.dur);
      livePulses++;
      if (p.t - p.delay >= p.dur) {
        p.on = false;
        if (p.kind === "scan") S.pop[p.cluster] = 1;
        else if (p.kind === "answer") {
          S.target[p.cluster] = 1;
          S.pop[p.cluster] = 1;
          S.dimTarget = 0.6;
          S.facing = true;
          launch(p.cluster, -1, "return", 0.1, 0.7);
        } else S.flash = 1;
        return;
      }
      if (!pm) return;
      if (k <= 0) {
        tmpM.makeScale(0, 0, 0);
      } else {
        const e = easeInOutCubic(k);
        const hub = graph.hubs[p.cluster];
        const f = p.dir === 1 ? e : 1 - e;
        tmpP.set(hub.x * f, hub.y * f, hub.z * f);
        const s = 0.07 + Math.sin(k * Math.PI) * 0.06;
        tmpM.compose(tmpP, tmpQ.identity(), tmpS.set(s, s, s));
      }
      pm.setMatrixAt(i, tmpM);
      pm.setColorAt(i, tmpC.copy(clusterColors[p.cluster]).lerp(tmpC2.set("#ffffff"), 0.35));
    });
    if (pm) {
      pm.instanceMatrix.needsUpdate = true;
      if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    }
    if (livePulses > 0) moving = true;

    // ---- activation easing
    const ek = 1 - Math.exp(-dt * 6);
    S.dimAll += (S.dimTarget - S.dimAll) * ek;
    let litErr = 0;
    for (let i = 0; i < clusters.length; i++) {
      const hover = B.hover === clusters[i].anchor ? 0.65 : 0;
      const goal = Math.max(S.target[i], hover);
      litErr = Math.max(litErr, Math.abs(goal - S.lit[i]));
      S.lit[i] += (goal - S.lit[i]) * ek;
      S.pop[i] *= Math.exp(-dt * 3.2);
    }
    if (litErr > 0.01 || Math.abs(S.dimTarget - S.dimAll) > 0.01) moving = true;

    // ---- nodes and halos
    const nm = nodeMesh.current;
    const hm = haloMesh.current;
    if (nm && hm) {
      graph.nodes.forEach((n, i) => {
        const L = S.lit[n.cluster];
        const pop = S.pop[n.cluster];
        const breathe = 1 + 0.07 * Math.sin(time * 1.3 + n.seed * 6.283);
        const s = n.scale * breathe * (1 + L * 0.85 + pop * (n.hub ? 0.55 : 0.35));
        tmpP.set(n.pos.x, n.pos.y + Math.sin(time * 0.55 + n.seed * 10) * 0.05, n.pos.z);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS.set(s, s, s));
        nm.setMatrixAt(i, tmpM);
        const h = n.scale * (1.6 + L * 3.4 + pop * 1.4) * smooth(L * 2 + pop);
        tmpM.compose(tmpP, tmpQ.identity(), tmpS.set(h, h, h));
        hm.setMatrixAt(i, tmpM);
        const bright = (dark ? 0.6 : 0.8) * (1 - S.dimAll * 0.55) + L * 0.5 + pop * 0.25; // sections not in the answer dim; the answering ones brighten
        tmpC.copy(fogColor).lerp(clusterColors[n.cluster], clamp01(bright));
        nm.setColorAt(i, tmpC);
        hm.setColorAt(i, clusterColors[n.cluster]);
      });
      nm.instanceMatrix.needsUpdate = true;
      hm.instanceMatrix.needsUpdate = true;
      if (nm.instanceColor) nm.instanceColor.needsUpdate = true;
      if (hm.instanceColor) hm.instanceColor.needsUpdate = true;
    }

    // ---- edges and highlighted spokes: vertex colours follow each cluster's activation
    const ec = edgeGeo.getAttribute("color") as BufferAttribute;
    for (let v = 0; v < graph.edgeCluster.length; v++) {
      const ci = graph.edgeCluster[v];
      const mix = clamp01(0.22 * (1 - S.dimAll * 0.6) + S.lit[ci] * 0.7);
      tmpC.copy(fogColor).lerp(clusterColors[ci], mix);
      ec.setXYZ(v, tmpC.r, tmpC.g, tmpC.b);
    }
    ec.needsUpdate = true;
    const sc = spokeGeo.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < clusters.length; i++) {
      tmpC.copy(fogColor).lerp(clusterColors[i], clamp01(S.lit[i] * 0.95));
      sc.setXYZ(i * 2, tmpC.r, tmpC.g, tmpC.b);
      sc.setXYZ(i * 2 + 1, tmpC.r, tmpC.g, tmpC.b);
    }
    sc.needsUpdate = true;

    // ---- core
    S.flash *= Math.exp(-dt * 2.6);
    S.wobble *= Math.exp(-dt * 2.2);
    if (S.flash > 0.01 || S.wobble > 0.01) moving = true;
    if (S.think > 0.01) moving = true;
    const spinSpeed = 0.22 + S.think * 1.6;
    if (core.current) {
      core.current.rotation.y += dt * spinSpeed;
      core.current.rotation.x += dt * (0.1 + S.think * 0.5);
      const s = CORE_SCALE * (1 + S.think * 0.06 * Math.sin(time * 7) + S.flash * 0.12);
      core.current.scale.setScalar(s);
      core.current.rotation.z = Math.sin(time * 38) * 0.12 * S.wobble; // the "shrug" for an unanswerable question
    }
    if (shell.current && core.current) {
      shell.current.rotation.copy(core.current.rotation);
      shell.current.scale.copy(core.current.scale).multiplyScalar(1.05);
    }
    if (ringA.current) ringA.current.rotation.z += dt * (0.18 + S.think * 1.2);
    if (ringB.current) ringB.current.rotation.z -= dt * (0.12 + S.think * 0.9);
    if (coreHalo.current) {
      const hs = CORE_SCALE * (1.35 + S.think * 0.5 + S.flash * 1.1);
      coreHalo.current.scale.setScalar(hs);
      (coreHalo.current.material as MeshStandardMaterial).opacity = 0.025 + S.think * 0.07 + S.flash * 0.1;
    }
    if (coreMat.current) coreMat.current.emissiveIntensity = S.think * 0.55 + S.flash * 0.9;

    // ---- whole-graph motion: slow idle rotation, or turning to face the sections that answered
    const sp = spin.current;
    if (sp) {
      if (S.facing) {
        const before = sp.quaternion.angleTo(S.faceQ);
        sp.quaternion.slerp(S.faceQ, 1 - Math.exp(-dt * 2.6));
        if (before > 0.004) moving = true;
      } else {
        tmpQ.setFromAxisAngle(up, dt * (0.07 + S.think * 0.25));
        sp.quaternion.premultiply(tmpQ);
      }
    }
    if (tilt.current) {
      S.px += (S.pointer.x - S.px) * (1 - Math.exp(-dt * 3));
      S.py += (S.pointer.y - S.py) * (1 - Math.exp(-dt * 3));
      tilt.current.rotation.y = S.px * 0.16;
      tilt.current.rotation.x = S.py * 0.1;
    }

    // ---- placement: lower-left beside the chat on wide screens (the intro text sits above it), centred and smaller otherwise
    if (root.current) {
      const aspect = size.width / size.height;
      const halfW = Math.tan((FOV * Math.PI) / 360) * CAMERA_Z * aspect;
      const wide = aspect > 1.45 && size.width >= 1024;
      const halfH = Math.tan((FOV * Math.PI) / 360) * CAMERA_Z;
      const tx = wide ? -halfW * 0.46 : 0;
      const ty = wide ? -halfH * 0.26 : 0;
      const ts = wide ? 0.8 : 0.7;
      const kk = 1 - Math.exp(-dt * 4);
      root.current.position.x += (tx - root.current.position.x) * kk;
      root.current.position.y += (ty - root.current.position.y) * kk;
      root.current.scale.setScalar(root.current.scale.x + (ts - root.current.scale.x) * (1 - Math.exp(-dt * 4)));
    }

    if (moving) B.lastMotion = now;
  });

  return (
    <>
      <ambientLight intensity={dark ? 0.55 : 0.95} />
      <directionalLight position={[4, 5, 6]} intensity={dark ? 2.0 : 1.5} />

      <group ref={root} position={[0, 0, 0]}>
        <group ref={tilt}>
          {/* The core: the hero's faceted core, back as the assistant */}
          <group>
            <mesh ref={core} scale={CORE_SCALE}>
              <icosahedronGeometry args={[1.5, 1]} />
              <meshStandardMaterial ref={coreMat} color={palette.primary} emissive={palette.accent} emissiveIntensity={0} flatShading metalness={0.35} roughness={0.35} />
            </mesh>
            <mesh ref={shell}>
              <icosahedronGeometry args={[1.5, 1]} />
              <meshBasicMaterial color={palette.accent} wireframe transparent opacity={0.35} />
            </mesh>
            <mesh ref={ringA} rotation={[Math.PI / 2.4, 0.3, 0]}>
              <torusGeometry args={[2.2, 0.012, 8, 160]} />
              <meshBasicMaterial color={palette.primary} transparent opacity={0.75} />
            </mesh>
            <mesh ref={ringB} rotation={[Math.PI / 3, -0.6, 0.4]}>
              <torusGeometry args={[2.65, 0.01, 8, 160]} />
              <meshBasicMaterial color={palette.accent} transparent opacity={0.5} />
            </mesh>
            <mesh ref={coreHalo}>
              <sphereGeometry args={[1.5, 24, 16]} />
              <meshStandardMaterial color={palette.accent} transparent opacity={0.025} depthWrite={false} emissive={palette.accent} emissiveIntensity={0.6} />
            </mesh>
          </group>

          <group ref={spin}>
            {/* Base spokes: fat lines from drei. Highlighted spokes and the web: vertex-coloured lines that follow activation. */}
            <Line segments points={graph.spokePoints} color={palette.grid} lineWidth={1.1} transparent opacity={0.4} />
            <lineSegments geometry={spokeGeo} frustumCulled={false}>
              <lineBasicMaterial vertexColors transparent opacity={0.95} blending={lineBlending} depthWrite={false} />
            </lineSegments>
            <lineSegments geometry={edgeGeo} frustumCulled={false}>
              <lineBasicMaterial vertexColors transparent opacity={0.8} blending={lineBlending} depthWrite={false} />
            </lineSegments>

            <instancedMesh ref={haloMesh} args={[undefined, undefined, graph.nodes.length]} frustumCulled={false}>
              <sphereGeometry args={[1, 14, 10]} />
              <meshBasicMaterial transparent opacity={0.11} depthWrite={false} />
            </instancedMesh>
            <instancedMesh ref={nodeMesh} args={[undefined, undefined, graph.nodes.length]} frustumCulled={false}>
              <icosahedronGeometry args={[1, 3]} />
              <meshStandardMaterial metalness={0.25} roughness={0.5} />
            </instancedMesh>
            <instancedMesh ref={pulseMesh} args={[undefined, undefined, MAX_PULSES]} frustumCulled={false}>
              <sphereGeometry args={[1, 10, 8]} />
              <meshBasicMaterial transparent opacity={0.95} depthWrite={false} />
            </instancedMesh>
          </group>
        </group>

        {/* Drifting motes: drei's GPU particle shader. They read as depth and keep the scene alive between questions. */}
        <Sparkles count={70} scale={[15, 9, 8]} size={2.2} speed={0.35} opacity={dark ? 0.55 : 0.7} color={palette.dust} />
      </group>
    </>
  );
}

/** Render-on-demand driver: draws every frame while there is motion or input, ~30 fps for a while after, then rests fully. */
function useSceneScheduler(bridge: MutableRefObject<AssistantBridge>) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const ACTIVE_MS = 1600;
    const IDLE_MS = 12_000;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const busy = bridge.current.phase === "thinking" || now - bridge.current.lastMotion < 250;
      const active = busy || now - last < ACTIVE_MS;
      const idle = !active && now - last < IDLE_MS && !document.hidden;
      if (!active && !idle) {
        running = false;
        return;
      }
      invalidate();
      if (active) raf = requestAnimationFrame(tick);
      else timer = setTimeout(tick, 33);
    };
    const wake = () => {
      last = performance.now();
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const events: (keyof WindowEventMap)[] = ["pointermove", "resize", "wheel", "touchmove", "keydown"];
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    window.addEventListener(ASSISTANT_WAKE, wake);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      events.forEach((e) => window.removeEventListener(e, wake));
      window.removeEventListener(ASSISTANT_WAKE, wake);
      document.removeEventListener("visibilitychange", wake);
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [bridge, invalidate]);
}

function Driver({ bridge }: { bridge: MutableRefObject<AssistantBridge> }) {
  useSceneScheduler(bridge);
  return null;
}

export interface KnowledgeSceneProps extends SceneProps {
  onLost: () => void;
}

export default function KnowledgeScene({ clusters, dark, bridge, onReady, onLost }: KnowledgeSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ fov: FOV, near: 0.1, far: 60, position: [0, 0, CAMERA_Z] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <Driver bridge={bridge} />
      <Scene clusters={clusters} dark={dark} bridge={bridge} onReady={onReady} />
    </Canvas>
  );
}
