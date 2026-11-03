// Named locals you can talk to, plus generic pedestrians walking the pavements.
import * as THREE from "three";
import { Character, type Look } from "./Character";
import { NPCS, type AreaId, type NpcDef } from "../../state/content";
import { groundY } from "../world/layout";
import { textLabelTexture } from "../world/textures";

const SKINS = ["#f1c9ad", "#e0b49a", "#c68a63", "#a8724f", "#8d5a3b", "#5a3a26", "#3d2618"];
const HAIRS = ["#0e0b09", "#20160f", "#4a2f1d", "#8a5a33", "#c9a15a", "#9a9a9a", "#b5532a"];
const COATS = ["#1f2937", "#111111", "#3f2d20", "#334155", "#5b2333", "#2f4f3f", "#6b4f2a", "#1e3a5f", "#4b5563", "#7c2d12"];
const TROUSERS = ["#1f2430", "#22252c", "#2b3442", "#3a3a3a", "#14213d", "#4a3f35"];
const UMBRELLAS = ["#111111", "#1e3a8a", "#7f1d1d", "#14532d", "#f59e0b", "#6b21a8", "#e5e7eb", "#111111"];
const STYLES: Look["hairStyle"][] = ["short", "short", "long", "bun", "afro", "bald", "cap"];
const GENDERS: Look["gender"][] = ["male", "male", "female", "female", "female", "male", "nonbinary"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Npc {
  char: Character;
  pos = new THREE.Vector3();
  target = new THREE.Vector3();
  wait = 0;
  speed: number;
  dir = 1;
  lane = 0;
  facing = 0;
  label?: THREE.Sprite;

  constructor(public def: NpcDef | null, look: Look) {
    this.char = new Character({ ...look, umbrella: pick(UMBRELLAS) }, def ? 1 : 0.94 + Math.random() * 0.1);
    this.speed = def ? 1.1 : 1.15 + Math.random() * 0.5;
    if (def) {
      this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textLabelTexture(def.name), depthWrite: false, transparent: true }));
      this.label.scale.set(1.5, 0.375, 1);
      this.label.position.y = 2.2;
      this.label.renderOrder = 10;
      this.char.root.add(this.label);
    }
  }
}

export class Crowd {
  npcs: Npc[] = [];
  group = new THREE.Group();

  constructor(pedestrians: number, area: AreaId = "albion") {
    for (const def of NPCS.filter((n) => n.area === area)) {
      const n = new Npc(def, { ...def.look });
      n.pos.set(def.anchor[0], groundY(def.anchor[1]), def.anchor[1]);
      n.target.copy(n.pos);
      n.wait = Math.random() * 4;
      this.add(n);
    }
    for (let i = 0; i < pedestrians; i++) {
      const look: Look = { skin: pick(SKINS), hair: pick(HAIRS), jacket: pick(COATS), trousers: pick(TROUSERS), hairStyle: pick(STYLES), gender: pick(GENDERS) };
      const n = new Npc(null, look);
      const north = Math.random() < 0.5;
      n.lane = north ? 8.2 + Math.random() * 0.8 : -(7.7 + Math.random() * 0.3);
      n.dir = Math.random() < 0.5 ? 1 : -1;
      n.pos.set(-84 + Math.random() * 168, 0.15, n.lane);
      this.add(n);
    }
  }

  private add(n: Npc) {
    this.npcs.push(n);
    this.group.add(n.char.root);
  }

  named(id: string) {
    return this.npcs.find((n) => n.def?.id === id);
  }

  update(dt: number, player: THREE.Vector3, talkingTo: string | null, rain: boolean, hour: number, view: THREE.Vector3, clear?: { x: number; z: number; r: number }) {
    for (const n of this.npcs) {
      let moving = false;
      // keep the character-creator stage free of passers-by
      if (clear && Math.hypot(n.pos.x - clear.x, n.pos.z - clear.z) < clear.r) { n.char.root.visible = false; continue; }
      const toPlayer = Math.hypot(player.x - n.pos.x, player.z - n.pos.z);
      if (n.def) {
        // locals keep to their patch; most go home in the small hours (Mo never sleeps)
        const away = n.def.id !== "mo" && hour >= 1.5 && hour < 7;
        n.char.root.visible = !away;
        if (away) continue;
        if (talkingTo === n.def.id) {
          n.facing = Math.atan2(player.x - n.pos.x, player.z - n.pos.z);
        } else if (n.wait > 0) {
          n.wait -= dt;
          if (toPlayer < 3.5) n.facing = dampAngle(n.facing, Math.atan2(player.x - n.pos.x, player.z - n.pos.z), 3, dt);
        } else {
          const dx = n.target.x - n.pos.x, dz = n.target.z - n.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.15) {
            n.wait = 4 + Math.random() * 8;
            const [ax, az] = n.def.anchor;
            const side = Math.sign(az);
            n.target.set(ax + (Math.random() - 0.5) * 5, 0, side * THREE.MathUtils.clamp(Math.abs(az) + (Math.random() - 0.5) * 1.6, 7.6, 9.2));
          } else if (toPlayer > 0.9) {
            n.pos.x += (dx / d) * n.speed * dt;
            n.pos.z += (dz / d) * n.speed * dt;
            n.facing = dampAngle(n.facing, Math.atan2(dx, dz), 8, dt);
            moving = true;
          }
        }
        if (n.label) {
          const show = toPlayer < 10;
          n.label.visible = show;
          (n.label.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.clamp((10 - toPlayer) / 3, 0, 1);
        }
      } else {
        // pedestrians stroll up and down; fewer about at night
        const late = hour >= 0.5 && hour < 6;
        n.char.root.visible = !late || n.lane > 8.3;
        const ahead = (player.x - n.pos.x) * n.dir;
        const blocked = Math.abs(player.z - n.pos.z) < 0.7 && ahead > 0 && ahead < 1.1;
        if (!blocked) {
          n.pos.x += n.dir * n.speed * dt;
          moving = true;
        }
        if (Math.abs(n.pos.x) > 92) { n.dir = n.pos.x > 0 ? -1 : 1; n.pos.x = Math.sign(n.pos.x) * 92; }
        n.pos.z = THREE.MathUtils.damp(n.pos.z, n.lane, 2, dt);
        n.facing = dampAngle(n.facing, n.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 6, dt);
      }
      n.pos.y = groundY(n.pos.z);
      if (Math.abs(n.pos.x - view.x) > 75) { n.char.root.visible = false; continue; }
      n.char.root.position.copy(n.pos);
      n.char.root.rotation.y = n.facing;
      n.char.update(dt, moving ? n.speed : 0, rain);
    }
  }
}

export function dampAngle(a: number, b: number, lambda: number, dt: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}
