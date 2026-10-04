import { CatmullRomCurve3, Vector3 } from "three";
import type { ZoneDef } from "./zones";

export interface RigCurves {
  position: CatmullRomCurve3;
  target: CatmullRomCurve3;
}

/**
 * Two smooth curves through the zone poses: where the camera is, and where it looks.
 * With N points, getPoint(u / (N - 1)) lands EXACTLY on control point i when u = i, so zone poses are hit precisely.
 * "centripetal" avoids the loops and overshoot the default Catmull-Rom can produce with uneven spacing.
 */
export function makeCurves(zones: ZoneDef[]): RigCurves {
  const toV = (v: [number, number, number]) => new Vector3(...v);
  return {
    position: new CatmullRomCurve3(zones.map((z) => toV(z.camera.position)), false, "centripetal"),
    target: new CatmullRomCurve3(zones.map((z) => toV(z.camera.target)), false, "centripetal"),
  };
}

/** Writes the camera position and look-at target for path parameter u (0 to zones - 1) into the given vectors. */
export function sampleRig(u: number, count: number, curves: RigCurves, position: Vector3, target: Vector3) {
  const t = count > 1 ? Math.min(1, Math.max(0, u / (count - 1))) : 0;
  curves.position.getPoint(t, position);
  curves.target.getPoint(t, target);
}
