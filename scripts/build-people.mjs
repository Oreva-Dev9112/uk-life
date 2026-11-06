// Builds the game's people from Quaternius's "Ultimate Modular Men" and "Ultimate Modular Women" packs
// (CC0, https://quaternius.com). Download both packs, unzip them into one folder as men/ and women/, then run
//   node scripts/build-people.mjs ~/Downloads
// It writes one .glb per outfit (no animations) and one shared anims.glb into public/people/.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, resample, weld } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-people.mjs <folder containing men/ and women/>");
  process.exit(1);
}
const OUT = "public/people";

// Only outfits that suit London: game id -> character in the pack's "Individual Characters/glTF" folder.
const OUTFITS = {
  male: { casual: "Casual_2", hoodie: "Casual_Hoodie", suit: "Suit", worker: "Worker", punk: "Punk", summer: "Beach", backpacker: "Adventurer" },
  female: { casual: "Casual", suit: "Suit", dress: "Formal", worker: "Worker", punk: "Punk", shorts: "Adventurer" },
};
const FOLDER = { male: "men", female: "women" };
// Both packs share one skeleton and the same animation data, so the men's clips serve everyone.
// (Idle_Gun lends its right arm to holding an umbrella.)
const CLIPS = ["Idle", "Walk", "Run", "Wave", "Interact", "Idle_Gun"];

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const gltfPath = (gender, name) => join(src, FOLDER[gender], "Individual Characters", "glTF", `${name}.gltf`);

async function build(from, to, { clips = [], meshes = true }) {
  const doc = await io.read(from);
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (clips.includes(a.getName())) continue;
    // (an animation's samplers would otherwise keep its keyframe data alive)
    for (const c of a.listChannels()) c.dispose();
    for (const s of a.listSamplers()) s.dispose();
    a.dispose();
  }
  // No weapons on London's streets (the suit comes with a pistol).
  for (const node of root.listNodes()) {
    if (!/pistol|gun|rifle|sword|knife|axe|weapon/i.test(node.getName())) continue;
    node.getMesh()?.dispose();
    node.dispose();
  }
  for (const mesh of root.listMeshes()) {
    if (!meshes) { mesh.dispose(); continue; }
    for (const p of mesh.listPrimitives()) p.setAttribute("TEXCOORD_0", null); // flat colours, so no UVs needed
  }
  await doc.transform(
    dedup(),
    weld(),
    resample(), // (drops keyframes the animation doesn't need)
    prune({ keepLeaves: true }), // (keep the finger-tip bones the skeleton expects)
    // Smaller numbers, then meshopt compression (three.js decodes it). One quantisation volume for the whole
    // model, because the head, body, legs and feet share a skeleton.
    meshopt({ encoder: MeshoptEncoder, level: "medium", ...(meshes ? { quantizationVolume: "scene" } : {}) }),
  );
  await io.write(to, doc);
  return (await stat(to)).size;
}

await mkdir(OUT, { recursive: true });
let total = 0;
for (const [gender, outfits] of Object.entries(OUTFITS)) {
  for (const [id, name] of Object.entries(outfits)) {
    const size = await build(gltfPath(gender, name), join(OUT, `${gender}-${id}.glb`), {});
    total += size;
    console.log(`${gender}-${id}.glb  ${(size / 1024).toFixed(0)} KB`);
  }
}
const animSize = await build(gltfPath("male", "Casual_2"), join(OUT, "anims.glb"), { clips: CLIPS, meshes: false });
total += animSize;
console.log(`anims.glb  ${(animSize / 1024).toFixed(0)} KB`);
await copyFile(join(src, "men", "License.txt"), join(OUT, "LICENSE.txt"));
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
