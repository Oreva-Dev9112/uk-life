// Street lighting: a small pool of real point lights that follow the player, plus cheap
// ground glow, wet-road reflection streaks and halos for every light source.
import * as THREE from "three";
import { groundY, type LightSource } from "./layout";
import { radialTexture, streakTexture } from "./textures";

function lightOn(l: LightSource, hour: number) {
  if (!l.hours) return true;
  const [o, c] = l.hours;
  if (o === c) return false;
  if (c > 24) return hour >= o || hour < c - 24;
  return hour >= o && hour < c;
}

export function createLighting(scene: THREE.Scene, sources: LightSource[], poolSize: number) {
  const pool: THREE.PointLight[] = [];
  for (let i = 0; i < poolSize; i++) {
    const l = new THREE.PointLight("#ffb36b", 0, 14, 2);
    scene.add(l);
    pool.push(l);
  }

  const radial = radialTexture();
  const streak = streakTexture();
  const n = sources.length;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  const poolMat = new THREE.MeshBasicMaterial({ map: radial, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), poolMat, n);
  const streakMat = new THREE.MeshBasicMaterial({ map: streak, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), streakMat, n);
  pools.renderOrder = streaks.renderOrder = 2;
  pools.frustumCulled = streaks.frustumCulled = false;

  const haloGeo = new THREE.BufferGeometry();
  const haloPos = new Float32Array(n * 3);
  const haloCol = new Float32Array(n * 3);
  const haloMat = new THREE.PointsMaterial({ map: radial, size: 3.2, sizeAttenuation: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true });
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.frustumCulled = false;

  sources.forEach((s, i) => {
    const gy = groundY(s.z) + 0.02;
    const r = s.pool ?? 4;
    dummy.position.set(s.x, gy, s.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(r * 2, 1, r * 2);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
    // streak runs from the light towards the middle of the road
    const len = s.kind === "lamp" ? 7 : 6;
    const dir = s.z > 0 ? -1 : 1;
    dummy.position.set(s.x, Math.max(gy, 0.03), s.z + dir * len * 0.5);
    dummy.rotation.set(0, s.z > 0 ? Math.PI : 0, 0);
    dummy.scale.set(s.kind === "lamp" ? 1.1 : 1.8, 1, len);
    dummy.updateMatrix();
    streaks.setMatrixAt(i, dummy.matrix);
    haloPos.set([s.x, s.y, s.z], i * 3);
  });

  const group = new THREE.Group();
  group.add(pools, streaks, halos);
  scene.add(group);

  let timer = 0;
  const order = sources.map((_, i) => i);
  const active = new Array(n).fill(true);

  return {
    group,
    dispose() {
      for (const l of pool) l.removeFromParent();
      group.removeFromParent();
      for (const m of [pools, streaks]) m.geometry.dispose();
      haloGeo.dispose();
      for (const mt of [poolMat, streakMat, haloMat]) mt.dispose();
      radial.dispose();
      streak.dispose();
    },
    update(dt: number, focus: THREE.Vector3, night: number, wet: number, rain: number, hour: number) {
      const lampOn = THREE.MathUtils.smoothstep(night, 0.25, 0.55);
      timer -= dt;
      if (timer <= 0) {
        timer = 0.25;
        for (let i = 0; i < n; i++) {
          const s = sources[i];
          active[i] = lightOn(s, hour) && (s.kind !== "lamp" || lampOn > 0.02);
          const k = active[i] ? s.intensity : 0;
          col.set(s.color).multiplyScalar(k);
          pools.setColorAt(i, col);
          streaks.setColorAt(i, col);
          col.set(s.color).multiplyScalar(active[i] ? (s.kind === "lamp" ? 1 : 0.55) : 0);
          haloCol.set([col.r, col.g, col.b], i * 3);
        }
        pools.instanceColor!.needsUpdate = true;
        streaks.instanceColor!.needsUpdate = true;
        haloGeo.attributes.color.needsUpdate = true;

        order.sort((a, b) => {
          const sa = sources[a], sb = sources[b];
          const da = (active[a] ? 0 : 1e6) + (sa.x - focus.x) ** 2 + (sa.z - focus.z) ** 2;
          const db = (active[b] ? 0 : 1e6) + (sb.x - focus.x) ** 2 + (sb.z - focus.z) ** 2;
          return da - db;
        });
        for (let i = 0; i < pool.length; i++) {
          const s = sources[order[i]];
          const l = pool[i];
          l.position.set(s.x, s.y, s.z);
          l.color.set(s.color);
          l.distance = s.range;
          l.userData.base = active[order[i]] ? s.intensity * (s.kind === "lamp" ? 26 : 14) : 0;
        }
      }
      for (const l of pool) l.intensity = (l.userData.base ?? 0) * Math.max(lampOn, 0.15 * night);
      poolMat.opacity = 0.55 * lampOn * (0.7 + wet * 0.4);
      streakMat.opacity = 0.55 * lampOn * wet;
      haloMat.opacity = lampOn * (0.35 + rain * 0.4);
      halos.visible = lampOn > 0.01;
    },
  };
}
