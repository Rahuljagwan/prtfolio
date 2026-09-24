"use client";

import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { type Group, type PerspectiveCamera, Vector3 } from "three";
import { ZONES } from "@/lib/world/zones";
import type { RigShared } from "../RigDriver";

/** Where the pod sits along the camera ray, in world units. Far enough to stay clear of the camera's lateral sway. */
const DISTANCE = 9;
/** Fraction of the stage height the pod's unit (local half-height 1) fills. Leaves a margin inside the window. */
const FIT = 0.86;

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Per-pod animation state, written every frame by usePodStage and read by the pod's own animation. */
export interface PodCtl {
  visible: boolean;
  /** Stage width / height, so the pod can lay itself out to fit the window. */
  aspect: number;
  /** 0 to 1, eased entrance. Replays each time the card scrolls back into view. */
  intro: number;
  /** 0 to 1, eased hover / focus state of this card. */
  hover: number;
  /** 1 normally; eases toward ~0.5 while a different card is hovered. */
  dim: number;
  /** Seconds since mount, for idle sway. */
  time: number;
}

export interface PodShared {
  /** The project card currently hovered or focused, if any. */
  hoverCard: MutableRefObject<Element | null>;
  /** Pointer in normalised device coordinates, -1 to 1. */
  pointer: MutableRefObject<{ x: number; y: number }>;
}

const DEPLOY_U = ZONES.findIndex((z) => z.id === "deployments");

/** The stage window for a project, found by its key (not by DOM order, which changes with filters and views). */
export const findStage = (stageKey: string) =>
  document.querySelector<HTMLElement>(`[data-pod-stage][data-stage-key="${CSS.escape(stageKey)}"]`);

/**
 * Anchors a pod to its project card. The card's cover strip (data-pod-stage) is a window in the HTML; each frame we
 * read its rectangle and place the pod on the camera ray through the window's centre, sized to fill it, facing the
 * camera. Result: the pod sits inside the window whatever the scroll, tilt or camera sway, and the card body (opaque HTML
 * above the canvas) clips it naturally. Returns the group to attach the pod to, and its live control values.
 *
 * `minAspect`: the narrowest window (width / height) a pod's layout can spread across. In a narrower window (a featured
 * card's tall cover) the pod is laid out at that aspect and scaled down to fit the width, so it letterboxes vertically
 * instead of spilling past the window's sides, where nothing opaque would clip it. 0 = lay out for whatever the window is.
 */
export function usePodStage(stageKey: string, shared: MutableRefObject<RigShared>, pod: PodShared, minAspect = 0) {
  const group = useRef<Group>(null);
  const ctl = useRef<PodCtl>({ visible: false, aspect: 2.6, intro: 0, hover: 0, dim: 1, time: 0 });
  const stage = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
  const wasVisible = useRef(false);
  const introStart = useRef(0);
  const ray = useRef(new Vector3());

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const c = ctl.current;
    const dt = Math.min(delta, 0.05);
    c.time += dt;

    // While warming up, draw the pod once at zero opacity so its shaders compile ahead of time.
    if (shared.current.warm || shared.current.podWarm) {
      g.visible = true;
      c.visible = true;
      c.intro = 0;
      return;
    }

    const u = shared.current.u;
    if (u < DEPLOY_U - 0.9 || u > DEPLOY_U + 0.9) {
      g.visible = false;
      c.visible = false;
      wasVisible.current = false;
      return;
    }

    // Re-resolve when the window was removed (a filter or view change remounts the card) and every ~30 frames as a backstop.
    if (!stage.current || !stage.current.isConnected || frame.current++ % 30 === 0) {
      stage.current = findStage(stageKey);
    }
    const el = stage.current;
    if (!el) {
      g.visible = false;
      return;
    }

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const onScreen = r.width > 0 && r.bottom > 0 && r.top < vh;
    g.visible = onScreen;
    c.visible = onScreen;
    if (!onScreen) {
      wasVisible.current = false;
      return;
    }

    // Entrance starts when the window is about to be well inside the viewport, and replays on every re-entry.
    if (!wasVisible.current && r.top < vh * 0.9) {
      wasVisible.current = true;
      introStart.current = c.time;
    }
    c.intro = wasVisible.current ? easeOutCubic(clamp01((c.time - introStart.current) / 1.2)) : 0;
    const aspect = r.width / Math.max(1, r.height);
    c.aspect = Math.max(aspect, minAspect);
    const fit = minAspect > 0 ? Math.min(1, aspect / minAspect) : 1;

    // Hover / focus: this card eases to 1, the others dim.
    const hovered = pod.hoverCard.current;
    const mine = hovered !== null && hovered === el.closest("[data-project-card]");
    const k = 1 - Math.exp(-dt * 9);
    c.hover += ((mine ? 1 : 0) - c.hover) * k;
    c.dim += ((hovered && !mine ? 0.5 : 1) - c.dim) * k;

    // Window centre -> point on the camera ray -> pod placement.
    const cam = state.camera as PerspectiveCamera;
    cam.updateMatrixWorld(); // the renderer updates it later this frame; we need this frame's pose now
    const ndcX = ((r.left + r.width / 2) / vw) * 2 - 1;
    const ndcY = -(((r.top + r.height / 2) / vh) * 2 - 1);
    const p = ray.current.set(ndcX, ndcY, 0.5).unproject(cam).sub(cam.position).normalize().multiplyScalar(DISTANCE).add(cam.position);
    g.position.copy(p);
    g.quaternion.copy(cam.quaternion);
    const worldHeight = 2 * Math.tan((cam.fov * Math.PI) / 360) * DISTANCE;
    g.scale.setScalar(((r.height / vh) * worldHeight * 0.5) * FIT * fit * (1 + c.hover * 0.1));
  });

  return { group, ctl };
}
