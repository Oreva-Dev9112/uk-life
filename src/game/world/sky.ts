// Sky dome, day/night keyframes and weather blending.
import * as THREE from "three";

interface Key {
  h: number;
  top: string; horizon: string; fog: string;
  sun: string; sunI: number;
  hemiSky: string; hemiGround: string; hemiI: number;
  night: number;
}

// Tuned for a London October day (sunrise ~07:12, sunset ~18:18); skyHourFor fits them to the real day.
const KEYS: Key[] = [
  { h: 0, top: "#050812", horizon: "#1c1a28", fog: "#0e0f17", sun: "#7d8fc0", sunI: 0.22, hemiSky: "#27304d", hemiGround: "#0c0b0d", hemiI: 0.35, night: 1 },
  { h: 5.2, top: "#070b18", horizon: "#22202e", fog: "#11121b", sun: "#7d8fc0", sunI: 0.2, hemiSky: "#27304d", hemiGround: "#0c0b0d", hemiI: 0.38, night: 1 },
  { h: 6.6, top: "#1d2a4f", horizon: "#86687a", fog: "#3d3a49", sun: "#ff9e7a", sunI: 0.35, hemiSky: "#4b5577", hemiGround: "#1d1716", hemiI: 0.55, night: 0.7 },
  { h: 7.6, top: "#6c86ad", horizon: "#f0b38d", fog: "#988d92", sun: "#ffcf9f", sunI: 1.5, hemiSky: "#a7b6cf", hemiGround: "#3a3330", hemiI: 0.95, night: 0.15 },
  { h: 10, top: "#7a9ac4", horizon: "#cdd6de", fog: "#a8b2bc", sun: "#fff3e2", sunI: 2.5, hemiSky: "#c4d2e4", hemiGround: "#4a4743", hemiI: 1.25, night: 0 },
  { h: 15, top: "#7896c0", horizon: "#d4d8dc", fog: "#aab2ba", sun: "#fff0dc", sunI: 2.2, hemiSky: "#c4d2e4", hemiGround: "#4a4743", hemiI: 1.2, night: 0 },
  { h: 17.2, top: "#5a6e98", horizon: "#f0a479", fog: "#8e8189", sun: "#ffb27a", sunI: 1.4, hemiSky: "#9aa6c2", hemiGround: "#3b322e", hemiI: 0.9, night: 0.15 },
  { h: 18.3, top: "#26315b", horizon: "#dd7658", fog: "#4b4057", sun: "#ff8a5c", sunI: 0.55, hemiSky: "#5a5f86", hemiGround: "#22191a", hemiI: 0.6, night: 0.55 },
  { h: 19.3, top: "#10172e", horizon: "#3d2f4b", fog: "#1c1a29", sun: "#8090c0", sunI: 0.22, hemiSky: "#323a5c", hemiGround: "#100d0f", hemiI: 0.42, night: 0.9 },
  { h: 21, top: "#070b18", horizon: "#1f1d2d", fog: "#10111a", sun: "#7d8fc0", sunI: 0.22, hemiSky: "#27304d", hemiGround: "#0c0b0d", hemiI: 0.36, night: 1 },
  { h: 24, top: "#050812", horizon: "#1c1a28", fog: "#0e0f17", sun: "#7d8fc0", sunI: 0.22, hemiSky: "#27304d", hemiGround: "#0c0b0d", hemiI: 0.35, night: 1 },
];

const KEY_SUNRISE = 7.2, KEY_SUNSET = 18.3;

/** Maps a London hour onto the keys' day, so dawn and dusk land on the real sunrise and sunset. */
export function skyHourFor(hour: number, sunrise: number, sunset: number) {
  if (hour < sunrise) return (hour / sunrise) * KEY_SUNRISE;
  if (hour < sunset) return KEY_SUNRISE + ((hour - sunrise) / (sunset - sunrise)) * (KEY_SUNSET - KEY_SUNRISE);
  return KEY_SUNSET + ((hour - sunset) / (24 - sunset)) * (24 - KEY_SUNSET);
}

const keyColors = KEYS.map((k) => ({
  top: new THREE.Color(k.top), horizon: new THREE.Color(k.horizon), fog: new THREE.Color(k.fog),
  sun: new THREE.Color(k.sun), hemiSky: new THREE.Color(k.hemiSky), hemiGround: new THREE.Color(k.hemiGround),
}));

export interface SkyState {
  top: THREE.Color; horizon: THREE.Color; fog: THREE.Color;
  sun: THREE.Color; sunI: number; sunDir: THREE.Vector3;
  hemiSky: THREE.Color; hemiGround: THREE.Color; hemiI: number;
  night: number;
}

const out: SkyState = {
  top: new THREE.Color(), horizon: new THREE.Color(), fog: new THREE.Color(),
  sun: new THREE.Color(), sunI: 0, sunDir: new THREE.Vector3(),
  hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiI: 0, night: 0,
};

const grey = new THREE.Color();
function desaturate(c: THREE.Color, amount: number, darken: number) {
  const l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  grey.setRGB(l, l, l);
  c.lerp(grey, amount).multiplyScalar(1 - darken);
}

// overcast: 0 clear .. 1 thick cloud; rain: 0 .. 1
export function skyAt(hour: number, overcast: number, rain: number): SkyState {
  let i = 0;
  while (i < KEYS.length - 2 && hour >= KEYS[i + 1].h) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = THREE.MathUtils.clamp((hour - a.h) / (b.h - a.h), 0, 1);
  const s = t * t * (3 - 2 * t);
  const ca = keyColors[i], cb = keyColors[i + 1];
  out.top.copy(ca.top).lerp(cb.top, s);
  out.horizon.copy(ca.horizon).lerp(cb.horizon, s);
  out.fog.copy(ca.fog).lerp(cb.fog, s);
  out.sun.copy(ca.sun).lerp(cb.sun, s);
  out.hemiSky.copy(ca.hemiSky).lerp(cb.hemiSky, s);
  out.hemiGround.copy(ca.hemiGround).lerp(cb.hemiGround, s);
  out.sunI = THREE.MathUtils.lerp(a.sunI, b.sunI, s);
  out.hemiI = THREE.MathUtils.lerp(a.hemiI, b.hemiI, s);
  out.night = THREE.MathUtils.lerp(a.night, b.night, s);

  // weather
  const day = 1 - out.night;
  desaturate(out.top, overcast * 0.65 * day, rain * 0.18);
  desaturate(out.horizon, overcast * 0.6 * day, rain * 0.15);
  desaturate(out.fog, overcast * 0.55 * day, rain * 0.12);
  out.sunI *= 1 - overcast * 0.72 * day;
  out.hemiI *= 1 + overcast * 0.15 * day - rain * 0.1;

  // sun path: rises in the east (+x), low in the southern sky (-z)
  const isDay = hour > 7 && hour < 18.4;
  if (isDay) {
    const p = (hour - 7) / (18.4 - 7);
    const elev = Math.sin(p * Math.PI) * THREE.MathUtils.degToRad(27) + 0.06;
    const az = THREE.MathUtils.lerp(-1.3, 1.3, p); // 0 = due south (-z)
    out.sunDir.set(-Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
  } else {
    out.sunDir.set(-0.35, 0.82, 0.45).normalize(); // moon
  }
  return out;
}

export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color() },
    uCloud: { value: 0.8 },
    uNight: { value: 1 },
    uTime: { value: 0 },
    uIsSun: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uHorizon, uSunDir, uSunColor;
      uniform float uCloud, uNight, uTime, uIsSun;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
        return v;
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.5));
        if (d.y < 0.0) col = mix(uHorizon, uHorizon * 0.35, min(1.0, -d.y * 4.0));

        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        float disc = smoothstep(0.9993, 0.9997, sd);
        vec3 sunGlow = uSunColor * (pow(sd, 8.0) * 0.35 + pow(sd, 64.0) * 0.6);
        col += sunGlow * (1.0 - uCloud * 0.75) * mix(1.0, 0.25, uNight);
        col += disc * uSunColor * mix(6.0, 1.6, uNight) * (1.0 - uCloud * 0.9);

        // stars (only through gaps, London light pollution keeps them faint)
        vec2 sp = d.xz / (d.y + 0.02) * 60.0;
        float star = step(0.997, hash(floor(sp))) * uNight * h * 0.8;

        // clouds
        vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(uTime * 0.006, uTime * 0.002);
        float n = fbm(uv * 1.6);
        float cover = smoothstep(0.62 - uCloud * 0.5, 0.95 - uCloud * 0.35, n) * smoothstep(0.0, 0.18, d.y);
        vec3 cloudDay = mix(uHorizon, vec3(0.92), 0.25) * (0.75 + 0.35 * n);
        vec3 cloudNight = vec3(0.16, 0.10, 0.075) * (0.7 + 0.6 * n); // city glow on the cloud base
        vec3 cloudCol = mix(cloudDay, cloudNight + uTop * 0.4, uNight);
        col = mix(col + star, cloudCol, cover * mix(0.85, 0.95, uCloud));

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, material, uniforms };
}
