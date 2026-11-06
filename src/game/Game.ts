// Owns the renderer and scene, runs the frame loop, and keeps the 3D world in sync with game state.
import * as THREE from "three";
import {
  BloomEffect, EffectComposer, EffectPass, RenderPass, SMAAEffect, SMAAPreset,
  ToneMappingEffect, ToneMappingMode, VignetteEffect,
} from "postprocessing";
import { buildWorld, disposeTree, shopIsOn, type World } from "./world/street";
import { AREA_VISUALS } from "./world/areas";
import { createSky, skyAt, skyHourFor } from "./world/sky";
import { createRain } from "./world/rain";
import { createLighting } from "./world/lighting";
import { FACADE } from "./world/layout";
import { Traffic, parkedCars } from "./actors/vehicles";
import { Crowd } from "./actors/crowd";
import { Player } from "./actors/Player";
import { CameraRig } from "./actors/CameraRig";
import { input } from "./systems/input";
import { audio } from "./systems/audio";
import { useGame, hourOf, objectiveTarget, realTimeAt } from "../state/store";
import { londonDaylightAt } from "../state/london";
import { npcById, placesIn, type AreaId, type Place } from "../state/content";
import { seeThroughUniforms } from "./world/seeThrough";
import { preloadPeople } from "./actors/Person";

const STAGE_FACING = -Math.PI / 2 - 0.35; // the creator preview faces down the pavement, slightly towards the road
const GAME_MINUTES_PER_SECOND = 1;

const RAIN_TARGET = { rain: 1, drizzle: 0.35, overcast: 0, clear: 0 };
const CLOUD_TARGET = { rain: 1, drizzle: 0.9, overcast: 0.85, clear: 0.15 };

export let game: Game | null = null;

export class Game {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(52, 1, 0.1, 1200);
  rig: CameraRig;
  world!: World;
  area: AreaId = "albion";
  player: Player;
  traffic!: Traffic;
  crowd!: Crowd;
  private sky = createSky();
  private rain: ReturnType<typeof createRain>;
  private lighting!: ReturnType<typeof createLighting>;
  private hemi = new THREE.HemisphereLight();
  private sun = new THREE.DirectionalLight();
  private pmrem: THREE.PMREMGenerator;
  private envScene = new THREE.Scene();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envKey = "";
  private envTimer = 0;
  private smaaPass: EffectPass | null = null;
  private timer = new THREE.Timer();
  // Adaptive resolution: render fewer pixels when frames are consistently slow (phones), more when there's headroom.
  renderScale = 1;
  private frameTimes: number[] = [];
  private govTimer = 4; // let shaders warm up before judging
  private govFast = 0;
  private accum = 0;
  private wet = 1;
  private rainVis = 1;
  private cloudVis = 1;
  private snapWeather = true; // (show the weather as it is, without fading, when a life starts or resumes)
  private marker = new THREE.Group();
  private tapRing: THREE.Mesh;
  private unsubs: (() => void)[] = [];
  private raf = 0;
  private resizeObs: ResizeObserver;
  private interactPoints: { place: Place; x: number; z: number }[] = [];
  private lastTeleportKey = -1;
  private previewYaw = 0;
  private keyLight = new THREE.PointLight("#ffe6cf", 0, 10, 2); // soft front light for the creator preview

  constructor(private container: HTMLElement) {
    const quality = useGame.getState().settings.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
    this.renderer.setPixelRatio(this.basePixelRatio());
    this.renderer.shadowMap.enabled = quality === "high";
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    // Always fill the container: the drawing buffer can be bigger (Retina) or smaller (auto resolution) than the CSS size.
    Object.assign(this.renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "none" });

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new BloomEffect({ mipmapBlur: true, intensity: 1.15, luminanceThreshold: 0.85, luminanceSmoothing: 0.3, radius: 0.72 });
    this.composer.addPass(new EffectPass(this.camera, bloom, new ToneMappingEffect({ mode: ToneMappingMode.AGX }), new VignetteEffect({ offset: 0.32, darkness: 0.5 })));
    this.setSMAA(quality === "high");

    // sky + environment
    this.scene.add(this.sky.mesh);
    this.envScene.add(new THREE.Mesh(this.sky.mesh.geometry, this.sky.material));
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.fog = new THREE.FogExp2("#1a1a28", 0.014);

    // lights
    this.scene.add(this.hemi, this.keyLight);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    // world
    this.rain = createRain(quality === "high" ? 9000 : 4500);
    this.scene.add(this.rain.group);
    preloadPeople(["male-casual", "female-casual", "male-hoodie"]); // (the creator's starting outfits)
    this.player = new Player(useGame.getState().profile.look);
    this.player.char.root.visible = false;
    this.scene.add(this.player.char.root);
    this.loadArea(useGame.getState().area);

    // objective marker + tap ring
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.6, 3.2) }));
    gem.scale.y = 1.4;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.25, 7, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.4, 1.8), transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = 0.8; // reaches down to the pavement
    this.marker.add(gem, beam);
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.tapRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.5, 1.5), transparent: true, opacity: 0, depthWrite: false }),
    );
    this.scene.add(this.tapRing);

    this.rig = new CameraRig(this.camera, this.renderer.domElement);
    this.rig.onDrag = (dx) => { this.previewYaw += dx * 0.012; };
    this.rig.onTapGround = (p) => {
      this.tapRing.position.set(p.x, Math.abs(p.z) > 6 ? 0.17 : 0.02, p.z);
      (this.tapRing.material as THREE.MeshBasicMaterial).opacity = 1;
    };
    this.camera.position.set(-20, 4, -3);

    this.bindKeys();
    this.bindStore();
    this.timer.connect(document);
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    game = this;
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this;
    this.loop();
  }

  // Build (or rebuild, when travelling) a district: street, lights, traffic and people.
  private loadArea(id: AreaId) {
    const quality = useGame.getState().settings.quality;
    const V = AREA_VISUALS[id];
    if (this.world) {
      disposeTree(this.world.group);
      this.lighting.dispose();
      disposeTree(this.traffic.group);
      disposeTree(this.crowd.group);
    }
    this.area = id;
    const t0 = performance.now();
    this.world = buildWorld(id);
    parkedCars(this.world.group, this.world.colliders);
    this.scene.add(this.world.group);
    this.lighting = createLighting(this.scene, this.world.lights, quality === "high" ? 10 : 5);
    this.traffic = new Traffic(V.traffic);
    this.traffic.onHonk = (x, z) => audio.honk(Math.hypot(x - this.player.pos.x, z - this.player.pos.z));
    this.scene.add(this.traffic.group);
    this.crowd = new Crowd(Math.round(V.pedestrians * (quality === "high" ? 1 : 0.6)), id);
    this.scene.add(this.crowd.group);
    this.interactPoints = placesIn(id).map((p) => ({ place: p, x: p.x, z: p.z ?? (p.side === "n" ? FACADE - 1.3 : -FACADE + 1.3) }));
    this.envKey = "";
    this.lastBuildMs = performance.now() - t0;
  }

  lastBuildMs = 0;

  private setSMAA(on: boolean) {
    if (on && !this.smaaPass) {
      this.smaaPass = new EffectPass(this.camera, new SMAAEffect({ preset: SMAAPreset.MEDIUM }));
      this.composer.addPass(this.smaaPass);
    } else if (!on && this.smaaPass) {
      this.composer.removePass(this.smaaPass);
      this.smaaPass.dispose();
      this.smaaPass = null;
    }
  }

  private bindKeys() {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const s = useGame.getState();
      if (s.phase !== "playing") return;
      input.keys.add(e.code);
      if (e.code === "KeyE" || e.code === "Enter") { if (!s.panel && !s.phoneOpen) { s.interact(); audio.blip(); } }
      if (e.code === "Escape") { if (s.panel) s.closePanel(); else if (s.phoneOpen) s.togglePhone(false); }
      if (e.code === "KeyP" || e.code === "Tab") { e.preventDefault(); s.togglePhone(); audio.blip(!s.phoneOpen); }
      if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const blur = () => input.keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    this.unsubs.push(() => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    });
  }

  private bindStore() {
    this.unsubs.push(useGame.subscribe((s, prev) => {
      if (s.draftLook !== prev.draftLook && s.phase === "title") {
        if (s.draftLook) {
          // character creator: show the character being designed on the street
          if (this.rig.mode !== "creator") this.previewYaw = 0;
          this.player.setLook(s.draftLook, this.scene);
          this.rig.mode = "creator";
        } else {
          this.player.char.root.visible = false;
          this.rig.mode = "cinematic";
        }
      }
      if (s.phase !== prev.phase) {
        if (s.phase === "playing") {
          this.snapWeather = true;
          this.player.setLook(s.profile.look, this.scene);
          this.player.char.root.visible = true;
          this.player.facing = Math.PI / 2;
          this.rig.startFollow(this.player.pos);
        } else if (s.phase === "title") {
          this.player.char.root.visible = false;
          this.rig.mode = "cinematic";
        }
      }
      if (s.area !== prev.area && s.area !== this.area) this.loadArea(s.area);
      if (s.phase === "playing" && prev.phase === "playing" && s.profile.look !== prev.profile.look) this.player.setLook(s.profile.look, this.scene);
      if (s.teleport && s.teleport.key !== this.lastTeleportKey) {
        this.lastTeleportKey = s.teleport.key;
        this.player.teleport(s.teleport.x, s.teleport.z);
        this.rig.snapTo(this.player.pos);
      }
      if (s.settings.quality !== prev.settings.quality) {
        this.setSMAA(s.settings.quality === "high");
        this.renderScale = 1;
        this.applyPixelRatio();
      }
      if (s.settings.volume !== prev.settings.volume) audio.setVolume(s.settings.volume);
    }));
  }

  private basePixelRatio() {
    return Math.min(devicePixelRatio, useGame.getState().settings.quality === "high" ? 1.75 : 1);
  }

  private applyPixelRatio() {
    this.renderer.setPixelRatio(this.basePixelRatio() * this.renderScale);
    this.resize();
  }

  // Judge the median frame time every 1.5s: drop resolution if slow, creep back up after a long good spell.
  private governResolution(raw: number) {
    if (document.hidden || raw > 0.25) return;
    this.frameTimes.push(raw * 1000);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    this.govTimer -= raw;
    if (this.govTimer > 0 || this.frameTimes.length < 40) return;
    this.govTimer = 1.5;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    let next = this.renderScale;
    if (median > 22) { next = Math.max(0.55, this.renderScale * 0.85); this.govFast = 0; }
    else if (median < 18 && this.renderScale < 1) { if (++this.govFast >= 10) { next = Math.min(1, this.renderScale * 1.12); this.govFast = 0; } }
    else this.govFast = 0;
    if (Math.abs(next - this.renderScale) > 0.01) {
      this.renderScale = next;
      this.applyPixelRatio();
      this.frameTimes.length = 0;
      this.govTimer = 2.5;
    }
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.8 ? 64 : 52;
    this.camera.updateProjectionMatrix();
  }

  private updateEnvironment(hour: number, dt: number) {
    this.envTimer -= dt;
    const key = `${Math.round(hour * 4)}:${Math.round(this.cloudVis * 5)}:${Math.round(this.rainVis * 5)}`;
    if (key === this.envKey || this.envTimer > 0) return;
    this.envKey = key;
    this.envTimer = 0.5;
    const rt = this.pmrem.fromScene(this.envScene, 0.03, 0.1, 1000);
    this.scene.environment = rt.texture;
    this.envRT?.dispose();
    this.envRT = rt;
  }

  // Where the player is on screen, for the hole cut in leaves and awnings that would hide them.
  private cutPos = new THREE.Vector3();
  private bufferSize = new THREE.Vector2();
  private updateSeeThrough(on: boolean) {
    const u = seeThroughUniforms;
    if (!on) { u.uCutRadius.value = 0; return; }
    this.camera.updateMatrixWorld();
    const p = this.cutPos.copy(this.player.pos);
    p.y += 1.15; // (chest height, so the hole also covers an umbrella)
    u.uCutDepth.value = -p.clone().applyMatrix4(this.camera.matrixWorldInverse).z - 0.6;
    p.project(this.camera);
    this.renderer.getDrawingBufferSize(this.bufferSize);
    u.uCutCenter.value.set((p.x * 0.5 + 0.5) * this.bufferSize.x, (p.y * 0.5 + 0.5) * this.bufferSize.y);
    u.uCutRadius.value = this.bufferSize.y * 0.14;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    this.timer.update();
    const raw = this.timer.getDelta();
    const dt = Math.min(raw, 0.05);
    const t = this.timer.getElapsed();
    this.governResolution(raw);
    const s = useGame.getState();
    const playing = s.phase === "playing";

    // game clock
    const paused = !playing || !!s.panel || s.phoneOpen || !!s.fade;
    if (!paused) {
      this.accum += dt;
      if (this.accum >= 0.25) { s.tick(this.accum * GAME_MINUTES_PER_SECOND); this.accum = 0; }
    }
    const minutes = useGame.getState().minutes;
    const hour = hourOf(minutes);
    const daylight = londonDaylightAt(realTimeAt(s, minutes));
    const skyHour = daylight ? skyHourFor(hour, daylight.sunrise, daylight.sunset) : hour;

    // weather
    const weather = s.weather;
    if (!playing || this.snapWeather) {
      // title screen, or a life just started: no fading in from the last weather shown
      this.rainVis = RAIN_TARGET[weather];
      this.cloudVis = CLOUD_TARGET[weather];
      this.wet = this.rainVis > 0.15 ? 1 : 0;
      if (playing) this.snapWeather = false;
    } else {
      this.rainVis = THREE.MathUtils.damp(this.rainVis, RAIN_TARGET[weather], 0.4, dt);
      this.cloudVis = THREE.MathUtils.damp(this.cloudVis, CLOUD_TARGET[weather], 0.3, dt);
      this.wet = this.rainVis > 0.15 ? THREE.MathUtils.damp(this.wet, 1, 0.6, dt) : Math.max(0, this.wet - dt / 150);
    }

    // sky + light
    const sk = skyAt(skyHour, this.cloudVis, this.rainVis);
    const night = sk.night;
    const u = this.sky.uniforms;
    u.uTop.value.copy(sk.top);
    u.uHorizon.value.copy(sk.horizon);
    u.uSunDir.value.copy(sk.sunDir);
    u.uSunColor.value.copy(sk.sun);
    u.uCloud.value = this.cloudVis;
    u.uNight.value = night;
    u.uTime.value = t;
    this.sky.mesh.position.copy(this.camera.position);
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(sk.fog);
    fog.density = 0.011 + this.rainVis * 0.011 + this.cloudVis * 0.003;
    this.hemi.color.copy(sk.hemiSky);
    this.hemi.groundColor.copy(sk.hemiGround);
    this.hemi.intensity = sk.hemiI;
    const creating = this.rig.mode === "creator";
    const focus = this.rig.mode === "follow" ? this.player.pos : creating ? this.rig.creator.focus : this.camera.position;
    this.sun.color.copy(sk.sun);
    this.sun.intensity = sk.sunI;
    this.sun.position.copy(focus).addScaledVector(sk.sunDir, 80);
    this.sun.target.position.copy(focus);
    this.scene.environmentIntensity = THREE.MathUtils.lerp(0.9, 0.55, night);
    this.updateEnvironment(skyHour, dt);

    // materials that follow time of day / weather
    const W = this.world;
    W.windowLit.emissiveIntensity = THREE.MathUtils.lerp(0.06, 1.25, night);
    const lampOn = THREE.MathUtils.smoothstep(night, 0.25, 0.55);
    W.lampGlow.emissiveIntensity = 0.3 + lampOn * 7;
    for (const sw of W.switchables) sw.material.emissiveIntensity = shopIsOn(sw, hour) ? THREE.MathUtils.lerp(sw.day, sw.base, night) : 0;
    W.roadMat.roughness = THREE.MathUtils.lerp(1, 0.5, this.wet);
    W.roadMat.color.setScalar(THREE.MathUtils.lerp(1, 0.7, this.wet));
    W.paveMat.roughness = THREE.MathUtils.lerp(1, 0.62, this.wet);
    W.paveMat.color.setScalar(THREE.MathUtils.lerp(1, 0.78, this.wet));
    W.slateMat.roughness = THREE.MathUtils.lerp(0.75, 0.38, this.wet);
    W.skylineMat.uniforms.uColor.value.copy(sk.horizon).lerp(sk.top, 0.35).multiplyScalar(0.55);
    W.skylineMat.uniforms.uNight.value = night;
    for (const a of W.animate) a(t, night);

    // actors
    const talkingTo = s.panel?.kind === "npc" ? s.panel.id : null;
    const raining = this.rainVis > 0.2;
    this.traffic.update(dt, playing ? this.player.pos : { x: 9999, z: 0 }, night, this.camera.position.x);
    this.crowd.people = { met: s.met, rel: s.rel, near: s.nearby?.kind === "npc" ? s.nearby.id : null };
    this.crowd.update(dt, playing ? this.player.pos : new THREE.Vector3(9999, 0, 0), talkingTo, raining, hour, this.camera.position, creating ? { x: focus.x, z: focus.z, r: 11 } : undefined);
    const fl = this.rig.creator.focus;
    this.keyLight.position.set(fl.x - 2.6, 2.4, fl.z - 1.6);
    this.keyLight.intensity = THREE.MathUtils.damp(this.keyLight.intensity, creating ? 16 : 0, 5, dt);
    if (creating) {
      const root = this.player.char.root;
      root.visible = true;
      root.position.copy(this.rig.creator.focus);
      root.rotation.y = STAGE_FACING + this.previewYaw + Math.sin(t * 0.7) * 0.08;
      this.player.char.update(dt, 0, false);
    }
    if (playing) {
      const blockers = this.crowd.npcs.filter((n) => n.char.root.visible).map((n) => n.pos);
      this.player.update(dt, this.rig.yaw, [...W.colliders, ...this.traffic.colliders()], blockers, s.needs.energy < 15, raining, !s.panel && !s.fade);
      this.updateInteraction();
      this.updateMarker(t);
    }
    const ring = this.tapRing.material as THREE.MeshBasicMaterial;
    ring.opacity = input.clickTarget ? Math.max(0.35, ring.opacity - dt) : Math.max(0, ring.opacity - dt * 3);

    this.rig.update(dt, this.player.pos);
    this.updateSeeThrough(playing && this.rig.mode === "follow");
    this.lighting.update(dt, focus, night, this.wet, this.rainVis, hour);
    this.rain.update(t, this.camera.position, this.rainVis, night);
    audio.setRain(this.rainVis);
    this.composer.render(dt);
  };

  private updateInteraction() {
    const s = useGame.getState();
    const p = this.player.pos;
    let best: { kind: "place" | "npc"; id: string; label: string; sub?: string } | null = null;
    let bestD = Infinity;
    for (const ip of this.interactPoints) {
      const d = Math.hypot(ip.x - p.x, ip.z - p.z);
      const r = ip.place.plots >= 2 ? 3.2 : 2.3;
      if (d < r && d < bestD) { bestD = d; best = { kind: "place", id: ip.place.id, label: ip.place.name, sub: ip.place.tagline }; }
    }
    for (const n of this.crowd.npcs) {
      if (!n.def || !n.char.root.visible) continue;
      const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
      if (d < 2.0 && d - 0.4 < bestD) {
        bestD = d - 0.4;
        const def = npcById(n.def.id);
        best = { kind: "npc", id: def.id, label: s.met[def.id] ? `Talk to ${def.name}` : "Say hello", sub: s.met[def.id] ? def.role : "Someone new" };
      }
    }
    s.setNearby(best);
  }

  private updateMarker(t: number) {
    const s = useGame.getState();
    const target = objectiveTarget(s);
    const p = this.player.pos;
    if (!target || Math.hypot(target.x - p.x, target.z - p.z) < 2.5) { this.marker.visible = false; return; }
    this.marker.visible = true;
    this.marker.position.set(target.x, 2.7 + Math.sin(t * 2.2) * 0.12, target.z);
    this.marker.children[0].rotation.y = t * 1.6;
  }

  playerPosition() {
    return this.player.pos;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.timer.dispose();
    this.unsubs.forEach((u) => u());
    this.resizeObs.disconnect();
    this.rig.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    game = null;
  }
}
