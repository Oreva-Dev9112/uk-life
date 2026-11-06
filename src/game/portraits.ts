// Head-and-shoulders portraits for the HUD. Each look is rendered once, on a small canvas of its own,
// and kept as an image URL.
import * as THREE from "three";
import { Character, type Look } from "./actors/Character";

const SIZE = 160;
const cache = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 10);

function setup() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.AgXToneMapping;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight("#e4ecff", "#3a3330", 2.4));
  const key = new THREE.DirectionalLight("#fff1dc", 3);
  key.position.set(1.4, 2.8, 2.2);
  scene.add(key);
  return { renderer, scene };
}

export function portrait(look: Look): string {
  const id = JSON.stringify(look);
  const hit = cache.get(id);
  if (hit) return hit;
  const { renderer: r, scene: sc } = renderer && scene ? { renderer, scene } : setup();
  const c = new Character({ ...look, umbrella: undefined });
  sc.add(c.root);
  const h = c.root.scale.y; // (shorter builds have their head lower)
  camera.position.set(0.34, 1.68 * h, 1.12);
  camera.lookAt(0, 1.58 * h, 0);
  r.render(sc, camera);
  const url = r.domElement.toDataURL("image/png");
  c.dispose();
  cache.set(id, url);
  return url;
}
