// Procedural canvas textures: bricks, slate, paving, wet asphalt, signs, shop interiors.
import * as THREE from "three";

type Ctx = CanvasRenderingContext2D;

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

export function toTexture(c: HTMLCanvasElement, srgb = true, repeat = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// Height (red channel) -> tangent-space normal map.
function heightToNormal(height: HTMLCanvasElement, strength: number) {
  const w = height.width;
  const h = height.height;
  const src = height.getContext("2d")!.getImageData(0, 0, w, h).data;
  const [c, ctx] = makeCanvas(w, h);
  const out = ctx.createImageData(w, h);
  const H = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

function softBlob(ctx: Ctx, x: number, y: number, r: number, rgb: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.6, `rgba(${rgb},${a * 0.7})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// Draws a blob at x and at its wrapped copies so the texture tiles.
function wrapped(S: number, x: number, y: number, r: number, fn: (x: number, y: number) => void) {
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
    if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
    fn(x + ox, y + oy);
  }
}

// ---------- Brick (1 tile = 1.8m x 1.8m) ----------
export const BRICK_TILE = 1.8;
export function brickTextures(kind: "stock" | "red", seed = 1) {
  const S = 512, cols = 8, rows = 24;
  const bw = S / cols, bh = S / rows, mortar = 3;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = kind === "stock" ? "#8e877c" : "#958d84";
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = "#202020";
  hctx.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * (bw / 2);
    for (let col = -1; col <= cols; col++) {
      const x = col * bw + off, y = row * bh;
      let hue: number, sat: number, lig: number;
      if (kind === "stock") {
        hue = 28 + r() * 14; sat = 22 + r() * 26; lig = 30 + r() * 20;
        if (r() < 0.08) lig = 17 + r() * 7;
        if (r() < 0.06) { hue = 10 + r() * 8; sat = 40; }
      } else {
        hue = 4 + r() * 12; sat = 38 + r() * 22; lig = 25 + r() * 13;
        if (r() < 0.08) lig = 16 + r() * 6;
      }
      ctx.fillStyle = `hsl(${hue} ${sat}% ${lig}%)`;
      ctx.fillRect(x + mortar / 2, y + mortar / 2, bw - mortar, bh - mortar);
      for (let k = 0; k < 16; k++) {
        ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.18})` : `rgba(255,240,220,${r() * 0.08})`;
        ctx.fillRect(x + r() * bw, y + r() * bh, 1 + r() * 2, 1 + r() * 2);
      }
      const hv = 190 + r() * 50;
      hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
      hctx.fillRect(x + mortar / 2 + 1, y + mortar / 2 + 1, bw - mortar - 2, bh - mortar - 2);
    }
  }
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = `rgba(15,15,15,${0.025 + r() * 0.05})`;
    ctx.fillRect(r() * S, r() * S, 2 + r() * 6, 20 + r() * 80);
  }
  return { map: toTexture(c), normalMap: toTexture(heightToNormal(hc, 3), false) };
}

// ---------- Painted render / stucco ----------
export function renderTextures(seed = 2) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = "#dedbd3";
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = "#c0c0c0";
  hctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2500; i++) {
    const v = r();
    ctx.fillStyle = v < 0.5 ? `rgba(0,0,0,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.06})`;
    ctx.fillRect(r() * S, r() * S, 2, 2);
    hctx.fillStyle = `rgba(${v < 0.5 ? 0 : 255},${v < 0.5 ? 0 : 255},${v < 0.5 ? 0 : 255},0.15)`;
    hctx.fillRect(r() * S, r() * S, 2, 2);
  }
  // Rusticated lines (horizontal grooves).
  for (let y = 0; y < S; y += 32) {
    hctx.fillStyle = "#404040";
    hctx.fillRect(0, y, S, 2);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, y, S, 2);
  }
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(40,40,30,${0.03 + r() * 0.05})`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 3, 30 + r() * 90);
  }
  return { map: toTexture(c), normalMap: toTexture(heightToNormal(hc, 1.5), false) };
}

// ---------- Slate roof ----------
export function slateTextures(seed = 3) {
  const S = 256, rows = 10, cols = 8;
  const rh = S / rows, cw = S / cols;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = "#15181d";
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * (cw / 2);
    for (let col = -1; col <= cols; col++) {
      const x = col * cw + off, y = row * rh;
      ctx.fillStyle = `hsl(${210 + r() * 15} ${8 + r() * 8}% ${17 + r() * 12}%)`;
      ctx.fillRect(x + 1, y + 1, cw - 2, rh - 1);
      const g = hctx.createLinearGradient(0, y, 0, y + rh);
      g.addColorStop(0, "#303030");
      g.addColorStop(1, "#e0e0e0");
      hctx.fillStyle = g;
      hctx.fillRect(x + 1, y, cw - 2, rh);
    }
  }
  for (let i = 0; i < 30; i++) softBlob(ctx, r() * S, r() * S, 10 + r() * 25, "60,70,50", 0.12);
  return { map: toTexture(c), normalMap: toTexture(heightToNormal(hc, 2), false) };
}

// ---------- Paving slabs (1 tile = 3m) ----------
export const PAVE_TILE = 3;
export function pavementTextures(seed = 5) {
  const S = 512, n = 5, sw = S / n;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = "#3a3b3d";
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = "#303030";
  hctx.fillRect(0, 0, S, S);
  rctx.fillStyle = "#e6e6e6";
  rctx.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = i * sw, y = j * sw;
    const l = 42 + r() * 14;
    ctx.fillStyle = `hsl(${30 + r() * 30} ${3 + r() * 4}% ${l}%)`;
    ctx.fillRect(x + 2, y + 2, sw - 4, sw - 4);
    for (let k = 0; k < 220; k++) {
      ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.12})` : `rgba(255,255,255,${r() * 0.06})`;
      ctx.fillRect(x + r() * sw, y + r() * sw, 1 + r() * 2, 1 + r() * 2);
    }
    const hv = 200 + r() * 30;
    hctx.fillStyle = `rgb(${hv},${hv},${hv})`;
    hctx.fillRect(x + 3, y + 3, sw - 6, sw - 6);
    const rv = 120 + r() * 70;
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(x + 2, y + 2, sw - 4, sw - 4);
    if (r() < 0.25) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      let px = x + r() * sw, py = y + 4;
      ctx.moveTo(px, py);
      for (let s = 0; s < 6; s++) { px += (r() - 0.5) * 20; py += sw / 7; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  }
  // Wet patches: darker + shinier.
  for (let i = 0; i < 14; i++) {
    const x = r() * S, y = r() * S, rad = 20 + r() * 60;
    wrapped(S, x, y, rad, (wx, wy) => {
      softBlob(ctx, wx, wy, rad, "10,12,16", 0.35);
      softBlob(rctx, wx, wy, rad, "25,25,25", 0.9);
    });
  }
  return {
    map: toTexture(c),
    normalMap: toTexture(heightToNormal(hc, 2.2), false),
    roughnessMap: toTexture(rc, false),
  };
}

// ---------- Asphalt (1 tile = 8m) ----------
export const ROAD_TILE = 8;
export function asphaltTextures(seed = 7) {
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  const [hc, hctx] = makeCanvas(S, S);
  const [rc, rctx] = makeCanvas(S, S);
  const r = rng(seed);
  ctx.fillStyle = "#2a2b2e";
  ctx.fillRect(0, 0, S, S);
  hctx.fillStyle = "#808080";
  hctx.fillRect(0, 0, S, S);
  rctx.fillStyle = "#a8a8a8";
  rctx.fillRect(0, 0, S, S);
  // Patch repairs.
  for (let i = 0; i < 5; i++) {
    const w = 80 + r() * 200, h = 60 + r() * 160, x = r() * (S - w), y = r() * (S - h);
    ctx.fillStyle = `rgba(${r() < 0.5 ? "20,20,22" : "55,55,58"},0.35)`;
    ctx.fillRect(x, y, w, h);
  }
  // Aggregate speckle.
  for (let i = 0; i < 26000; i++) {
    const x = r() * S, y = r() * S, v = r();
    ctx.fillStyle = v < 0.55 ? `rgba(0,0,0,${0.15 + r() * 0.3})` : `rgba(200,200,205,${0.05 + r() * 0.18})`;
    ctx.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
    hctx.fillStyle = v < 0.55 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.5)";
    hctx.fillRect(x, y, 2, 2);
  }
  // Puddles: dark and mirror-smooth.
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 30 + r() * 120;
    const sx = 1 + r() * 1.6;
    wrapped(S, x, y, rad * sx, (wx, wy) => {
      ctx.save(); ctx.translate(wx, wy); ctx.scale(sx, 1);
      softBlob(ctx, 0, 0, rad, "5,6,9", 0.55);
      ctx.restore();
      rctx.save(); rctx.translate(wx, wy); rctx.scale(sx, 1);
      softBlob(rctx, 0, 0, rad, "8,8,8", 1);
      rctx.restore();
      hctx.save(); hctx.translate(wx, wy); hctx.scale(sx, 1);
      softBlob(hctx, 0, 0, rad, "128,128,128", 1);
      hctx.restore();
    });
  }
  return {
    map: toTexture(c),
    normalMap: toTexture(heightToNormal(hc, 1.2), false),
    roughnessMap: toTexture(rc, false),
  };
}

// ---------- Glow helpers ----------
export function radialTexture(inner = "255,255,255") {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${inner},1)`);
  g.addColorStop(0.25, `rgba(${inner},0.55)`);
  g.addColorStop(0.6, `rgba(${inner},0.15)`);
  g.addColorStop(1, `rgba(${inner},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c, true, false);
}

export function streakTexture() {
  const W = 64, H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = (x / (W - 1)) * 2 - 1;
    const v = y / (H - 1);
    const a = Math.exp(-u * u * 6) * Math.pow(1 - v, 1.6) * (0.75 + 0.25 * Math.sin(v * 60 + x * 0.3));
    const i = (y * W + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
  }
  ctx.putImageData(img, 0, 0);
  return toTexture(c, true, false);
}

// ---------- Windows (atlas of 4 lit interiors) ----------
export function windowAtlas(seed = 11) {
  const W = 64, H = 128;
  const [c, ctx] = makeCanvas(W * 4, H);
  const r = rng(seed);
  const variants = [
    ["#ffcf8a", "#e9954d", "#7a2f22"],
    ["#a9c8ff", "#5d7fc4", "#1d2a4a"],
    ["#ffe0a8", "#f0b060", "#3a4a3a"],
    ["#f7b27a", "#c9733f", "#5a2440"],
  ];
  variants.forEach(([a, b, curtain], i) => {
    const x = i * W;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, W, H);
    // lamp glow
    softBlob(ctx, x + W * (0.3 + r() * 0.4), H * 0.55, 30, "255,250,235", 0.6);
    // furniture silhouette
    ctx.fillStyle = "rgba(40,20,10,0.35)";
    ctx.fillRect(x + 6 + r() * 20, H * 0.72, 20 + r() * 20, H * 0.28);
    // curtains
    ctx.fillStyle = curtain;
    ctx.fillRect(x, 0, 10, H);
    ctx.fillRect(x + W - 10, 0, 10, H);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let k = 0; k < 4; k++) { ctx.fillRect(x + 2 + k * 2, 0, 1, H); ctx.fillRect(x + W - 9 + k * 2, 0, 1, H); }
  });
  const t = toTexture(c, true, false);
  return t;
}

// Daytime look of windows: net curtains, sky reflection, blinds, open curtains. Same 4-cell layout as windowAtlas.
export function windowDayAtlas() {
  const W = 64, H = 128;
  const [c, ctx] = makeCanvas(W * 4, H);
  // 0: net curtains
  ctx.fillStyle = "#b4b8bd"; ctx.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 6) { ctx.fillStyle = x % 12 ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)"; ctx.fillRect(x, 0, 3, H); }
  // 1: dark room with the sky reflected in the glass
  const g1 = ctx.createLinearGradient(0, 0, 0, H); g1.addColorStop(0, "#8b9db2"); g1.addColorStop(1, "#2e3946");
  ctx.fillStyle = g1; ctx.fillRect(W, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.beginPath(); ctx.moveTo(W + 10, 0); ctx.lineTo(W + 30, 0); ctx.lineTo(W + 4, H * 0.55); ctx.lineTo(W - 16 + 16, H * 0.55); ctx.fill();
  // 2: venetian blinds
  ctx.fillStyle = "#cbc2b0"; ctx.fillRect(W * 2, 0, W, H);
  for (let y = 0; y < H; y += 6) { ctx.fillStyle = "#857d6e"; ctx.fillRect(W * 2, y, W, 1); }
  // 3: open curtains onto a dim room
  const g3 = ctx.createLinearGradient(0, 0, 0, H); g3.addColorStop(0, "#5f6b78"); g3.addColorStop(0.35, "#2b3037"); g3.addColorStop(1, "#24272c");
  ctx.fillStyle = g3; ctx.fillRect(W * 3, 0, W, H);
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(W * 3 + 18, H * 0.7, 28, H * 0.3);
  ctx.fillStyle = "#6e2a2a"; ctx.fillRect(W * 3, 0, 12, H); ctx.fillRect(W * 4 - 12, 0, 12, H);
  return toTexture(c, true, false);
}

// ---------- Shop interiors ----------
export function interiorTexture(kind: string, seed = 13) {
  const W = 256, H = 128;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(seed);
  const palettes: Record<string, [string, string]> = {
    bakery: ["#fff1d6", "#f2c98a"],
    chippy: ["#f4fbff", "#cfe6f2"],
    shop: ["#f6fff4", "#d7f0d0"],
    pub: ["#ffbe6b", "#9a4a17"],
    laundrette: ["#eef6ff", "#bcd3ee"],
    jobcentre: ["#eef3f6", "#c9d6dd"],
    gym: ["#ffd6f0", "#6d2a63"],
    station: ["#d9c39b", "#6b5537"],
    generic: ["#ffe7c2", "#d9a76a"],
    barber: ["#f0f6ff", "#c5d4ea"],
    vape: ["#e9d6ff", "#6b3fb0"],
    bookies: ["#e8ffe9", "#5aa36a"],
    bank: ["#b9c4cd", "#4c5a66"],
    tailor: ["#f3e6cf", "#9c8462"],
    restaurant: ["#ffd09a", "#a3402a"],
    bar: ["#f0a3c8", "#3b0d2c"],
    records: ["#ffe1b0", "#7a4a22"],
    vintage: ["#ffe7c7", "#a8703f"],
    theatre: ["#ffe2a8", "#7a2a12"],
    club: ["#5b1a7a", "#0a0412"],
  };
  const [top, bottom] = palettes[kind] ?? palettes.generic;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // ceiling lights
  for (let x = 20; x < W; x += 50) softBlob(ctx, x, 6, 22, "255,255,255", 0.9);

  if (kind === "club") {
    // coloured spotlight beams and a crowd in silhouette
    for (const [x, col] of [[40, "236,72,153"], [128, "56,189,248"], [210, "250,204,21"]] as [number, string][]) {
      const g2 = ctx.createLinearGradient(x, 0, x, H);
      g2.addColorStop(0, `rgba(${col},0.9)`); g2.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(x - 6, 0); ctx.lineTo(x + 6, 0); ctx.lineTo(x + 40, H); ctx.lineTo(x - 40, H); ctx.fill();
    }
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    for (let x = 6; x < W; x += 16 + r() * 10) { ctx.beginPath(); ctx.arc(x, 92 + r() * 6, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - 9, 98, 18, 30); }
  } else if (kind === "theatre") {
    ctx.fillStyle = "rgba(120,20,20,0.85)"; ctx.fillRect(0, 70, W, 58); // red carpet + foyer
    for (let x = 30; x < W; x += 60) softBlob(ctx, x, 30, 26, "255,230,170", 0.9); // chandeliers
    ctx.fillStyle = "rgba(60,20,8,0.85)"; for (let x = 20; x < W; x += 48) ctx.fillRect(x, 50, 8, 78);
  } else if (kind === "bank") {
    ctx.fillStyle = "rgba(40,50,60,0.55)"; ctx.fillRect(W * 0.3, 80, W * 0.4, 48); // reception desk
    for (let x = 16; x < W; x += 40) { ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(x, 20, 18, 4); }
    ctx.fillStyle = "rgba(30,30,30,0.5)"; for (let x = 10; x < W; x += 70) ctx.fillRect(x, 40, 6, 88);
  } else if (kind === "laundrette") {
    for (let x = 22; x < W; x += 42) {
      ctx.fillStyle = "#dfe6ee"; ctx.fillRect(x - 18, 60, 36, 50);
      ctx.fillStyle = "#3b4a5c"; ctx.beginPath(); ctx.arc(x, 82, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#9fc3e8"; ctx.beginPath(); ctx.arc(x, 82, 9, 0, Math.PI * 2); ctx.fill();
    }
  } else if (kind === "gym") {
    for (let x = 20; x < W; x += 56) {
      ctx.fillStyle = "rgba(20,10,25,0.85)";
      ctx.fillRect(x, 92, 44, 8); ctx.fillRect(x + 36, 62, 4, 32);
      ctx.beginPath(); ctx.arc(x + 20, 58, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x + 16, 64, 8, 26);
    }
  } else if (kind === "pub") {
    ctx.fillStyle = "rgba(60,25,8,0.8)"; ctx.fillRect(0, 84, W, 44);
    for (let x = 4; x < W; x += 9) {
      ctx.fillStyle = `hsl(${r() * 60 + 10} 70% ${30 + r() * 30}%)`;
      ctx.fillRect(x, 40 + r() * 6, 5, 22);
    }
    for (let i = 0; i < 6; i++) {
      const x = 15 + r() * (W - 30);
      ctx.fillStyle = "rgba(30,12,4,0.85)";
      ctx.beginPath(); ctx.arc(x, 74, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(x - 10, 80, 20, 40);
    }
  } else if (kind === "station") {
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    for (let x = 0; x < W; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = "#c8102e"; ctx.fillRect(0, 40, W, 6);
    ctx.fillStyle = "#333"; for (let x = 20; x < W; x += 40) ctx.fillRect(x, 88, 10, 40);
    // stairs down to the platforms: a dark opening in the middle gives the hall some depth
    const st = ctx.createLinearGradient(0, 70, 0, H); st.addColorStop(0, "rgba(30,20,10,0.55)"); st.addColorStop(1, "rgba(8,6,4,0.95)");
    ctx.fillStyle = st; ctx.fillRect(W * 0.32, 70, W * 0.36, H - 70);
  } else {
    // shelves with products
    for (let y = 30; y < 90; y += 20) {
      ctx.fillStyle = "rgba(80,60,40,0.5)";
      ctx.fillRect(0, y + 14, W, 3);
      for (let x = 2; x < W; x += 6 + r() * 5) {
        ctx.fillStyle = `hsl(${r() * 360} ${50 + r() * 40}% ${40 + r() * 30}%)`;
        ctx.fillRect(x, y + 14 - (6 + r() * 8), 4 + r() * 3, 14);
      }
    }
    ctx.fillStyle = "rgba(40,30,20,0.75)";
    ctx.fillRect(W * 0.55, 92, W * 0.45, 36);
  }
  return toTexture(c, true, false);
}

// ---------- Signs ----------
export interface SignOpts {
  text: string;
  sub?: string;
  bg: string;
  fg: string;
  font?: string;
  w?: number;
  h?: number;
  border?: string;
  glow?: string;
}

export function signTexture(o: SignOpts) {
  const W = o.w ?? 1024, H = o.h ?? 160;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, W, H);
  if (o.border) {
    ctx.strokeStyle = o.border;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, W - 20, H - 20);
  }
  const font = o.font ?? "800 {s}px 'Space Grotesk', 'Arial Black', sans-serif";
  let size = o.sub ? H * 0.5 : H * 0.62;
  ctx.font = font.replace("{s}", String(size));
  while (ctx.measureText(o.text).width > W * 0.88 && size > 10) {
    size -= 4;
    ctx.font = font.replace("{s}", String(size));
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 24; }
  ctx.fillStyle = o.fg;
  ctx.fillText(o.text, W / 2, o.sub ? H * 0.4 : H * 0.53);
  if (o.sub) {
    ctx.shadowBlur = 0;
    ctx.font = `600 ${H * 0.2}px 'Inter', Arial, sans-serif`;
    ctx.fillText(o.sub, W / 2, H * 0.8);
  }
  return toTexture(c, true, false);
}

export function stripeTexture(a: string, b: string, n = 8) {
  const [c, ctx] = makeCanvas(256, 64);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? a : b;
    ctx.fillRect((i * 256) / n, 0, 256 / n + 1, 64);
  }
  return toTexture(c, true, true);
}

export function tileTexture(color: string, grout: string, size = 16) {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, S, S);
  const r = rng(17);
  for (let y = 0; y < S; y += size) for (let x = 0; x < S; x += size) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85 + r() * 0.15;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  }
  ctx.globalAlpha = 1;
  // glaze highlight
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

export function textLabelTexture(text: string, color = "#ffffff") {
  const W = 512, H = 128;
  const [c, ctx] = makeCanvas(W, H);
  ctx.font = "700 56px 'Space Grotesk', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = Math.min(W - 8, ctx.measureText(text).width + 60);
  ctx.fillStyle = "rgba(10,12,20,0.6)";
  const x = (W - w) / 2;
  ctx.beginPath();
  ctx.roundRect(x, 24, w, 80, 40);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, W / 2, H / 2 + 2);
  return toTexture(c, true, false);
}
