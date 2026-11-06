// The player: movement relative to the camera, collision against the street, tap-to-walk.
import * as THREE from "three";
import type { Look } from "./Character";
import { Person } from "./Person";
import { dampAngle } from "./crowd";
import { FACADE, PLAY_X, groundY, type AABB } from "../world/layout";
import { input, moveAxes } from "../systems/input";

const RADIUS = 0.3;

export class Player {
  char: Person;
  pos = new THREE.Vector3();
  facing = 0;
  speed = 0;

  constructor(look: Look) {
    this.char = new Person({ ...look, umbrella: "#c8102e" });
  }

  setLook(look: Look, scene: THREE.Object3D) {
    this.char.dispose();
    this.char = new Person({ ...look, umbrella: "#c8102e" });
    scene.add(this.char.root);
  }

  teleport(x: number, z: number) {
    this.pos.set(x, groundY(z), z);
    input.clickTarget = null;
  }

  update(dt: number, camYaw: number, colliders: AABB[], blockers: THREE.Vector3[], tired: boolean, rain: boolean, enabled: boolean) {
    let mx = 0, mz = 0, run = false;
    if (enabled) {
      const a = moveAxes();
      if (a.active) {
        input.clickTarget = null;
        const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
        const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
        mx = fx * a.f + rx * a.r;
        mz = fz * a.f + rz * a.r;
        run = a.run;
      } else if (input.clickTarget) {
        const dx = input.clickTarget.x - this.pos.x, dz = input.clickTarget.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) input.clickTarget = null;
        else { mx = dx / d; mz = dz / d; run = d > 12; }
      }
    } else {
      input.clickTarget = null;
    }
    const len = Math.hypot(mx, mz);
    const maxSpeed = (run ? 5.4 : 2.7) * (tired ? 0.72 : 1);
    const targetSpeed = len > 0.01 ? maxSpeed * Math.min(1, len) : 0;
    this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 10, dt);
    if (len > 0.01) {
      this.facing = dampAngle(this.facing, Math.atan2(mx, mz), 12, dt);
      const step = this.speed * dt;
      this.pos.x += (mx / len) * step;
      this.pos.z += (mz / len) * step;
    }

    // collisions
    for (let iter = 0; iter < 2; iter++) {
      for (const b of colliders) {
        const cx = THREE.MathUtils.clamp(this.pos.x, b.minX, b.maxX);
        const cz = THREE.MathUtils.clamp(this.pos.z, b.minZ, b.maxZ);
        const dx = this.pos.x - cx, dz = this.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RADIUS * RADIUS) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            this.pos.x = cx + (dx / d) * RADIUS;
            this.pos.z = cz + (dz / d) * RADIUS;
          } else {
            // inside the box: push out the shortest way
            const pushes = [b.minX - RADIUS - this.pos.x, b.maxX + RADIUS - this.pos.x, b.minZ - RADIUS - this.pos.z, b.maxZ + RADIUS - this.pos.z];
            const i = pushes.reduce((best, v, k) => (Math.abs(v) < Math.abs(pushes[best]) ? k : best), 0);
            if (i < 2) this.pos.x += pushes[i]; else this.pos.z += pushes[i];
          }
        }
      }
      for (const n of blockers) {
        const dx = this.pos.x - n.x, dz = this.pos.z - n.z;
        const d = Math.hypot(dx, dz);
        const min = RADIUS + 0.3;
        if (d < min && d > 1e-4) { this.pos.x = n.x + (dx / d) * min; this.pos.z = n.z + (dz / d) * min; }
      }
    }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -PLAY_X, PLAY_X);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -FACADE + RADIUS, FACADE - RADIUS);
    this.pos.y = THREE.MathUtils.damp(this.pos.y, groundY(this.pos.z), 18, dt);

    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.facing;
    this.char.update(dt, this.speed, rain);
  }
}
