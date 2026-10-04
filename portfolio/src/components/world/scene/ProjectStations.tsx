"use client";

import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, type InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, LineBasicMaterial, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import { RACK, STATION, activeIndex, flightWeight, focusAt, indexFromProgress, progressFromRect, rackFloorY, rackTopY, slabCount, slabWidth, slabY, stationLayout, stepEase, type Vec3 } from "@/lib/world/station-math";
import { narrowFactor } from "@/lib/world/tunnel-math";
import { isExhibitKey } from "@/lib/projects/exhibits";
import { stationsState, subscribeStations } from "@/lib/world/stations";
import { getScrollY } from "@/lib/scroll-state";
import { ExhibitRoot } from "./exhibits/kit";
import { EXHIBIT_COMPONENTS } from "./exhibits";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

// The Projects "flight": one service rack per project on a chain in the Deployments region, a follower that blends the
// camera onto the current rack as the visitor scrolls the Flight track, and a HUD label naming it. Infrastructure, not
// planets: racks of flat slabs with status LEDs, joined by a data bus with a packet that travels with the camera.
// Everything is procedural and instanced. The scene is inert (not drawn at all) unless the Flight view is on the page.

const CAP = 12; // most racks the buffers hold
const SLABS = RACK.maxSlabs; // most slabs a rack has (one per layer of a project's stack)
const EDGE_VERTS = 24; // 12 edges x 2 ends
const HOP_SEGS = 14; // segments per hop of the data bus
const ROLL = 0.035; // radians the camera leans into a hop
const BUS_LIFT = 0.35;

const CORNERS: Vec3[] = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
];
const EDGES = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

interface Flight {
  /** Smoothed fractional station index. */
  t: number;
  /** Smoothed blend weight. */
  w: number;
  active: number;
}

/** A point on the chain for fractional index t, interpolated between per-rack points and eased exactly like the camera. */
function chainPoint(pts: Vec3[], t: number, out: Vector3, lift = 0) {
  const n = pts.length;
  if (n === 0) return;
  const tt = Math.min(n - 1, Math.max(0, t));
  const i = Math.min(n - 1, Math.floor(tt));
  const j = Math.min(n - 1, i + 1);
  const e = i === j ? 0 : stepEase(tt - i);
  const a = pts[i];
  const b = pts[j];
  out.set(a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e + lift * Math.sin(Math.PI * e), a[2] + (b[2] - a[2]) * e);
}

/**
 * Blends the flight camera pose over the rig's camera. It runs right after RigDriver (registration order: it is mounted
 * next to it and before every pod), reads the Flight track's rect straight from the DOM each frame (so it is in lockstep
 * with the scroll, like the rig), and lerps position / slerps orientation by `w`. With w = 0 it does nothing at all, and the
 * rig files stay untouched: the flight is a layer on top, not a change to the path.
 * It is a separate component from the scene on purpose: drei's <Html> labels subscribe to the frame loop when they mount,
 * and children subscribe before their parents, so the labels must not live under the component that moves the camera.
 */
function StationsCamera({ flight }: { flight: MutableRefObject<Flight> }) {
  const tmp = useMemo(
    () => ({ m: new Matrix4(), q: new Quaternion(), roll: new Quaternion(), pos: new Vector3(), tgt: new Vector3(), up: new Vector3(0, 1, 0), z: new Vector3(0, 0, 1) }),
    [],
  );

  useFrame((state, delta) => {
    const f = flight.current;
    const dt = Math.min(delta, 0.1);
    const { track, stations } = stationsState;
    const n = stations.length;

    let goalW = 0;
    let goalT = f.t;
    if (track && track.isConnected && n > 0) {
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      // The rect follows the browser's whole-pixel scroll; shift it by the difference to Lenis's fractional position.
      const shift = window.scrollY - getScrollY();
      const top = r.top + shift;
      goalW = flightWeight(top, r.bottom + shift, vh);
      goalT = indexFromProgress(progressFromRect(top, r.height, vh), n);
    }
    if (f.w < 0.001 && goalW > 0) f.t = goalT; // first engagement: start where the scroll is, not from station 1
    f.t += (goalT - f.t) * (1 - Math.exp(-dt * 10));
    f.w += (goalW - f.w) * (1 - Math.exp(-dt * 12));
    if (Math.abs(goalW - f.w) < 0.0005) f.w = goalW;
    f.t = Math.min(Math.max(0, n - 1), Math.max(0, f.t));
    stationsState.weight = f.w;
    f.active = activeIndex(f.t, n, f.active);
    if (f.w <= 0 || n === 0) return;

    const focus = focusAt(f.t, n);
    tmp.pos.set(...focus.position);
    tmp.tgt.set(...focus.target);
    // On a narrow screen there is no "left for the text, right for the rack": the text docks under the 3D, so the camera squares up to the
    // rack (no sideways offset), backs off to fit it, and aims below it so it rides in the upper part of the screen (about 42% of the
    // screen's half-height above the middle, wherever the lens is).
    const narrow = narrowFactor(state.size.width);
    if (narrow > 0) {
      const back = 4.6 * narrow;
      const halfH = Math.tan(((state.camera as THREE.PerspectiveCamera).fov * Math.PI) / 360) * (STATION.camOffset[2] + back);
      tmp.pos.x -= STATION.camOffset[0] * narrow;
      tmp.pos.z += back;
      tmp.tgt.x -= STATION.lookOffset[0] * narrow;
      tmp.tgt.y -= 0.42 * halfH * narrow;
    }
    tmp.m.lookAt(tmp.pos, tmp.tgt, tmp.up);
    tmp.q.setFromRotationMatrix(tmp.m);
    if (focus.travel > 0) tmp.q.multiply(tmp.roll.setFromAxisAngle(tmp.z, -focus.direction * focus.travel * ROLL));
    state.camera.position.lerp(tmp.pos, f.w);
    state.camera.quaternion.slerp(tmp.q, f.w);
  });

  return null;
}

const STATUS_LABEL: Record<string, string> = { live: "live", maintained: "maintained", "in-development": "in development", archived: "archived" };

/** Per-rack geometry worked out at rebuild: how many slabs, where the floor, the bus port and the top are. */
interface RackGeo {
  layout: Vec3[]; // rack centres
  ks: number[]; // slabs per rack (one per layer of the project's stack)
  ports: Vec3[]; // where the data bus meets each rack
  pads: Vec3[]; // the glowing pad under each rack
  tops: Vec3[]; // where the HUD label sits above each rack
  exhibit: boolean[]; // true where the project has its own schematic (the rack is then not drawn)
}

function StationsScene({ palette, dark, flight, shared }: { palette: WorldPalette; dark: boolean; flight: MutableRefObject<Flight>; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const slabMesh = useRef<InstancedMesh>(null);
  const ledMesh = useRef<InstancedMesh>(null);
  const rowMesh = useRef<InstancedMesh>(null);
  const plinthMesh = useRef<InstancedMesh>(null);
  const pad = useRef<THREE.Mesh>(null);
  const packet = useRef<THREE.Group>(null);
  const labelPos = useRef<THREE.Group>(null);
  const labelEl = useRef<HTMLDivElement>(null);
  const labelText = useRef<HTMLSpanElement>(null);
  // One label per slab of the ACTIVE rack: it names the layer (Browser, Application, Data, ...) and lists its technologies.
  const slotGroup = useRef<(THREE.Group | null)[]>([]);
  const slotEl = useRef<(HTMLDivElement | null)[]>([]);
  const slotKey = useRef<string[]>([]);
  const built = useRef(-1);
  const shown = useRef({ active: -1, n: -1 });
  const geo = useRef<RackGeo>({ layout: [], ks: [], ports: [], pads: [], tops: [], exhibit: [] });
  const scratch = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(), c: new Color(), v: new Vector3() }), []);

  const box = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const padGeo = useMemo(() => new CircleGeometry(1, 48), []);
  const edgeGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(CAP * SLABS * EDGE_VERTS * 3), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(CAP * SLABS * EDGE_VERTS * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);
  const busGeo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(CAP * HOP_SEGS * 2 * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const mats = useMemo(
    () => ({
      solid: new MeshStandardMaterial({ flatShading: true, transparent: true, opacity: 0, roughness: 0.85, metalness: 0.08 }),
      led: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      row: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      plinth: new MeshStandardMaterial({ flatShading: true, transparent: true, opacity: 0, roughness: 0.9, metalness: 0.05 }),
      edge: new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false }),
      bus: new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      pad: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      halo: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }),
      core: new MeshBasicMaterial({ color: "#eafff2", transparent: true, opacity: 0, depthWrite: false, depthTest: false, fog: false }),
    }),
    [],
  );
  const colors = useMemo(() => ({ primary: new Color(), accent: new Color(), muted: new Color(), body: new Color() }), []);

  useEffect(() => {
    colors.primary.set(palette.primary);
    colors.accent.set(palette.accent);
    colors.muted.set(dark ? "#5b6b64" : "#9a9580");
    colors.body.set(dark ? "#14221c" : "#fbf8ef");
    mats.solid.color.copy(colors.body);
    mats.plinth.color.set(dark ? "#0d1712" : "#efeadb");
    mats.row.color.copy(colors.primary);
    mats.bus.color.set(palette.route);
    mats.pad.color.copy(colors.primary);
    mats.halo.color.copy(colors.primary);
  }, [palette, dark, colors, mats]);

  // instanceColor buffers exist only once something is written to them, so write neutral values up front.
  useEffect(() => {
    scratch.c.set("#ffffff");
    for (let k = 0; k < CAP * SLABS; k++) {
      slabMesh.current?.setColorAt(k, scratch.c);
      ledMesh.current?.setColorAt(k, scratch.c);
    }
  }, [scratch]);

  useEffect(
    () => () => {
      box.dispose();
      padGeo.dispose();
      edgeGeo.dispose();
      busGeo.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [box, padGeo, edgeGeo, busGeo, mats],
  );

  /** Fills every instance matrix, the edge positions and the bus for the current list of stations. One slab per stack layer. */
  const rebuild = (n: number) => {
    const infos = stationsState.stations;
    const layout = stationLayout(n);
    const exhibit = layout.map((_, i) => isExhibitKey(infos[i]?.exhibit));
    const ks = layout.map((_, i) => slabCount(infos[i]?.layers.length ?? 0));
    // A project with its own schematic stands on a fixed floor below it; without one, the rack stands on its own plinth.
    const floor = (c: Vec3, i: number) => (exhibit[i] ? c[1] - 1.85 : rackFloorY(c[1], ks[i]));
    const ports = layout.map((c, i): Vec3 => [c[0], floor(c, i) + 0.12, c[2] + 1.45]);
    const pads = layout.map((c, i): Vec3 => [c[0], floor(c, i) - 0.04, c[2]]);
    const tops = layout.map((c, i): Vec3 => [c[0], exhibit[i] ? c[1] + 1.95 : rackTopY(c[1], ks[i]) + 0.65, c[2]]);
    geo.current = { layout, ks, ports, pads, tops, exhibit };

    const { m, q, p, s } = scratch;
    const setM = (mesh: InstancedMesh | null, k: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (!mesh) return;
      m.compose(p.set(x, y, z), q, s.set(sx, sy, sz));
      mesh.setMatrixAt(k, m);
    };
    const edges = edgeGeo.getAttribute("position") as BufferAttribute;
    const bus = busGeo.getAttribute("position") as BufferAttribute;

    layout.forEach((c, i) => {
      setM(plinthMesh.current, i, c[0], rackFloorY(c[1], ks[i]) - 0.06, c[2], exhibit[i] ? 0 : 3.7, exhibit[i] ? 0 : 0.12, exhibit[i] ? 0 : 2.4);
      for (let j = 0; j < SLABS; j++) {
        const k = i * SLABS + j;
        if (j >= ks[i] || exhibit[i]) {
          // Unused slab slot: zero size, so it draws nothing.
          for (const mesh of [slabMesh.current, ledMesh.current, rowMesh.current]) setM(mesh, k, c[0], c[1], c[2], 0, 0, 0);
          for (let e = 0; e < EDGES.length; e++) edges.setXYZ(k * EDGE_VERTS + e, 0, 0, 0);
          continue;
        }
        const y = slabY(c[1], ks[i], j);
        const w = slabWidth(i, j);
        setM(slabMesh.current, k, c[0], y, c[2], w, RACK.slab, 1.8);
        setM(ledMesh.current, k, c[0] - w / 2 + 0.6, y, c[2] + 0.92, 0.7, 0.07, 0.04);
        setM(rowMesh.current, k, c[0] + 0.3, y, c[2] + 0.92, w * 0.5, 0.05, 0.03);
        for (let e = 0; e < EDGES.length; e++) {
          const cr = CORNERS[EDGES[e]];
          edges.setXYZ(k * EDGE_VERTS + e, c[0] + cr[0] * w, y + cr[1] * RACK.slab, c[2] + cr[2] * 1.8);
        }
      }
    });
    for (let i = 0; i < layout.length - 1; i++) {
      const a = ports[i];
      const b = ports[i + 1];
      for (let sg = 0; sg < HOP_SEGS; sg++) {
        for (let end = 0; end < 2; end++) {
          const e = (sg + end) / HOP_SEGS;
          bus.setXYZ((i * HOP_SEGS + sg) * 2 + end, a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e + BUS_LIFT * Math.sin(Math.PI * e), a[2] + (b[2] - a[2]) * e);
        }
      }
    }
    for (const mesh of [slabMesh.current, ledMesh.current, rowMesh.current]) {
      if (!mesh) continue;
      mesh.count = n * SLABS;
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (plinthMesh.current) {
      plinthMesh.current.count = n;
      plinthMesh.current.instanceMatrix.needsUpdate = true;
    }
    edges.needsUpdate = true;
    bus.needsUpdate = true;
    edgeGeo.setDrawRange(0, n * SLABS * EDGE_VERTS);
    busGeo.setDrawRange(0, Math.max(0, n - 1) * HOP_SEGS * 2);
    shown.current = { active: -1, n: -1 };
    slotKey.current = [];
  };

  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const warm = !!shared.current.warm;
    const f = flight.current;
    g.visible = warm || f.w > 0.002;
    if (!g.visible) return;

    const infos = stationsState.stations;
    const n = infos.length > 0 ? infos.length : warm ? 2 : 0; // warm-up with no flight on the page: two blank racks, invisible, so shaders compile now
    if (n === 0) return;
    if (built.current !== stationsState.version || geo.current.layout.length !== n) {
      rebuild(n);
      built.current = stationsState.version;
    }

    const w = warm ? 0 : f.w;
    const t = f.t;
    const time = state.clock.elapsedTime;
    const { c, v } = scratch;
    const { layout, ks, ports, pads, tops, exhibit } = geo.current;

    // The floor pad, the data bus and the travelling packet belong to the generic rack: they fade out under a project's own schematic.
    const i0 = Math.min(n - 1, Math.floor(t));
    const i1 = Math.min(n - 1, i0 + 1);
    const fr = t - i0;
    const own = (exhibit[i0] ? 1 : 0) * (1 - fr) + (exhibit[i1] ? 1 : 0) * fr;
    const gen = 1 - own;

    mats.solid.opacity = 0.92 * w;
    mats.plinth.opacity = 0.9 * w;
    mats.led.opacity = w;
    mats.row.opacity = 0.3 * w;
    mats.edge.opacity = 0.95 * w;
    mats.bus.opacity = 0.55 * w * gen;
    mats.pad.opacity = 0.14 * w * gen;
    mats.halo.opacity = 0.32 * w * gen;
    mats.core.opacity = w * gen;

    const colorAttr = edgeGeo.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < n; i++) {
      const a = smooth(1 - Math.abs(t - i));
      const status = infos[i]?.status;
      const dimBody = 0.55 + 0.45 * a;
      // The LEDs mean "this layer is part of the stack": green. A stated status only tints them (amber while in development, grey once archived).
      const ledBase = status === "in-development" ? colors.accent : status === "archived" ? colors.muted : colors.primary;
      const blink = status === "in-development" ? 0.65 + 0.35 * Math.sin(time * 3 + i) : 1;
      const level = (status === "maintained" ? 0.6 : 1) * (0.32 + 0.68 * a) * blink;
      for (let j = 0; j < SLABS; j++) {
        const k = i * SLABS + j;
        slabMesh.current?.setColorAt(k, c.setScalar(dimBody));
        const on = status === "archived" ? (j === 0 ? 0.5 : 0.18) : 0.75 + 0.25 * Math.sin(time * 1.7 + i * 2 + j * 1.3);
        ledMesh.current?.setColorAt(k, c.copy(ledBase).multiplyScalar(level * on));
      }
      const edgeLevel = 0.2 + 0.8 * a;
      c.copy(colors.primary).multiplyScalar(edgeLevel);
      for (let vtx = i * SLABS * EDGE_VERTS; vtx < (i + 1) * SLABS * EDGE_VERTS; vtx++) colorAttr.setXYZ(vtx, c.r, c.g, c.b);
    }
    if (slabMesh.current?.instanceColor) slabMesh.current.instanceColor.needsUpdate = true;
    if (ledMesh.current?.instanceColor) ledMesh.current.instanceColor.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // The glowing pad under the current rack and the data packet follow the same eased index as the camera.
    if (pad.current) {
      chainPoint(pads, t, v);
      pad.current.position.set(v.x, v.y, v.z);
      pad.current.scale.setScalar(2.4 + 0.15 * Math.sin(time * 2));
    }
    if (packet.current) {
      chainPoint(ports, t, v, BUS_LIFT);
      packet.current.position.copy(v);
      packet.current.scale.setScalar(1 + 0.25 * Math.sin(time * 5));
    }

    // HUD label: follows the rack, names the active one, fades while the camera is between racks.
    const act = Math.min(n - 1, Math.max(0, f.active));
    const actFade = w * smooth(1 - Math.abs(t - act) * 1.6);
    const el = labelEl.current;
    if (labelPos.current) {
      chainPoint(tops, t, v);
      labelPos.current.position.set(v.x, v.y, v.z);
    }
    if (el) {
      if (shown.current.active !== act || shown.current.n !== n) {
        shown.current = { active: act, n };
        const info = infos[act];
        if (labelText.current && info) {
          labelText.current.textContent = `${String(act + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")} · ${info.label}${info.status ? ` · ${STATUS_LABEL[info.status]}` : ""}${exhibit[act] ? " · schematic" : ""}`;
        }
      }
      el.style.opacity = String(actFade);
    }

    // Layer labels: one beside each slab of the active rack, on the right (the text is on the left), fading with the rack.
    const layers = infos[act]?.layers ?? [];
    const rack = layout[act];
    for (let j = 0; j < SLABS; j++) {
      const slot = slotEl.current[j];
      const grp = slotGroup.current[j];
      if (!slot || !grp) continue;
      const layer = j < ks[act] && !exhibit[act] ? layers[j] : undefined;
      if (!layer || !rack) {
        slot.style.opacity = "0";
        continue;
      }
      grp.position.set(rack[0] + slabWidth(act, j) / 2 + 0.3, slabY(rack[1], ks[act], j), rack[2] + 0.95);
      const key = `${act}|${layer.label}|${layer.items.join(",")}`;
      if (slotKey.current[j] !== key) {
        slotKey.current[j] = key;
        (slot.children[1] as HTMLElement).textContent = layer.label;
        (slot.children[2] as HTMLElement).textContent = layer.items.join(" · ");
      }
      slot.style.opacity = String(actFade);
    }
  });

  return (
    <group ref={root} visible={false}>
      <instancedMesh ref={slabMesh} args={[box, mats.solid, CAP * SLABS]} frustumCulled={false} />
      <instancedMesh ref={plinthMesh} args={[box, mats.plinth, CAP]} frustumCulled={false} />
      {/* Draw order matters: the slabs are transparent and write depth, so anything on their faces (rows, LEDs, edges) must be
          drawn after them or the slab covers it. The pad is drawn first so the plinth sits on top of it. */}
      <instancedMesh ref={rowMesh} args={[box, mats.row, CAP * SLABS]} frustumCulled={false} renderOrder={1} />
      <instancedMesh ref={ledMesh} args={[box, mats.led, CAP * SLABS]} frustumCulled={false} renderOrder={2} />
      <lineSegments geometry={edgeGeo} material={mats.edge} frustumCulled={false} renderOrder={3} />
      <lineSegments geometry={busGeo} material={mats.bus} frustumCulled={false} renderOrder={3} />
      <mesh ref={pad} geometry={padGeo} material={mats.pad} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} renderOrder={-1} />
      <group ref={packet}>
        <mesh material={mats.halo} renderOrder={2001}>
          <sphereGeometry args={[0.2, 14, 10]} />
        </mesh>
        <mesh material={mats.core} renderOrder={2002}>
          <sphereGeometry args={[0.07, 14, 10]} />
        </mesh>
      </group>
      <ExhibitLayer flight={flight} palette={palette} dark={dark} />
      <group ref={labelPos}>
        <Html center wrapperClass="pointer-events-none" zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div ref={labelEl} className="hud-label" style={{ opacity: 0 }}>
            <span className="hud-label__line" aria-hidden />
            <span ref={labelText} />
          </div>
        </Html>
      </group>
      {Array.from({ length: SLABS }, (_, j) => (
        <group key={j} ref={(el) => void (slotGroup.current[j] = el)}>
          <Html wrapperClass="pointer-events-none" zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
            <div ref={(el) => void (slotEl.current[j] = el)} className="stack-label" style={{ opacity: 0 }}>
              <span className="stack-label__line" aria-hidden />
              <span className="stack-label__name" />
              <span className="stack-label__items" />
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/** One schematic per project that has one, each mounted only while the camera is near it (see ExhibitRoot). */
function ExhibitLayer({ flight, palette, dark }: { flight: MutableRefObject<Flight>; palette: WorldPalette; dark: boolean }) {
  const [, bump] = useState(0);
  useEffect(() => subscribeStations(() => bump((v) => v + 1)), []);
  const infos = stationsState.stations;
  const layout = stationLayout(infos.length);
  return (
    <>
      {infos.map((info, i) => {
        if (!isExhibitKey(info.exhibit)) return null;
        const Exhibit = EXHIBIT_COMPONENTS[info.exhibit];
        return (
          <ExhibitRoot key={info.id} index={i} position={layout[i]} flight={flight} palette={palette} dark={dark}>
            <Exhibit />
          </ExhibitRoot>
        );
      })}
    </>
  );
}

/** Mounted in WorldScene right after RigDriver (and before ProjectPods), so the camera follower runs after the rig and before anything that reads the camera. */
export function ProjectStations({ palette, dark, shared }: { palette: WorldPalette; dark: boolean; shared: MutableRefObject<RigShared> }) {
  const flight = useRef<Flight>({ t: 0, w: 0, active: 0 });
  return (
    <>
      <StationsCamera flight={flight} />
      <StationsScene palette={palette} dark={dark} flight={flight} shared={shared} />
    </>
  );
}
