// Collects static geometry per material and merges it into a handful of draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

interface Group {
  material: THREE.Material;
  geoms: THREE.BufferGeometry[];
  castShadow: boolean;
  receiveShadow: boolean;
  vertexColors: boolean;
}

const tmpColor = new THREE.Color();

// Box-projected UVs in world space, so textures keep real-world scale on any size of box.
export function worldUV(g: THREE.BufferGeometry, tile: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = -z * Math.sign(nor.getX(i) || 1); v = y; }
    else { u = x * Math.sign(nor.getZ(i) || 1); v = y; }
    uv[i * 2] = u / tile;
    uv[i * 2 + 1] = v / tile;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

export class Batcher {
  private groups = new Map<string, Group>();

  register(key: string, material: THREE.Material, opts: { cast?: boolean; receive?: boolean; vertexColors?: boolean } = {}) {
    this.groups.set(key, {
      material,
      geoms: [],
      castShadow: opts.cast ?? true,
      receiveShadow: opts.receive ?? true,
      vertexColors: opts.vertexColors ?? false,
    });
  }

  has(key: string) {
    return this.groups.has(key);
  }

  add(key: string, geometry: THREE.BufferGeometry, matrix?: THREE.Matrix4, opts: { tile?: number; color?: THREE.ColorRepresentation } = {}) {
    const group = this.groups.get(key);
    if (!group) throw new Error(`Batcher: unknown group ${key}`);
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (matrix) g.applyMatrix4(matrix);
    for (const name of Object.keys(g.attributes)) {
      if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
    }
    if (opts.tile) worldUV(g, opts.tile);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (group.vertexColors) {
      tmpColor.set(opts.color ?? "#ffffff");
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = tmpColor.r; col[i * 3 + 1] = tmpColor.g; col[i * 3 + 2] = tmpColor.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    }
    group.geoms.push(g);
  }

  build(parent: THREE.Object3D) {
    const meshes: THREE.Mesh[] = [];
    for (const [key, group] of this.groups) {
      if (!group.geoms.length) continue;
      const merged = mergeGeometries(group.geoms, false);
      if (!merged) { console.warn("merge failed", key); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, group.material);
      mesh.name = key;
      mesh.castShadow = group.castShadow;
      mesh.receiveShadow = group.receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
      for (const g of group.geoms) g.dispose();
      group.geoms = [];
    }
    return meshes;
  }
}

// Small helpers to build transformed primitives quickly.
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const s = new THREE.Vector3();
const p = new THREE.Vector3();

export function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  e.set(rx, ry, rz);
  q.setFromEuler(e);
  s.set(sx, sy, sz);
  p.set(x, y, z);
  return m4.clone().compose(p, q, s);
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const PLANE = new THREE.PlaneGeometry(1, 1);
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
export const CYL_LO = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
export const SPHERE = new THREE.SphereGeometry(0.5, 14, 10);
