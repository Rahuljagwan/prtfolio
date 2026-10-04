"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  LineBasicMaterial,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type InstancedMesh,
} from "three";
import type * as THREE from "three";
import { audioScene } from "@/lib/audio/state";
import type { RigCurves } from "@/lib/world/rig-path";
import { BEACON, ZONES } from "@/lib/world/zones";
import { smootherstep } from "@/lib/world/rig-math";
import {
  HELI,
  angleDelta,
  heliOpacity,
  laneAbove,
  laneLateral,
  liftGoal,
  orbitRamp,
  padOpacity,
  padPull,
  riseFor,
  spoolFor,
  trackS,
  yawFor,
} from "@/lib/world/heli-math";
import { ditherFade } from "./dither";
import type { WorldPalette } from "./palette";
import { ROUTE_DROP } from "./RouteAndDust";
import type { RigShared } from "./RigDriver";

const GROUND_Y = -2.7; // the same ground every zone builds on (FoundationZone, CityZone, GroundPlane)
const SCALE = 0.72; // model scale: sized to sit inside the pad's inner ring with its rotor clear of the About copy above it
const MASS = { y: 0.35, z: 0.15 }; // model-space point it turns about: the rotor mast, like a real helicopter
const PARKED_Y = GROUND_Y + 0.012 + MASS.y * SCALE; // pose height with the skids resting on the pad
const MAIN_SPEED = 20; // rad/s at full spool (kept low enough that four blades never look like they turn backwards)
const TAIL_SPEED = 52;
const PAD_LIGHTS = 12;
const PAD_LIGHT_RADIUS = 1.6; // the pad's inner ring (FoundationZone's rings: 1.6, 3.2, 5.2, 8)
const RIPPLES = 2; // rotor wash on the pad while it spools up and lifts
const RIPPLE_PERIOD = 1.3; // seconds for one ripple to travel out and fade

/**
 * The route the helicopter follows and the lane it flies in. The route is the one the camera rides (the position curve) followed by the
 * straight leg the route line takes into the beacon. The lane sits on the route line's axis, above it, and ahead of the camera, so it
 * passes through exactly the corridor the camera passes through (see heli-math.ts for the numbers).
 */
function useLane(curves: RigCurves) {
  return useMemo(() => {
    const last = ZONES.length - 1;
    // The route position where it passes the pad (bisection: the route runs monotonically away from the camera).
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (curves.position.getPoint(m).z > HELI.PAD.z) lo = m;
      else hi = m;
    }
    const sPad = ((lo + hi) / 2) * last;
    const hover = new Vector3(HELI.PAD.x, GROUND_Y + HELI.HOVER_ALT, HELI.PAD.z);

    const camEnd = curves.position.getPoint(1);
    const tubeEnd = new Vector3(camEnd.x, camEnd.y - ROUTE_DROP, camEnd.z);
    const beacon = new Vector3(BEACON[0], BEACON[1], BEACON[2]);
    const a = new Vector3();
    const b = new Vector3();

    /** A point on the route LINE (the glowing tube: ROUTE_DROP under the camera's path) at route position s. */
    const tubeAt = (s: number, out: Vector3) => {
      if (s <= last) {
        curves.position.getPoint(Math.min(1, Math.max(0, s / last)), out);
        out.y -= ROUTE_DROP;
        return out;
      }
      return out.lerpVectors(tubeEnd, beacon, Math.min(1, (s - last) / HELI.LEG_U));
    };
    /** The horizontal direction of travel at s, from a short stretch of route either side, so a bend or the joint onto the leg is rounded off. */
    const heading = (s: number) => {
      tubeAt(Math.max(0, s - 0.08), a);
      tubeAt(s + 0.08, b);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      return { x: dx / len, z: dz / len };
    };

    const p = new Vector3();
    tubeAt(sPad, p);
    const h0 = heading(sPad);
    // Where the hover point sits relative to the route line, so the lane starts exactly over the pad centre.
    const lateral0 = (hover.x - p.x) * -h0.z + (hover.z - p.z) * h0.x;
    const above0 = hover.y - p.y;

    const raw = (s: number, out: Vector3) => {
      tubeAt(s, p);
      const h = heading(s);
      const lat = laneLateral(lateral0, s, sPad);
      return out.set(p.x - h.z * lat, p.y + laneAbove(above0, s, sPad), p.z + h.x * lat);
    };
    const delta = hover.clone().sub(raw(sPad, new Vector3()));

    // The orbit: a circle around the beacon through the point where the lane stops.
    const stop = raw(HELI.S_ORBIT, new Vector3());
    const orbit = { x: beacon.x, z: beacon.z, radius: Math.hypot(stop.x - beacon.x, stop.z - beacon.z), phi0: Math.atan2(stop.z - beacon.z, stop.x - beacon.x), stop };

    return {
      sPad,
      orbit,
      /** World position of the helicopter's pose point (the rotor mast) at route position s. */
      place: (s: number, out: Vector3) => raw(s, out).addScaledVector(delta, padPull(s, sPad)),
      heading,
    };
  }, [curves]);
}

/**
 * The helicopter that parks on the About section's helipad (the concentric rings under its copy), and the helipad's own markings.
 *
 * It is drawn entirely in code (no model files), in the same blueprint language as the rest of the world: a dark low-poly body in
 * the dark theme (a light one in the light theme, so it never fights the text it sits behind), outlined in the status green,
 * with an amber beacon. It is scroll-driven end to end (see lib/world/heli-math.ts for the story and the numbers): parked while
 * About is read; as the end of About scrolls by, the rotors spool up, wash ripples spread over the pad, and it lifts off, hovers and
 * rolls forward; then it leads the visitor down the whole route, above the line and ahead of the camera, and at the end it settles
 * beside the beacon and circles it.
 *
 * It sits in the 3D canvas, behind the page text, so it can never cover or alter content; it is small enough to rest in the clear
 * space under the About copy.
 */
export function Helicopter({ palette, dark, curves, shared }: { palette: WorldPalette; dark: boolean; curves: RigCurves; shared: MutableRefObject<RigShared> }) {
  const root = useRef<THREE.Group>(null);
  const mainRotor = useRef<THREE.Group>(null);
  const tailRotor = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Group>(null);
  const padGroup = useRef<THREE.Group>(null);
  const ripples = useRef<(THREE.Mesh | null)[]>([]);
  const lights = useRef<InstancedMesh>(null);
  const state = useRef({ started: false, s: 0, lift: 0, rotor: 0, tail: 0, phase: 0, v: 0 });
  const lane = useLane(curves);
  const pos = useMemo(() => new Vector3(), []);
  const ndc = useMemo(() => new Vector3(), []);

  const uFade = useMemo(() => ({ value: 0 }), []);

  const geo = useMemo(() => {
    const sphere = new SphereGeometry(0.5, 14, 10);
    const box = new BoxGeometry(1, 1, 1);
    return {
      sphere,
      box,
      fuselageEdges: new EdgesGeometry(sphere, 14),
      humpEdges: new EdgesGeometry(box),
      boom: new CylinderGeometry(0.03, 0.07, 1, 8).rotateX(Math.PI / 2), // thin end toward +Z (the tail)
      skid: new CylinderGeometry(0.018, 0.018, 1, 6).rotateX(Math.PI / 2),
      mast: new CylinderGeometry(0.028, 0.036, 0.17, 8),
      disc: new CircleGeometry(0.8, 40),
      shadow: new CircleGeometry(1, 28),
      ripple: new RingGeometry(0.94, 1, 56),
      padBar: new PlaneGeometry(1, 1),
      padLight: new SphereGeometry(0.04, 8, 6),
    };
  }, []);

  const mats = useMemo(() => {
    const standard = (extra: ConstructorParameters<typeof MeshStandardMaterial>[0]) =>
      ditherFade(new MeshStandardMaterial({ flatShading: true, roughness: 0.55, metalness: 0.2, ...extra }), uFade);
    return {
      // polygonOffset pushes the surface back a hair so the outline drawn on it is never eaten by z-fighting.
      body: standard({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      dark: standard({}),
      blade: standard({ roughness: 0.7 }),
      glass: standard({ roughness: 0.25, metalness: 0.1, emissiveIntensity: 0.55 }),
      edge: new LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      disc: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide, fog: false }),
      beacon: new MeshBasicMaterial({ transparent: true, opacity: 0 }),
      shadow: [0, 1, 2].map(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })),
      ripple: Array.from({ length: RIPPLES }, () => new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide })),
      pad: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: DoubleSide }),
      padLight: new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    };
  }, [uFade]);

  useEffect(() => {
    mats.body.color.set(dark ? "#2c3b44" : "#e7ece9");
    mats.dark.color.set(dark ? "#151f25" : "#59656e");
    mats.blade.color.set(dark ? "#0c1317" : "#2b3339");
    mats.glass.color.set(dark ? "#7fd6ff" : "#8fb7d6");
    mats.glass.emissive.set(dark ? "#1b6f93" : "#3d6f8f");
    mats.edge.color.set(palette.primary);
    mats.disc.color.set(palette.primary);
    mats.beacon.color.set(palette.accent);
    mats.pad.color.set(palette.accent);
    mats.padLight.color.set(palette.accent);
    mats.shadow.forEach((m) => m.color.set(dark ? "#000000" : "#2f2a1c"));
    mats.ripple.forEach((m) => m.color.set(palette.dust));
  }, [mats, palette, dark]);

  // Pad lights: a ring of small beacons on the pad's inner ring, set once.
  useEffect(() => {
    const m = lights.current;
    if (!m) return;
    const tmp = new Matrix4();
    const q = new Quaternion();
    const s = new Vector3(1, 1, 1);
    for (let i = 0; i < PAD_LIGHTS; i++) {
      const a = (i / PAD_LIGHTS) * Math.PI * 2;
      tmp.compose(new Vector3(Math.cos(a) * PAD_LIGHT_RADIUS, GROUND_Y + 0.045, Math.sin(a) * PAD_LIGHT_RADIUS), q, s);
      m.setMatrixAt(i, tmp);
    }
    m.instanceMatrix.needsUpdate = true;
  }, []);

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose());
      Object.values(mats).forEach((m) => (Array.isArray(m) ? m.forEach((x) => x.dispose()) : m.dispose()));
    },
    [geo, mats],
  );

  useFrame((fs, delta) => {
    const g = root.current;
    const pg = padGroup.current;
    if (!g || !pg) return;
    const u = shared.current.u;
    const local = shared.current.local ?? 0;
    const warm = !!shared.current.warm;

    // The pad's markings belong to the Gate zone and fade with it.
    const padOn = warm || (u > 0.05 && u < 2.7);
    pg.visible = padOn;
    if (padOn) {
      const p = padOpacity(u);
      mats.pad.opacity = 0.5 * p;
      mats.padLight.opacity = 0.95 * p;
    }

    const op = heliOpacity(u);
    g.visible = warm || (u > 0.05 && op > 0.002);
    if (!g.visible) {
      audioScene.heli.on = false;
      return;
    }

    const dt = Math.min(delta, 0.1);
    const s = state.current;
    const goalS = trackS(u, local, lane.sPad);
    const goalLift = liftGoal(u, local);
    // Both are eased on top of the scroll (which Lenis has already smoothed), so nothing in the flight ever steps with the wheel.
    if (!s.started) {
      s.s = goalS;
      s.lift = goalLift;
      s.started = true;
    } else {
      const before = s.s;
      s.s += (goalS - s.s) * (1 - Math.exp(-dt * 9));
      s.lift += (goalLift - s.lift) * (1 - Math.exp(-dt * 4.2)); // slower than the flight: a gentle, unhurried take-off
      // Ground speed along the route (route units per second), smoothed: it drives the lean and the bank.
      const v = delta > 1e-4 && delta < 0.25 ? (s.s - before) / delta : 0;
      s.v += (v - s.v) * (1 - Math.exp(-dt * 6));
    }
    const L = s.lift;
    const time = fs.clock.elapsedTime;

    // ---- position: parked on the pad, rising over it, then along the lane
    lane.place(s.s, pos);
    pos.y = PARKED_Y + (pos.y - PARKED_Y) * riseFor(L);
    const fly = smootherstep((s.s - lane.sPad) / 0.1); // 0 on the pad, 1 once it is under way
    const hover = smootherstep(L) * (1 - fly); // a hovering helicopter is never perfectly still
    pos.y += Math.sin(time * 1.7) * 0.022 * hover;
    pos.x += Math.sin(time * 1.1 + 1) * 0.012 * hover;

    // ---- at the end of the route: circling the beacon (an offset from the stop point, so the hand-over is seamless)
    const ramp = orbitRamp(u);
    if (ramp > 0) s.phase += HELI.ORBIT_OMEGA * ramp * dt;
    else s.phase *= Math.exp(-dt * 3);
    const phi = lane.orbit.phi0 - s.phase;
    if (s.phase > 1e-4) {
      pos.x += lane.orbit.x + Math.cos(phi) * lane.orbit.radius - lane.orbit.stop.x;
      pos.z += lane.orbit.z + Math.sin(phi) * lane.orbit.radius - lane.orbit.stop.z;
      pos.y += Math.sin(time * 0.7) * 0.18 * smootherstep(s.phase / 0.5);
    }

    // ---- attitude: swings its nose from the parked heading to the route as it lifts; leans into the speed; banks into turns
    const yawAt = (at: number) => {
      const h = lane.heading(at);
      return yawFor(h.x, h.z);
    };
    const yawParked = yawFor(HELI.PARKED_HEADING[0], HELI.PARKED_HEADING[1]);
    const yawLane = yawAt(s.s);
    const orbitBlend = smootherstep(s.phase / 0.35);
    const yawOrbit = yawFor(Math.sin(phi), -Math.cos(phi)); // tangent while the angle decreases
    const yawFlight = yawLane + angleDelta(yawLane, yawOrbit) * orbitBlend;
    const yaw = yawParked + angleDelta(yawParked, yawFlight) * smootherstep((L - 0.45) / 0.55);
    const turn = angleDelta(yawAt(Math.max(0, s.s - 0.05)), yawAt(s.s + 0.05)) / 0.1; // radians per route unit
    const bankLane = Math.max(-0.22, Math.min(0.22, turn * s.v * 0.25));
    const roll = (bankLane * (1 - orbitBlend) + 0.13 * orbitBlend) * fly;
    const lean = -(0.03 * fly + 0.13 * Math.max(-0.6, Math.min(1, s.v / 1.0)) * fly);
    g.position.copy(pos);
    g.rotation.set(lean, yaw, roll, "YXZ");

    // ---- rotors
    const spool = spoolFor(L);
    s.rotor = (s.rotor + MAIN_SPEED * spool * dt) % (Math.PI * 2);
    s.tail = (s.tail + TAIL_SPEED * spool * dt) % (Math.PI * 2);
    if (mainRotor.current) mainRotor.current.rotation.y = s.rotor;
    if (tailRotor.current) tailRotor.current.rotation.x = s.tail;
    mats.disc.opacity = 0.17 * spool * op; // the blur of a spinning rotor

    // ---- what the sound design hears: rotor speed, how far it is from the camera, and where it is across the screen (lib/audio)
    const ha = audioScene.heli;
    ha.on = true;
    ha.spool = spool;
    ha.rise = riseFor(L);
    ha.speed = Math.abs(s.v);
    ha.dist = fs.camera.position.distanceTo(pos);
    ndc.copy(pos).project(fs.camera);
    ha.pan = ndc.z < 1 ? Math.max(-1, Math.min(1, ndc.x)) : 0; // behind the camera: dead centre
    ha.at = performance.now();

    // ---- fade (dither for the solid parts, plain opacity for the outline and beacon)
    uFade.value = op;
    mats.edge.opacity = 0.55 * op;
    mats.beacon.opacity = op;

    // ---- on the ground: a soft shadow that grows and fades as it climbs, and wash ripples spreading over the pad while it is low
    const alt = Math.max(0, pos.y - GROUND_Y - MASS.y * SCALE);
    const sh = shadow.current;
    if (sh) {
      sh.position.set(pos.x - alt * 0.18, GROUND_Y + 0.014, pos.z - alt * 0.12);
      sh.rotation.y = yaw;
      const grow = 1 + alt * 0.12;
      sh.scale.set(grow, 1, grow);
      const k = (1 - smootherstep(alt / 3.5)) * op;
      mats.shadow.forEach((m, i) => (m.opacity = (dark ? 0.16 : 0.1) * k * (i === 0 ? 1 : i === 1 ? 0.9 : 0.8)));
    }
    const wash = spool * (1 - smootherstep(alt / 2.4)) * op * padOpacity(u);
    for (let i = 0; i < RIPPLES; i++) {
      const m = ripples.current[i];
      if (!m) continue;
      const p = (((time / RIPPLE_PERIOD + i / RIPPLES) % 1) + 1) % 1;
      const r = (0.45 + p * 1.9) * (1 + alt * 0.2);
      m.position.set(pos.x, GROUND_Y + 0.016 + i * 0.0005, pos.z);
      m.scale.set(r, r, 1);
      mats.ripple[i].opacity = 0.34 * wash * (1 - p) * (1 - p);
    }
  });

  return (
    <>
      {/* The pad's markings: an H under where it parks, and a ring of beacons on the inner ring. */}
      <group ref={padGroup} visible={false} position={[HELI.PAD.x, 0, HELI.PAD.z]}>
        <mesh geometry={geo.padBar} material={mats.pad} rotation={[-Math.PI / 2, 0, 0]} position={[-0.34, GROUND_Y + 0.013, 0]} scale={[0.075, 1.0, 1]} />
        <mesh geometry={geo.padBar} material={mats.pad} rotation={[-Math.PI / 2, 0, 0]} position={[0.34, GROUND_Y + 0.013, 0]} scale={[0.075, 1.0, 1]} />
        <mesh geometry={geo.padBar} material={mats.pad} rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.013, 0]} scale={[0.755, 0.075, 1]} />
        <instancedMesh ref={lights} args={[geo.padLight, mats.padLight, PAD_LIGHTS]} frustumCulled={false} />
      </group>

      {/* A soft shadow: three stacked discs on the ground, so it reads as resting on the pad rather than floating over it. */}
      <group ref={shadow}>
        {mats.shadow.map((m, i) => (
          <mesh key={i} geometry={geo.shadow} material={m} rotation={[-Math.PI / 2, 0, 0]} scale={[0.62 * SCALE * (1 - i * 0.28), 0.95 * SCALE * (1 - i * 0.28), 1]} position={[0, i * 0.0006, 0]} />
        ))}
      </group>

      {/* The wash of the rotor over the pad: thin rings spreading outward while it spools up and lifts off. */}
      {mats.ripple.map((m, i) => (
        <mesh key={i} ref={(el) => void (ripples.current[i] = el)} geometry={geo.ripple} material={m} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false} />
      ))}

      {/* The helicopter. The outer group is the pose (about the rotor mast); the inner one places the model so that point is the origin. */}
      <group ref={root} visible={false} scale={SCALE}>
        <group position={[0, -MASS.y, -MASS.z]}>
          {/* fuselage + its outline */}
          <group position={[0, 0.3, 0]} scale={[0.46, 0.44, 0.95]}>
            <mesh geometry={geo.sphere} material={mats.body} />
            <lineSegments geometry={geo.fuselageEdges} material={mats.edge} />
          </group>
          {/* canopy */}
          <mesh geometry={geo.sphere} material={mats.glass} position={[0, 0.36, -0.26]} scale={[0.4, 0.32, 0.5]} />
          {/* engine cowling */}
          <group position={[0, 0.57, MASS.z]} scale={[0.32, 0.14, 0.46]}>
            <mesh geometry={geo.box} material={mats.body} />
            <lineSegments geometry={geo.humpEdges} material={mats.edge} />
          </group>
          {/* tail boom, fin, stabiliser */}
          <mesh geometry={geo.boom} material={mats.dark} position={[0, 0.4, 0.95]} />
          <mesh geometry={geo.box} material={mats.body} position={[0, 0.6, 1.4]} scale={[0.026, 0.36, 0.22]} />
          <mesh geometry={geo.box} material={mats.dark} position={[0, 0.45, 1.22]} scale={[0.42, 0.02, 0.15]} />
          {/* tail rotor */}
          <group ref={tailRotor} position={[0.05, 0.62, 1.44]}>
            <mesh geometry={geo.box} material={mats.blade} scale={[0.012, 0.26, 0.035]} />
            <mesh geometry={geo.box} material={mats.blade} scale={[0.012, 0.035, 0.26]} />
          </group>
          {/* mast, hub and main rotor */}
          <mesh geometry={geo.mast} material={mats.dark} position={[0, 0.715, MASS.z]} />
          <group ref={mainRotor} position={[0, 0.8, MASS.z]}>
            <mesh geometry={geo.box} material={mats.blade} scale={[1.6, 0.012, 0.075]} />
            <mesh geometry={geo.box} material={mats.blade} scale={[0.075, 0.012, 1.6]} />
            <mesh geometry={geo.sphere} material={mats.dark} scale={0.1} />
          </group>
          <mesh geometry={geo.disc} material={mats.disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.8, MASS.z]} />
          {/* skids and struts */}
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh geometry={geo.skid} material={mats.dark} position={[side * 0.26, 0.02, -0.05]} />
              <mesh geometry={geo.box} material={mats.dark} position={[side * 0.235, 0.12, -0.22]} rotation={[0, 0, side * 0.17]} scale={[0.02, 0.2, 0.02]} />
              <mesh geometry={geo.box} material={mats.dark} position={[side * 0.235, 0.12, 0.2]} rotation={[0, 0, side * 0.17]} scale={[0.02, 0.2, 0.02]} />
            </group>
          ))}
          {/* beacons: amber, never red (red is reserved for the incident sequence) */}
          <mesh geometry={geo.sphere} material={mats.beacon} position={[0, 0.78, 1.4]} scale={0.055} />
          <mesh geometry={geo.sphere} material={mats.beacon} position={[0, 0.66, 0.4]} scale={0.05} />
        </group>
      </group>
    </>
  );
}
