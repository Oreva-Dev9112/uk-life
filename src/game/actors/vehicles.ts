// Traffic: red double-deckers, black cabs and cars that drive on the left, stop at the
// zebra crossing and the bus stop, and brake for the player.
import * as THREE from "three";
import { BUS_STOP_X, LANE_Z, ZEBRA_X, type AABB } from "../world/layout";
import { radialTexture, signTexture } from "../world/textures";
import { bake, type Part } from "../world/bake";

export type VehicleKind = "bus" | "cab" | "car";

const box = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 16).rotateX(Math.PI / 2);
const mats = new Map<string, THREE.MeshStandardMaterial>();
const paintSet = new Set<THREE.Material>();
const paint = (c: string, rough = 0.28, metal = 0.45) => {
  const k = `${c}:${rough}:${metal}`;
  if (!mats.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); mats.set(k, m); paintSet.add(m); }
  return mats.get(k)!;
};
// All painted body parts are baked into one mesh that takes its colour from the vertices.
const vehiclePaint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.35 });
const glass = new THREE.MeshStandardMaterial({ color: "#0a0e14", roughness: 0.05, metalness: 0.4 });
const tyre = new THREE.MeshStandardMaterial({ color: "#151515", roughness: 0.85 });
paintSet.add(tyre);
export const headMat = new THREE.MeshStandardMaterial({ color: "#222", emissive: "#fff1d0", emissiveIntensity: 5 });
export const tailMat = new THREE.MeshStandardMaterial({ color: "#300", emissive: "#ff1a1a", emissiveIntensity: 3 });
const interiorMat = new THREE.MeshStandardMaterial({ color: "#1a140c", emissive: "#ffd7a0", emissiveIntensity: 1.4, roughness: 0.2 });
const taxiMat = new THREE.MeshStandardMaterial({ color: "#332200", emissive: "#ffb000", emissiveIntensity: 4 });
let beamTex: THREE.Texture | null = null;
const beamMat = () => {
  beamTex ??= radialTexture("255,240,210");
  return new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
};

export interface VehicleModel {
  group: THREE.Group;
  length: number;
  width: number;
  wheels: THREE.Mesh[];
  beam: THREE.Mesh;
  beamMat: THREE.MeshBasicMaterial;
}

// Local forward is +x.
export function makeVehicle(kind: VehicleKind, color: string): VehicleModel {
  const g = new THREE.Group();
  const wheels: THREE.Mesh[] = []; // wheels are baked into the body (a plain round tyre looks the same spinning)
  let length: number, width: number;
  // Collect pieces, then bake: painted parts -> one mesh; each special material (glass, lights...) -> one mesh.
  const pieces: Part[] = [];
  const byMat = new Map<THREE.Material, Part[]>();
  const part = (_g: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, geo: THREE.BufferGeometry = box) => {
    const p: Part = { geo, color: "#ffffff", pos: [x, y, z], scale: [sx, sy, sz] };
    if (paintSet.has(mat)) { p.color = (mat as THREE.MeshStandardMaterial).color; pieces.push(p); }
    else { const l = byMat.get(mat) ?? []; l.push(p); byMat.set(mat, l); }
  };
  if (kind === "bus") {
    length = 10.8; width = 2.5;
    const red = paint("#c8102e", 0.35, 0.2);
    part(g, red, 0, 1.3, 0, length, 2.0, width);
    part(g, red, 0, 3.3, 0, length, 2.0, width);
    part(g, red, 0, 4.35, 0, length - 0.2, 0.2, width - 0.15);
    part(g, interiorMat, -0.7, 1.75, 0, 8.6, 0.95, width + 0.02);
    part(g, interiorMat, 0, 3.45, 0, length - 0.8, 0.95, width + 0.02);
    part(g, glass, length / 2 + 0.005, 1.65, 0, 0.02, 1.2, width - 0.3);
    part(g, paint("#111", 0.6, 0), 0, 0.45, 0, length + 0.02, 0.32, width + 0.02);
    part(g, paint("#e5e5e5", 0.5, 0), 0, 2.38, 0, length + 0.02, 0.06, width + 0.02);
    const dest = signTexture({ text: "38  ALBION PARK", bg: "#0b0b0b", fg: "#ffcc33", w: 512, h: 96 });
    const dm = new THREE.MeshStandardMaterial({ color: "#000", emissive: "#ffffff", emissiveMap: dest, emissiveIntensity: 2 });
    const d = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.36), dm);
    d.position.set(length / 2 + 0.02, 2.85, 0);
    d.rotation.y = Math.PI / 2;
    g.add(d);
    for (const x of [3.4, -3.6]) for (const z of [1.1, -1.1]) part(g, tyre, x, 0.5, z, 0.5, 0.5, 0.3, wheelGeo);
    for (const z of [0.85, -0.85]) {
      part(g, headMat, length / 2 + 0.01, 0.75, z, 0.04, 0.2, 0.3);
      part(g, tailMat, -length / 2 - 0.01, 0.9, z * 1.2, 0.04, 0.35, 0.18);
    }
  } else {
    const cab = kind === "cab";
    length = cab ? 4.6 : 4.3; width = 1.85;
    const body = paint(color);
    part(g, body, 0, 0.6, 0, length, 0.72, width);
    part(g, glass, cab ? -0.1 : -0.25, cab ? 1.3 : 1.2, 0, cab ? 2.6 : 2.2, cab ? 0.75 : 0.6, width - 0.15);
    part(g, body, cab ? -0.1 : -0.25, cab ? 1.7 : 1.52, 0, cab ? 2.5 : 2.1, 0.07, width - 0.2);
    part(g, paint("#0d0d0d", 0.5, 0.2), length / 2 - 0.02, 0.45, 0, 0.1, 0.3, width - 0.1);
    if (cab) part(g, taxiMat, 0, 1.82, 0, 0.5, 0.16, 0.26);
    for (const x of [length / 2 - 0.85, -length / 2 + 0.85]) for (const z of [width / 2 - 0.05, -width / 2 + 0.05]) part(g, tyre, x, 0.34, z, 0.34, 0.34, 0.22, wheelGeo);
    for (const z of [0.62, -0.62]) {
      part(g, headMat, length / 2 + 0.005, 0.68, z, 0.04, 0.14, 0.32);
      part(g, tailMat, -length / 2 - 0.005, 0.72, z, 0.04, 0.16, 0.3);
    }
  }
  const bodyMesh = new THREE.Mesh(bake(pieces), vehiclePaint);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  g.add(bodyMesh);
  for (const [mat, list] of byMat) {
    const mm = new THREE.Mesh(bake(list), mat);
    mm.castShadow = mat === glass;
    g.add(mm);
  }
  const bm = beamMat();
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), bm);
  beam.position.set(length / 2 + 4.5, 0.03, 0);
  beam.scale.set(9, 1, kind === "bus" ? 4.2 : 3.4);
  beam.renderOrder = 3;
  g.add(beam);
  return { group: g, length, width, wheels, beam, beamMat: bm };
}

interface Vehicle {
  model: VehicleModel;
  kind: VehicleKind;
  dir: 1 | -1;
  x: number;
  z: number;
  speed: number;
  maxSpeed: number;
  stopTimer: number;
  served: boolean;
  blockedFor: number;
}

const CAR_COLORS = ["#d9d9d9", "#1f2937", "#7f1d1d", "#1e3a8a", "#6b7280", "#f3f4f6", "#14532d", "#3f3f46"];

export class Traffic {
  vehicles: Vehicle[] = [];
  group = new THREE.Group();
  onHonk?: (x: number, z: number) => void;

  constructor(mix: { buses: number; cabs: number; cars: number } = { buses: 2, cabs: 3, cars: 5 }) {
    const spawn = (kind: VehicleKind, dir: 1 | -1, x: number) => {
      const color = kind === "cab" ? "#0c0c0c" : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
      const model = makeVehicle(kind, color);
      this.group.add(model.group);
      this.vehicles.push({
        model, kind, dir, x, z: dir === 1 ? -LANE_Z - (kind === "bus" ? 0.25 : 0) : LANE_Z + (kind === "bus" ? 0.25 : 0),
        speed: 7, maxSpeed: kind === "bus" ? 8 : 8.5 + Math.random() * 1.5, stopTimer: 0, served: false, blockedFor: 0,
      });
    };
    // spread the district's buses, cabs and cars over both directions
    const kinds: VehicleKind[] = [];
    for (let i = 0; i < mix.buses; i++) kinds.push("bus");
    for (let i = 0; i < mix.cabs; i++) kinds.push("cab");
    for (let i = 0; i < mix.cars; i++) kinds.push("car");
    kinds.forEach((k, i) => spawn(k, i % 2 ? -1 : 1, -150 + ((i * 300) / kinds.length + (i % 2) * 37) % 300));
  }

  update(dt: number, player: { x: number; z: number }, night: number, viewX: number) {
    for (const v of this.vehicles) {
      const half = v.model.length / 2;
      const front = v.x + v.dir * half;
      let desired = v.maxSpeed;

      for (const o of this.vehicles) {
        if (o === v || o.dir !== v.dir) continue;
        const gap = (o.x - v.x) * v.dir - half - o.model.length / 2;
        if (gap > -1 && gap < 16) desired = Math.min(desired, Math.max(0, (gap - 3) * 0.8));
      }
      // player standing in our lane
      let blocked = false;
      if (Math.abs(player.z - v.z) < 1.9) {
        const d = (player.x - front) * v.dir;
        if (d > -0.5 && d < 14) { desired = Math.min(desired, Math.max(0, (d - 2.5) * 0.9)); blocked = d < 6; }
      }
      // zebra crossing: give way if the player is on or at the crossing
      if (Math.abs(player.x - ZEBRA_X) < 2.6 && Math.abs(player.z) < 7.6) {
        const stopX = ZEBRA_X - v.dir * 3.2;
        const d = (stopX - front) * v.dir;
        if (d > -0.5 && d < 25) desired = Math.min(desired, Math.max(0, d * 0.6));
      }
      // bus stop (eastbound buses only; the stop is on the south pavement)
      if (v.kind === "bus" && v.dir === 1 && !v.served) {
        const d = BUS_STOP_X + 3 - front;
        if (d > -0.5 && d < 35) desired = Math.min(desired, Math.max(0, d * 0.45));
        if (d < 0.6 && v.speed < 0.3) { v.stopTimer = 6; v.served = true; }
      }
      if (v.stopTimer > 0) { v.stopTimer -= dt; desired = 0; }

      const accel = desired > v.speed ? 2.2 : 7;
      v.speed += THREE.MathUtils.clamp(desired - v.speed, -accel * dt, accel * dt);
      v.x += v.dir * v.speed * dt;
      if (v.x > 160) { v.x = -160; v.served = false; }
      if (v.x < -160) { v.x = 160; v.served = false; }

      v.blockedFor = blocked && v.speed < 0.5 ? v.blockedFor + dt : 0;
      if (v.blockedFor > 1.6) { v.blockedFor = -3; this.onHonk?.(v.x, v.z); }

      v.model.group.visible = Math.abs(v.x - viewX) < 110;
      v.model.group.position.set(v.x, 0, v.z);
      v.model.group.rotation.y = v.dir === 1 ? 0 : Math.PI;
      for (const w of v.model.wheels) w.rotation.z -= (v.speed * dt) / w.scale.x;
      v.model.beamMat.opacity = 0.35 * night + 0.03;
    }
    tailMat.emissiveIntensity = 1.5 + night * 2.5;
    interiorMat.emissiveIntensity = 0.15 + night * 1.25;
    headMat.emissiveIntensity = 1 + night * 5;
  }

  colliders(): AABB[] {
    return this.vehicles.map((v) => ({
      minX: v.x - v.model.length / 2, maxX: v.x + v.model.length / 2,
      minZ: v.z - v.model.width / 2, maxZ: v.z + v.model.width / 2,
    }));
  }
}

// Parked cars along the kerb in the marked bays.
export function parkedCars(group: THREE.Group, colliders: AABB[]) {
  const spots: [number, number, 1 | -1][] = [
    [-59, 4.6, -1], [-52.5, 4.6, -1], [41, 4.6, -1], [47, 4.6, -1], [65.5, 4.6, -1], [72, 4.6, -1],
    [22.5, -4.6, 1], [27.5, -4.6, 1], [52.5, -4.6, 1], [58.3, -4.6, 1],
  ];
  for (const [x, z, dir] of spots) {
    const m = makeVehicle("car", CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]);
    m.group.position.set(x, 0, z);
    m.group.rotation.y = dir === 1 ? 0 : Math.PI;
    m.beam.visible = false;
    m.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.material === headMat) o.material = paint("#9a9a90", 0.2, 0.3);
      if (o.material === tailMat) o.material = paint("#5a0d0d", 0.3, 0.1);
    });
    group.add(m.group);
    colliders.push({ minX: x - m.length / 2, maxX: x + m.length / 2, minZ: z - m.width / 2, maxZ: z + m.width / 2 });
  }
}
