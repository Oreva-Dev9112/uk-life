// People built from Quaternius's character packs (CC0, see public/people/LICENSE.txt): an outfit model in the
// look's colours, with the game's own hairstyles and umbrella, moved by shared animations. Until a model has
// loaded, or if it can't, the shape-built Character stands in.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { bake } from "../world/bake";
import { Character, charMat, hairParts, makeUmbrella, type Look } from "./Character";
import { bodyOf, outfitOf, type Body } from "../../state/content";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const url = (file: string) => `${import.meta.env.BASE_URL}people/${file}.glb`;

// What colours each part of a model: 0 keeps the model's own colour, the rest come from the look.
const SLOT = { fixed: 0, skin: 1, skinShade: 2, brows: 3, top: 4, bottom: 5 };
const HEIGHT: Record<Body, number> = { male: 0.95, female: 0.9 }; // (the models are ~1.85 m tall)
// Ground each clip covers per second at normal speed, so feet don't slide (tuned by eye).
const WALK_SPEED = 1.4, RUN_SPEED = 3.6;
const RIGHT_ARM = /^(Shoulder|UpperArm|LowerArm|Wrist|Index\d|Middle\d|Ring\d|Pinky\d|Thumb\d)R\./;
const CANOPY_OVER_HEAD = new THREE.Vector3(0, 0.45, -0.02); // from the head bone (base of the skull), in model space
const UP = new THREE.Vector3(0, 1, 0);
const SKULL = new THREE.SphereGeometry(1, 18, 14);

interface Outfit {
  scene: THREE.Object3D; // the armature plus one merged skinned mesh named "Person"
  hairAt: THREE.Vector3; // centre of the head in model space, where the hair goes
  hairScale: number;
  skull: { at: THREE.Vector3; radii: THREE.Vector3 }; // the pack's heads are open under their hair, so we add a scalp
  hat: boolean; // the outfit has its own headgear, so no hair
  body: Body;
}

interface Clips { idle: THREE.AnimationClip; walk: THREE.AnimationClip; run: THREE.AnimationClip; idleU: THREE.AnimationClip; walkU: THREE.AnimationClip; runU: THREE.AnimationClip; hold: THREE.AnimationClip; all: Record<string, THREE.AnimationClip> }

const loading = new Map<string, Promise<Outfit>>();
const loaded = new Map<string, Outfit>();
let clipsLoading: Promise<Clips> | null = null;
let clips: Clips | null = null;

function loadOutfit(id: string) {
  let p = loading.get(id);
  if (!p) {
    p = loader.loadAsync(url(id)).then((g) => {
      const o = makeOutfit(g.scene, bodyOf(id));
      loaded.set(id, o);
      return o;
    });
    loading.set(id, p);
  }
  return p;
}

function loadClips() {
  clipsLoading ??= loader.loadAsync(url("anims")).then((g) => {
    const all = Object.fromEntries(g.animations.map((c) => [c.name, c]));
    // Holding an umbrella: the right arm frozen halfway through Interact (hand in front of the chest), everything
    // else from the usual clips.
    const arm = (t: THREE.KeyframeTrack) => RIGHT_ARM.test(t.name);
    const noArm = (c: THREE.AnimationClip) => new THREE.AnimationClip(`${c.name}U`, c.duration, c.tracks.filter((t) => !arm(t)));
    const frozen = (c: THREE.AnimationClip, at: number) => c.tracks.filter(arm).map((t) => {
      const value = t.InterpolantFactoryMethodLinear(new Float32Array(t.getValueSize())).evaluate(c.duration * at) as ArrayLike<number>;
      return new (t.constructor as typeof THREE.KeyframeTrack)(t.name, [0], Array.from(value));
    });
    clips = {
      idle: all.Idle, walk: all.Walk, run: all.Run,
      idleU: noArm(all.Idle), walkU: noArm(all.Walk), runU: noArm(all.Run),
      hold: new THREE.AnimationClip("Hold", 1, frozen(all.Interact, 0.45)),
      all,
    };
    return clips;
  });
  return clipsLoading;
}

/** Starts loading outfits ahead of time (and the shared animations). */
export function preloadPeople(ids: string[]) {
  loadClips().catch(() => {});
  for (const id of ids) loadOutfit(id).catch(() => {});
}

const triangles = (m: THREE.Mesh) => (m.geometry.index?.count ?? m.geometry.getAttribute("position").count) / 3;
const materialName = (m: THREE.Mesh) => (m.material as THREE.Material).name;

// One model, one draw: tag every part with what colours it, merge them, and measure the head for the hair.
function makeOutfit(scene: THREE.Object3D, body: Body): Outfit {
  scene.updateMatrixWorld(true);
  const parts: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh); });
  // (the pack names each part's node ..._Head, _Body, _Legs or _Feet; meshes with several colours come in as a group;
  // anything else, like the backpacker's backpack, keeps its own colours)
  const partOf = (m: THREE.Object3D) => (m.name.match(/_(Head|Body|Legs|Feet)/) ?? m.parent?.name.match(/_(Head|Body|Legs|Feet)/))?.[1] ?? "Extra";
  const keep: { mesh: THREE.SkinnedMesh; slot: number }[] = [];
  const head = new THREE.Box3();
  let hat = false;
  let top = "";
  for (const part of ["Head", "Body", "Legs", "Feet", "Extra"]) {
    const meshes = parts.filter((m) => partOf(m) === part);
    const clothes = meshes.filter((m) => !materialName(m).startsWith("Skin")).sort((a, b) => triangles(b) - triangles(a));
    if (part === "Body") top = clothes[0] ? materialName(clothes[0]) : "";
    for (const m of meshes) {
      const name = materialName(m);
      let slot = SLOT.fixed;
      if (name === "Skin") slot = SLOT.skin;
      else if (name.startsWith("Skin")) slot = SLOT.skinShade;
      else if (part === "Head" && /hair|eyebrow/i.test(name)) {
        if (triangles(m) > 200) continue; // the pack's own hair makes way for the game's hairstyles
        slot = SLOT.brows;
      } else if (part === "Head" && triangles(m) > 100) hat = true; // hard hats and the like
      else if (part === "Body" && m === clothes[0]) slot = SLOT.top;
      else if (part === "Legs" && m === clothes[0]) slot = name === top ? SLOT.top : SLOT.bottom; // (a dress is one garment)
      keep.push({ mesh: m, slot });
      if (part === "Head" && name === "Skin") head.expandByObject(m);
    }
  }
  const first = keep[0].mesh;
  const geometries = keep.map(({ mesh, slot }) => {
    const g = mesh.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "skinIndex", "skinWeight"].includes(name)) g.deleteAttribute(name);
    const n = g.getAttribute("position").count;
    const c = (mesh.material as THREE.MeshStandardMaterial).color;
    const color = new Float32Array(n * 3), slots = new Float32Array(n).fill(slot);
    for (let i = 0; i < n; i++) color.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(color, 3));
    g.setAttribute("slot", new THREE.BufferAttribute(slots, 1));
    if (!mesh.matrixWorld.equals(first.matrixWorld)) console.warn("Person: parts don't share a transform", mesh.name);
    return g;
  });
  first.geometry = mergeGeometries(geometries)!;
  first.geometry.userData.shared = true; // (everyone in this outfit uses it, so a district's clean-up must leave it)
  first.name = "Person";
  // Bounds for skipping off-screen people: the rest pose, with room for swinging arms and legs.
  first.computeBoundingSphere();
  first.boundingSphere!.radius *= 1.3;
  for (const { mesh } of keep) if (mesh !== first) mesh.removeFromParent();
  for (const m of parts) if (!keep.some((k) => k.mesh === m)) m.removeFromParent();

  const size = head.getSize(new THREE.Vector3());
  const hairScale = size.x / 2 / 0.121; // (the hairstyles fit a head 0.121 m across at the ears)
  const hairAt = new THREE.Vector3((head.min.x + head.max.x) / 2, head.max.y - 0.138 * hairScale, (head.min.z + head.max.z) / 2);
  // (just inside the head, so it only shows where the head has no skin of its own)
  const skull = { at: new THREE.Vector3(hairAt.x, head.max.y - 0.125, hairAt.z - 0.01), radii: new THREE.Vector3(size.x / 2 - 0.004, 0.122, size.z / 2 - 0.006) };
  return { scene, hairAt, hairScale, skull, hat, body };
}

// Vertex colours, except where a part's slot says to use the look's colour instead.
function personMaterial(palette: THREE.Color[]) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPalette = { value: palette };
    shader.vertexShader = shader.vertexShader
      .replace("#include <color_pars_vertex>", "#include <color_pars_vertex>\nattribute float slot;\nuniform vec3 uPalette[6];")
      .replace("#include <color_vertex>", "#include <color_vertex>\n  if (slot > 0.5) vColor.rgb = uPalette[int(slot + 0.5)];");
  };
  return m;
}

function paletteFor(look: Look) {
  const skin = new THREE.Color(look.skin);
  return [
    new THREE.Color(), skin, skin.clone().multiplyScalar(0.8), new THREE.Color(look.hair).multiplyScalar(0.6),
    new THREE.Color(look.jacket), new THREE.Color(look.trousers),
  ];
}

export class Person {
  root = new THREE.Group();
  /** Resolves once the model (rather than the stand-in) is showing. */
  ready: Promise<void>;
  private stand: Character | null = null;
  private model: THREE.Object3D | null = null;
  private material: THREE.MeshStandardMaterial | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<Exclude<keyof Clips, "all">, THREE.AnimationAction> | null = null;
  private umbrella: THREE.Object3D | null = null;
  private wrist: THREE.Object3D | null = null;
  private umbrellaT = 0;
  private head: THREE.Object3D | null = null;
  private gone = false;
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();

  constructor(public look: Look) {
    const id = outfitOf(look);
    const outfit = loaded.get(id);
    if (outfit && clips) {
      this.build(outfit, clips);
      this.ready = Promise.resolve();
      return;
    }
    this.stand = new Character(look);
    this.root.add(this.stand.root);
    this.ready = Promise.all([loadOutfit(id), loadClips()]).then(([o, c]) => {
      if (this.gone) return;
      this.stand?.dispose();
      this.stand = null;
      this.build(o, c);
    });
    this.ready.catch(() => {}); // (offline or missing: the stand-in stays)
  }

  private build(outfit: Outfit, c: Clips) {
    const model = SkeletonUtils.clone(outfit.scene);
    model.scale.setScalar(HEIGHT[outfit.body]);
    const mesh = model.getObjectByName("Person") as THREE.SkinnedMesh;
    this.material = personMaterial(paletteFor(this.look));
    mesh.material = this.material;
    mesh.castShadow = true;

    // Scalp and hair: placed on the head in the rest pose, then carried by the head bone.
    const onHead: THREE.Mesh[] = [];
    const { at, radii } = outfit.skull;
    const scalp = new THREE.Mesh(bake([{ geo: SKULL, color: this.look.skin, scale: [radii.x, radii.y, radii.z] }]), charMat);
    scalp.position.copy(at);
    onHead.push(scalp);
    const style = hairParts(this.look);
    if (style.length && !outfit.hat) {
      const hair = new THREE.Mesh(bake(style), charMat);
      hair.castShadow = true;
      hair.position.copy(outfit.hairAt);
      hair.scale.setScalar(outfit.hairScale);
      onHead.push(hair);
    }
    const headBone = model.getObjectByName("Head")!;
    model.add(...onHead);
    model.updateMatrixWorld(true);
    for (const m of onHead) headBone.attach(m);
    // Umbrella: kept upright at the right hand rather than turning with it.
    this.umbrella = makeUmbrella(this.look.umbrella);
    this.umbrella.visible = false;
    model.add(this.umbrella);
    this.wrist = model.getObjectByName("WristR") ?? null;
    this.head = model.getObjectByName("Head") ?? null;

    this.mixer = new THREE.AnimationMixer(model);
    const play = (clip: THREE.AnimationClip) => {
      const a = this.mixer!.clipAction(clip);
      a.setEffectiveWeight(0).play();
      return a;
    };
    this.actions = { idle: play(c.idle), walk: play(c.walk), run: play(c.run), idleU: play(c.idleU), walkU: play(c.walkU), runU: play(c.runU), hold: play(c.hold) };
    this.actions.idle.setEffectiveWeight(1);
    this.mixer.update(Math.random() * 2); // (so a crowd isn't in step)
    this.model = model;
    this.root.add(model);
  }

  update(dt: number, speed: number, rain: boolean) {
    if (!this.mixer || !this.actions || !this.model) {
      this.stand?.update(dt, speed, rain);
      return;
    }
    this.umbrellaT = THREE.MathUtils.damp(this.umbrellaT, rain ? 1 : 0, 4, dt);
    const u = this.umbrellaT;
    // idle, walk and run by speed; each clip sped up to match the ground covered
    const run = THREE.MathUtils.smoothstep(speed, 3.0, 3.6);
    const walk = THREE.MathUtils.smoothstep(speed, 0.05, 0.6) * (1 - run);
    const idle = 1 - walk - run;
    const A = this.actions;
    A.idle.setEffectiveWeight(idle * (1 - u));
    A.idleU.setEffectiveWeight(idle * u);
    A.walk.setEffectiveWeight(walk * (1 - u));
    A.walkU.setEffectiveWeight(walk * u);
    A.run.setEffectiveWeight(run * (1 - u));
    A.runU.setEffectiveWeight(run * u);
    A.hold.setEffectiveWeight(u);
    const walkRate = THREE.MathUtils.clamp(speed / WALK_SPEED, 0.6, 2.2);
    const runRate = THREE.MathUtils.clamp(speed / RUN_SPEED, 0.7, 1.8);
    A.walk.timeScale = A.walkU.timeScale = walkRate;
    A.run.timeScale = A.runU.timeScale = runRate;
    this.mixer.update(dt);

    if (this.umbrella && this.wrist && this.head) {
      this.umbrella.visible = u > 0.05;
      if (this.umbrella.visible) {
        // The shaft runs from the hand up to just above the head, so the canopy covers the head.
        this.model.updateMatrixWorld(true);
        const hand = this.model.worldToLocal(this.wrist.getWorldPosition(this.v));
        const top = this.model.worldToLocal(this.head.getWorldPosition(this.v2)).add(CANOPY_OVER_HEAD);
        const dir = this.v3.subVectors(top, hand).normalize();
        this.umbrella.position.copy(top).addScaledVector(dir, -0.48); // (the canopy sits 0.48 up the shaft)
        this.umbrella.quaternion.setFromUnitVectors(UP, dir);
        this.umbrella.scale.setScalar(Math.max(0.01, u));
      }
    }
  }

  dispose() {
    this.gone = true;
    this.stand?.dispose();
    this.mixer?.stopAllAction();
    this.material?.dispose();
    // (the model's geometry is shared by everyone in that outfit; only the hair and umbrella are this person's)
    this.model?.traverse((o) => { if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh)) o.geometry.dispose(); });
    this.root.removeFromParent();
  }
}
