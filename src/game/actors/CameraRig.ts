// Third-person orbit camera: drag to rotate, wheel/pinch to zoom, tap the ground to walk there.
import * as THREE from "three";
import { FACADE } from "../world/layout";
import { input } from "../systems/input";

export class CameraRig {
  yaw = 0.5;
  pitch = 0.38;
  dist = 8.5;
  target = new THREE.Vector3();
  mode: "follow" | "cinematic" | "creator" = "cinematic";
  // Character-creator stage: a spot on the north pavement outside the pub.
  creator = { focus: new THREE.Vector3(24, 0.15, 8.0) };
  onDrag?: (dx: number, dy: number) => void;
  private lookSmooth = new THREE.Vector3();
  private creatorInit = false;
  private desired = new THREE.Vector3();
  private look = new THREE.Vector3();
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number }>();
  private dragged = false;
  private pinchDist = 0;
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
  private t = 0;
  onTapGround?: (p: THREE.Vector3) => void;

  constructor(public camera: THREE.PerspectiveCamera, private el: HTMLElement) {
    el.addEventListener("pointerdown", this.down);
    el.addEventListener("pointermove", this.move);
    el.addEventListener("pointerup", this.up);
    el.addEventListener("pointercancel", this.up);
    el.addEventListener("wheel", this.wheel, { passive: false });
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  dispose() {
    this.el.removeEventListener("pointerdown", this.down);
    this.el.removeEventListener("pointermove", this.move);
    this.el.removeEventListener("pointerup", this.up);
    this.el.removeEventListener("pointercancel", this.up);
    this.el.removeEventListener("wheel", this.wheel);
  }

  private down = (e: PointerEvent) => {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    if (this.pointers.size === 1) this.dragged = false;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragged = true;
    }
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.dist = THREE.MathUtils.clamp(this.dist * (this.pinchDist / d), 3.5, 18);
      this.pinchDist = d;
      return;
    }
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) this.dragged = true;
    if (this.dragged && this.mode === "creator") this.onDrag?.(dx, dy);
    if (this.dragged && this.mode === "follow") {
      this.yaw -= dx * 0.006;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, 0.12, 1.25);
    }
  };

  private up = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (!p || this.dragged || this.mode !== "follow" || e.button === 2) return;
    const rect = this.el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.ground, hit) && Math.abs(hit.z) < FACADE - 0.3) {
      input.clickTarget = { x: hit.x, z: hit.z };
      this.onTapGround?.(hit);
    }
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.mode !== "follow") return;
    this.dist = THREE.MathUtils.clamp(this.dist * (1 + e.deltaY * 0.0012), 3.5, 18);
  };

  update(dt: number, focus: THREE.Vector3) {
    this.t += dt;
    if (this.mode === "creator") {
      // Camera on the pavement looking along it; the character is nudged to the side the form isn't on.
      const f = this.creator.focus;
      const portrait = this.camera.aspect < 0.9;
      const dist = portrait ? 4.8 : 3.4;
      this.desired.set(f.x - dist, portrait ? 1.15 : 1.25, f.z);
      this.camera.position.lerp(this.desired, 1 - Math.exp(-3 * dt));
      const aim = new THREE.Vector3(f.x, portrait ? -0.66 : 0.95, f.z + (portrait ? 0 : -1.15));
      if (!this.creatorInit) { this.lookSmooth.copy(this.look); this.creatorInit = true; }
      this.lookSmooth.lerp(aim, 1 - Math.exp(-4 * dt));
      this.camera.lookAt(this.lookSmooth);
      return;
    }
    this.creatorInit = false;
    if (this.mode === "cinematic") {
      const x = Math.sin(this.t * 0.025) * 50 - 10;
      this.desired.set(x, 3.6 + Math.sin(this.t * 0.07) * 0.8, -3.4);
      this.look.set(x + 16 * Math.cos(this.t * 0.025), 3.2, 4.5);
      this.camera.position.lerp(this.desired, 1 - Math.exp(-2 * dt));
      this.camera.lookAt(this.look);
      return;
    }
    this.target.lerp(new THREE.Vector3(focus.x, focus.y + 1.35, focus.z), 1 - Math.exp(-10 * dt));
    const off = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    ).multiplyScalar(this.dist);
    // keep the camera out of the buildings
    const limit = FACADE - 0.5;
    const cz = this.target.z + off.z;
    if (Math.abs(cz) > limit && Math.abs(off.z) > 1e-3) {
      const s = (Math.sign(cz) * limit - this.target.z) / off.z;
      off.multiplyScalar(THREE.MathUtils.clamp(s, 0.25, 1));
    }
    this.desired.copy(this.target).add(off);
    this.desired.y = Math.max(this.desired.y, 0.7);
    this.camera.position.lerp(this.desired, 1 - Math.exp(-12 * dt));
    this.camera.lookAt(this.target);
  }

  snapBehind(facing: number) {
    this.yaw = facing + Math.PI;
    this.mode = "follow";
  }
}
