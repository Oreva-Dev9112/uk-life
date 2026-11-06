// Keeps your character visible under trees and awnings from the overhead camera: those materials get a
// soft-edged hole around the player, but only where they're nearer the camera than the player is.
import * as THREE from "three";

export const seeThroughUniforms = {
  uCutCenter: { value: new THREE.Vector2() }, // the player on screen, in drawing-buffer pixels
  uCutRadius: { value: 0 }, // pixels; 0 turns it off
  uCutDepth: { value: 0 }, // the player's distance from the camera; only nearer surfaces are cut
};

export function seeThrough<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, seeThroughUniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `uniform vec2 uCutCenter;
uniform float uCutRadius;
uniform float uCutDepth;
void main() {
  float cutD = distance(gl_FragCoord.xy, uCutCenter);
  if (cutD < uCutRadius && vViewPosition.z < uCutDepth) {
    // dithered towards the rim, so the hole has a soft edge
    float keep = smoothstep(uCutRadius * 0.55, uCutRadius, cutD);
    float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (noise > keep) discard;
  }`,
    );
  };
  return m;
}
