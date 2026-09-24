// The hand-off between the Projects "Flight" view (DOM) and the 3D stations + camera follower (lazy-loaded).
//
// Like events.ts, this file imports nothing from three.js or R3F, so the DOM side (part of the home page's chunks) can
// use it without pulling the 3D stack in. It holds plain mutable state, not React state: the follower reads it every
// frame, and a scroll must never cause a re-render.

import type { ProjectStatus } from "@/lib/types";
import { WAKE_EVENT } from "./events";

export interface StationInfo {
  id: string;
  /** Short mono label for the HUD, for example "release-dashboard". */
  label: string;
  status?: ProjectStatus;
  /** The project's stack as layers, top (what users see) to bottom (where it runs): each becomes one slab of the rack, with a label. */
  layers: { label: string; items: string[] }[];
  /** The project's own 3D schematic (a key of lib/projects/exhibits.ts). Without one the generic stack rack is drawn. */
  exhibit?: string;
}

interface StationsState {
  /** The tall DOM track the visitor scrolls through, or null when the Flight view is not on the page. */
  track: HTMLElement | null;
  stations: StationInfo[];
  /** Bumped whenever `stations` changes, so the 3D side knows to rebuild its instances. */
  version: number;
  /** How much of the flight camera is blended over the rig (0 to 1). Written by the follower, read by the zones that make room for it. */
  weight: number;
}

export const stationsState: StationsState = { track: null, stations: [], version: 0, weight: 0 };

const listeners = new Set<() => void>();
/** Calls `fn` whenever the list of stations changes (the 3D side re-renders which exhibits it shows). Returns the unsubscribe. */
export function subscribeStations(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const wake = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(WAKE_EVENT));
};

/** Called by the Flight view when it mounts, and again whenever the list of shown projects changes. */
export function registerFlight(track: HTMLElement, stations: StationInfo[]) {
  stationsState.track = track;
  const same = stationsState.stations.length === stations.length && stationsState.stations.every((s, i) => s.id === stations[i].id && s.status === stations[i].status && s.label === stations[i].label && s.exhibit === stations[i].exhibit && JSON.stringify(s.layers) === JSON.stringify(stations[i].layers));
  if (!same) {
    stationsState.stations = stations;
    stationsState.version++;
    listeners.forEach((fn) => fn());
  }
  wake();
}

/** Called when the Flight view unmounts. Only clears its own registration (a newer one may already have replaced it). */
export function unregisterFlight(track: HTMLElement) {
  if (stationsState.track !== track) return;
  stationsState.track = null;
  wake(); // the follower needs a few more frames to fade the flight out
}
