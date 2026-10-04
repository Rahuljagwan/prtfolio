// What the 3D world tells the sound engine. Plain mutable state, no React, no three.js and no Web Audio: the scene writes it once a frame it
// draws (RigDriver, Helicopter), the engine reads it on its own clock. Nothing here costs anything when sound is off.

export interface HeliAudio {
  /** The helicopter is in the scene and visible. */
  on: boolean;
  /** Rotor speed, 0 (parked) to 1 (full). */
  spool: number;
  /** Distance from the camera, world units. */
  dist: number;
  /** Where it is across the screen, -1 (left edge) to 1 (right edge). */
  pan: number;
  /** How far it has risen off the pad, 0 (skids down) to 1 (hovering or flying): the rotor bites harder as it lifts. */
  rise: number;
  /** Ground speed along the route, route units per second (absolute). */
  speed: number;
  /** performance.now() of the last frame that wrote this. */
  at: number;
}

export interface AudioScene {
  /** The camera's position along the route (0 to 5): the same u the rig uses. */
  u: number;
  /** performance.now() of the last frame the world drew (0 until it has drawn one: the static page never sets it). */
  frameAt: number;
  heli: HeliAudio;
}

export const audioScene: AudioScene = {
  u: 0,
  frameAt: 0,
  heli: { on: false, spool: 0, dist: 99, pan: 0, rise: 0, speed: 0, at: 0 },
};
