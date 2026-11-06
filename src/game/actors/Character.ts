// Stylised low-poly person. Each limb is baked into ONE mesh with per-vertex colour, so a
// character is 7 draw calls instead of ~30. Procedural walk cycle and an umbrella.
import * as THREE from "three";
import { bake, type Part } from "../world/bake";
import type { Gender, HairStyle } from "../../state/content";

export interface Look {
  skin: string;
  hair: string;
  jacket: string;
  trousers: string;
  hairStyle: HairStyle;
  gender: Gender;
  shoes?: string;
  umbrella?: string;
  outfit?: string; // (used by Person; the shape-built Character ignores it)
}

const geo = {
  torso: new THREE.CapsuleGeometry(0.19, 0.36, 6, 12),
  hips: new THREE.CapsuleGeometry(0.15, 0.12, 4, 10).rotateZ(Math.PI / 2),
  leg: new THREE.CapsuleGeometry(0.085, 0.66, 4, 8).translate(0, -0.42, 0),
  arm: new THREE.CapsuleGeometry(0.062, 0.48, 4, 8).translate(0, -0.3, 0),
  hand: new THREE.SphereGeometry(0.055, 8, 6).translate(0, -0.6, 0),
  shoe: new THREE.BoxGeometry(0.13, 0.08, 0.27).translate(0, -0.84, 0.045),
  head: new THREE.SphereGeometry(0.13, 18, 14),
  neck: new THREE.CylinderGeometry(0.055, 0.06, 0.12, 8),
  eyeWhite: new THREE.SphereGeometry(0.02, 10, 8),
  pupil: new THREE.SphereGeometry(0.0105, 8, 6),
  brow: new THREE.BoxGeometry(0.05, 0.01, 0.012),
  nose: new THREE.SphereGeometry(0.014, 8, 6),
  mouth: new THREE.BoxGeometry(0.05, 0.008, 0.01),
  hairCap: new THREE.SphereGeometry(0.138, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
  hairLong: new THREE.CapsuleGeometry(0.11, 0.2, 4, 10),
  bun: new THREE.SphereGeometry(0.07, 10, 8),
  afro: new THREE.SphereGeometry(0.225, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), // top of the hair only, so the face stays clear
  afroBack: new THREE.SphereGeometry(0.175, 12, 10),
  capBrim: new THREE.CylinderGeometry(0.125, 0.125, 0.015, 16, 1, false, -Math.PI / 2, Math.PI),
  canopy: new THREE.ConeGeometry(0.62, 0.28, 10, 1, true),
  shaft: new THREE.CylinderGeometry(0.012, 0.012, 0.95, 6),
  collar: new THREE.TorusGeometry(0.11, 0.04, 6, 14).rotateX(Math.PI / 2),
};

// Body proportions per gender: height, shoulder width, torso/hip shape, arm thickness.
const BUILD: Record<Gender, { height: number; shoulder: number; torsoX: number; torsoZ: number; hipsX: number; hipsZ: number; arm: number; legX: number }> = {
  male: { height: 1.0, shoulder: 0.27, torsoX: 1.16, torsoZ: 0.78, hipsX: 0.98, hipsZ: 1.0, arm: 1.04, legX: 0.095 },
  female: { height: 0.935, shoulder: 0.2, torsoX: 0.8, torsoZ: 0.7, hipsX: 1.2, hipsZ: 1.1, arm: 0.8, legX: 0.104 },
  nonbinary: { height: 0.97, shoulder: 0.235, torsoX: 0.98, torsoZ: 0.74, hipsX: 1.12, hipsZ: 1.05, arm: 0.92, legX: 0.098 },
};

export const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 });
const umbrellaMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, side: THREE.DoubleSide });

/** Hair (or a cap) as parts for bake(), around a head of radius ~0.13 centred at the origin and facing +z. */
export function hairParts(L: Look): Part[] {
  const style = L.hairStyle, hair = L.hair;
  if (style === "bald") return [];
  if (style === "afro") return [{ geo: geo.afro, color: hair, pos: [0, 0.035, -0.04] }, { geo: geo.afroBack, color: hair, pos: [0, -0.01, -0.085] }];
  const capColor = L.jacket === "#111111" ? "#c8102e" : "#111111";
  const parts: Part[] = [{ geo: geo.hairCap, color: style === "cap" ? capColor : hair, pos: [0, 0.012, -0.008], rot: [-0.18, 0, 0] }];
  if (style === "long") parts.push({ geo: geo.hairLong, color: hair, pos: [0, -0.12, -0.07], scale: [1.15, 1, 0.6] });
  if (style === "bun") parts.push({ geo: geo.bun, color: hair, pos: [0, 0.12, -0.1] });
  if (style === "cap") parts.push({ geo: geo.capBrim, color: "#111111", pos: [0, 0.05, 0.095] }); // half-disc already faces +z (front)
  return parts;
}

/** An umbrella with its handle at the origin. */
export function makeUmbrella(color = "#1b1b1f") {
  const mesh = new THREE.Mesh(bake([
    { geo: geo.canopy, color, pos: [0, 0.48, 0] },
    { geo: geo.shaft, color: "#222222", pos: [0, 0.02, 0] },
  ]), umbrellaMat);
  mesh.castShadow = true;
  return mesh;
}

export class Character {
  root = new THREE.Group();
  private body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private umbrella = new THREE.Group();
  private phase = Math.random() * 10;
  private umbrellaT = 0;
  private idleT = Math.random() * 10;
  speed = 0;

  constructor(public look: Look, scale = 1) {
    this.build();
    this.root.scale.setScalar(scale * BUILD[look.gender].height);
  }

  private mk(parts: Part[], parent: THREE.Object3D, material: THREE.Material = charMat) {
    const mesh = new THREE.Mesh(bake(parts), material);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private build() {
    const L = this.look;
    const b = BUILD[L.gender];
    const shoes = L.shoes ?? "#141414";
    const hair = L.hair;

    this.root.add(this.body);
    // legs (each one mesh: trousers + shoe)
    for (const [g, x] of [[this.legL, -b.legX], [this.legR, b.legX]] as const) {
      g.position.set(x, 0.93, 0);
      this.mk([{ geo: geo.leg, color: L.trousers }, { geo: geo.shoe, color: shoes }], g);
      this.body.add(g);
    }
    // torso, hip-length jacket hem (so the pelvis reads as clothing), collar and neck: one mesh
    this.mk([
      { geo: geo.hips, color: L.jacket, pos: [0, 0.97, 0], scale: [b.hipsX, 1, b.hipsZ] },
      { geo: geo.torso, color: L.jacket, pos: [0, 1.27, 0], scale: [b.torsoX, 1, b.torsoZ] },
      { geo: geo.collar, color: L.jacket, pos: [0, 1.5, 0] },
      { geo: geo.neck, color: L.skin, pos: [0, 1.55, 0] },
    ], this.body);
    // arms (sleeve + hand)
    for (const [g, x] of [[this.armL, -b.shoulder], [this.armR, b.shoulder]] as const) {
      g.position.set(x, 1.47, 0);
      this.mk([{ geo: geo.arm, color: L.jacket, scale: [b.arm, 1, b.arm] }, { geo: geo.hand, color: L.skin }], g);
      this.body.add(g);
    }
    // head: skull, face and hair as one mesh
    this.head.position.set(0, 1.69, 0);
    this.body.add(this.head);
    const mouth = L.gender === "female" ? "#b3524f" : "#8a4b44";
    const parts: Part[] = [
      { geo: geo.head, color: L.skin, scale: [0.93, 1.06, 1] },
      { geo: geo.nose, color: L.skin, pos: [0, -0.03, 0.13] },
      { geo: geo.mouth, color: mouth, pos: [0, -0.062, 0.121] },
    ];
    for (const sx of [-1, 1]) {
      parts.push(
        { geo: geo.eyeWhite, color: "#f4f1ea", pos: [sx * 0.046, -0.004, 0.116], scale: [1, 1, 0.55] },
        { geo: geo.pupil, color: "#15110f", pos: [sx * 0.046, -0.004, 0.127] },
        { geo: geo.brow, color: hair, pos: [sx * 0.046, 0.034, 0.121], rot: [0, 0, -sx * 0.12] },
      );
    }
    parts.push(...hairParts(L));
    this.mk(parts, this.head);
    // umbrella, held in the right hand
    this.umbrella.add(makeUmbrella(L.umbrella));
    this.umbrella.position.set(0.13, 1.5, 0.34);
    this.umbrella.rotation.x = -0.18;
    this.umbrella.visible = false;
    this.body.add(this.umbrella);
  }

  update(dt: number, speed: number, rain: boolean) {
    this.speed = speed;
    const k = Math.min(1, speed / 1.6);
    const run = Math.max(0, Math.min(1, (speed - 3.5) / 2));
    this.phase += dt * (speed * 2.4 + 0.001);
    const s = Math.sin(this.phase);
    const swing = (0.55 + run * 0.35) * k;
    this.legL.rotation.x = s * swing;
    this.legR.rotation.x = -s * swing;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.035 * k;
    this.body.rotation.x = run * 0.12;
    this.body.rotation.y = Math.sin(this.phase) * 0.06 * k;

    this.umbrellaT = THREE.MathUtils.damp(this.umbrellaT, rain ? 1 : 0, 4, dt);
    const u = this.umbrellaT;
    this.umbrella.visible = u > 0.05;
    this.umbrella.scale.setScalar(Math.max(0.01, u));

    this.armL.rotation.x = -s * swing * 0.8;
    this.armL.rotation.z = -0.06;
    const armSwingR = s * swing * 0.8;
    this.armR.rotation.x = THREE.MathUtils.lerp(armSwingR, -0.75, u);
    this.armR.rotation.z = THREE.MathUtils.lerp(0.06, 0.25, u);

    // idle: breathing and the odd look around
    this.idleT += dt;
    const idle = 1 - k;
    this.head.rotation.y = Math.sin(this.idleT * 0.5) * 0.35 * idle * (Math.sin(this.idleT * 0.13) > 0.4 ? 1 : 0.2);
    this.body.scale.y = 1 + Math.sin(this.idleT * 1.8) * 0.006 * idle;
  }

  dispose() {
    // geometry is unique to this character (baked), so free it
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.root.removeFromParent();
  }
}
