// Look test: an isometric, storybook take on the street, switched on with ?look=iso (or ?look=pixel for a
// pixel-art finish). Without the switch nothing changes.
import * as THREE from "three";
import { BrightnessContrastEffect, Effect, EffectAttribute, EffectPass, HueSaturationEffect, PixelationEffect, type Pass } from "postprocessing";
import { OVERHEAD } from "./actors/CameraRig";

const LOOK = new URLSearchParams(location.search).get("look");
export const ISO = LOOK === "iso" || LOOK === "pixel";
export const ISO_FOV = 16;
export const ISO_FOG = 0.2; // (fog at this distance would wash everything out)

// A long lens from far away: hardly any perspective, so it reads as isometric. Turned 40° towards the shop
// fronts, and still above the road, so buildings never come between you and the camera.
if (ISO) Object.assign(OVERHEAD, { pitch: 0.8, dist: 52, swing: 0.7, minDist: 25, maxDist: 90 });

// Dark lines wherever the depth jumps or folds: the edges of buildings, people and props.
class OutlineEffect extends Effect {
  constructor() {
    super("OutlineEffect", /* glsl */ `
uniform vec3 lineColor;
float viewZ(const in vec2 uv) { return getViewZ(readDepth(uv)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float z = viewZ(uv);
  vec2 o = texelSize;
  // (second difference: zero across flat surfaces, large at edges and creases)
  float e = abs(viewZ(uv + vec2(o.x, 0.0)) + viewZ(uv - vec2(o.x, 0.0)) - 2.0 * z)
          + abs(viewZ(uv + vec2(0.0, o.y)) + viewZ(uv - vec2(0.0, o.y)) - 2.0 * z);
  float line = smoothstep(0.003, 0.012, e / max(-z, 1.0));
  outputColor = vec4(mix(inputColor.rgb, lineColor, line * 0.85), inputColor.a);
}`, { attributes: EffectAttribute.DEPTH, uniforms: new Map([["lineColor", new THREE.Uniform(new THREE.Color("#1b1d2e"))]]) });
  }
}

/** The extra passes for the look test, to add after the usual ones. */
export function lookPasses(camera: THREE.Camera): Pass[] {
  if (!ISO) return [];
  const passes: Pass[] = [new EffectPass(camera, new OutlineEffect(), new HueSaturationEffect({ saturation: 0.34 }), new BrightnessContrastEffect({ brightness: 0.06, contrast: 0.1 }))];
  if (LOOK === "pixel") passes.push(new EffectPass(camera, new PixelationEffect(3)));
  return passes;
}
