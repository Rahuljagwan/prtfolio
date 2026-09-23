"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Fog } from "three";
import { makeCurves } from "@/lib/world/rig-path";
import type { ZoneLayout } from "@/lib/world/rig-math";
import { ZONES } from "@/lib/world/zones";
import { PALETTE } from "./scene/palette";
import { RigDriver, type RigShared } from "./scene/RigDriver";
import { ProjectPods } from "./scene/pods/ProjectPods";
import { RouteDust, RouteFlow, RouteLine } from "./scene/RouteAndDust";
import { GroundPlane } from "./scene/GroundPlane";
import { CityZone } from "./scene/CityZone";
import { DeploymentsZone } from "./scene/DeploymentsZone";
import { FoundationZone } from "./scene/FoundationZone";
import { StackZone } from "./scene/StackZone";
import { RequestOriginZone } from "./scene/RequestOriginZone";
import { WAKE_EVENT, useRenderScheduler } from "./scene/useRenderScheduler";
import { SignalOutZone } from "./scene/SignalOutZone";

// Loaded lazily by WorldCanvas. Everything is procedural (no models, textures or HDRIs).

/** Drops the pixel ratio once if the frame rate stays low, so weak GPUs degrade instead of stuttering. */
function useAdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr);
  const acc = useRef({ time: 0, frames: 0, done: false });
  useFrame((_, dt) => {
    const a = acc.current;
    if (a.done || dt > 0.1) return; // ignore the long gap after an idle period
    a.time += dt;
    a.frames += 1;
    if (a.time >= 1) {
      if (a.time / a.frames > 0.028) {
        setDpr(1);
        a.done = true;
      }
      a.time = 0;
      a.frames = 0;
    }
  });
}

/** Everything inside the canvas: theme, fog, scheduler, rig, and the zone content. */
function World({ dark, host, layouts, onReady }: Pick<WorldSceneProps, "dark" | "host" | "layouts" | "onReady">) {
  const palette = dark ? PALETTE.dark : PALETTE.light;
  const scene = useThree((s) => s.scene);
  const shared = useRef<RigShared>({ u: 0, zone: 0 });
  const curves = useMemo(() => makeCurves(ZONES), []);

  useRenderScheduler();
  useAdaptiveDpr();

  // Warm-up: shaders compile and geometry uploads to the GPU the first time something is drawn, which used to happen
  // mid-scroll each time a zone came into view (measured: 50 to 150 ms hitches on the first pass down the page).
  // Draw every zone once, invisibly (their opacity is 0 until the camera reaches them), right after load instead.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    shared.current.warm = true;
    invalidate();
    const t = setTimeout(() => {
      shared.current.warm = false;
      invalidate();
    }, 250);
    return () => clearTimeout(t);
  }, [invalidate]);

  // Fog matches the page background so far geometry dissolves into the HTML behind it.
  useEffect(() => {
    scene.fog = new Fog(palette.fog, 16, 70);
    window.dispatchEvent(new Event(WAKE_EVENT)); // theme changed: redraw
  }, [scene, palette.fog]);

  return (
    <>
      <RigDriver curves={curves} layouts={layouts} host={host} shared={shared} onReady={onReady} />
      <ambientLight intensity={dark ? 0.5 : 0.9} />
      <directionalLight position={[4, 5, 6]} intensity={dark ? 2.2 : 1.6} />
      <RouteLine curves={curves} palette={palette} shared={shared} />
      <RouteDust curves={curves} palette={palette} count={550} shared={shared} />
      <RouteFlow curves={curves} palette={palette} shared={shared} />
      <GroundPlane palette={palette} shared={shared} />
      <RequestOriginZone palette={palette} curves={curves} shared={shared} />
      <FoundationZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <CityZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <DeploymentsZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <StackZone palette={palette} curves={curves} shared={shared} />
      <ProjectPods dark={dark} shared={shared} />
      <SignalOutZone palette={palette} shared={shared} />
    </>
  );
}

export interface WorldSceneProps {
  dark: boolean;
  host: RefObject<HTMLElement | null>;
  layouts: RefObject<ZoneLayout[]>;
  onReady: () => void;
  onLost: () => void;
}

export default function WorldScene({ dark, host, layouts, onReady, onLost }: WorldSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ fov: 42, near: 0.1, far: 80, position: ZONES[0].camera.position }}
      // failIfMajorPerformanceCaveat: a machine with only software rendering gets no context, so it keeps the static hero.
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <World dark={dark} host={host} layouts={layouts} onReady={onReady} />
    </Canvas>
  );
}
