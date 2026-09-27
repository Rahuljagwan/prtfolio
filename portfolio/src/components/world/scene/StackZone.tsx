"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Euler, type InstancedMesh, Matrix4, OctahedronGeometry, PlaneGeometry, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import type { RigCurves } from "@/lib/world/rig-path";
import { INCIDENT_EVENT, INCIDENT_TIMING } from "@/lib/world/events";
import { boundaryLocal, type SectionExtent } from "@/lib/world/tunnel-math";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

const LAYERS = 9;
const NODES_PER_LAYER = 11;
const LAYER_SIZE = 22;
const FIRST_Y = 2.6;
const LAYER_GAP = 1.6;
// Layers 0..VAULT_LAYERS-1 are the DB Vault (Education): static, no pulse, "committed records". The rest are the
// Monitoring Tower (Skills): pulsing, "live" status. Same 9-layer geometry throughout — only material/motion differ.
const VAULT_LAYERS = 4;

// The camera pose for this whole zone is frozen (Skills and Education share one dwell — see zones.ts), so camera
// height never distinguishes which section is on screen; RigShared.local (position within the zone's own scroll
// extent) does. Measured live against the actual page: the Skills/Education boundary sits at local ≈ -0.014 — the
// two sections are within a few px of the same height, so the threshold is almost exactly centre. The transition
// is a smootherstep band around it, not a step, so a frozen camera never sees a hard material flip mid-dwell.
const EMPHASIS_THRESHOLD = -0.014;
const EMPHASIS_BAND = 0.1;

// The Incident: the one place on the whole site red appears. Node/layer chosen and verified in-frame at the frozen
// stack pose (see the zone's own screenshots), not just the topmost layer.
const INCIDENT_LAYER = 5;
const INCIDENT_NODE = 4;

// Timing budget shared with IncidentPanel's own DOM-side timer via INCIDENT_TIMING (see that file for why these two
// don't relay off one another). T_SETTLE is purely a 3D tail (the node quietly rejoining Tower's ambient amber) with
// no DOM counterpart, so it stays local.
const T_ALERT = INCIDENT_TIMING.alert;
const T_REROUTE_START = INCIDENT_TIMING.reroute;
const T_REROUTE_END = INCIDENT_TIMING.restart;
const T_NOMINAL = INCIDENT_TIMING.nominal;
const T_SETTLE = 4.9; // after this, the node quietly rejoins the Tower's ambient amber and the sequence fully resets

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const lineGeo = (a: number[]) => new BufferGeometry().setAttribute("position", new BufferAttribute(new Float32Array(a), 3));
const smootherstep = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

interface Layout {
  vaultLayers: Matrix4[];
  towerLayers: Matrix4[];
  vaultNodes: Matrix4[];
  towerNodes: Matrix4[];
  vaultHalos: Matrix4[];
  towerHalos: Matrix4[];
  frames: BufferGeometry;
  links: BufferGeometry;
  incidentPos: Vector3;
  incidentScale: number;
  neighbourA: Vector3;
  neighbourB: Vector3;
}

/**
 * Layers are horizontal sheets the rising camera passes through. Each is centred on the camera path at the height where
 * the camera crosses it, so the route threads every layer near its middle and nodes sit around the corridor, not in it.
 * One node (INCIDENT_LAYER/INCIDENT_NODE) is built but held out of the Tower's instanced mesh — it gets its own mesh so
 * its colour can animate independently during the incident sequence.
 */
function buildLayout(curves: RigCurves): Layout {
  const rand = rng(33);
  const samples = curves.position.getPoints(600);
  const centreAt = (y: number) => samples.find((p, i) => i > 300 && p.y >= y) ?? samples[samples.length - 1];

  const vaultLayers: Matrix4[] = [];
  const towerLayers: Matrix4[] = [];
  const vaultNodes: Matrix4[] = [];
  const towerNodes: Matrix4[] = [];
  const vaultHalos: Matrix4[] = [];
  const towerHalos: Matrix4[] = [];
  const framePts: number[] = [];
  const linkPts: number[] = [];
  const flat = new Quaternion().setFromEuler(new Euler(-Math.PI / 2, 0, 0));
  const id = new Quaternion();
  const half = LAYER_SIZE / 2;
  const cell = LAYER_SIZE / 8;

  let incidentPos = new Vector3();
  let incidentScale = 0.2;
  let neighbourA = new Vector3();
  let neighbourB = new Vector3();

  let prev: Vector3[] = [];
  for (let k = 0; k < LAYERS; k++) {
    const isVault = k < VAULT_LAYERS;
    const y = FIRST_Y + k * LAYER_GAP;
    const c = centreAt(y);
    const cx = c.x;
    const cz = c.z;
    (isVault ? vaultLayers : towerLayers).push(new Matrix4().compose(new Vector3(cx, y, cz), flat, new Vector3(1, 1, 1)));

    const x0 = cx - half, x1 = cx + half, z0 = cz - half, z1 = cz + half;
    framePts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    for (let g = 1; g < 8; g++) {
      framePts.push(x0 + g * cell, y, z0, x0 + g * cell, y, z1, x0, y, z0 + g * cell, x1, y, z0 + g * cell);
    }

    const here: Vector3[] = [];
    const hereScale: number[] = [];
    for (let n = 0; n < NODES_PER_LAYER; n++) {
      const a = rand() * Math.PI * 2;
      const r = 3.8 + rand() * 7; // never in the corridor the camera uses
      const p = new Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
      const s = 0.12 + rand() * rand() * 0.34;
      here.push(p);
      hereScale.push(s);
      if (k === INCIDENT_LAYER && n === INCIDENT_NODE) {
        incidentPos = p;
        incidentScale = s;
      } else {
        const nodeGroup = isVault ? vaultNodes : towerNodes;
        const haloGroup = isVault ? vaultHalos : towerHalos;
        nodeGroup.push(new Matrix4().compose(p, id, new Vector3(s, s, s)));
        haloGroup.push(new Matrix4().compose(p, id, new Vector3(s * 3.2, s * 3.2, s * 3.2)));
      }
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
    if (k === INCIDENT_LAYER) {
      // The two nearest other nodes on the same layer: where traffic reroutes to during the incident.
      const ranked = here
        .map((p, i) => ({ p, i, d: (p.x - incidentPos.x) ** 2 + (p.z - incidentPos.z) ** 2 }))
        .filter((e) => e.i !== INCIDENT_NODE)
        .sort((a, b) => a.d - b.d);
      neighbourA = ranked[0].p;
      neighbourB = ranked[1].p;
    }
    prev = here;
  }
  return { vaultLayers, towerLayers, vaultNodes, towerNodes, vaultHalos, towerHalos, frames: lineGeo(framePts), links: lineGeo(linkPts), incidentPos, incidentScale, neighbourA, neighbourB };
}

type Mats = {
  vaultLayers?: THREE.MeshBasicMaterial;
  towerLayers?: THREE.MeshBasicMaterial;
  frames?: THREE.LineBasicMaterial;
  links?: THREE.LineBasicMaterial;
  vaultNodes?: THREE.MeshBasicMaterial;
  towerNodes?: THREE.MeshBasicMaterial;
  vaultHalos?: THREE.MeshBasicMaterial;
  towerHalos?: THREE.MeshBasicMaterial;
  incidentNode?: THREE.MeshBasicMaterial;
  incidentHalo?: THREE.MeshBasicMaterial;
  reroute?: THREE.LineBasicMaterial;
};

function fill(mesh: InstancedMesh | null, matrices: Matrix4[]) {
  if (!mesh) return;
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
}

type Phase = "idle" | "alert" | "hold" | "reroute" | "restart" | "nominal" | "settle";

/**
 * Zone 5, "The Stack": nine tiers of translucent sheets, split into the DB Vault (lower, static — Education) and the
 * Monitoring Tower (upper, pulsing — Skills). The camera rises straight through them on one frozen pose shared by both
 * sections, so which half reads as "active" is driven by scroll position within the zone (RigShared.local), not camera
 * height — see EMPHASIS_THRESHOLD. One Tower node is held out of the ambient instancing so it can run the Incident: a
 * single node fails (red, the only red on the site), traffic visibly reroutes to its neighbours, it restarts
 * (red -> amber -> green), and a DOM log reads the sequence out loud. Triggered by INCIDENT_EVENT (a DOM button in the
 * Skills section); if the zone scrolls out of view mid-sequence it snaps straight to nominal — never a stuck red node.
 */
export function StackZone({ palette, curves, shared, sections }: { palette: WorldPalette; dark?: boolean; curves: RigCurves; shared: MutableRefObject<RigShared>; sections?: RefObject<SectionExtent[]> }) {
  const root = useRef<THREE.Group>(null);
  const vaultLayerMesh = useRef<InstancedMesh>(null);
  const towerLayerMesh = useRef<InstancedMesh>(null);
  const vaultNodeMesh = useRef<InstancedMesh>(null);
  const towerNodeMesh = useRef<InstancedMesh>(null);
  const vaultHaloMesh = useRef<InstancedMesh>(null);
  const towerHaloMesh = useRef<InstancedMesh>(null);
  const incidentNodeMesh = useRef<THREE.Mesh>(null);
  const incidentHaloMesh = useRef<THREE.Mesh>(null);
  const rerouteMesh = useRef<THREE.LineSegments>(null);
  const mats = useRef<Mats>({});
  const fade = useRef(-1);
  const emphasis = useRef(-1);
  const invalidate = useThree((s) => s.invalidate);

  const layout = useMemo(() => buildLayout(curves), [curves]);
  const plane = useMemo(() => new PlaneGeometry(LAYER_SIZE, LAYER_SIZE), []);
  const node = useMemo(() => new OctahedronGeometry(1, 0), []);
  const rerouteGeo = useMemo(
    () => lineGeo([layout.incidentPos.x, layout.incidentPos.y, layout.incidentPos.z, layout.neighbourA.x, layout.neighbourA.y, layout.neighbourA.z, layout.incidentPos.x, layout.incidentPos.y, layout.incidentPos.z, layout.neighbourB.x, layout.neighbourB.y, layout.neighbourB.z]),
    [layout],
  );

  const ambientAmber = useMemo(() => new Color(), []);
  const rerouteColor = useMemo(() => new Color(), []); // blended toward white: plain accent reads as just another Tower diamond against this backdrop
  const alertRed = useMemo(() => new Color("#e3392f"), []); // the site's one red, fixed rather than palette-driven — it must never shift with theme/season
  const nodeColor = useMemo(() => new Color(), []);
  const tmpColor = useMemo(() => new Color(), []);

  const incident = useRef({ t: -1, phase: "idle" as Phase });

  useEffect(() => {
    fill(vaultLayerMesh.current, layout.vaultLayers);
    fill(towerLayerMesh.current, layout.towerLayers);
    fill(vaultNodeMesh.current, layout.vaultNodes);
    fill(towerNodeMesh.current, layout.towerNodes);
    fill(vaultHaloMesh.current, layout.vaultHalos);
    fill(towerHaloMesh.current, layout.towerHalos);
    if (incidentNodeMesh.current) incidentNodeMesh.current.scale.setScalar(layout.incidentScale);
    if (incidentHaloMesh.current) incidentHaloMesh.current.scale.setScalar(layout.incidentScale * 3.2);
  }, [layout]);

  useEffect(() => {
    const M = mats.current;
    M.vaultLayers?.color.set(palette.primary);
    M.towerLayers?.color.set(palette.accent);
    M.frames?.color.set(palette.primary);
    M.links?.color.set(palette.route);
    M.vaultNodes?.color.set(palette.primary); // Vault: healthy/steady, no pulse
    M.vaultHalos?.color.set(palette.primary);
    ambientAmber.set(palette.accent);
    M.towerNodes?.color.copy(ambientAmber); // Tower: amber, pulsing (set live in useFrame)
    M.towerHalos?.color.copy(ambientAmber);
    // Blended toward white, the same reason every other status flash on this site is: a thin line in the plain accent
    // colour reads as just another Tower diamond's edge against this amber-and-green-heavy backdrop, not a distinct event.
    rerouteColor.set(palette.accent).lerp(new Color("#ffffff"), 0.6);
    M.reroute?.color.copy(rerouteColor);
    fade.current = -1;
    emphasis.current = -1;
  }, [palette, ambientAmber, rerouteColor]);

  useEffect(
    () => () => {
      layout.frames.dispose();
      layout.links.dispose();
      plane.dispose();
      node.dispose();
      rerouteGeo.dispose();
    },
    [layout, plane, node, rerouteGeo],
  );

  // The trigger: ignored while a sequence is already running (re-entrancy guard — the DOM button mirrors this by
  // disabling itself on the same "alert" -> "nominal" window, but the guard lives here too since the button isn't the
  // only thing that could dispatch this event). This purely runs the 3D visual off INCIDENT_TIMING; it doesn't relay
  // anything to the DOM log — see events.ts for why the two sides run independent timers instead.
  useEffect(() => {
    const onTrigger = () => {
      if (incident.current.t >= 0) return;
      incident.current = { t: 0, phase: "alert" };
      invalidate();
    };
    window.addEventListener(INCIDENT_EVENT, onTrigger);
    return () => window.removeEventListener(INCIDENT_EVENT, onTrigger);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const u = shared.current.u;
    const g = root.current;
    if (!g) return;
    g.visible = !!shared.current.warm || (u > 3.3 && u < 5.8);
    if (!g.visible) {
      // Scrolled away: if an incident was mid-flight, snap the 3D visual straight to settled so nothing is left
      // stuck red. The DOM log runs its own independent timer (see events.ts), so it needs no equivalent handling
      // here — it simply finishes the sequence it already started, which is still an honest reflection of what the
      // visitor triggered.
      if (incident.current.t >= 0 && incident.current.t < T_NOMINAL) {
        incident.current = { t: T_SETTLE, phase: "settle" };
      }
      return;
    }
    const inn = Math.min(1, Math.max(0, (u - 3.5) / 0.9));
    const out = 1 - Math.min(1, Math.max(0, (u - 5.0) / 0.8));
    const f = inn * inn * (3 - 2 * inn) * out;
    if (Math.abs(f - fade.current) > 0.002) {
      fade.current = f;
      const M = mats.current;
      if (M.vaultLayers) M.vaultLayers.opacity = 0.07 * f;
      if (M.towerLayers) M.towerLayers.opacity = 0.07 * f;
      if (M.frames) M.frames.opacity = 0.4 * f;
      if (M.links) M.links.opacity = 0.3 * f;
      if (M.vaultNodes) M.vaultNodes.opacity = 0.85 * f;
      if (M.vaultHalos) M.vaultHalos.opacity = 0.1 * f;
    }

    // Which half of the content is active: RigShared.local, smootherstepped over a band, not a hard switch — the
    // camera is frozen for this whole dwell, so a step change would be very visible.
    const local = shared.current.local ?? 0;
    // Where Skills ends and Education begins within this zone: measured from the page (the sections change height with their
    // content), with the value measured once by hand as the fallback.
    const threshold = boundaryLocal(sections?.current ?? [], "skills", "education") ?? EMPHASIS_THRESHOLD;
    const towerEmph = smootherstep((local - (threshold - EMPHASIS_BAND)) / (EMPHASIS_BAND * 2));
    if (Math.abs(towerEmph - emphasis.current) > 0.002) {
      emphasis.current = towerEmph;
      const M = mats.current;
      if (M.towerHalos) M.towerHalos.opacity = f * (0.08 + 0.1 * towerEmph);
    }
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0018));
    if (mats.current.towerNodes) mats.current.towerNodes.opacity = f * (0.55 + 0.4 * towerEmph) * pulse;

    // The incident sequence.
    const inc = incident.current;
    if (inc.t >= 0) {
      inc.t += dt;
      invalidate();
      const t = inc.t;
      const phase: Phase = t < T_ALERT ? "alert" : t < T_REROUTE_START ? "hold" : t < T_REROUTE_END ? "reroute" : t < T_NOMINAL ? "restart" : t < T_SETTLE ? "nominal" : "settle";
      inc.phase = phase;

      // Node colour: amber -> red -> (hold) -> red -> amber -> green -> (hold) -> back to ambient amber.
      if (t < T_ALERT) nodeColor.copy(ambientAmber).lerp(alertRed, smootherstep(t / T_ALERT));
      else if (t < T_REROUTE_END) nodeColor.copy(alertRed);
      else if (t < (T_REROUTE_END + T_NOMINAL) / 2) nodeColor.copy(alertRed).lerp(ambientAmber, smootherstep((t - T_REROUTE_END) / ((T_NOMINAL - T_REROUTE_END) / 2)));
      else if (t < T_NOMINAL) nodeColor.copy(ambientAmber).lerp(tmpColor.set(palette.primary), smootherstep((t - (T_REROUTE_END + T_NOMINAL) / 2) / ((T_NOMINAL - T_REROUTE_END) / 2)));
      else if (t < T_SETTLE) nodeColor.set(palette.primary);
      else nodeColor.copy(tmpColor.set(palette.primary)).lerp(ambientAmber, smootherstep((t - T_SETTLE) / 0.6));

      if (mats.current.incidentNode) mats.current.incidentNode.color.copy(nodeColor);
      if (mats.current.incidentHalo) mats.current.incidentHalo.color.copy(nodeColor);
      const nodeOpacity = f * (0.75 + 0.25 * Math.min(1, t / T_ALERT));
      if (mats.current.incidentNode) mats.current.incidentNode.opacity = nodeOpacity;
      if (mats.current.incidentHalo) mats.current.incidentHalo.opacity = f * 0.35 * (phase === "alert" || phase === "hold" ? 1 + 0.4 * Math.sin(performance.now() * 0.02) : 1);

      // Reroute lines: fade in for the reroute phase, out again by restart. Both factors are already 0 outside their
      // own side of the window (smootherstep clamps), so the product alone is the full in-out envelope.
      const rerouteIn = smootherstep((t - T_REROUTE_START) / 0.3);
      const rerouteOut = 1 - smootherstep((t - T_REROUTE_END) / 0.4);
      if (mats.current.reroute) mats.current.reroute.opacity = f * 0.95 * Math.min(rerouteIn, rerouteOut);

      if (t >= T_SETTLE + 0.6) {
        incident.current = { t: -1, phase: "idle" };
      }
    } else {
      if (mats.current.incidentNode) { mats.current.incidentNode.color.copy(ambientAmber); mats.current.incidentNode.opacity = f * (0.55 + 0.4 * towerEmph) * pulse; }
      if (mats.current.incidentHalo) { mats.current.incidentHalo.color.copy(ambientAmber); mats.current.incidentHalo.opacity = f * (0.08 + 0.1 * towerEmph); }
      if (mats.current.reroute) mats.current.reroute.opacity = 0;
    }
  });

  const bind = <K extends keyof Mats>(key: K) => (m: Mats[K] | null) => void (mats.current[key] = (m ?? undefined) as Mats[K]);

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={vaultLayerMesh} args={[plane, undefined, layout.vaultLayers.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("vaultLayers")} side={DoubleSide} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={towerLayerMesh} args={[plane, undefined, layout.towerLayers.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("towerLayers")} side={DoubleSide} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <lineSegments geometry={layout.frames} frustumCulled={false}>
        <lineBasicMaterial ref={bind("frames")} transparent opacity={0} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={layout.links} frustumCulled={false}>
        <lineBasicMaterial ref={bind("links")} transparent opacity={0} depthWrite={false} />
      </lineSegments>

      <instancedMesh ref={vaultHaloMesh} args={[node, undefined, layout.vaultHalos.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("vaultHalos")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={vaultNodeMesh} args={[node, undefined, layout.vaultNodes.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("vaultNodes")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={towerHaloMesh} args={[node, undefined, layout.towerHalos.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("towerHalos")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={towerNodeMesh} args={[node, undefined, layout.towerNodes.length]} frustumCulled={false}>
        <meshBasicMaterial ref={bind("towerNodes")} transparent opacity={0} depthWrite={false} />
      </instancedMesh>

      {/* The one node the Incident runs on: its own mesh, held out of the Tower instancing above. */}
      <mesh ref={incidentHaloMesh} geometry={node} position={layout.incidentPos} renderOrder={10}>
        <meshBasicMaterial ref={bind("incidentHalo")} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={incidentNodeMesh} geometry={node} position={layout.incidentPos} renderOrder={11}>
        <meshBasicMaterial ref={bind("incidentNode")} transparent opacity={0} depthWrite={false} />
      </mesh>
      <lineSegments ref={rerouteMesh} geometry={rerouteGeo} frustumCulled={false} renderOrder={12}>
        <lineBasicMaterial ref={bind("reroute")} transparent opacity={0} depthWrite={false} fog={false} />
      </lineSegments>
    </group>
  );
}
