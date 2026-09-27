"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Fog } from "three";
import { makeCurves } from "@/lib/world/rig-path";
import { WORLD_FOV, type SectionExtent } from "@/lib/world/tunnel-math";
import { makeGovernor, stepGovernor, type Governor } from "@/lib/world/quality";
import { getScrollY } from "@/lib/scroll-state";
import type { ZoneLayout } from "@/lib/world/rig-math";
import { ZONES } from "@/lib/world/zones";
import { PALETTE } from "./scene/palette";
import { RigDriver, type RigShared } from "./scene/RigDriver";
import { ProjectPods } from "./scene/pods/ProjectPods";
import { ProjectStations } from "./scene/ProjectStations";
import { TunnelCamera } from "./scene/TunnelCamera";
import { SpeedStreaks } from "./scene/SpeedStreaks";
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

/**
 * Lets weak GPUs degrade instead of stutter: while the page is scrolling (frames are being drawn continuously) the resolution
 * governor watches how long frames take, steps the canvas's pixel ratio down when they are slow, and gives it back after a long calm
 * stretch (lib/world/quality.ts). Idle frames, which are rare by design, are never counted.
 */
function useAdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr);
  const initial = useThree((s) => s.viewport.dpr);
  const gov = useRef<Governor | null>(null);
  const lastY = useRef(0);
  useFrame((_, dt) => {
    if (!gov.current) gov.current = makeGovernor(initial);
    const y = getScrollY();
    const moving = Math.abs(y - lastY.current) > 0.5;
    lastY.current = y;
    if (!moving || dt > 0.25) return;
    const next = stepGovernor(gov.current, dt * 1000);
    if (next !== undefined) setDpr(next);
  });
}

/** Everything inside the canvas: theme, fog, scheduler, rig, and the zone content. */
function World({ dark, host, layouts, sections, onReady }: Pick<WorldSceneProps, "dark" | "host" | "layouts" | "sections" | "onReady">) {
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
      {/* The tunnel run gives each section its own camera shot on top of the rig's pose. It must run right after the rig (which
          re-poses the camera from scratch every frame) and before the flight, which blends over whatever this leaves. */}
      <TunnelCamera sections={sections} shared={shared} host={host} />
      {/* Must stay right after RigDriver and TunnelCamera and before the pods: it blends the flight camera over theirs, so it has to run
          after they have posed the camera and before anything that reads it (the pods call cam.updateMatrixWorld). */}
      <ProjectStations palette={palette} dark={dark} shared={shared} />
      <ambientLight intensity={dark ? 0.5 : 0.9} />
      <directionalLight position={[4, 5, 6]} intensity={dark ? 2.2 : 1.6} />
      <RouteLine curves={curves} palette={palette} shared={shared} />
      <RouteDust curves={curves} palette={palette} count={550} shared={shared} />
      <RouteFlow curves={curves} palette={palette} shared={shared} />
      <SpeedStreaks curves={curves} palette={palette} shared={shared} />
      <GroundPlane palette={palette} shared={shared} />
      <RequestOriginZone palette={palette} curves={curves} shared={shared} />
      <FoundationZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <CityZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <DeploymentsZone palette={palette} dark={dark} curves={curves} shared={shared} />
      <StackZone palette={palette} curves={curves} shared={shared} sections={sections} />
      <ProjectPods dark={dark} shared={shared} />
      <SignalOutZone palette={palette} shared={shared} />
    </>
  );
}

export interface WorldSceneProps {
  dark: boolean;
  host: RefObject<HTMLElement | null>;
  layouts: RefObject<ZoneLayout[]>;
  /** Where each section sits on the page, for the tunnel camera's per-section shots. */
  sections: RefObject<SectionExtent[]>;
  onReady: () => void;
  onLost: () => void;
}

export default function WorldScene({ dark, host, layouts, sections, onReady, onLost }: WorldSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.25]}
      camera={{ fov: WORLD_FOV, near: 0.1, far: 80, position: ZONES[0].camera.position }}
      // failIfMajorPerformanceCaveat: a machine with only software rendering gets no context, so it keeps the static hero.
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", failIfMajorPerformanceCaveat: true }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      <World dark={dark} host={host} layouts={layouts} sections={sections} onReady={onReady} />
    </Canvas>
  );
}
