import type { MeshStandardMaterial } from "three";

/**
 * Makes a standard material fade by screen-door dither instead of alpha: below the uniform's value a fragment is kept, above it
 * it is discarded by noise. The material stays opaque and depth-tested (so overlapping parts of one model never show through each
 * other mid-fade, and nothing needs sorting), the same technique the city's buildings use (see makeCityMaterial). The uniform object
 * is shared by every material that is given it, so one write fades the whole model.
 */
export function ditherFade<M extends MeshStandardMaterial>(material: M, uFade: { value: number }): M {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDitherFade = uFade;
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform float uDitherFade;
      void main() {
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        if (ign > uDitherFade) discard;`,
    );
  };
  material.customProgramCacheKey = () => "dither-fade";
  return material;
}
