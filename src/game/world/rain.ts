// GPU rain: falling streaks around the camera plus ripple splashes on the ground.
import * as THREE from "three";

export function createRain(count: number) {
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(count * 6);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random()];
    seeds.set(s, i * 6);
    seeds.set(s, i * 6 + 3);
    ends[i * 2] = 0;
    ends[i * 2 + 1] = 1;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
  geo.setAttribute("aEnd", new THREE.BufferAttribute(ends, 1));

  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: 1 },
    uCenter: { value: new THREE.Vector3() },
    uBox: { value: new THREE.Vector3(44, 26, 44) },
    uWind: { value: new THREE.Vector2(0.18, 0.06) },
    uSpeed: { value: 17 },
    uLen: { value: 0.6 },
    uColor: { value: new THREE.Color("#b8c6d8") },
    uBright: { value: 0.35 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uIntensity, uSpeed, uLen;
      uniform vec3 uCenter, uBox;
      uniform vec2 uWind;
      attribute vec3 aSeed;
      attribute float aEnd;
      varying float vAlpha;
      void main() {
        float speed = uSpeed * (0.8 + 0.4 * aSeed.z);
        float y = mod(aSeed.y * uBox.y - uTime * speed, uBox.y);
        vec3 half_ = uBox * 0.5;
        vec2 base = vec2(aSeed.x, fract(aSeed.x * 7.13 + aSeed.y * 3.7)) * uBox.xz;
        vec2 lo = uCenter.xz - half_.xz;
        vec2 xz = mod(base - lo, uBox.xz) + lo;
        vec3 p = vec3(xz.x, uCenter.y - half_.y * 0.4 + y, xz.y);
        p.xz += uWind * y;
        p += normalize(vec3(uWind.x, -1.0, uWind.y)) * uLen * aEnd;
        float on = step(aSeed.z, uIntensity) * step(0.0, p.y);
        vAlpha = (1.0 - aEnd * 0.85) * on;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vAlpha *= smoothstep(0.3, 2.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uBright;
      varying float vAlpha;
      void main() {
        if (vAlpha < 0.01) discard;
        gl_FragColor = vec4(uColor, vAlpha * uBright);
      }`,
  });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  lines.renderOrder = 5;

  // Ripple splashes
  const N = 420;
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const inst = new THREE.InstancedBufferGeometry();
  inst.index = plane.index;
  inst.setAttribute("position", plane.attributes.position);
  inst.setAttribute("uv", plane.attributes.uv);
  const aSeed = new Float32Array(N * 2);
  for (let i = 0; i < N * 2; i++) aSeed[i] = Math.random();
  inst.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aSeed, 2));
  inst.instanceCount = N;
  const splashUniforms = { uTime: uniforms.uTime, uIntensity: uniforms.uIntensity, uCenter: uniforms.uCenter, uBright: { value: 0.5 } };
  const splashMat = new THREE.ShaderMaterial({
    uniforms: splashUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uIntensity;
      uniform vec3 uCenter;
      attribute vec2 aSeed;
      varying vec2 vUv;
      varying float vPhase, vOn;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float t = uTime * (1.4 + aSeed.x * 1.2) + aSeed.y * 10.0;
        float cycle = floor(t);
        vPhase = fract(t);
        vec2 r = vec2(hash(vec2(cycle, aSeed.x * 91.0)), hash(vec2(aSeed.y * 37.0, cycle + 3.0)));
        vec2 xz = uCenter.xz + (r - 0.5) * 30.0;
        float gy = abs(xz.y) > 6.0 ? 0.156 : 0.014;
        float size = 0.08 + vPhase * 0.3;
        vOn = step(aSeed.x, uIntensity) * step(abs(xz.y), 9.9);
        vUv = uv;
        vec3 p = vec3(xz.x + position.x * size, gy, xz.y + position.z * size);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uBright;
      varying vec2 vUv;
      varying float vPhase, vOn;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float ring = smoothstep(0.7, 0.88, d) * (1.0 - smoothstep(0.9, 1.0, d));
        float a = ring * (1.0 - vPhase) * vOn * uBright;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a);
      }`,
  });
  const splashes = new THREE.Mesh(inst, splashMat);
  splashes.frustumCulled = false;
  splashes.renderOrder = 4;

  const group = new THREE.Group();
  group.add(lines, splashes);

  return {
    group,
    update(time: number, center: THREE.Vector3, intensity: number, night: number) {
      uniforms.uTime.value = time;
      uniforms.uCenter.value.copy(center);
      uniforms.uIntensity.value = intensity;
      uniforms.uBright.value = THREE.MathUtils.lerp(0.32, 0.5, night);
      splashUniforms.uBright.value = THREE.MathUtils.lerp(0.25, 0.55, night);
      group.visible = intensity > 0.01;
    },
  };
}
