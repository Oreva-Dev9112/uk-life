// Builds the high street: terraces, shops, landmarks, pavements, road markings and street furniture.
import * as THREE from "three";
import { Batcher, BOX, PLANE, CYL, CYL_LO, SPHERE, mat } from "./batcher";
import * as T from "./textures";
import {
  type AABB, type LightSource, BUS_STOP_X, FACADE, KERB_H, PLOT, ROAD_HALF, STREET_X, ZEBRA_X,
} from "./layout";
import { placesIn, type AreaId, type Place, type Side } from "../../state/content";
import { AREA_VISUALS, type Landmark, type ShopSpec } from "./areas";
import { seeThrough } from "./seeThrough";

export interface Switchable {
  material: THREE.MeshStandardMaterial;
  hours: [number, number];
  base: number; // emissive intensity when on at night
  day: number; // emissive intensity when on during the day
}

export interface World {
  group: THREE.Group;
  colliders: AABB[];
  lights: LightSource[];
  roadMat: THREE.MeshStandardMaterial;
  paveMat: THREE.MeshStandardMaterial;
  slateMat: THREE.MeshStandardMaterial;
  windowLit: THREE.MeshStandardMaterial;
  lampGlow: THREE.MeshStandardMaterial;
  switchables: Switchable[];
  skylineMat: THREE.ShaderMaterial;
  animate: ((t: number, night: number) => void)[];
}

const SHOP_LIGHT: Record<string, string> = {
  bakery: "#ffd59a", chippy: "#e6f4ff", shop: "#eaffea", laundrette: "#d6ecff", generic: "#ffd9a8",
  barber: "#e8f1ff", vape: "#c084fc", bookies: "#a7f3d0", pub: "#ffb057", gym: "#ff5fd2",
  jobcentre: "#e8f0f4", station: "#fff3dc", bank: "#eef4ff", tailor: "#ffe8c2", restaurant: "#ffb877",
  bar: "#f0a3ff", records: "#ffd08a", vintage: "#ffe2b8", theatre: "#ffd18a", club: "#e879f9",
};
const BRIGHT = ["#7c3aed", "#f59e0b", "#06b6d4", "#ef4444", "#10b981", "#ec4899", "#facc15", "#3b82f6"];
const STONE = ["#e7e0cf", "#d9d2c3", "#efe9dc", "#cfc6b2"];

const DOOR_COLORS = ["#111111", "#1e2a44", "#7f1d1d", "#14532d", "#1f2937", "#6b21a8", "#b45309", "#0f4c5c", "#9b1c1c"];
const RENDER_COLORS = ["#f2efe8", "#efe6d2", "#d5e2ea", "#ecd6d2", "#d7e8d8", "#efe3b8"];

// The big procedural textures are the same in every district: generate them once and keep them.
let shared: ReturnType<typeof makeSharedTextures> | null = null;
function makeSharedTextures() {
  const t = {
    brickStock: T.brickTextures("stock", 1),
    brickRed: T.brickTextures("red", 2),
    render: T.renderTextures(),
    slate: T.slateTextures(),
    pave: T.pavementTextures(),
    asphalt: T.asphaltTextures(),
    windowAtlas: T.windowAtlas(),
    windowDay: T.windowDayAtlas(),
    tiles: T.tileTexture("#6a1a17", "#2a0c0b", 16),
  };
  const mark = (x: unknown) => {
    if (x instanceof THREE.Texture) x.userData.shared = true;
    else if (x && typeof x === "object") Object.values(x).forEach(mark);
  };
  mark(t);
  return t;
}
const sharedTextures = () => (shared ??= makeSharedTextures());

export function buildWorld(areaId: AreaId = "albion"): World {
  const V = AREA_VISUALS[areaId];
  const places = placesIn(areaId);
  const group = new THREE.Group();
  const colliders: AABB[] = [];
  const lights: LightSource[] = [];
  const switchables: Switchable[] = [];
  const animate: World["animate"] = [];
  const r = T.rng(42 + areaId.length * 7);

  // ---------- materials ----------
  const { brickStock, brickRed, render, slate, pave, asphalt, windowAtlas, windowDay, tiles } = sharedTextures();

  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const M = {
    brickStock: std({ map: brickStock.map, normalMap: brickStock.normalMap, roughness: 0.9 }),
    brickRed: std({ map: brickRed.map, normalMap: brickRed.normalMap, roughness: 0.88 }),
    render: std({ map: render.map, normalMap: render.normalMap, roughness: 0.78, vertexColors: true }),
    slate: std({ map: slate.map, normalMap: slate.normalMap, roughness: 0.42, metalness: 0.1 }),
    trim: std({ color: "#e7e3da", roughness: 0.55 }),
    paint: std({ color: "#ffffff", roughness: 0.32, vertexColors: true }),
    matte: std({ color: "#ffffff", roughness: 0.85, vertexColors: true }),
    stone: std({ color: "#7c7a77", roughness: 0.6 }),
    glassDark: std({ color: "#2a3442", roughness: 0.06, metalness: 0.6 }),
    windowDay: std({ map: windowDay, roughness: 0.14, metalness: 0.1 }),
    // by day these show the daytime atlas; at night the lit interior (emissive) takes over
    windowLit: std({ map: windowDay, emissive: "#ffffff", emissiveMap: windowAtlas, emissiveIntensity: 1, roughness: 0.1 }),
    lampGlow: std({ color: "#1a1410", emissive: "#ffc27a", emissiveIntensity: 6, roughness: 0.3 }),
    tiles: std({ map: tiles, roughness: 0.18, metalness: 0.05 }),
    foliage: seeThrough(std({ color: "#46663c", roughness: 0.8, flatShading: true })),
    markWhite: std({ color: "#d9d9d3", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    markYellow: std({ color: "#d6a21e", roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    shelterGlass: std({ color: "#9fb6c6", roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    ground: std({ color: "#15171a", roughness: 1 }),
  };

  const b = new Batcher();
  b.register("brickStock", M.brickStock);
  b.register("brickRed", M.brickRed);
  b.register("render", M.render, { vertexColors: true });
  b.register("slate", M.slate);
  b.register("trim", M.trim);
  b.register("paint", M.paint, { vertexColors: true });
  b.register("matte", M.matte, { vertexColors: true });
  b.register("stone", M.stone);
  b.register("glassDark", M.glassDark, { cast: false });
  b.register("windowDay", M.windowDay, { cast: false });
  b.register("windowLit", M.windowLit, { cast: false });
  b.register("lampGlow", M.lampGlow, { cast: false, receive: false });
  b.register("tiles", M.tiles);
  b.register("foliage", M.foliage);
  b.register("markWhite", M.markWhite, { cast: false });
  b.register("markYellow", M.markYellow, { cast: false });
  b.register("shelterGlass", M.shelterGlass, { cast: false, receive: false });

  // Lit window planes with UVs pointing at one of 4 interiors in the atlas.
  const litPlanes = [0, 1, 2, 3].map((i) => {
    const g = PLANE.clone();
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 4);
    return g;
  });

  // ---------- helpers in plot-local space (facade at z=0, building extends to +z, front faces -z) ----------
  let P = new THREE.Matrix4();
  const plotMatrix = (x: number, side: Side) => (side === "n" ? mat(x, 0, FACADE) : mat(x, 0, -FACADE, 0, Math.PI, 0));
  const toWorld = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyMatrix4(P);
  const box = (key: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, opts: { tile?: number; color?: string; ry?: number } = {}) =>
    b.add(key, BOX, P.clone().multiply(mat(x, y, z, 0, opts.ry ?? 0, 0, sx, sy, sz)), opts);
  const plane = (key: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, color?: string) =>
    b.add(key, geo, P.clone().multiply(mat(x, y, z, 0, Math.PI, 0, sx, sy, 1)), { color });
  const meshAt = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz = 1) => {
    const m = new THREE.Mesh(geo, material);
    m.matrixAutoUpdate = false;
    m.matrix.copy(P.clone().multiply(mat(x, y, z, 0, Math.PI, 0, sx, sy, sz)));
    group.add(m);
    return m;
  };

  const sashWindow = (x: number, y: number, w: number, h: number, lit: boolean) => {
    if (lit) plane("windowLit", litPlanes[Math.floor(r() * 4)], x, y, -0.01, w, h);
    else plane("windowDay", litPlanes[Math.floor(r() * 4)], x, y, -0.01, w, h);
    box("trim", x - w / 2, y, -0.05, 0.08, h + 0.08, 0.1);
    box("trim", x + w / 2, y, -0.05, 0.08, h + 0.08, 0.1);
    box("trim", x, y + h / 2, -0.05, w + 0.08, 0.08, 0.1);
    box("trim", x, y - h / 2, -0.05, w + 0.08, 0.08, 0.1);
    box("trim", x, y, -0.05, w, 0.05, 0.08);
    box("trim", x, y, -0.035, 0.035, h, 0.05);
    box("trim", x, y - h / 2 - 0.07, -0.12, w + 0.3, 0.09, 0.26);
    box("trim", x, y + h / 2 + 0.13, -0.045, w + 0.34, 0.22, 0.1);
  };

  const roofGeo = (() => {
    const v = [
      [0.5, 0, 0], [-0.5, 0, 0], [-0.5, 1, 0.5], [0.5, 0, 0], [-0.5, 1, 0.5], [0.5, 1, 0.5],
      [-0.5, 0, 1], [0.5, 0, 1], [0.5, 1, 0.5], [-0.5, 0, 1], [0.5, 1, 0.5], [-0.5, 1, 0.5],
      [-0.5, 0, 0], [-0.5, 0, 1], [-0.5, 1, 0.5],
      [0.5, 0, 1], [0.5, 0, 0], [0.5, 1, 0.5],
    ].flat();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  })();

  const upperFloors = (wallKey: string, top: number, groundH: number, floors: number, w: number, color?: string) => {
    for (let f = 0; f < floors; f++) {
      const y0 = groundH + f * 3;
      const h = f === floors - 1 && floors > 1 ? 1.45 : 1.75;
      const cols = w > 7 ? [-w / 2 + 1.5, -w / 4 + 0.4, w / 4 - 0.4, w / 2 - 1.5] : [-1.45, 1.45];
      for (const cx of cols) sashWindow(cx, y0 + 1.55, 1.1, h, r() < 0.42);
      if (f < floors - 1) box("trim", 0, y0 + 3, -0.03, w, 0.12, 0.08);
    }
    // cornice
    box("trim", 0, top - 0.2, -0.12, w + 0.04, 0.4, 0.3);
    box(wallKey, 0, top + 0.35, 0.1, w, 0.7, 0.25, { tile: wallKey === "render" ? 3 : T.BRICK_TILE, color });
  };

  const roofAndChimney = (top: number, w: number, depth: number, chimney = true) => {
    const rise = 2.3;
    b.add("slate", roofGeo, P.clone().multiply(mat(0, top + 0.7, -0.3, 0, 0, 0, w + 0.02, rise, depth + 0.6)));
    if (chimney) {
      const cx = -w / 2;
      box("brickStock", cx, top + 0.7 + rise * 0.6, depth / 2, 0.75, rise * 1.2 + 0.6, 1.1, { tile: T.BRICK_TILE });
      box("trim", cx, top + 0.7 + rise * 1.2 + 0.05, depth / 2, 0.85, 0.12, 1.2);
      for (const dz of [-0.3, 0, 0.3]) b.add("matte", CYL_LO, P.clone().multiply(mat(cx, top + 0.7 + rise * 1.2 + 0.32, depth / 2 + dz, 0, 0, 0, 0.2, 0.45, 0.2)), { color: "#8f4527" });
    }
  };

  // ---------- building types ----------
  const DEPTH = 10;

  function house(wallKey: string, color: string | undefined, floors: number, door: string, special?: { number?: string }) {
    const groundH = 3.2;
    const top = groundH + (floors - 1) * 3;
    const tile = wallKey === "render" ? 3 : T.BRICK_TILE;
    box(wallKey, 0, top / 2, DEPTH / 2, PLOT, top, DEPTH, { tile, color });
    if (wallKey !== "render" && r() < 0.35) box("render", 0, groundH / 2, -0.03, PLOT, groundH, 0.08, { tile: 3, color: "#efece4" });
    box("stone", 0, 0.2, -0.04, PLOT, 0.4, 0.1);
    // door
    const dx = 1.6;
    box("paint", dx, KERB_H + 1.15, -0.04, 1.0, 2.2, 0.1, { color: door });
    box("paint", dx, KERB_H + 1.2, -0.1, 0.08, 0.08, 0.06, { color: "#c9a227" }); // knob
    box("paint", dx, KERB_H + 1.55, -0.1, 0.32, 0.06, 0.04, { color: "#c9a227" }); // letterbox
    plane("windowLit", litPlanes[2], dx, KERB_H + 2.5, -0.01, 0.9, 0.42);
    box("trim", dx - 0.62, KERB_H + 1.4, -0.08, 0.18, 2.8, 0.16);
    box("trim", dx + 0.62, KERB_H + 1.4, -0.08, 0.18, 2.8, 0.16);
    box("trim", dx, KERB_H + 2.85, -0.12, 1.5, 0.2, 0.26);
    box("stone", dx, KERB_H + 0.08, -0.3, 1.5, 0.16, 0.45);
    if (special?.number) {
      const tex = T.signTexture({ text: special.number, bg: "#1a1a1a", fg: "#d4af37", w: 128, h: 96, font: "700 {s}px Georgia, serif" });
      meshAt(PLANE, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.25 }), dx, KERB_H + 1.8, -0.1, 0.32, 0.24);
    }
    // ground floor window or bay
    if (r() < 0.5) {
      const bx = -1.2, bw = 2.4, bh = 2.4, bd = 0.7;
      box(wallKey, bx, KERB_H + bh / 2 + 0.3, -bd / 2, bw, bh + 0.6, bd, { tile, color });
      box("trim", bx, KERB_H + bh + 0.65, -bd / 2 - 0.05, bw + 0.2, 0.18, bd + 0.15);
      plane(r() < 0.45 ? "windowLit" : "windowDay", litPlanes[Math.floor(r() * 4)], bx, KERB_H + 1.65, -bd - 0.01, 1.7, 1.7);
      box("trim", bx, KERB_H + 0.75, -bd - 0.08, 1.9, 0.08, 0.2);
      const c = toWorld(bx, 0, -bd / 2);
      colliders.push({ minX: c.x - bw / 2, maxX: c.x + bw / 2, minZ: c.z - bd / 2 - 0.05, maxZ: c.z + bd / 2 + 0.05 });
    } else {
      sashWindow(-1.3, KERB_H + 1.7, 1.3, 1.9, r() < 0.45);
    }
    upperFloors(wallKey, top, groundH, floors - 1, PLOT, color);
    roofAndChimney(top, PLOT, DEPTH);
  }

  function shopfront(spec: ShopSpec, w = PLOT) {
    const glassTex = T.interiorTexture(spec.kind === "empty" ? "generic" : spec.kind, Math.floor(r() * 1000));
    const glass = new THREE.MeshStandardMaterial({ color: "#0a0c0f", emissive: "#ffffff", emissiveMap: glassTex, emissiveIntensity: 1, roughness: 0.05, metalness: 0.2 });
    if (spec.kind === "empty") { glass.emissiveIntensity = 0; glass.color.set("#d9d4c7"); glass.roughness = 0.9; }
    else switchables.push({ material: glass, hours: spec.hours, base: 1.15, day: 0.55 });
    const frameColor = spec.bg;
    const gw = w - 2.4;
    meshAt(PLANE, glass, -0.6, KERB_H + 1.6, -0.02, gw, 2.2);
    meshAt(PLANE, glass, w / 2 - 1.1, KERB_H + 1.25, -0.02, 0.95, 2.3);
    box("paint", -w / 2 + 0.15, KERB_H + 1.7, -0.1, 0.3, 3.4, 0.2, { color: frameColor });
    box("paint", w / 2 - 0.15, KERB_H + 1.7, -0.1, 0.3, 3.4, 0.2, { color: frameColor });
    box("paint", w / 2 - 1.65, KERB_H + 1.4, -0.08, 0.14, 2.8, 0.14, { color: frameColor });
    box("paint", -0.6, KERB_H + 0.3, -0.06, gw, 0.6, 0.12, { color: frameColor });
    box("paint", -0.6, KERB_H + 2.75, -0.06, gw + 0.1, 0.08, 0.1, { color: frameColor });
    box("paint", 0, KERB_H + 3.2, -0.12, w - 0.3, 0.8, 0.2, { color: frameColor });
    box("trim", 0, KERB_H + 3.68, -0.16, w, 0.16, 0.36);
    const signTex = T.signTexture({ text: spec.name, sub: spec.sub, bg: spec.bg, fg: spec.fg, glow: spec.neon ? spec.fg : undefined });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: "#ffffff", emissiveMap: signTex, emissiveIntensity: 0.4, roughness: 0.35 });
    meshAt(PLANE, signMat, 0, KERB_H + 3.2, -0.225, w - 0.5, 0.72);
    if (spec.kind !== "empty") switchables.push({ material: signMat, hours: spec.neon ? spec.hours : [0, 24], base: spec.neon ? 2.6 : 0.9, day: 0.25 });
    if (spec.awning) {
      const at = T.stripeTexture(spec.awning[0], spec.awning[1], 10);
      const am = seeThrough(new THREE.MeshStandardMaterial({ map: at, roughness: 0.7, side: THREE.DoubleSide }));
      const a = new THREE.Mesh(PLANE, am);
      a.matrixAutoUpdate = false;
      a.matrix.copy(P.clone().multiply(mat(0, KERB_H + 2.55, -0.68, -2.03, Math.PI, 0, w - 0.4, 1.5, 1)));
      a.castShadow = true;
      group.add(a);
    }
    if (spec.pole) {
      const pt = T.stripeTexture("#dc2626", "#f8fafc", 6);
      pt.rotation = 0.5;
      const pm = new THREE.MeshStandardMaterial({ map: pt, emissive: "#ffffff", emissiveMap: pt, emissiveIntensity: 0.6, roughness: 0.2 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 16), pm);
      pole.position.copy(toWorld(-w / 2 + 0.6, KERB_H + 2.3, -0.3));
      group.add(pole);
      animate.push((t) => { pt.offset.x = -t * 0.4; });
    }
    if (spec.kind !== "empty") {
      const c = toWorld(-0.3, 1.8, -1.0);
      lights.push({ x: c.x, y: c.y, z: c.z, color: SHOP_LIGHT[spec.kind] ?? "#ffd9a8", intensity: 0.7, range: 9, kind: "shop", placeId: spec.placeId, pool: 3.6, hours: spec.hours });
    }
  }

  function shopBuilding(spec: ShopSpec, wallKey: string, color: string | undefined, floors: number) {
    const groundH = 3.6;
    const top = groundH + (floors - 1) * 3;
    const tile = wallKey === "render" ? 3 : T.BRICK_TILE;
    box(wallKey, 0, top / 2, DEPTH / 2, PLOT, top, DEPTH, { tile, color });
    shopfront(spec);
    upperFloors(wallKey, top, groundH, floors - 1, PLOT, color);
    roofAndChimney(top, PLOT, DEPTH);
  }

  function pub(spec: Extract<Landmark, { kind: "pub" }>, placeId: string) {
    const w = PLOT * 2, floors = 3, groundH = 3.8;
    const top = groundH + (floors - 1) * 3;
    box("brickRed", 0, top / 2, DEPTH / 2, w, top, DEPTH, { tile: T.BRICK_TILE });
    const green = spec.paint;
    box("paint", 0, KERB_H + groundH / 2 - 0.1, -0.08, w, groundH - 0.2, 0.16, { color: green });
    const glassTex = T.interiorTexture("pub", 77);
    const glass = new THREE.MeshStandardMaterial({ color: "#0a0705", emissive: "#ffffff", emissiveMap: glassTex, emissiveIntensity: 1.3, roughness: 0.05, metalness: 0.2 });
    switchables.push({ material: glass, hours: [11, 24], base: 1.4, day: 0.6 });
    for (const gx of [-4.1, 4.1]) {
      meshAt(PLANE, glass, gx, KERB_H + 1.75, -0.17, 3.0, 2.1);
      box("paint", gx, KERB_H + 0.45, -0.2, 3.2, 0.12, 0.1, { color: "#c9a227" });
      box("paint", gx, KERB_H + 2.85, -0.2, 3.2, 0.1, 0.1, { color: "#c9a227" });
      box("paint", gx, KERB_H + 1.75, -0.2, 0.06, 2.1, 0.08, { color: green });
    }
    meshAt(PLANE, glass, 0, KERB_H + 1.3, -0.17, 1.8, 2.4);
    for (const px of [-5.85, -2.4, -1.1, 1.1, 2.4, 5.85]) box("paint", px, KERB_H + 1.8, -0.22, 0.3, 3.4, 0.12, { color: "#0b0f0d" });
    const signTex = T.signTexture({ text: spec.name, sub: spec.sub, bg: spec.paint, fg: spec.gold, border: spec.gold, font: "700 {s}px Georgia, 'Times New Roman', serif" });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: "#ffffff", emissiveMap: signTex, emissiveIntensity: 0.5, roughness: 0.3 });
    meshAt(PLANE, signMat, 0, KERB_H + 3.55, -0.2, w - 0.6, 0.8);
    switchables.push({ material: signMat, hours: [0, 24], base: 1.0, day: 0.2 });
    // lanterns
    for (const lx of [-2.4, 2.4]) {
      box("paint", lx, KERB_H + 2.95, -0.45, 0.06, 0.06, 0.5, { color: "#111" });
      box("lampGlow", lx, KERB_H + 2.75, -0.7, 0.26, 0.36, 0.26);
      box("paint", lx, KERB_H + 2.98, -0.7, 0.34, 0.08, 0.34, { color: "#111" });
      const c = toWorld(lx, KERB_H + 2.75, -0.8);
      lights.push({ x: c.x, y: c.y, z: c.z, color: "#ffb05a", intensity: 0.8, range: 8, kind: "shop", placeId, pool: 3, hours: [11, 24] });
    }
    // hanging pub sign
    if (spec.hangingSign) {
    const hsTex = (() => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 320;
      const g = c.getContext("2d")!;
      g.fillStyle = "#0f3d2e"; g.fillRect(0, 0, 256, 320);
      g.strokeStyle = "#c9a227"; g.lineWidth = 10; g.strokeRect(8, 8, 240, 304);
      g.fillStyle = "#e5c158";
      g.beginPath(); g.moveTo(68, 120); g.lineTo(88, 70); g.lineTo(108, 105); g.lineTo(128, 60); g.lineTo(148, 105); g.lineTo(168, 70); g.lineTo(188, 120); g.closePath(); g.fill();
      g.fillRect(68, 120, 120, 18);
      g.fillStyle = "#b91c1c";
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(128 + Math.cos(i) * 22, 205 + Math.sin(i) * 22, 22, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#7f1d1d"; g.beginPath(); g.arc(128, 205, 16, 0, Math.PI * 2); g.fill();
      return T.toTexture(c, true, false);
    })();
    const hs = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.95), [
      new THREE.MeshStandardMaterial({ map: hsTex }), new THREE.MeshStandardMaterial({ map: hsTex }),
      M.paint, M.paint, M.paint, M.paint,
    ]);
    hs.position.copy(toWorld(-w / 2 + 0.6, groundH + 1.2, -0.9));
    hs.castShadow = true;
    group.add(hs);
    box("paint", -w / 2 + 0.6, groundH + 1.95, -0.6, 0.06, 0.06, 1.2, { color: "#111" });
    }
    // hanging baskets
    for (const hx of [-5.2, -0.9, 3.3]) {
      b.add("foliage", SPHERE, P.clone().multiply(mat(hx, KERB_H + 3.15, -0.55, 0, 0, 0, 0.55, 0.4, 0.55)));
      for (let k = 0; k < 6; k++) b.add("paint", SPHERE, P.clone().multiply(mat(hx + (r() - 0.5) * 0.45, KERB_H + 3.1 + (r() - 0.5) * 0.3, -0.55 + (r() - 0.5) * 0.45, 0, 0, 0, 0.12, 0.12, 0.12)), { color: r() < 0.5 ? "#ec4899" : "#a855f7" });
    }
    upperFloors("brickRed", top, groundH, floors - 1, w);
    roofAndChimney(top, w, DEPTH);
  }

  function station(name: string, placeId: string) {
    const w = PLOT * 3, h = 8.4;
    box("tiles", 0, h / 2, DEPTH / 2, w, h, DEPTH, { tile: 1.2 });
    box("tiles", 0, h + 0.3, -0.1, w + 0.2, 0.6, 0.4, { tile: 1.2 });
    const glassTex = T.interiorTexture("station", 5);
    const glass = new THREE.MeshStandardMaterial({ color: "#0c0b09", emissive: "#ffffff", emissiveMap: glassTex, emissiveIntensity: 1.4, roughness: 0.1 });
    switchables.push({ material: glass, hours: [0, 24], base: 0.6, day: 0.35 });
    const disc = new THREE.CircleGeometry(0.5, 24, 0, Math.PI);
    for (const ax of [-6, 0, 6]) {
      meshAt(PLANE, glass, ax, KERB_H + 1.6, -0.02, 3.6, 3.2);
      box("paint", ax, KERB_H + 3.3, -0.1, 3.9, 0.18, 0.2, { color: "#3b0a0a" });
      for (const sx of [-1.9, 1.9]) box("paint", ax + sx, KERB_H + 1.65, -0.1, 0.18, 3.3, 0.2, { color: "#3b0a0a" });
      // arched first-floor window
      plane("windowDay", litPlanes[1], ax, 5.6, -0.01, 2.6, 2.0);
      b.add("glassDark", disc, P.clone().multiply(mat(ax, 6.6, -0.01, 0, Math.PI, 0, 2.6, 2.6, 1)));
      box("trim", ax, 4.55, -0.12, 3.0, 0.12, 0.25);
      box("paint", ax, 5.6, -0.04, 0.06, 2.0, 0.06, { color: "#2a0a0a" });
    }
    const signTex = T.signTexture({ text: name, sub: "UNDERGROUND STATION", bg: "#10215e", fg: "#ffffff" });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: "#ffffff", emissiveMap: signTex, emissiveIntensity: 1.1, roughness: 0.3 });
    meshAt(PLANE, signMat, 0, KERB_H + 3.85, -0.18, w - 1.0, 0.85);
    switchables.push({ material: signMat, hours: [0, 24], base: 1.6, day: 0.4 });
    box("paint", 0, KERB_H + 3.85, -0.12, w - 0.8, 1.0, 0.1, { color: "#0b1844" });
    const c = toWorld(0, 2, -1.5);
    lights.push({ x: c.x, y: c.y, z: c.z, color: SHOP_LIGHT.station, intensity: 0.8, range: 12, kind: "shop", placeId, pool: 6 });
  }

  function jobCentre() {
    const w = PLOT * 2, floors = 3, top = 3.8 + 2 * 3.2;
    box("matte", 0, top / 2, DEPTH / 2, w, top, DEPTH, { color: "#8c8f93" });
    const glassTex = T.interiorTexture("jobcentre", 9);
    const glass = new THREE.MeshStandardMaterial({ color: "#0b0d10", emissive: "#ffffff", emissiveMap: glassTex, emissiveIntensity: 1, roughness: 0.05, metalness: 0.3 });
    switchables.push({ material: glass, hours: [9, 17], base: 1.1, day: 0.6 });
    meshAt(PLANE, glass, -1, KERB_H + 1.5, -0.02, w - 3, 2.6);
    meshAt(PLANE, glass, w / 2 - 0.9, KERB_H + 1.2, -0.02, 1.2, 2.3);
    for (let f = 1; f < floors; f++) {
      plane(r() < 0.5 ? "windowLit" : "windowDay", litPlanes[1], 0, 3.8 + (f - 1) * 3.2 + 1.7, -0.01, w - 1, 1.3);
      box("matte", 0, 3.8 + (f - 1) * 3.2 + 0.85, -0.12, w, 0.4, 0.25, { color: "#6f7276" });
    }
    const signTex = T.signTexture({ text: "Job Centre", sub: "Employment · Benefits · Advice", bg: "#00703c", fg: "#ffffff", font: "700 {s}px 'Inter', Arial, sans-serif" });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: "#ffffff", emissiveMap: signTex, emissiveIntensity: 0.5, roughness: 0.3 });
    meshAt(PLANE, signMat, -1, KERB_H + 3.3, -0.12, 6, 0.8);
    switchables.push({ material: signMat, hours: [0, 24], base: 0.8, day: 0.2 });
    box("matte", 0, top + 0.4, 0.1, w, 0.8, 0.3, { color: "#7a7d81" });
    const c = toWorld(-1, 2, -1.2);
    lights.push({ x: c.x, y: c.y, z: c.z, color: SHOP_LIGHT.jobcentre, intensity: 0.6, range: 9, kind: "shop", placeId: "jobcentre", pool: 4, hours: [9, 17] });
  }

  function gym(spec: Extract<Landmark, { kind: "gym" }>, placeId: string) {
    const w = PLOT * 2, top = 8.2;
    box("matte", 0, top / 2, DEPTH / 2, w, top, DEPTH, { color: "#1b1c20" });
    const glassTex = T.interiorTexture("gym", 21);
    const glass = new THREE.MeshStandardMaterial({ color: "#09060a", emissive: "#ffffff", emissiveMap: glassTex, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.3 });
    switchables.push({ material: glass, hours: [6, 23], base: 1.3, day: 0.7 });
    meshAt(PLANE, glass, -0.5, KERB_H + 1.6, -0.02, w - 2.5, 2.8);
    meshAt(PLANE, glass, 0, 5.6, -0.02, w - 1, 2.6);
    meshAt(PLANE, glass, w / 2 - 0.8, KERB_H + 1.2, -0.02, 1.1, 2.3);
    const neonTex = T.signTexture({ text: spec.name, sub: spec.sub, bg: "#000000", fg: spec.neon, glow: spec.neon });
    const neonMat = new THREE.MeshStandardMaterial({ map: neonTex, emissive: "#ffffff", emissiveMap: neonTex, emissiveIntensity: 3, roughness: 0.4 });
    meshAt(PLANE, neonMat, 0, KERB_H + 3.6, -0.06, w - 1.5, 1.0);
    switchables.push({ material: neonMat, hours: [6, 23], base: 3.2, day: 0.8 });
    const c = toWorld(0, 3, -1.2);
    lights.push({ x: c.x, y: c.y, z: c.z, color: spec.neon, intensity: 1.1, range: 11, kind: "neon", placeId, pool: 5, hours: [6, 23] });
  }

  // ---------- district landmarks ----------
  let lobbyMat: THREE.MeshStandardMaterial | null = null;
  const lobby = () => {
    if (!lobbyMat) {
      lobbyMat = new THREE.MeshStandardMaterial({ color: "#0b0d10", emissive: "#ffffff", emissiveMap: T.interiorTexture("bank", 31), emissiveIntensity: 1, roughness: 0.05, metalness: 0.3 });
      switchables.push({ material: lobbyMat, hours: [7, 21], base: 0.75, day: 0.28 });
    }
    return lobbyMat;
  };
  const pick = <X,>(a: X[]) => a[Math.floor(r() * a.length)];

  // City office: glass curtain wall or stone with punched windows, lit lobby at street level.
  function office(floors: number) {
    const w = PLOT, glassy = r() < 0.55;
    const body = glassy ? pick(["#3c4a5c", "#4a5568", "#2f3b4a", "#56606b"]) : pick(["#cfc7b6", "#bdb4a2", "#d9d3c6", "#a8a093"]);
    const trimC = glassy ? "#20262e" : "#8e8677";
    const groundH = 4.6, fh = 3.6, top = groundH + floors * fh;
    box("matte", 0, top / 2, DEPTH / 2, w, top, DEPTH, { color: body });
    meshAt(PLANE, lobby(), 0, KERB_H + 2.0, -0.02, w - 1.2, 3.4);
    box("matte", 0, groundH, -0.15, w, 0.5, 0.3, { color: trimC });
    for (let f = 0; f < floors; f++) {
      const y0 = groundH + f * fh;
      if (glassy) {
        plane(r() < 0.5 ? "windowLit" : "windowDay", litPlanes[1], 0, y0 + fh * 0.55, -0.01, w - 0.3, fh - 0.55);
      } else {
        for (const cx of [-1.9, 0, 1.9]) {
          plane(r() < 0.45 ? "windowLit" : "windowDay", litPlanes[Math.floor(r() * 4)], cx, y0 + fh * 0.55, -0.01, 1.15, 2.0);
          box("matte", cx, y0 + fh * 0.55 - 1.06, -0.1, 1.35, 0.1, 0.2, { color: trimC });
        }
      }
      box("matte", 0, y0, -0.07, w, 0.28, 0.14, { color: trimC });
    }
    if (glassy) for (let i = 0; i <= 4; i++) box("matte", -w / 2 + i * (w / 4), groundH + (top - groundH) / 2, -0.09, 0.09, top - groundH, 0.16, { color: trimC });
    box("matte", 0, top + 0.45, 0.2, w + 0.1, 0.9, 0.4, { color: trimC });
  }

  function tower(spec: Extract<Landmark, { kind: "tower" }>, placeId: string) {
    const w = PLOT * 3, groundH = 7.5, fh = 3.6, top = groundH + spec.floors * fh;
    box("matte", 0, top / 2, DEPTH / 2, w, top, DEPTH, { color: "#2f3b4a" });
    box("matte", 0, groundH / 2, -0.05, w, groundH, 0.3, { color: "#d6cfbf" });
    for (const cx of [-7.6, -4.6, 4.6, 7.6]) box("trim", cx, groundH / 2, -0.5, 0.9, groundH - 0.4, 0.7);
    const t = T.interiorTexture("bank", 91);
    const glass = new THREE.MeshStandardMaterial({ color: "#0b0d10", emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 1, roughness: 0.05, metalness: 0.3 });
    switchables.push({ material: glass, hours: [7, 21], base: 0.85, day: 0.32 });
    meshAt(PLANE, glass, 0, KERB_H + 2.6, -0.22, 7.6, 4.8);
    for (const cx of [-6.1, 6.1]) meshAt(PLANE, glass, cx, KERB_H + 2.2, -0.22, 2.0, 4.0);
    const signTex = T.signTexture({ text: spec.name, sub: spec.sub, bg: "#0b0b0b", fg: "#d4af37", font: "700 {s}px Georgia, 'Times New Roman', serif" });
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: "#ffffff", emissiveMap: signTex, emissiveIntensity: 0.6, roughness: 0.3 });
    meshAt(PLANE, signMat, 0, groundH - 1.0, -0.25, 9.5, 1.1);
    switchables.push({ material: signMat, hours: [0, 24], base: 1.3, day: 0.3 });
    for (let f = 0; f < spec.floors; f++) {
      const y0 = groundH + f * fh;
      plane(r() < 0.55 ? "windowLit" : "windowDay", litPlanes[1], 0, y0 + fh * 0.55, -0.01, w - 0.6, fh - 0.6);
      box("matte", 0, y0, -0.07, w, 0.3, 0.14, { color: "#1b222b" });
    }
    for (let i = 0; i <= 12; i++) box("matte", -w / 2 + i * (w / 12), groundH + (top - groundH) / 2, -0.09, 0.1, top - groundH, 0.18, { color: "#1b222b" });
    box("matte", 0, top + 1.5, 0.6, w - 2, 3, DEPTH - 1.2, { color: "#1b222b" });
    const c = toWorld(0, 2.4, -1.4);
    lights.push({ x: c.x, y: c.y, z: c.z, color: "#fff2d6", intensity: 1.0, range: 12, kind: "shop", placeId, pool: 6, hours: [7, 21] });
  }

  function club(spec: Extract<Landmark, { kind: "club" }>, placeId: string) {
    const w = PLOT * 2, top = 3.8 + 2 * 3.1;
    box("matte", 0, top / 2, DEPTH / 2, w, top, DEPTH, { color: "#141416" });
    for (let f = 0; f < 2; f++) for (const cx of [-4, -1.4, 1.4, 4]) plane("glassDark", PLANE, cx, 3.8 + f * 3.1 + 1.5, -0.01, 1.5, 1.9);
    const door = new THREE.MeshStandardMaterial({ color: "#050307", emissive: "#ffffff", emissiveMap: T.interiorTexture("club", 55), emissiveIntensity: 1.2, roughness: 0.1 });
    switchables.push({ material: door, hours: spec.hours, base: 1.5, day: 0.15 });
    meshAt(PLANE, door, 0, KERB_H + 1.35, -0.02, 2.4, 2.7);
    box("paint", 0, KERB_H + 3.05, -1.0, 5.4, 0.22, 2.0, { color: "#0a0a0a" });
    for (let i = 0; i < 9; i++) box("lampGlow", -2.4 + i * 0.6, KERB_H + 2.9, -1.95, 0.12, 0.12, 0.12);
    const neonTex = T.signTexture({ text: spec.name, sub: spec.sub, bg: "#000000", fg: spec.neon, glow: spec.neon });
    const neon = new THREE.MeshStandardMaterial({ map: neonTex, emissive: "#ffffff", emissiveMap: neonTex, emissiveIntensity: 3, roughness: 0.4 });
    meshAt(PLANE, neon, 0, KERB_H + 4.5, -0.06, w - 1.6, 1.3);
    switchables.push({ material: neon, hours: spec.hours, base: 3.4, day: 0.6 });
    // velvet-rope queue on the pavement
    for (let i = 0; i < 4; i++) {
      b.add("paint", CYL_LO, P.clone().multiply(mat(3.0 + i * 1.3, KERB_H + 0.5, -2.2, 0, 0, 0, 0.09, 1.0, 0.09)), { color: "#d4af37" });
      if (i < 3) b.add("paint", BOX, P.clone().multiply(mat(3.65 + i * 1.3, KERB_H + 0.85, -2.2, 0, 0, 0, 1.2, 0.05, 0.05)), { color: "#9f1239" });
    }
    const q0 = toWorld(2.9, 0, -2.3), q1 = toWorld(7.1, 0, -2.1);
    colliders.push({ minX: Math.min(q0.x, q1.x), maxX: Math.max(q0.x, q1.x), minZ: Math.min(q0.z, q1.z), maxZ: Math.max(q0.z, q1.z) });
    const c = toWorld(0, 3, -1.4);
    lights.push({ x: c.x, y: c.y, z: c.z, color: spec.neon, intensity: 1.3, range: 12, kind: "neon", placeId, pool: 6, hours: spec.hours });
  }

  function theatre(spec: Extract<Landmark, { kind: "theatre" }>, placeId: string) {
    const w = PLOT * 2, top = 15;
    box("render", 0, top / 2, DEPTH / 2, w, top, DEPTH, { tile: 3, color: "#e9dfc9" });
    for (const cx of [-5.2, -1.8, 1.8, 5.2]) box("trim", cx, 10.0, -0.25, 0.7, 8.6, 0.5);
    for (const cx of [-3.5, 3.5]) { sashWindow(cx, 8.0, 1.5, 2.6, r() < 0.6); sashWindow(cx, 11.6, 1.5, 2.2, r() < 0.6); }
    box("trim", 0, top - 0.3, -0.25, w + 0.2, 0.6, 0.6);
    const nameTex = T.signTexture({ text: spec.name, bg: "#1a1206", fg: "#f5c96a", border: "#f5c96a", font: "700 {s}px Georgia, 'Times New Roman', serif" });
    const nameMat = new THREE.MeshStandardMaterial({ map: nameTex, emissive: "#ffffff", emissiveMap: nameTex, emissiveIntensity: 1, roughness: 0.3 });
    meshAt(PLANE, nameMat, 0, top - 1.7, -0.3, 7.5, 1.2);
    switchables.push({ material: nameMat, hours: [0, 24], base: 1.8, day: 0.3 });
    const doors = new THREE.MeshStandardMaterial({ color: "#0b0805", emissive: "#ffffff", emissiveMap: T.interiorTexture("theatre", 66), emissiveIntensity: 1, roughness: 0.1 });
    switchables.push({ material: doors, hours: [10, 24], base: 1.3, day: 0.6 });
    for (const cx of [-3.6, 0, 3.6]) meshAt(PLANE, doors, cx, KERB_H + 1.4, -0.02, 2.4, 2.8);
    box("paint", 0, KERB_H + 3.6, -1.2, w - 0.6, 1.1, 2.4, { color: "#5a0e14" });
    const showTex = T.signTexture({ text: spec.show, bg: "#0b0b0b", fg: "#ffffff" });
    const showMat = new THREE.MeshStandardMaterial({ map: showTex, emissive: "#ffffff", emissiveMap: showTex, emissiveIntensity: 1.5, roughness: 0.3 });
    meshAt(PLANE, showMat, 0, KERB_H + 3.6, -2.42, w - 1.4, 0.8);
    switchables.push({ material: showMat, hours: [0, 24], base: 2.2, day: 0.6 });
    for (let i = 0; i < 26; i++) {
      const bx = -w / 2 + 0.6 + (i * (w - 1.2)) / 25;
      box("lampGlow", bx, KERB_H + 4.2, -2.43, 0.1, 0.1, 0.06);
      box("lampGlow", bx, KERB_H + 3.0, -2.43, 0.1, 0.1, 0.06);
    }
    const c = toWorld(0, 2.6, -1.6);
    lights.push({ x: c.x, y: c.y, z: c.z, color: "#ffd18a", intensity: 1.3, range: 13, kind: "shop", placeId, pool: 7, hours: [10, 24] });
  }

  // Market stalls on the pavement, counters facing the walkway by the shops.
  function market(p: Place) {
    P = new THREE.Matrix4();
    const dir = p.side === "n" ? 1 : -1;
    const zc = dir * 7.25;
    const colourways: [string, string][] = [["#dc2626", "#fef2f2"], ["#2563eb", "#eff6ff"], ["#16a34a", "#f0fdf4"], ["#9333ea", "#faf5ff"]];
    const goods = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#e5e7eb", "#111827", "#ec4899", "#a16207"];
    for (let i = 0; i < 4; i++) {
      const cx = p.x - 6 + i * 4;
      for (const ox of [-1.4, 1.4]) for (const oz of [-0.65, 0.65]) box("paint", cx + ox, KERB_H + 1.2, zc + oz, 0.08, 2.4, 0.08, { color: "#2b2b2b" });
      box("paint", cx, KERB_H + 0.45, zc + dir * 0.2, 2.8, 0.9, 0.9, { color: "#7a5230" });
      for (let k = 0; k < 8; k++) box("paint", cx - 1.2 + (k % 4) * 0.8 + r() * 0.2, KERB_H + 0.98, zc + dir * (k < 4 ? 0 : 0.35), 0.35, 0.18 + r() * 0.2, 0.25, { color: pick(goods) });
      const am = seeThrough(new THREE.MeshStandardMaterial({ map: T.stripeTexture(colourways[i][0], colourways[i][1], 8), roughness: 0.7, side: THREE.DoubleSide }));
      const canopy = new THREE.Mesh(PLANE, am);
      canopy.position.set(cx, KERB_H + 2.45, zc);
      canopy.rotation.set(-Math.PI / 2 + dir * 0.18, 0, 0);
      canopy.scale.set(3.1, 1.7, 1);
      canopy.castShadow = true;
      group.add(canopy);
      for (let k = 0; k < 6; k++) box("lampGlow", cx - 1.25 + k * 0.5, KERB_H + 2.25, zc + dir * 0.78, 0.1, 0.1, 0.1);
      colliders.push({ minX: cx - 1.45, maxX: cx + 1.45, minZ: zc - 0.7, maxZ: zc + 0.7 });
      lights.push({ x: cx, y: KERB_H + 2.2, z: zc + dir * 0.6, color: "#ffcf8a", intensity: 0.5, range: 7, kind: "shop", placeId: p.id, pool: 3, hours: p.hours });
    }
  }

  // ---------- lay out both sides ----------
  const placeAt = new Map<string, string>();
  for (const p of places) if (p.plots > 0) {
    const first = p.x - ((p.plots - 1) * PLOT) / 2;
    for (let k = 0; k < p.plots; k++) placeAt.set(`${p.side}:${first + k * PLOT}`, k === 0 ? p.id : "_");
  }
  const decorAt = new Map(V.decor.map((d) => [`${d.side}:${d.x}`, d]));
  const fillers = [...V.fillerShops].sort(() => r() - 0.5);
  let nextFiller = 0;
  const door = () => DOOR_COLORS[Math.floor(r() * DOOR_COLORS.length)];

  // Ordinary buildings between the landmarks, in this district's style.
  function filler(style: { wall: string; color: string | undefined; floors: number }) {
    switch (V.style) {
      case "terrace": house(style.wall, style.color, style.floors, door()); break;
      case "city":
        if (r() < 0.65) office(5 + Math.floor(r() * 8));
        else house("render", pick(STONE), 5, "#111111");
        break;
      case "soho":
        if (fillers.length && r() < 0.8) shopBuilding(fillers[nextFiller++ % fillers.length], style.wall, style.color, 4);
        else house(style.wall, style.color, 4, door());
        break;
      case "market":
        if (fillers.length && r() < 0.8) shopBuilding(fillers[nextFiller++ % fillers.length], "render", pick(BRIGHT), r() < 0.5 ? 2 : 3);
        else house("render", pick(BRIGHT), 3, door());
        break;
    }
  }

  for (const side of ["n", "s"] as Side[]) {
    let runLeft = 0;
    let style = { wall: "brickStock", color: undefined as string | undefined, floors: 3 };
    for (let x = -STREET_X; x <= STREET_X; x += PLOT) {
      if (runLeft <= 0) {
        runLeft = 2 + Math.floor(r() * 4);
        const roll = r();
        style = {
          wall: roll < 0.5 ? "brickStock" : roll < 0.75 ? "brickRed" : "render",
          color: roll >= 0.75 ? (V.style === "soho" ? pick(["#2b2d42", "#3d405b", "#5c3d2e", "#e8e1d4"]) : RENDER_COLORS[Math.floor(r() * RENDER_COLORS.length)]) : undefined,
          floors: r() < 0.15 ? 4 : r() < 0.25 ? 2 : 3,
        };
      }
      runLeft--;
      const key = `${side}:${x}`;
      const placeId = placeAt.get(key);
      if (placeId === "_") continue;
      const place = placeId ? places.find((p) => p.id === placeId)! : null;
      const cx = place ? place.x : x;
      P = plotMatrix(cx, side);
      const lm = placeId ? V.landmarks[placeId] : undefined;
      if (lm && placeId) {
        if (lm.kind === "station") station(lm.name, placeId);
        else if (lm.kind === "pub") pub(lm, placeId);
        else if (lm.kind === "jobcentre") jobCentre();
        else if (lm.kind === "gym") gym(lm, placeId);
        else if (lm.kind === "flat") house("brickStock", undefined, 3, "#9b1c1c", { number: "27" });
        else if (lm.kind === "tower") tower(lm, placeId);
        else if (lm.kind === "club") club(lm, placeId);
        else if (lm.kind === "theatre") theatre(lm, placeId);
      } else if (placeId && V.shops[placeId]) shopBuilding(V.shops[placeId], style.wall, style.color, Math.max(2, style.floors));
      else if (decorAt.has(key)) shopBuilding(decorAt.get(key)!, style.wall, style.color, Math.max(2, style.floors));
      else filler(style);
    }
    const zMin = side === "n" ? FACADE : -FACADE - DEPTH;
    colliders.push({ minX: -STREET_X - 10, maxX: STREET_X + 10, minZ: zMin, maxZ: zMin + DEPTH });
  }
  for (const p of places) if (V.landmarks[p.id]?.kind === "market") market(p);

  // ---------- back rows (fill the view behind the street) ----------
  P = new THREE.Matrix4();
  for (const sz of [1, -1]) {
    for (let x = -160; x < 160; ) {
      const [h0, h1] = V.backRow;
      const w = 10 + r() * 16, h = h0 + r() * (h1 - h0), d = 10 + r() * 6;
      const z = sz * (24 + r() * 8 + d / 2);
      const tall = V.style === "city";
      if (tall) box("matte", x + w / 2, h / 2, z, w, h, d, { color: pick(["#3c4a5c", "#4a5568", "#2f3b4a", "#5b6470", "#8c8577"]) });
      else box(V.style === "market" ? "render" : r() < 0.6 ? "brickStock" : "brickRed", x + w / 2, h / 2, z, w, h, d, { tile: V.style === "market" ? 3 : T.BRICK_TILE, color: V.style === "market" ? pick(BRIGHT) : undefined });
      const faceZ = z - sz * (d / 2 + 0.02);
      for (let wy = 2; wy < h - 1; wy += tall ? 3.6 : 3) for (let wx = x + 1.2; wx < x + w - 1; wx += 2.2) {
        if (r() < (tall ? 0.45 : 0.35)) b.add("windowLit", litPlanes[Math.floor(r() * 4)], mat(wx, wy, faceZ, 0, sz > 0 ? Math.PI : 0, 0, 1, 1.4, 1));
      }
      x += w + r() * 2;
    }
  }

  // ---------- ground, road, pavements ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = std({
    map: asphalt.map, normalMap: asphalt.normalMap, roughnessMap: asphalt.roughnessMap,
    roughness: 1, metalness: 0.05, normalScale: new THREE.Vector2(0.6, 0.6),
  });
  const roadGeo = new THREE.PlaneGeometry(STREET_X * 2 + 40, ROAD_HALF * 2).rotateX(-Math.PI / 2);
  setWorldUV(roadGeo, T.ROAD_TILE);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = true;
  group.add(road);

  const paveMat = std({
    map: pave.map, normalMap: pave.normalMap, roughnessMap: pave.roughnessMap,
    roughness: 1, normalScale: new THREE.Vector2(0.8, 0.8),
  });
  for (const sz of [1, -1]) {
    const g = new THREE.BoxGeometry(STREET_X * 2 + 40, KERB_H, FACADE - ROAD_HALF).translate(0, KERB_H / 2, sz * (ROAD_HALF + FACADE) / 2);
    setWorldUV(g, T.PAVE_TILE);
    const m = new THREE.Mesh(g, paveMat);
    m.receiveShadow = true;
    group.add(m);
    b.add("stone", BOX, mat(0, KERB_H / 2 + 0.003, sz * (ROAD_HALF + 0.15), 0, 0, 0, STREET_X * 2 + 40, KERB_H + 0.006, 0.3));
  }

  // ---------- road markings ----------
  const Y = 0.004;
  const mark = (key: string, x: number, z: number, sx: number, sz: number, ry = 0) =>
    b.add(key, BOX, mat(x, Y, z, 0, ry, 0, sx, 0.008, sz));
  for (let x = -STREET_X; x < STREET_X; x += 9) {
    if (Math.abs(x + 2 - ZEBRA_X) < 13) continue;
    mark("markWhite", x + 2, 0, 4, 0.12);
  }
  const busBox = [BUS_STOP_X - 8, BUS_STOP_X + 8];
  for (const sz of [1, -1]) for (const off of [5.62, 5.78]) {
    // double yellows, broken for the bus stop box (south) and parking bays
    const gaps: [number, number][] = sz < 0 ? [busBox as [number, number], [20, 30], [50, 61]] : [[-62, -48], [38, 50], [62, 78]];
    let start = -STREET_X;
    for (const [g0, g1] of [...gaps, [STREET_X, STREET_X]]) {
      if (g0 > start) mark("markYellow", (start + g0) / 2, sz * off, g0 - start, 0.08);
      start = g1;
    }
  }
  for (let k = 0; k < 12; k++) mark("markWhite", ZEBRA_X, -5.5 + k, 3, 0.5);
  for (const dir of [-1, 1]) {
    for (const zz of [-5.3, -0.25, 0.25, 5.3]) {
      for (let i = 0; i < 9; i++) {
        const x0 = ZEBRA_X + dir * (2 + i);
        const zA = zz + (i % 2 ? 0.25 : -0.25) * (zz > 0 ? 1 : -1) * 0.6;
        const zB = zz + (i % 2 ? -0.25 : 0.25) * (zz > 0 ? 1 : -1) * 0.6;
        const len = Math.hypot(1, zB - zA);
        mark("markWhite", x0 + dir * 0.5, (zA + zB) / 2, len, 0.1, -Math.atan2(zB - zA, dir));
      }
    }
  }
  // bus stop box
  mark("markYellow", BUS_STOP_X, -3.9, 16, 0.12);
  mark("markYellow", busBox[0], -4.85, 0.12, 2);
  mark("markYellow", busBox[1], -4.85, 0.12, 2);
  {
    const tex = T.signTexture({ text: "BUS STOP", bg: "rgba(0,0,0,0)", fg: "#d6a21e", w: 512, h: 128 });
    const m = new THREE.Mesh(PLANE, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5, depthWrite: false }));
    m.rotation.set(-Math.PI / 2, 0, 0);
    m.position.set(BUS_STOP_X, 0.01, -4.8);
    m.scale.set(6, 1.4, 1);
    group.add(m);
  }

  // ---------- street furniture ----------
  P = new THREE.Matrix4();
  const black = "#121212";
  const circleCollider = (x: number, z: number, rad: number) => colliders.push({ minX: x - rad, maxX: x + rad, minZ: z - rad, maxZ: z + rad });

  const lamp = (x: number, z: number) => {
    const y0 = KERB_H;
    b.add("paint", CYL, mat(x, y0 + 0.3, z, 0, 0, 0, 0.36, 0.6, 0.36), { color: black });
    b.add("paint", CYL_LO, mat(x, y0 + 2.6, z, 0, 0, 0, 0.14, 4.2, 0.14), { color: black });
    b.add("paint", BOX, mat(x, y0 + 4.72, z, 0, 0, 0, 0.5, 0.08, 0.08), { color: black });
    b.add("lampGlow", BOX, mat(x, y0 + 5.0, z, 0, Math.PI / 4, 0, 0.34, 0.5, 0.34));
    b.add("paint", CYL_LO, mat(x, y0 + 5.32, z, 0, Math.PI / 8, 0, 0.55, 0.14, 0.55), { color: black });
    b.add("paint", SPHERE, mat(x, y0 + 5.47, z, 0, 0, 0, 0.12, 0.16, 0.12), { color: black });
    lights.push({ x, y: y0 + 5.0, z, color: "#ffb36b", intensity: 1, range: 15, kind: "lamp", pool: 6.5 });
    circleCollider(x, z, 0.22);
  };
  for (let x = -STREET_X + 6; x <= STREET_X; x += 18) lamp(x, 6.5);
  for (let x = -STREET_X + 15; x <= STREET_X; x += 18) lamp(x, -6.5);

  const isClear = (x: number, z: number) => (V.clear ?? []).some(([x0, x1, side]) => x >= x0 && x <= x1 && (side === "n") === z > 0);
  const tree = (x: number, z: number) => {
    if (isClear(x, z)) return;
    b.add("matte", CYL_LO, mat(x, KERB_H + 1.8, z, 0, 0, 0, 0.3, 3.6, 0.3), { color: "#5b5348" });
    b.add("paint", BOX, mat(x, KERB_H + 0.01, z, 0, 0, 0, 1.1, 0.02, 1.1), { color: "#1d1d1d" });
    for (let k = 0; k < 4; k++) {
      const s = 2.2 + r() * 1.2;
      b.add("foliage", new THREE.IcosahedronGeometry(0.5, 1), mat(x + (r() - 0.5) * 1.8, KERB_H + 4.6 + r() * 1.6, z + (r() - 0.5) * 1.8, r(), r(), r(), s, s * 0.8, s));
    }
    circleCollider(x, z, 0.3);
  };
  for (const x of [-105, -69, -33, 3, 39, 75, 111]) tree(x, 7.0);
  for (const x of [-96, -60, -24, 30, 48, 102]) tree(x, -7.0);

  const bin = (x: number, z: number) => {
    if (isClear(x, z)) return;
    b.add("paint", CYL, mat(x, KERB_H + 0.45, z, 0, 0, 0, 0.55, 0.9, 0.55), { color: "#1a1a1a" });
    b.add("paint", CYL, mat(x, KERB_H + 0.92, z, 0, 0, 0, 0.6, 0.06, 0.6), { color: "#c9a227" });
    circleCollider(x, z, 0.3);
  };
  for (const [x, z] of [[-21, 6.9], [18, 6.9], [45, 6.9], [-36, -6.9], [16, -6.9], [60, -6.9]]) bin(x, z);

  // Phone box
  {
    const x = -9, z = 6.95, red = "#c8102e";
    b.add("paint", BOX, mat(x, KERB_H + 1.25, z, 0, 0, 0, 1.0, 2.5, 1.0), { color: red });
    b.add("paint", BOX, mat(x, KERB_H + 2.6, z, 0, 0, 0, 1.1, 0.22, 1.1), { color: red });
    b.add("paint", CYL, mat(x, KERB_H + 2.75, z, Math.PI / 2, 0, 0, 1.05, 1.1, 0.25), { color: red });
    for (const [ox, oz, ry] of [[0, -0.51, 0], [0, 0.51, Math.PI], [-0.51, 0, Math.PI / 2], [0.51, 0, -Math.PI / 2]]) {
      b.add("windowLit", litPlanes[1], mat(x + ox, KERB_H + 1.3, z + oz, 0, ry + Math.PI, 0, 0.7, 1.6, 1));
      for (let k = 0; k < 3; k++) b.add("paint", BOX, mat(x + ox * 1.02, KERB_H + 0.8 + k * 0.5, z + oz * 1.02, 0, ry, 0, 0.72, 0.05, 0.03), { color: red });
    }
    const tex = T.signTexture({ text: "TELEPHONE", bg: "#111", fg: "#f5f5f5", w: 512, h: 96 });
    const tm = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 1.2 });
    switchables.push({ material: tm, hours: [0, 24], base: 1.6, day: 0.3 });
    for (const [oz, ry] of [[-0.56, Math.PI], [0.56, 0]]) {
      const m = new THREE.Mesh(PLANE, tm);
      m.position.set(x, KERB_H + 2.35, z + oz);
      m.rotation.y = ry;
      m.scale.set(0.8, 0.16, 1);
      group.add(m);
    }
    colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: z - 0.55, maxZ: z + 0.55 });
  }

  // Post box
  b.add("paint", CYL, mat(50, KERB_H + 0.75, 7.0, 0, 0, 0, 0.6, 1.5, 0.6), { color: "#c8102e" });
  b.add("paint", SPHERE, mat(50, KERB_H + 1.5, 7.0, 0, 0, 0, 0.66, 0.3, 0.66), { color: "#c8102e" });
  b.add("paint", BOX, mat(50, KERB_H + 1.2, 6.68, 0, 0, 0, 0.3, 0.05, 0.04), { color: "#111" });
  circleCollider(50, 7.0, 0.32);

  // Bus shelter
  {
    const x0 = BUS_STOP_X - 2.2, x1 = BUS_STOP_X + 2.2, zb = -9.3, zf = -8.2, gray = "#3a3d42";
    for (const x of [x0, x1]) for (const z of [zb, zf]) b.add("paint", BOX, mat(x, KERB_H + 1.25, z, 0, 0, 0, 0.08, 2.5, 0.08), { color: gray });
    b.add("paint", BOX, mat(BUS_STOP_X, KERB_H + 2.55, (zb + zf) / 2, 0, 0, 0, 4.7, 0.12, 1.5), { color: gray });
    b.add("shelterGlass", PLANE, mat(BUS_STOP_X, KERB_H + 1.35, zb, 0, 0, 0, 4.4, 2.2, 1));
    b.add("shelterGlass", PLANE, mat(x0, KERB_H + 1.35, (zb + zf) / 2, 0, Math.PI / 2, 0, 1.1, 2.2, 1));
    b.add("paint", BOX, mat(BUS_STOP_X - 0.6, KERB_H + 0.5, zb + 0.25, 0, 0, 0, 2.4, 0.06, 0.35), { color: gray });
    const adTex = (() => {
      const c = document.createElement("canvas"); c.width = 256; c.height = 400;
      const g = c.getContext("2d")!;
      const gr = g.createLinearGradient(0, 0, 0, 400); gr.addColorStop(0, "#ef3340"); gr.addColorStop(1, "#1e1b4b");
      g.fillStyle = gr; g.fillRect(0, 0, 256, 400);
      g.fillStyle = "#fff"; g.textAlign = "center";
      g.font = "800 46px 'Space Grotesk', Arial"; g.fillText("YOUR", 128, 150); g.fillText("BRAND", 128, 200); g.fillText("HERE", 128, 250);
      g.font = "600 18px Inter, Arial"; g.fillText("Advertise in UK Life", 128, 320);
      return T.toTexture(c, true, false);
    })();
    const ad = new THREE.MeshStandardMaterial({ map: adTex, emissive: "#ffffff", emissiveMap: adTex, emissiveIntensity: 1.2 });
    switchables.push({ material: ad, hours: [0, 24], base: 1.5, day: 0.8 });
    const adm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.8, 1.1), [ad, ad, M.paint, M.paint, M.paint, M.paint]);
    adm.position.set(x1 + 0.1, KERB_H + 1.3, (zb + zf) / 2);
    group.add(adm);
    // bus stop flag
    b.add("paint", CYL_LO, mat(BUS_STOP_X + 3.5, KERB_H + 1.6, -6.7, 0, 0, 0, 0.1, 3.2, 0.1), { color: gray });
    const flagTex = T.signTexture({ text: "38", sub: "BUS STOP", bg: "#c8102e", fg: "#ffffff", w: 256, h: 256 });
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.6, 0.6), new THREE.MeshStandardMaterial({ map: flagTex, emissive: "#ffffff", emissiveMap: flagTex, emissiveIntensity: 0.3 }));
    flag.position.set(BUS_STOP_X + 3.5, KERB_H + 3.0, -6.4);
    group.add(flag);
    colliders.push({ minX: x0 - 0.1, maxX: x1 + 0.2, minZ: zb - 0.1, maxZ: zf + 0.05 });
    circleCollider(BUS_STOP_X + 3.5, -6.7, 0.12);
  }

  // Belisha beacons at the zebra crossing
  {
    const poleTex = T.stripeTexture("#111111", "#f5f5f5", 8);
    poleTex.rotation = Math.PI / 2;
    const poleMat = new THREE.MeshStandardMaterial({ map: poleTex, roughness: 0.4 });
    const globeMat = new THREE.MeshStandardMaterial({ color: "#3a2000", emissive: "#ff9a1f", emissiveIntensity: 4, roughness: 0.3 });
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 10);
    const globeGeo = new THREE.SphereGeometry(0.2, 16, 12);
    for (const x of [ZEBRA_X - 1.9, ZEBRA_X + 1.9]) for (const z of [6.45, -6.45]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(x, KERB_H + 1.3, z);
      p.castShadow = true;
      group.add(p);
      const g = new THREE.Mesh(globeGeo, globeMat);
      g.position.set(x, KERB_H + 2.75, z);
      group.add(g);
      lights.push({ x, y: KERB_H + 2.75, z, color: "#ff9a1f", intensity: 0.5, range: 6, kind: "beacon", pool: 2 });
      circleCollider(x, z, 0.1);
    }
    animate.push((t) => { globeMat.emissiveIntensity = Math.sin(t * Math.PI * 1.1) > 0 ? 5 : 0.2; });
  }

  // ---------- distant London skyline ----------
  const skylineMat = new THREE.ShaderMaterial({
    fog: false,
    uniforms: { uColor: { value: new THREE.Color("#1a1d2a") }, uNight: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uNight;
      varying vec3 vPos;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 cell = floor(vec2(vPos.x + vPos.z, vPos.y) / vec2(2.5, 3.2));
        vec2 f = fract(vec2(vPos.x + vPos.z, vPos.y) / vec2(2.5, 3.2));
        float lit = step(0.82, hash(cell)) * step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.75);
        vec3 col = uColor + vec3(1.0, 0.78, 0.5) * lit * uNight * 0.55;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  {
    const add = (geo: THREE.BufferGeometry, x: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) => {
      const m = new THREE.Mesh(geo, skylineMat);
      m.position.set(x, 0, z);
      m.scale.set(sx, sy, sz);
      m.rotation.y = ry;
      group.add(m);
      return m;
    };
    const redLights: THREE.Mesh[] = [];
    const redMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15), fog: false });
    const beacon = (x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), redMat);
      m.position.set(x, y, z);
      group.add(m);
      redLights.push(m);
    };
    // The Shard
    add(new THREE.ConeGeometry(9, 85, 4, 1).translate(0, 42.5, 0), -260, -420, 1, 1, 0.8, 0.4);
    beacon(-260, 86, -420);
    // The Gherkin
    add(new THREE.SphereGeometry(10, 16, 16).translate(0, 0, 0).scale(1, 2.6, 1), 330, -440, 1, 1, 1);
    // BT Tower
    add(new THREE.CylinderGeometry(3.5, 4.5, 70, 12).translate(0, 35, 0), -420, 380);
    add(new THREE.CylinderGeometry(6, 6, 6, 16).translate(0, 58, 0), -420, 380);
    beacon(-420, 72, 380);
    // Canary Wharf
    add(new THREE.BoxGeometry(16, 60, 16).translate(0, 30, 0), 460, 260);
    add(new THREE.ConeGeometry(11.3, 10, 4).translate(0, 65, 0), 460, 260, 1, 1, 1, Math.PI / 4);
    add(new THREE.BoxGeometry(14, 48, 14).translate(0, 24, 0), 432, 228);
    add(new THREE.BoxGeometry(14, 44, 14).translate(0, 22, 0), 488, 290);
    beacon(460, 71, 260);
    // tower blocks and cranes
    const rr = T.rng(9);
    for (let i = 0; i < 26; i++) {
      const a = rr() * Math.PI * 2, d = 330 + rr() * 140;
      const h = 18 + rr() * 34;
      add(new THREE.BoxGeometry(10 + rr() * 12, h, 10 + rr() * 8).translate(0, h / 2, 0), Math.cos(a) * d, Math.sin(a) * d, 1, 1, 1, rr() * 3);
    }
    for (let i = 0; i < 4; i++) {
      const a = rr() * Math.PI * 2, d = 300 + rr() * 120, h = 50 + rr() * 20;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      add(new THREE.BoxGeometry(1.6, h, 1.6).translate(0, h / 2, 0), x, z);
      add(new THREE.BoxGeometry(48, 1.4, 1.4).translate(12, h, 0), x, z, 1, 1, 1, rr() * 6);
      beacon(x, h + 2, z);
    }
    animate.push((t) => { const on = Math.sin(t * 2.2) > 0.2; for (const m of redLights) m.visible = on; });
  }

  // ---------- finalize ----------
  b.build(group);
  return {
    group, colliders, lights,
    roadMat, paveMat, slateMat: M.slate,
    windowLit: M.windowLit, lampGlow: M.lampGlow,
    switchables, skylineMat, animate,
  };
}

function setWorldUV(g: THREE.BufferGeometry, tile: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
  uv.needsUpdate = true;
}

export function shopIsOn(s: Switchable, hour: number) {
  const [o, c] = s.hours;
  if (o === 0 && c === 24) return true;
  if (o === c) return false;
  if (c > 24) return hour >= o || hour < c - 24;
  return hour >= o && hour < c;
}

// Free GPU resources for a whole object tree (used when leaving a district).
export function disposeTree(root: THREE.Object3D, materials = true) {
  root.removeFromParent();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !m.geometry.userData.shared) m.geometry.dispose();
    if (!materials && !(o instanceof THREE.Sprite)) return;
    const mats = m.material ? ([] as THREE.Material[]).concat(m.material) : [];
    for (const mt of mats) {
      if (mt.userData.shared) continue;
      const st = mt as THREE.MeshStandardMaterial;
      for (const tex of [st.map, st.normalMap, st.roughnessMap, st.emissiveMap]) if (tex && !tex.userData.shared) tex.dispose();
      mt.dispose();
    }
  });
}
