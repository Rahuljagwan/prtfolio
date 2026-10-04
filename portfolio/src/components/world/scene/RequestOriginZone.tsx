"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BoxGeometry, Color, type InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import type * as THREE from "three";
import { REQUEST_TRAVEL_SECONDS, SEND_REQUEST_EVENT } from "@/lib/world/events";
import type { RigCurves } from "@/lib/world/rig-path";
import type { WorldPalette } from "./palette";
import type { RigShared } from "./RigDriver";

// Re-exported so existing imports of SEND_REQUEST_EVENT from this file keep working; the name is defined in
// lib/world/events.ts (no three.js/R3F imports there) so the eagerly-loaded RequestCounter button can dispatch it
// without pulling the whole 3D stack into the home page's first-load bundle. The canvas host is deliberately
// pointer-events-none (it sits behind every section, full-screen and fixed, and must never intercept real page
// clicks), so the origin node cannot use a normal Three.js raycasted onClick — nothing would ever reach it; a DOM
// button dispatches this event instead, the same cross-boundary pattern the world already uses for WAKE_EVENT.
export { SEND_REQUEST_EVENT };

const TRAIL = 10;
const TRAVEL_SECONDS = REQUEST_TRAVEL_SECONDS; // how long a sent request takes to cross the whole route
const LAUNCH = 0.05; // fraction of the trip spent leaving the node itself before joining the route curve
const RING_TICKS = 36;
const RING_RADIUS = 1.62; // just outside the wireframe shell (1.15 * 1.32 ≈ 1.52), so it reads as its own ring, not clipping into it
const RING_FLASH_SECONDS = 0.6;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

interface RequestOriginZoneProps {
  palette: WorldPalette;
  curves: RigCurves;
  shared: MutableRefObject<RigShared>;
}

/**
 * Zone 1, "The Request Begins": this is the browser. An origin node sits where the hero's decorative core used to be;
 * its only idle motion is a slow breathing scale on the core itself (see RouteRings for the same "the system is alive"
 * idea applied along the whole route). It carries no ambient ring or orbit — nothing here decorates; everything is a
 * status. The ring around it (see RING_TICKS below) is normally fully invisible and exists only as a request-progress
 * readout: amber ticks fill in as a sent request travels, and a bright green flash sweeps the ring and clears when it
 * arrives — the ring IS the request's progress, not a separate ornament.
 * The "Send a request" button beside the hero copy (see RequestCounter.tsx) fires SEND_REQUEST_EVENT; on it, one real
 * request leaves: a bright packet that travels the whole route curve — the same spine the camera itself rides, through
 * every zone that follows — and fades once it reaches the far end. That trip is the site's thesis made literal:
 * everything past this point is what happens to a request after it leaves this node. The trigger is a DOM button and
 * not a raycasted click on the node itself because the canvas host is pointer-events-none (see SEND_REQUEST_EVENT).
 * The packet and its trail sit at the scene root, not inside the node's own group (which tracks the hero headline and
 * would otherwise drag the packet sideways with it); only their per-frame position follows the curve.
 */
export function RequestOriginZone({ palette, curves, shared }: RequestOriginZoneProps) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const shell = useRef<THREE.Mesh>(null);
  const cloud = useRef<THREE.Points>(null);
  const pointer = useRef({ x: 0, y: 0 });
  // The node is placed on its first frame (it used to start at a fixed x and ease across), and the HUD labels are held back for
  // their first few frames, until drei's Html has projected them: both were visible as a circle that settled into place on load.
  const placed = useRef(false);
  const frames = useRef(0);
  // Below lg the lightweight orb is in the flow of the hero text (data-orb-anchor, see OriginOrb): the 3D node is placed over it, at the
  // same place and size, so there is no gap where it was and no jump when the 3D takes over. Measured once the page has settled, and
  // again whenever its shape may have changed. x is a viewport position, y a document position (the node belongs to the hero at the top).
  const anchor = useRef({ active: false, x: 0, y: 0, d: 0 });
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);

  // ---- request-progress ring: RING_TICKS small marks around the node, normally scaled to nothing (invisible).
  const ringMesh = useRef<InstancedMesh>(null);
  const ringMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const ringGeo = useMemo(() => new BoxGeometry(0.05, 0.16, 0.02), []);
  const ringFlash = useRef(-1); // -1 = not flashing; 0..1 = progress through the completion flash
  const ringAmber = useMemo(() => new Color(), []);
  const ringGreen = useMemo(() => new Color(), []);
  const ticks = useMemo(
    () =>
      Array.from({ length: RING_TICKS }, (_, k) => {
        const a = (k / RING_TICKS) * Math.PI * 2;
        return {
          pos: new Vector3(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0),
          rot: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), a),
        };
      }),
    [],
  );

  useEffect(() => {
    ringAmber.set(palette.accent);
    // Blended toward white rather than the raw "healthy" green: that green is the same hue as the core sphere itself,
    // so a flash in that exact colour barely registers against it. A brighter, whiter flash reads as a flash regardless
    // of what is behind it, the same reason the pipeline pod's own packets are a near-white tint of their route colour.
    ringGreen.set(palette.primary).lerp(new Color("#ffffff"), 0.55);
  }, [palette, ringAmber, ringGreen]);

  useEffect(() => () => {
    ringMat.dispose();
    ringGeo.dispose();
  }, [ringMat, ringGeo]);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = document.querySelector<HTMLElement>("[data-orb-anchor]");
      const r = el?.getBoundingClientRect();
      const a = anchor.current;
      if (!el || !r || r.width < 8) {
        a.active = false; // wide screens: the orb is beside the text and the node uses its own placement
        return;
      }
      a.active = true;
      a.x = r.left + r.width / 2;
      a.y = r.top + window.scrollY + r.height / 2;
      a.d = r.width;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("resize", schedule);
    window.addEventListener("load", schedule);
    void document.fonts?.ready.then(schedule);
    const timers = [300, 1200, 3000].map((ms) => window.setTimeout(schedule, ms));
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("load", schedule);
      timers.forEach(clearTimeout);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Idle traffic: a shell of small pings drifting near the node, standing in for background requests the visitor didn't send.
  const positions = useMemo(() => {
    const count = 220;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 3.0 + Math.random() * 2.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  // ---- the request the visitor sends: one packet + a short trail, travelling the full camera curve (t: 0 to 1).
  const travel = useRef({ active: false, t: 0 });
  // The node's own world position when send() was called: the packet's real starting point, so it visibly leaves FROM
  // the thing that was clicked, not from the camera curve's first control point (a different location in world space).
  const launchFrom = useRef(new Vector3());
  const packet = useRef<THREE.Group>(null);
  // ---- HUD micro-labels: "the world introduces itself." Two diegetic labels, hero only for this pass (the same
  // system extends to later zones next). Plain DOM (via drei's Html, which re-projects its 3D anchor every frame),
  // so this never enters the eagerly-loaded bundle -- it lives inside this already-lazy-loaded 3D chunk, same as
  // everything else here. Opacity is driven by refs in useFrame, not React state, so labelling never causes a
  // re-render.
  const originLabelRef = useRef<HTMLDivElement>(null);
  const pathLabelRef = useRef<HTMLDivElement>(null);
  const pathAnchor = useMemo(() => {
    const p = curves.position.getPoint(0.035); // a little ahead of the camera's own start (t=0), where the route line is actually visible in the hero frame
    p.y -= 1.3;
    return p;
  }, [curves]);
  const trailMesh = useRef<InstancedMesh>(null);
  const packetMat = useMemo(() => new MeshBasicMaterial({ color: "#eafff2", transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const haloMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const trailMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, fog: false }), []);
  const tmpM = useMemo(() => new Matrix4(), []);
  const tmpP = useMemo(() => new Vector3(), []);
  const tmpS = useMemo(() => new Vector3(), []);
  const tmpQ = useMemo(() => new Quaternion(), []);

  useEffect(() => {
    haloMat.color.set(palette.accent);
    trailMat.color.set(palette.route);
  }, [palette, haloMat, trailMat]);

  useEffect(
    () => () => {
      packetMat.dispose();
      haloMat.dispose();
      trailMat.dispose();
    },
    [packetMat, haloMat, trailMat],
  );

  const send = () => {
    if (travel.current.active) return; // one in flight at a time keeps the trip readable
    if (group.current) launchFrom.current.copy(group.current.position);
    travel.current = { active: true, t: 0 };
    invalidate();
  };

  useEffect(() => {
    window.addEventListener(SEND_REQUEST_EVENT, send);
    return () => window.removeEventListener(SEND_REQUEST_EVENT, send);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** World-space point for flight progress `tt` (0 = the node, 1 = the far end of the route), written into `out`. */
  const posAt = (tt: number, out: Vector3) => {
    if (tt < LAUNCH) {
      out.copy(curves.position.getPoint(0));
      out.y -= 1.3;
      out.lerp(launchFrom.current, 1 - smooth(tt / LAUNCH));
    } else {
      out.copy(curves.position.getPoint(Math.min(1, (tt - LAUNCH) / (1 - LAUNCH))));
      out.y -= 1.3; // the route line sits slightly below the camera path; the packet rides the line, not the camera itself
    }
    return out;
  };

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    frames.current += 1;
    const g = group.current;
    const a = anchor.current;
    if (g) {
      let targetX: number;
      let targetY = 0.1;
      let targetScale = 0.85;
      if (a.active) {
        // Over the in-flow orb: its centre on screen, mapped onto the plane the node lives on (8 units from the hero camera, which looks
        // straight at it), and its size matched (the hexagon is 92% of the orb's box; the node's shell is 2.58 units across at scale 0.85).
        const { width, height } = state.size;
        const halfH = Math.tan((camera.fov * Math.PI) / 360) * 8;
        targetX = (a.x / width * 2 - 1) * halfH * camera.aspect;
        targetY = (1 - (a.y / height) * 2) * halfH;
        targetScale = (0.85 * ((0.92 * a.d) / height) * 2 * halfH) / 2.58;
      } else {
        // Sit to the right of the headline: a fixed fraction of the visible half-width at the node's distance. The same placement
        // is written in CSS for the lightweight orb (.origin-orb-wide in globals.css), so the hand-over between the two is seamless:
        // keep the two in step.
        const halfWidth = Math.tan((camera.fov * Math.PI) / 360) * 8 * camera.aspect;
        targetX = Math.min(2.9, halfWidth * 0.52);
      }
      if (!placed.current) {
        g.position.x = targetX;
        g.position.y = targetY;
        g.scale.setScalar(targetScale);
        placed.current = true;
      } else {
        const k = Math.min(1, dt * 4);
        g.position.x += (targetX - g.position.x) * k;
        g.position.y += (targetY - g.position.y) * k;
        g.scale.setScalar(g.scale.x + (targetScale - g.scale.x) * k);
      }

      // Pointer parallax only matters while this zone is the one on screen.
      const weight = Math.max(0, 1 - shared.current.u * 2);
      g.rotation.y += (pointer.current.x * 0.4 * weight - g.rotation.y) * Math.min(1, dt * 3);
      g.rotation.x += (-pointer.current.y * 0.25 * weight - g.rotation.x) * Math.min(1, dt * 3);
    }

    // HUD labels: fade with the same "is this zone actually the one on screen" curve as the pointer parallax above,
    // so they're gone well before the camera reaches the Gate -- introducing the metaphor, not narrating the whole trip.
    // On a narrow screen the labels would run into the copy, and the orb sits where the hero text already says what it is: no labels.
    const labelOpacity = frames.current < 4 || a.active ? "0" : clamp01(1 - shared.current.u * 2.2).toFixed(3);
    if (originLabelRef.current) originLabelRef.current.style.opacity = labelOpacity;
    if (pathLabelRef.current) pathLabelRef.current.style.opacity = labelOpacity;
    if (core.current) {
      core.current.rotation.y += dt * 0.18;
      const pulse = 1 + Math.sin(performance.now() * 0.0022) * 0.035; // a slow breathing scale, not a spin: reads as alive, not decorative
      core.current.scale.setScalar(pulse);
    }
    if (shell.current) shell.current.rotation.y -= dt * 0.06;
    if (cloud.current) cloud.current.rotation.y += dt * 0.015;

    // The sent request, travelling the whole route curve in world space.
    const tr = travel.current;
    if (tr.active) {
      tr.t += dt / TRAVEL_SECONDS;
      if (tr.t >= 1) {
        tr.active = false;
        tr.t = 1;
        ringFlash.current = 0; // the packet has arrived: the ring flashes green and clears
        invalidate();
      }
    }

    // The progress ring itself: amber ticks fill in order while a request is in flight, all flash green together once
    // it arrives, then the whole ring clears. Fully invisible whenever neither is happening.
    if (ringFlash.current >= 0) {
      ringFlash.current += dt / RING_FLASH_SECONDS;
      if (ringFlash.current >= 1) ringFlash.current = -1;
      else invalidate();
    }
    const rm = ringMesh.current;
    if (rm) {
      const flashing = ringFlash.current >= 0;
      const filled = tr.active ? clamp01(tr.t) : 0;
      for (let k = 0; k < RING_TICKS; k++) {
        const on = flashing || k / RING_TICKS <= filled;
        const s = on ? 1 : 0.0001;
        tmpM.compose(ticks[k].pos, ticks[k].rot, tmpS.set(s, s, s));
        rm.setMatrixAt(k, tmpM);
      }
      rm.instanceMatrix.needsUpdate = true;
      ringMat.color.copy(flashing ? ringGreen : ringAmber);
      ringMat.opacity = flashing ? (1 - ringFlash.current) * 0.9 : tr.active ? 0.8 : 0;
    }
    const flying = tr.active || tr.t > 0;
    if (flying) {
      invalidate(); // demand-mode: keep asking for the next frame for as long as the packet is on its way, not just once
      const edge = Math.min(1, tr.t * 14) * Math.min(1, (1 - tr.t) * 6); // eases in, then fades over the last stretch
      if (packet.current) posAt(tr.t, packet.current.position);
      packetMat.opacity = edge;
      haloMat.opacity = edge * 0.45;
      const tm = trailMesh.current;
      if (tm) {
        for (let k = 0; k < TRAIL; k++) {
          const tt = Math.max(0, tr.t - (k + 1) * 0.012);
          posAt(tt, tmpP);
          const s = 0.09 * (1 - k / TRAIL) * edge;
          tmpM.compose(tmpP, tmpQ, tmpS.set(s, s, s));
          tm.setMatrixAt(k, tmpM);
        }
        tm.instanceMatrix.needsUpdate = true;
        trailMat.opacity = edge * 0.7;
      }
      if (!tr.active && edge <= 0.001) tr.t = 0; // fully faded: reset so `flying` goes false and this branch stops running
    } else {
      packetMat.opacity = 0;
      haloMat.opacity = 0;
      trailMat.opacity = 0;
    }
  });

  return (
    <>
      <group ref={group} position={[2.6, 0.1, 0]} scale={0.85}>
        <mesh ref={core}>
          <sphereGeometry args={[1.15, 32, 24]} />
          <meshStandardMaterial color={palette.primary} emissive={palette.primary} emissiveIntensity={0.55} metalness={0.2} roughness={0.4} />
        </mesh>
        <mesh ref={shell} scale={1.32}>
          <icosahedronGeometry args={[1.15, 1]} />
          <meshBasicMaterial color={palette.accent} wireframe transparent opacity={0.3} />
        </mesh>
        {/* Request-progress ring: RING_TICKS marks, each scaled to nothing until it is either "reached" by the current
            flight or part of the completion flash — see the useFrame block above. Flat, like RouteRings. */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          <instancedMesh ref={ringMesh} args={[ringGeo, ringMat, RING_TICKS]} frustumCulled={false} renderOrder={1500} />
        </group>

        <points ref={cloud}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" array={positions} count={positions.length / 3} itemSize={3} />
          </bufferGeometry>
          <pointsMaterial color={palette.accent} size={0.032} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
        </points>

        {/* HUD: names the sphere. A child of this group so it tracks the node's own animated x-position for free. */}
        <Html position={[0, 1.7, 0]} center wrapperClass="pointer-events-none" zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div ref={originLabelRef} className="hud-label" style={{ opacity: 0 }}>
            <span className="hud-label__line" aria-hidden />
            you &middot; the request starts here
          </div>
        </Html>
      </group>

      {/* HUD: names the route. Scene-root, not parented -- anchored to a fixed point just ahead of the camera's own
          start, where the route line is actually visible in the hero frame. */}
      <Html position={pathAnchor} center wrapperClass="pointer-events-none" zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
        <div ref={pathLabelRef} className="hud-label" style={{ opacity: 0 }}>
          <span className="hud-label__line" aria-hidden />
          the route &middot; scroll to follow it &#8595;
        </div>
      </Html>

      {/* The travelling request: world-space, not parented under the node above. */}
      <instancedMesh ref={trailMesh} args={[undefined, undefined, TRAIL]} frustumCulled={false} renderOrder={2000} material={trailMat}>
        <sphereGeometry args={[1, 10, 8]} />
      </instancedMesh>
      <group ref={packet}>
        <mesh renderOrder={2001} material={haloMat}>
          <sphereGeometry args={[0.16, 14, 10]} />
        </mesh>
        <mesh renderOrder={2002} material={packetMat}>
          <sphereGeometry args={[0.06, 14, 10]} />
        </mesh>
      </group>
    </>
  );
}
