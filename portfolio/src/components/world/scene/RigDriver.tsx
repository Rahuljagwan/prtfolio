"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { computeRig, projectsWeave, type ZoneLayout } from "@/lib/world/rig-math";
import { sampleRig, type RigCurves } from "@/lib/world/rig-path";
import { ZONES } from "@/lib/world/zones";

/** Shared, mutable rig state that zones read each frame (no React state, so no re-renders while scrolling). */
export interface RigShared {
  u: number;
  zone: number;
  /** True for a moment after load: every zone is drawn once (invisibly) so shaders compile and buffers upload up front. */
  warm?: boolean;
  /** Same idea for the project pods only, which mount later. Draws just the pods (not every zone) so it stays cheap. */
  podWarm?: boolean;
}

interface RigDriverProps {
  curves: RigCurves;
  layouts: RefObject<ZoneLayout[]>;
  host: RefObject<HTMLElement | null>;
  shared: MutableRefObject<RigShared>;
  onReady: () => void;
}

// Higher = the camera sits closer to the scroll position. Lenis already eases the scroll itself, so this second smoothing
// layer only needs to soften jumps (anchors, keys). At 7 the camera trailed the page by about 140 ms during a scroll.
const DAMPING = 16;

/**
 * Moves the camera along the path from the page scroll position. Each frame:
 *   viewport centre -> (measured zone layouts) -> path parameter u -> curve sample -> camera pose.
 * u is eased toward its target so the camera glides even if scroll input is jumpy (anchor jumps, keyboard).
 * The first frame snaps to the target, so reloading part-way down the page starts at the right place, not at the top.
 */
export function RigDriver({ curves, layouts, host, shared, onReady }: RigDriverProps) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const position = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const started = useRef(false);
  const lastAttr = useRef("");

  useEffect(() => {
    invalidate(); // demand mode: draw the first frame
  }, [invalidate]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const centre = window.scrollY + window.innerHeight / 2;
    const { u: goal, local } = computeRig(centre, layouts.current ?? []);

    if (!started.current) {
      shared.current.u = goal;
    } else {
      shared.current.u += (goal - shared.current.u) * (1 - Math.exp(-dt * DAMPING));
    }
    const u = shared.current.u;
    shared.current.zone = Math.min(ZONES.length - 1, Math.max(0, Math.round(u)));

    sampleRig(u, ZONES.length, curves, position, target);
    // A small lateral drift while a zone is on screen, so a long section never feels frozen. Fades out during travel.
    const dwell = 1 - Math.min(1, Math.abs(u - Math.round(u)) * 4);
    position.x += local * 0.7 * dwell;

    // Projects: a slow S-shaped weave through the floating cards as the section scrolls. `local` (-0.5 to 0.5) is where the
    // viewport is within the section, so the sway is a pure function of scroll and stays perfectly in sync. The target
    // swings the other way (a parallax pivot), the camera lifts slightly mid-section and banks into the turn. It blends in
    // and out with the same dwell factor as the drift above, so travel between zones is untouched.
    let bank = 0;
    if (ZONES[shared.current.zone].id === "deployments") {
      const w = projectsWeave(local, dwell);
      position.x += w.sway;
      position.y += w.lift;
      target.x += w.targetX;
      bank = w.bank;
    }

    camera.position.copy(position);
    camera.lookAt(target);
    if (bank) camera.rotateZ(bank);

    // Observable state for tests and debugging; the DOM is only touched when the value actually changes.
    const attr = `${u.toFixed(3)}|${ZONES[shared.current.zone].id}`;
    if (attr !== lastAttr.current && host.current) {
      lastAttr.current = attr;
      host.current.dataset.u = u.toFixed(3);
      host.current.dataset.zone = ZONES[shared.current.zone].id;
    }

    if (!started.current) {
      started.current = true;
      onReady();
    }
  });

  return null;
}
