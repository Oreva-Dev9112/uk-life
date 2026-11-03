// Bake several transformed primitives into ONE geometry with per-vertex colour (fewer draw calls).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type Vec3 = [number, number, number];
export interface Part { geo: THREE.BufferGeometry; color: THREE.ColorRepresentation; pos?: Vec3; rot?: Vec3; scale?: Vec3 }

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function bake(parts: Part[]) {
  const gs = parts.map((part) => {
    const g = part.geo.index ? part.geo.toNonIndexed() : part.geo.clone();
    _e.set(...(part.rot ?? [0, 0, 0]));
    _q.setFromEuler(_e);
    _p.set(...(part.pos ?? [0, 0, 0]));
    _s.set(...(part.scale ?? [1, 1, 1]));
    g.applyMatrix4(_m.compose(_p, _q, _s));
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    _c.set(part.color);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  });
  const merged = mergeGeometries(gs, false)!;
  gs.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}
