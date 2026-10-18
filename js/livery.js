/* ==========================================================
   FEISAR FX350 livery — painted at runtime on canvas.
   UV layout comes from tools/build_feisar.py:
   hull  u = 0 nose → 1 tail, v = position around the hull profile (VB bands)
   panel u = 0 front → 1 rear, v = 0 top → 1 bottom (both sides share it)
   ========================================================== */
import * as THREE from 'three';

const VB = [0, .30, .34, .41, .50, .54, .76, .80, .89, .96, 1];
const C = {
  white: '#f3f6fa', sky: '#3aa6dc', teal: '#1d7fb4', yellow: '#e8b62a', dark: '#262c35', black: '#14181f', ink: '#0a1530',
};

const star = (x, cx, cy, R) => {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * .42 : R;
    x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  x.closePath(); x.fill();
};

// draw text into a band with a transform so it reads correctly on the model
function bandText(x, text, { cx, cy, size, font, color, flipX = false, flipY = false, weight = '', align = 'left', spacing = 0 }) {
  x.save();
  x.translate(cx, cy);
  x.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  x.font = `${weight} ${size}px ${font}`;
  x.fillStyle = color; x.textBaseline = 'middle'; x.textAlign = align;
  if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
  x.fillText(text, 0, 0);
  x.restore();
}

function paintHull() {
  const W = 4096, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const band = i => [VB[i] * H, VB[i + 1] * H];
  const fill = (i, col) => { const [a, b] = band(i); x.fillStyle = col; x.fillRect(0, a, W, b - a); };

  fill(0, C.dark); fill(1, C.black); fill(9, C.black);
  fill(2, C.yellow); fill(8, C.yellow);
  fill(3, C.sky); fill(7, C.sky);
  fill(4, C.white); fill(6, C.white); fill(5, C.white);

  // rear deck (under the cowl) in sky blue
  const [t0, t1] = band(5);
  x.fillStyle = C.sky; x.fillRect(W * .76, t0, W * .24, t1 - t0);

  // --- top deck ---
  x.fillStyle = C.sky;
  x.fillRect(0, t0 + 10, W * .76, 5); x.fillRect(0, t1 - 15, W * .76, 5);
  x.fillStyle = C.teal; x.fillRect(W * .1, (t0 + t1) / 2 - 2, W * .6, 3);
  // nose hazard chevrons
  x.save(); x.beginPath(); x.rect(0, t0, 160, t1 - t0); x.clip();
  for (let i = -6; i < 12; i++) {
    x.fillStyle = i % 2 ? C.yellow : C.ink;
    x.beginPath(); x.moveTo(i * 36, t0); x.lineTo(i * 36 + 36, t0); x.lineTo(i * 36 + 36 + 80, t1); x.lineTo(i * 36 + 80, t1); x.fill();
  }
  x.restore();
  bandText(x, 'race for e-unity', { cx: 260, cy: t1 - 52, size: 58, font: 'Saira, sans-serif', weight: 600, color: C.teal, flipY: true });
  bandText(x, 'FEISAR', { cx: 1180, cy: (t0 + t1) / 2 - 6, size: 120, font: 'Michroma, sans-serif', color: C.sky, flipY: true });
  bandText(x, 'FX350 · FEDERAL BUILD 2207 · BOLOGNA', { cx: 260, cy: t0 + 46, size: 22, font: '"JetBrains Mono", monospace', weight: 500, color: C.ink, spacing: 4, flipY: true });
  // 12-star emblem
  const ex = 2420, ey = (t0 + t1) / 2;
  x.fillStyle = '#0047bb'; x.beginPath(); x.arc(ex, ey, 86, 0, 7); x.fill();
  x.fillStyle = '#ffcc00';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; star(x, ex + Math.cos(a) * 58, ey + Math.sin(a) * 58, 11); }
  // panel lines + rivets
  x.strokeStyle = 'rgba(10,21,48,.28)'; x.lineWidth = 3;
  for (const px of [820, 1720, 2060, 2700]) { x.beginPath(); x.moveTo(px, t0); x.lineTo(px, t1); x.stroke(); }
  x.fillStyle = 'rgba(10,21,48,.3)';
  for (let px = 860; px < 2900; px += 46) { x.fillRect(px, t0 + 26, 4, 4); x.fillRect(px, t1 - 30, 4, 4); }
  // barcode
  for (let i = 0, px = 2780; i < 40; i++) { const w = 2 + (i * 7 % 5); x.fillStyle = C.ink; x.fillRect(px, t0 + 70, w, 70); px += w + 3 + (i * 3 % 4); }

  // --- side bands (right = flipY, left = flipX) ---
  const sides = [
    { upper: band(3), lower: band(2), flipY: true, flipX: false },
    { upper: band(7), lower: band(8), flipY: false, flipX: true },
  ];
  for (const s of sides) {
    const [u0, u1] = s.upper, uc = (u0 + u1) / 2;
    const [l0, l1] = s.lower, lc = (l0 + l1) / 2;
    const at = px => s.flipX ? W - px : px; // left side reads towards the nose
    // big lowercase logotype
    bandText(x, 'feisar', { cx: s.flipX ? W - 520 : 520, cy: uc, size: 74, font: 'Michroma, sans-serif', color: C.white, flipX: s.flipX, flipY: s.flipY, align: s.flipX ? 'right' : 'left' });
    bandText(x, 'race for e-unity', { cx: s.flipX ? W - 1200 : 1200, cy: uc, size: 40, font: 'Saira, sans-serif', weight: 600, color: C.white, flipX: s.flipX, flipY: s.flipY, align: s.flipX ? 'right' : 'left' });
    // panel lines
    x.strokeStyle = 'rgba(10,21,48,.25)'; x.lineWidth = 3;
    for (const px of [420, 1060, 1900, 2500, 2960]) { x.beginPath(); x.moveTo(at(px), u0); x.lineTo(at(px), u1); x.stroke(); }
    // vents
    x.fillStyle = 'rgba(10,21,48,.75)';
    for (let k = 0; k < 6; k++) x.fillRect(at(2060 + k * 26), uc - 22, 12 * (s.flipX ? -1 : 1), 44);
    // tail chevrons
    x.fillStyle = C.white;
    for (let k = 0; k < 3; k++) {
      const bx = at(2620 + k * 50), d = s.flipX ? -1 : 1;
      x.beginPath(); x.moveTo(bx, uc - 22); x.lineTo(bx + 26 * d, uc); x.lineTo(bx, uc + 22); x.lineTo(bx + 10 * d, uc); x.fill();
    }
    // lower yellow band: pinstripe + microtext
    x.fillStyle = C.ink; x.fillRect(0, s.flipY ? l1 - 6 : l0, W, 6);
    for (let k = 0; k < 4; k++)
      bandText(x, 'STRENGTH IN UNITY · FEISAR AG-SYS · EUROPEAN FEDERATION', { cx: at(300 + k * 900), cy: lc, size: 20, font: '"JetBrains Mono", monospace', weight: 500, color: C.ink, flipX: s.flipX, flipY: s.flipY, align: s.flipX ? 'right' : 'left', spacing: 3 });
  }
  // chamfer pinlines
  for (const i of [4, 6]) { const [a, b] = band(i); x.fillStyle = C.sky; x.fillRect(0, (a + b) / 2 - 2, W * .76, 4); }
  // underside panels
  const [b0, b1] = band(0);
  x.fillStyle = 'rgba(255,255,255,.06)';
  for (let k = 0; k < 7; k++) x.fillRect(300 + k * 520, b0 + 30, 420, b1 - b0 - 60);

  return c;
}

function paintPanel() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = C.yellow; x.fillRect(0, 0, W, H);
  x.fillStyle = C.sky; x.fillRect(0, H * .74, W, H * .26);
  x.fillStyle = C.white; x.fillRect(0, H * .72, W, 10);
  // hazard bar along the top edge
  x.save(); x.beginPath(); x.rect(0, 0, W, 26); x.clip();
  for (let i = -2; i < 60; i++) { x.fillStyle = i % 2 ? C.ink : C.yellow; x.beginPath(); x.moveTo(i * 24, 0); x.lineTo(i * 24 + 24, 0); x.lineTo(i * 24 + 10, 26); x.lineTo(i * 24 - 14, 26); x.fill(); }
  x.restore();
  bandText(x, '350', { cx: 250, cy: 210, size: 150, font: 'Michroma, sans-serif', color: C.ink });
  bandText(x, 'FEISAR', { cx: 260, cy: 312, size: 46, font: 'Michroma, sans-serif', color: C.white });
  bandText(x, 'AIRBRAKE ZONE · KEEP CLEAR', { cx: 260, cy: 345, size: 18, font: '"JetBrains Mono", monospace', weight: 500, color: C.ink, spacing: 3 });
  x.strokeStyle = 'rgba(10,21,48,.3)'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(380, 40); x.lineTo(380, H * .72); x.stroke();
  bandText(x, 'race for e-unity', { cx: 520, cy: H * .87, size: 40, font: 'Saira, sans-serif', weight: 600, color: C.white });
  return c;
}

function paintBump() {
  // grooves (dark) for panel lines, raised rivets (light) — same layout as paintHull
  const W = 2048, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#303030'; x.lineWidth = 3;
  const line = (x0, y0, x1, y1) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  const vb = i => VB[i] * H;
  for (const px of [410, 860, 1030, 1350]) line(px, vb(5), px, vb(6));
  for (const px of [210, 530, 950, 1250, 1480]) { line(px, vb(3), px, vb(4)); line(W - px, vb(7), W - px, vb(8)); }
  for (const i of [2, 3, 4, 5, 6, 7, 8, 9]) line(0, vb(i), W, vb(i));
  for (let px = 0; px < W; px += 180) line(px, vb(0) + 20, px, vb(1) - 20);
  x.fillStyle = '#d0d0d0';
  for (let px = 430; px < 1450; px += 23) { x.fillRect(px, vb(5) + 13, 3, 3); x.fillRect(px, vb(6) - 16, 3, 3); }
  return c;
}

function paintCarbon() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
    const v = (i + j) % 4 < 2;
    const g = x.createLinearGradient(i * 8, j * 8, i * 8 + (v ? 8 : 0), j * 8 + (v ? 0 : 8));
    g.addColorStop(0, v ? '#2b3039' : '#14171c'); g.addColorStop(1, v ? '#14171c' : '#2b3039');
    x.fillStyle = g; x.fillRect(i * 8, j * 8, 8, 8);
  }
  return c;
}

export async function applyLivery(root, renderer) {
  try { await document.fonts.ready; } catch (e) { /* fonts optional */ }
  const tex = canvas => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  };
  const hull = tex(paintHull()), panel = tex(paintPanel());
  const bump = new THREE.CanvasTexture(paintBump()); bump.flipY = false;
  const carbon = tex(paintCarbon()); carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping; carbon.repeat.set(10, 10);
  root.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (m.name === 'fsr_livery') { m.map = hull; m.bumpMap = bump; m.bumpScale = 3; m.color.set(0xffffff); m.needsUpdate = true; }
      if (m.name === 'fsr_carbon') { m.map = carbon; m.color.set(0xffffff); m.needsUpdate = true; }
      if (m.name === 'fsr_panel') { m.map = panel; m.color.set(0xffffff); m.needsUpdate = true; }
    });
  });
}
