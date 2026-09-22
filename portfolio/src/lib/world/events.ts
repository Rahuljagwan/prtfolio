// Custom window events the 3D world (lazy-loaded, dynamic-imported, never in the home page's initial bundle) and
// ordinary eagerly-rendered DOM components (Hero, always in the initial bundle) use to talk to each other.
//
// This file must import NOTHING from "three" or "@react-three/fiber": it exists specifically so a component like
// RequestCounter (part of Hero, part of the page's first-load JS) can reference an event name without pulling the
// whole 3D stack in with it. Importing a constant from a module that also imports three.js at module scope still
// bundles three.js wherever that import lands, even if only the constant is used — this file has no such imports, so
// it stays a few bytes. The 3D-side files (RequestOriginZone, useRenderScheduler) re-export these for their own
// callers, so the event name is still defined in exactly one place.

/** Dispatch to make the world redraw on demand (for example after a theme change, or a DOM-triggered animation). */
export const WAKE_EVENT = "world:wake";

/** Dispatch to send one request packet travelling the whole route curve, from RequestOriginZone's origin node. */
export const SEND_REQUEST_EVENT = "world:send-request";

/** Dispatch to start the Stack zone's incident sequence (a node fails, reroutes, restarts). No-op if one is already running. */
export const INCIDENT_EVENT = "world:trigger-incident";

/**
 * Timing budget for the Incident sequence, shared so the DOM log (IncidentPanel) and the 3D visual (StackZone) stay
 * in lockstep without one depending on the other — each runs its own timer off the same INCIDENT_EVENT trigger and
 * the same constants below, rather than the DOM relaying on an event the 3D side dispatches. That relay design was
 * tried first and shipped a real dead button: on a device where the 3D world never mounts (canRun3D() false, the
 * static fallback), StackZone never exists to dispatch anything, so a DOM log that only listened for its relay never
 * advanced past "simulate an incident" — no error, just silently nothing, exactly the kind of dangling reference a
 * fallback audit exists to catch. Two independent timers reading the same numbers is the same "converge on one
 * source of truth" fix as useActiveSection vs. the rig: the truth here is the timing budget itself, not either side's
 * dispatch of it.
 */
export const INCIDENT_TIMING = {
  alert: 0.4, // ramps to red
  reroute: 1.9, // 1.5s hold at red, then reroute begins
  restart: 2.9, // 1s reroute, then restart (red -> amber -> green) begins
  nominal: 3.9, // 1s restart, reaching nominal
} as const;
