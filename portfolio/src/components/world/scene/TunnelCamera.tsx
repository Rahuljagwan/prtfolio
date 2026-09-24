"use client";

import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Quaternion, Vector3, type PerspectiveCamera } from "three";
import { stationsState } from "@/lib/world/stations";
import {
  WORLD_FOV,
  damp,
  dampPose,
  fovKick,
  focalDistance,
  fxWeight,
  leanFor,
  makePoseState,
  poseAt,
  settled,
  speedNorm,
  type Damped,
  type SectionExtent,
} from "@/lib/world/tunnel-math";
import type { RigShared } from "./RigDriver";

// The tunnel run: the camera direction that plays over the rig as the visitor scrolls. The rig carries the camera along the
// route and holds one pose per zone; this layer gives every section its own shot on top of that (a base angle plus a slow move
// that plays as the section scrolls by, tracking around the same subject), glides between the shots at the section boundaries,
// and reacts to scroll speed: the lens widens, the camera is thrown forward and leans into the motion, and the edges of the
// canvas darken (a CSS variable), so travelling between sections feels like moving through a tunnel.
//
// It is additive and self-resetting: the rig re-poses the camera from scratch every frame, this runs right after it, and the
// Projects flight (StationsCamera) runs after this and blends its own pose over the result, so with no shots and no scroll
// speed it does nothing at all. All the maths is in lib/world/tunnel-math.ts (pure, tested); this file only applies it.

const SHOT_OMEGA = 5.2; // how tightly the shot follows the scroll (1/s): about 0.8 s to settle, so the camera has weight
const SPEED_UP = 8; // the speed reaction rises quickly...
const SPEED_DOWN = 3.4; // ...and lets go slowly
const DEG = Math.PI / 180;

interface TunnelState {
  started: boolean;
  lastY: number;
  pose: ReturnType<typeof makePoseState>;
  speed: Damped;
  vignette: number;
  lastFov: number;
  lastAttr: string;
}

export function TunnelCamera({ sections, shared, host }: { sections: RefObject<SectionExtent[]>; shared: MutableRefObject<RigShared>; host: RefObject<HTMLElement | null> }) {
  const st = useRef<TunnelState>({ started: false, lastY: 0, pose: makePoseState(), speed: { x: 0, v: 0 }, vignette: -1, lastFov: WORLD_FOV, lastAttr: "" });
  const tmp = useMemo(
    () => ({
      f: new Vector3(),
      f1: new Vector3(),
      r: new Vector3(),
      up: new Vector3(),
      pivot: new Vector3(),
      qd: new Quaternion(),
      qe: new Quaternion(),
      euler: new Euler(0, 0, 0, "YXZ"),
    }),
    [],
  );

  useFrame((state, delta) => {
    const s = st.current;
    const cam = state.camera as PerspectiveCamera;
    const dt = Math.min(delta, 0.1);
    const y = window.scrollY;
    const vh = Math.max(1, window.innerHeight);
    const u = shared.current.u;

    // Where the shot wants the camera, from where the viewport centre sits in the sections.
    const goal = poseAt(y + vh / 2, sections.current ?? []);
    if (!s.started) {
      s.pose = makePoseState(goal); // a reload part-way down the page starts on its shot, it does not swing in from nothing
      s.lastY = y;
      s.started = true;
    }
    dampPose(s.pose, goal, dt, SHOT_OMEGA);

    // How fast the page is moving, in screens per second (signed), smoothed with a quick attack and a slow release.
    const rawSpeed = speedNorm((y - s.lastY) / Math.max(delta, 1 / 240) / vh);
    s.lastY = y;
    damp(s.speed, rawSpeed, dt, rawSpeed === 0 || Math.abs(rawSpeed) < Math.abs(s.speed.x) ? SPEED_DOWN : SPEED_UP);

    // The flight has its own pose and lens: the speed reaction fades out over it, and it does not fight the shots (they are zero there).
    const fx = fxWeight(u) * (1 - Math.min(1, stationsState.weight));
    const lean = leanFor(s.speed.x * fx);
    const kick = fovKick(s.speed.x) * fx;

    const p = s.pose;
    const dx = p.dx.x;
    const dy = p.dy.x;
    const dz = p.dz.x + lean.dz;
    const yaw = p.yaw.x;
    const pitch = p.pitch.x;
    const roll = p.roll.x + lean.roll;
    const fov = p.fov.x * (1 - Math.min(1, stationsState.weight)) + kick;

    const still = Math.abs(dx) + Math.abs(dy) + Math.abs(dz) + Math.abs(yaw) + Math.abs(pitch) + Math.abs(roll) < 1e-4;
    if (!still) {
      // The rig has just posed the camera. Move it in its own frame, then turn it back onto the same point it was looking at,
      // so the subject stays in frame and the angle onto it is what changes (an arc, not a slide). Pan, tilt and roll go on top.
      tmp.f.set(0, 0, -1).applyQuaternion(cam.quaternion);
      tmp.r.set(1, 0, 0).applyQuaternion(cam.quaternion);
      tmp.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
      tmp.pivot.copy(cam.position).addScaledVector(tmp.f, focalDistance(u));
      cam.position.addScaledVector(tmp.r, dx).addScaledVector(tmp.up, dy).addScaledVector(tmp.f, dz);
      tmp.f1.copy(tmp.pivot).sub(cam.position).normalize();
      tmp.qd.setFromUnitVectors(tmp.f, tmp.f1);
      cam.quaternion.premultiply(tmp.qd);
      tmp.euler.set(pitch * DEG, -yaw * DEG, roll * DEG);
      tmp.qe.setFromEuler(tmp.euler);
      cam.quaternion.multiply(tmp.qe);
    }

    const wantFov = WORLD_FOV + fov;
    if (Math.abs(wantFov - s.lastFov) > 0.004) {
      cam.fov = wantFov;
      cam.updateProjectionMatrix();
      s.lastFov = wantFov;
    }

    // The canvas edges darken with speed (see .world-tunnel in globals.css): a tunnel-vision cue that costs one CSS variable.
    const el = host.current;
    if (el) {
      const v = Math.round(Math.min(1, Math.abs(s.speed.x) * fx) * 50) / 50;
      if (v !== s.vignette) {
        s.vignette = v;
        el.style.setProperty("--tunnel", String(v));
      }
      const attr = `${dx.toFixed(2)},${dy.toFixed(2)},${dz.toFixed(2)},${yaw.toFixed(1)},${pitch.toFixed(1)},${roll.toFixed(1)},${wantFov.toFixed(1)}`;
      if (attr !== s.lastAttr) {
        s.lastAttr = attr;
        el.dataset.tunnel = attr;
      }
    }

    // Keep drawing until the shot has settled on where it is going and the speed reaction has let go.
    if (!settled(s.pose, goal) || Math.abs(s.speed.x) > 0.002) state.invalidate();
  });

  return null;
}

