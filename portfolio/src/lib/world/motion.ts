// What the tunnel camera knows about how the page is moving, for other parts of the world that want to react to it (the
// speed streaks). Plain mutable state, no React and no three.js: the camera writes it once a frame, the readers run after it.

export interface MotionState {
  /** Smoothed scroll speed, -1 (fast up) to 1 (fast down). */
  speed: number;
  /** How much of the speed reaction applies at this point of the journey: 0 over the hero and under the project flight, 1 elsewhere. */
  fx: number;
}

export const motionState: MotionState = { speed: 0, fx: 0 };
