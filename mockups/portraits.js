// Illustrated portraits drawn from a character's look (skin, hair, hairstyle, outfit), in the UI kit's style:
// flat colour, thick ink outlines, glossy highlights. Same inputs as the 3D models, so they always match.
const INK = "#16203f";
const toRgb = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = (a) => `rgb(${a.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(",")})`;
const shade = (c, f) => css(toRgb(c).map((v) => v * f));
const tint = (c, f) => css(toRgb(c).map((v) => v + (255 - v) * f));
const hashOf = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const IRIS = ["#5a3a22", "#3b2a1a", "#2f6d8f", "#3f7a3a", "#6b4a2a", "#1f2a44"];

function scallop(cx, cy, r, bumps, depth) {
  // a cloud-like outline (afros)
  let d = "";
  for (let i = 0; i <= bumps; i++) {
    const a = (i / bumps) * Math.PI * 2, m = ((i + 0.5) / bumps) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const qx = cx + Math.cos(m) * (r + depth), qy = cy + Math.sin(m) * (r + depth);
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)}` : "";
    if (i < bumps) {
      const a2 = ((i + 1) / bumps) * Math.PI * 2;
      d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${(cx + Math.cos(a2) * r).toFixed(1)} ${(cy + Math.sin(a2) * r).toFixed(1)}`;
    }
  }
  return d + "Z";
}

export function portraitSVG(look, opts = {}) {
  const mood = opts.mood ?? "happy";
  const fem = look.gender === "female";
  const kind = (look.outfit ?? "male-casual").split("-")[1];
  const style = kind === "punk" ? "mohawk" : kind === "worker" ? "hardhat" : look.hairStyle;
  const seed = hashOf(opts.name ?? look.skin + look.hair);
  const sw = 3.4;
  const skin = look.skin, skinS = shade(skin, 0.8), skinH = tint(skin, 0.3);
  const hair = look.hair, hairH = tint(hair, 0.4);
  const top = look.jacket, topS = shade(top, 0.72), topH = tint(top, 0.3);
  const iris = IRIS[seed % IRIS.length];
  const brow = style === "bald" ? shade(skin, 0.55) : shade(hair, 0.85);
  const line = (d, c = INK, w = sw) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shape = (d, fill, w = sw) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"/>`;
  const gloss = (d, w = 4.5, o = 0.45) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`;

  // ---- hair behind the head ----
  let back = "";
  if (style === "long") back = shape("M58 82 C 44 128, 48 178, 64 200 L 136 200 C 152 178, 156 128, 142 82 Z", hair);
  if (style === "afro") back = shape(scallop(100, 82, 56, 14, 9), hair) + gloss("M62 52 C 72 38, 88 32, 102 31", 5, 0.3);
  if (style === "bun") back = shape("M84 30 C 84 12, 116 12, 116 30 C 116 44, 84 44, 84 30 Z", hair) + gloss("M90 22 C 95 17, 103 16, 108 19", 3.5, 0.45);

  // ---- body and outfit ----
  const torso = shape("M14 220 C 16 186, 42 168, 72 162 L 128 162 C 158 168, 184 186, 186 220 Z", ["dress", "summer"].includes(kind) ? skin : kind === "punk" ? "#f1f3f8" : top);
  let outfit = "";
  if (kind === "casual") outfit = shape("M83 161 C 90 173, 110 173, 117 161 Z", skin, 3) + line("M83 161 C 90 173, 110 173, 117 161", topS, 6) + gloss("M38 186 C 48 176, 60 170, 72 168", 5, 0.3);
  if (kind === "hoodie") outfit = shape("M60 170 C 62 148, 138 148, 140 170 C 126 184, 74 184, 60 170 Z", topS) + shape("M80 168 C 88 158, 112 158, 120 168 C 112 175, 88 175, 80 168 Z", shade(top, 0.5), 2.6)
    + line("M90 176 L 87 200", INK, 3) + line("M110 176 L 113 200", INK, 3) + `<circle cx="87" cy="202" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/><circle cx="113" cy="202" r="3" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
  if (kind === "suit") outfit = shape("M80 162 L 100 210 L 120 162 Z", "#f3f5fb") + shape("M95 170 L 105 170 L 108 200 L 100 212 L 92 200 Z", "#c22a45", 2.6) + shape("M93 163 L 107 163 L 105 172 L 95 172 Z", "#a5203a", 2.6)
    + shape("M70 163 L 96 214 L 84 216 L 62 170 Z", topS) + shape("M130 163 L 104 214 L 116 216 L 138 170 Z", topS);
  if (kind === "worker") outfit = shape("M26 190 C 36 174, 56 166, 80 163 L 92 220 L 30 220 Z", "#ffb300") + shape("M174 190 C 164 174, 144 166, 120 163 L 108 220 L 170 220 Z", "#ffb300")
    + shape("M30 199 L 86 196 L 88 206 L 29 209 Z", "#e9eef7", 2.4) + shape("M170 199 L 114 196 L 112 206 L 171 209 Z", "#e9eef7", 2.4);
  if (kind === "punk") outfit = shape("M22 198 C 28 178, 54 167, 80 163 L 90 220 L 20 220 Z", top) + shape("M178 198 C 172 178, 146 167, 120 163 L 110 220 L 180 220 Z", top)
    + [[52, 186], [62, 200], [148, 186], [138, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#e9eef7" stroke="${INK}" stroke-width="2"/>`).join("");
  if (kind === "dress") outfit = shape("M38 220 C 42 198, 62 188, 100 188 C 138 188, 158 198, 162 220 Z", top) + line("M72 190 L 78 165", INK, 9) + line("M72 190 L 78 165", top, 4.5) + line("M128 190 L 122 165", INK, 9) + line("M128 190 L 122 165", top, 4.5) + gloss("M60 204 C 72 196, 86 193, 98 193", 4, 0.3);
  if (kind === "summer") outfit = shape("M46 220 C 48 196, 60 182, 76 170 C 86 182, 114 182, 124 170 C 140 182, 152 196, 154 220 Z", top);
  if (kind === "shorts") outfit = shape("M83 161 L 99 180 L 89 186 L 76 168 Z", topH, 2.6) + shape("M117 161 L 101 180 L 111 186 L 124 168 Z", topH, 2.6) + line("M100 182 L 100 220", INK, 2.6) + shape("M120 196 L 140 196 L 140 212 L 120 212 Z", topS, 2.4);
  if (kind === "backpacker") outfit = shape("M82 162 L 100 202 L 118 162 Z", "#eef1f7") + line("M52 178 L 62 220", INK, 13) + line("M52 178 L 62 220", "#8a5a2c", 8) + line("M148 178 L 138 220", INK, 13) + line("M148 178 L 138 220", "#8a5a2c", 8);
  const neck = shape("M86 126 L 86 158 C 92 168, 108 168, 114 158 L 114 126 Z", skin) + `<path d="M86 134 C 94 145, 106 145, 114 134 L 114 148 C 106 152, 94 152, 86 148 Z" fill="${skinS}" opacity=".7"/>`;

  // ---- head ----
  const head = fem ? "M62 88 C 62 49, 138 49, 138 88 C 138 116, 123 139, 100 140 C 77 139, 62 116, 62 88 Z" : "M60 87 C 60 47, 140 47, 140 87 C 140 117, 126 141, 100 142 C 74 141, 60 117, 60 87 Z";
  const ears = shape("M62 92 C 50 88, 48 108, 62 110 Z", skin, 3) + shape("M138 92 C 150 88, 152 108, 138 110 Z", skin, 3);
  const face = shape(head, skin) + `<path d="M126 66 C 142 88, 138 122, 112 138 C 128 118, 134 94, 126 66 Z" fill="${skinS}" opacity=".55"/>`
    + `<ellipse cx="75" cy="114" rx="8" ry="5" fill="#ff6f86" opacity=".28"/><ellipse cx="125" cy="114" rx="8" ry="5" fill="#ff6f86" opacity=".28"/>`;

  // ---- eyes, brows, nose, mouth (by mood) ----
  const eye = (x, side) => mood === "buzzing"
    ? line(`M${x - 9} 99 Q ${x} 89 ${x + 9} 99`, INK, 3.4)
    : `<ellipse cx="${x}" cy="97" rx="9.5" ry="10.5" fill="#fff" stroke="${INK}" stroke-width="2.6"/><circle cx="${x + 1.5}" cy="98.5" r="5.8" fill="${iris}"/><circle cx="${x + 1.5}" cy="98.5" r="2.7" fill="#0b0d1a"/><circle cx="${x + 3.6}" cy="95.4" r="2" fill="#fff"/>`
      + (fem ? line(`M${x + side * 8} 89 L ${x + side * 12} 85`, INK, 2.6) + line(`M${x + side * 10} 93 L ${x + side * 14.5} 90.5`, INK, 2.4) : "");
  const brows = {
    buzzing: ["M73 80 Q 83 73 93 79", "M107 79 Q 117 73 127 80"],
    happy: ["M73 82 Q 83 76 93 80", "M107 80 Q 117 76 127 82"],
    meh: ["M73 81 L 93 81", "M107 81 L 127 81"],
    fedup: ["M73 79 L 93 83", "M107 83 L 127 79"],
    miserable: ["M73 84 Q 84 82 93 76", "M107 76 Q 116 82 127 84"],
  }[mood];
  const browW = fem ? 4.2 : 5.6;
  const nose = line("M100 102 C 97 109, 97 113, 102 114", skinS, 3);
  const lip = fem ? "#c9475f" : shade(skin, 0.6);
  const mouth = {
    buzzing: shape("M84 119 Q 100 138 116 119 Z", "#7a1f2e", 2.8) + `<path d="M87 120 Q 100 125 113 120 L 112 123 Q 100 127 88 123 Z" fill="#fff"/>`,
    happy: line("M86 120 Q 100 131 114 120", lip, 5) + line("M86 120 Q 100 131 114 120", INK, 2.4),
    meh: line("M89 124 L 111 123", INK, 3),
    fedup: line("M88 127 Q 100 120 112 127", INK, 3),
    miserable: line("M86 129 Q 100 117 114 129", INK, 3) + shape("M128 104 C 124 112, 126 118, 130 118 C 134 118, 135 112, 128 104 Z", "#7cc8ff", 2),
  }[mood];
  const features = eye(84, -1) + eye(116, 1) + line(brows[0], brow, browW) + line(brows[1], brow, browW) + nose + mouth;

  // ---- hair in front ----
  let front = "";
  if (style === "short") front = shape("M57 92 C 52 54, 76 36, 102 37 C 128 38, 150 56, 143 92 C 140 80, 134 70, 126 66 C 112 74, 88 72, 72 66 C 64 72, 59 82, 57 92 Z", hair) + gloss("M80 47 C 90 42, 106 41, 118 45");
  if (style === "long") front = shape("M56 98 C 50 52, 80 34, 104 36 C 132 38, 152 60, 144 102 C 138 84, 128 70, 112 64 C 100 77, 80 85, 62 87 C 60 91, 58 94, 56 98 Z", hair)
    + shape("M57 92 C 52 120, 54 146, 62 164 L 71 160 C 66 140, 66 114, 68 94 Z", hair, 3) + shape("M143 92 C 148 120, 146 146, 138 164 L 129 160 C 134 140, 134 114, 132 94 Z", hair, 3) + gloss("M78 46 C 92 39, 110 39, 124 46");
  if (style === "bun") front = shape("M58 90 C 54 54, 78 38, 100 38 C 122 38, 146 54, 142 90 C 136 72, 120 62, 100 62 C 80 62, 64 72, 58 90 Z", hair) + gloss("M80 47 C 92 42, 108 42, 120 47");
  if (style === "afro") front = shape("M60 86 C 58 58, 80 48, 100 48 C 120 48, 142 58, 140 86 C 128 72, 114 67, 100 67 C 86 67, 72 72, 60 86 Z", hair);
  if (style === "cap") {
    const capColour = look.jacket === "#111111" ? "#c8102e" : "#1b1f2e";
    front = shape("M58 86 C 56 44, 144 44, 142 86 C 120 77, 80 77, 58 86 Z", capColour) + shape("M58 84 C 74 72, 132 72, 152 86 C 164 94, 160 100, 150 98 C 124 90, 84 90, 58 94 Z", shade(capColour, 0.7))
      + `<circle cx="100" cy="47" r="4" fill="${shade(capColour, 0.7)}" stroke="${INK}" stroke-width="2.4"/>` + gloss("M74 58 C 84 50, 98 48, 110 49", 4, 0.35);
  }
  if (style === "bald") front = gloss("M78 58 C 88 52, 106 51, 118 56", 6, 0.35) + (fem ? "" : `<path d="M61 86 C 61 76, 64 70, 67 66 L 68 84 Z M139 86 C 139 76, 136 70, 133 66 L 132 84 Z" fill="${hair}" opacity=".55"/>`);
  if (style === "mohawk") {
    const crest = fem ? "#b03adf" : "#e0303e";
    front = `<path d="M64 84 C 64 66, 74 56, 86 52 L 88 70 Z M136 84 C 136 66, 126 56, 114 52 L 112 70 Z" fill="${hair}" opacity=".45"/>`
      + shape("M88 66 C 82 40, 90 16, 104 2 C 104 18, 112 28, 117 42 C 121 52, 116 60, 112 68 Z", crest) + gloss("M98 12 C 94 24, 93 36, 94 50", 4, 0.4);
  }
  if (style === "hardhat") front = shape("M56 86 C 54 40, 146 40, 144 86 Z", "#ffcc00") + shape("M48 86 C 70 79, 130 79, 152 86 C 154 93, 46 93, 48 86 Z", "#e6a800") + line("M100 44 L 100 82", "#e6a800", 6) + gloss("M70 60 C 78 50, 90 46, 98 46", 5, 0.5);

  return `<svg viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg">${back}${torso}${outfit}${neck}${ears}${face}${features}${front}</svg>`;
}
