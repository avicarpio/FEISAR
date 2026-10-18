/* ==========================================================
   FEISAR livery (classic hard-surface craft, v5) — painted at runtime on canvas.
   UV layout comes from tools/build_feisar.py:
   hull    x = ship length fraction (0 nose → 1 tail), y = band around the faceted profile (VB)
   wing    x = root → tip, y = 0 leading edge → .55 trailing edge
   fin     region x 0–.5, y .55–1 (upper fins) and x .5–1, y 0–.5 (pod emblem plates)
   hazard  warning plate on the engine block
   (js/livery_hd.js paints the Wipeout HD FX350 recreation from tools/build_feisar_hd.py)
   ========================================================== */
import * as THREE from 'three';

// strips: bottom, chineR, sideR, shoulderR, shoulderTopR, deckR, grooveR, grooveBottom, grooveL, deckL,
//         shoulderTopL, shoulderL, sideL, chineL
const VB = [0, .2299, .2874, .4023, .4713, .5172, .5747, .5977, .6322, .6552, .7126, .7586, .8276, .9425, 1];
const C = {
  teal: '#2fa3cf', tealDark: '#1d7fae', white: '#eef2f6', grey: '#c9d2dc', yellow: '#f2c418',
  dark: '#2b313a', black: '#14181f', ink: '#0a1530', red: '#e5293b',
};

function text(x, str, { cx, cy, size, font, color, weight = '', align = 'left', flipX = false, flipY = false, spacing = 0 }) {
  x.save(); x.translate(cx, cy); x.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  x.font = `${weight} ${size}px ${font}`; x.textBaseline = 'middle'; x.textAlign = align;
  if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
  x.fillStyle = color; x.fillText(str, 0, 0); x.restore();
}

function roundel(x, cx, cy, r) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = C.ink; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, r * .86, 0, 7); x.fill();
  x.beginPath(); x.arc(0, 0, r * .8, 0, 7); x.clip();
  x.fillStyle = '#1a8fc4'; x.beginPath(); x.moveTo(-r, -r * .1); x.bezierCurveTo(-r * .3, -r * .2, -r * .1, -r * .9, r, -r * .75); x.lineTo(r, -r); x.lineTo(-r, -r); x.fill();
  x.fillStyle = C.yellow; x.beginPath(); x.moveTo(-r, r * .55); x.bezierCurveTo(-r * .2, r * .45, 0, r * .2, r, r * .25); x.lineTo(r, r); x.lineTo(-r, r); x.fill();
  x.restore();
}

function hazard(x, x0, y0, w, h, step = 26) {
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip();
  x.fillStyle = C.yellow; x.fillRect(x0, y0, w, h);
  x.fillStyle = C.ink;
  for (let i = -Math.ceil(h / step) - 2; i < w / step + 2; i++) {
    const a = x0 + i * step * 2;
    x.beginPath(); x.moveTo(a, y0); x.lineTo(a + step, y0); x.lineTo(a + step + h, y0 + h); x.lineTo(a + h, y0 + h); x.fill();
  }
  x.restore();
}

function paintHull() {
  const W = 4096, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const b = i => [VB[i] * H, VB[i + 1] * H];
  const U = u => u * W;
  x.fillStyle = C.teal; x.fillRect(0, 0, W, H);

  // yellow aft section; on the flanks the boundary rakes back toward the belly
  x.fillStyle = C.yellow;
  const rakeU = v => {            // v: 0 at the deck edge → 1 at the keel (per side)
    return .45 + .15 * v;
  };
  // right side: strips 1..4, VB increases upward (deck edge at VB[5], keel at VB[1])
  // left side: strips 10..13, VB increases downward (deck edge at VB[10], keel at VB[14])
  const flank = (yDeck, yKeel) => {
    x.beginPath();
    x.moveTo(U(rakeU(0)), yDeck); x.lineTo(W, yDeck); x.lineTo(W, yKeel); x.lineTo(U(rakeU(1)), yKeel); x.closePath(); x.fill();
  };
  flank(VB[5] * H, VB[1] * H);
  flank(VB[10] * H, VB[14] * H);
  x.fillRect(U(.45), VB[5] * H, W, (VB[10] - VB[5]) * H);           // deck
  x.fillRect(U(.6), 0, W, VB[1] * H);                                // belly
  x.fillRect(U(.6), VB[14] * H - 2, W, H);
  // white pinstripe ahead of the rake
  x.strokeStyle = C.white; x.lineWidth = 12;
  x.beginPath(); x.moveTo(U(.435), VB[5] * H); x.lineTo(U(.585), VB[1] * H); x.stroke();
  x.beginPath(); x.moveTo(U(.435), VB[10] * H); x.lineTo(U(.585), VB[14] * H); x.stroke();
  // deck groove + edge pinstripes
  for (const i of [6, 7, 8]) { const [a, bb] = b(i); x.fillStyle = C.black; x.fillRect(0, a, U(.47), bb - a); }
  for (const i of [5, 9]) { const [a, bb] = b(i); x.fillStyle = C.white; x.fillRect(U(.04), (a + bb) / 2 - 3, U(.38), 6); }

  // flank graphics (right side reads with flipY, left side with flipX)
  const sides = [{ s: b(2), fy: true, fx: false }, { s: b(12), fy: false, fx: true }];
  for (const sd of sides) {
    const at = u => sd.fx ? W - U(u) : U(u);
    const al = sd.fx ? 'right' : 'left';
    const [a, bb] = sd.s, mid = (a + bb) / 2, hh = bb - a;
    const up = sd.fy ? 1 : -1; // canvas direction that is "up" on the ship
    text(x, 'feisar.', { cx: at(.045), cy: mid + up * hh * .2, size: 70, font: 'Michroma, sans-serif', color: C.white, flipX: sd.fx, flipY: sd.fy, align: al });
    text(x, 'race for e-unity', { cx: at(.05), cy: mid - up * hh * .27, size: 32, font: 'Saira, sans-serif', weight: 600, color: C.white, flipX: sd.fx, flipY: sd.fy, align: al, spacing: 2 });
    x.fillStyle = C.yellow;
    for (let k = 0; k < 3; k++) {
      const cx = at(.25 + k * .028), d = sd.fx ? 1 : -1;
      x.beginPath(); x.moveTo(cx, mid - 32); x.lineTo(cx + d * 34, mid); x.lineTo(cx, mid + 32); x.lineTo(cx + d * 15, mid); x.closePath(); x.fill();
    }
    roundel(x, at(.5), mid, 52);
    text(x, 'mogoc', { cx: at(.69), cy: mid, size: 62, font: 'Michroma, sans-serif', color: C.ink, flipX: sd.fx, flipY: sd.fy, align: al });
    for (const u of [.38, .58]) {
      const cx = at(u);
      x.strokeStyle = C.red; x.lineWidth = 5;
      x.beginPath(); x.moveTo(cx, mid - 16 * up); x.lineTo(cx + 16, mid + 12 * up); x.lineTo(cx - 16, mid + 12 * up); x.closePath(); x.stroke();
    }
    hazard(x, sd.fx ? 0 : U(.93), a, U(.07), hh, 20);
  }
  return c;
}

function paintWing() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = C.yellow; x.fillRect(0, 0, W, H);
  hazard(x, W * .45, 0, W * .55, H * .1, 22);
  hazard(x, W * .9, 0, W * .1, H * .55, 22);
  x.fillStyle = C.teal; x.fillRect(0, 0, W * .12, H * .55);
  x.fillStyle = C.white; x.fillRect(W * .12, 0, 10, H * .55);
  x.strokeStyle = 'rgba(10,21,48,.35)'; x.lineWidth = 3;
  for (const f of [.35, .6]) { x.beginPath(); x.moveTo(W * f, 0); x.lineTo(W * f, H * .55); x.stroke(); }
  text(x, 'FEISAR', { cx: W * .2, cy: H * .32, size: 60, font: 'Michroma, sans-serif', color: C.ink });
  return c;
}

function paintFin() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = C.yellow; x.fillRect(0, 0, W, H);
  hazard(x, W * .25, H * .55, W * .25, H * .45, 20);
  x.fillStyle = C.teal; x.fillRect(0, H * .55, W * .06, H * .45);
  x.fillStyle = C.yellow; x.fillRect(W * .5, 0, W * .5, H * .5);
  x.strokeStyle = C.ink; x.lineWidth = 6; x.strokeRect(W * .5 + 12, 12, W * .5 - 24, H * .5 - 24);
  roundel(x, W * .75, H * .2, 110);
  text(x, 'AG-SYS · FX350', { cx: W * .75, cy: H * .42, size: 34, font: '"JetBrains Mono", monospace', weight: 500, color: C.ink, align: 'center', spacing: 4 });
  return c;
}

function paintHazard() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = C.dark; x.fillRect(0, 0, W, H);
  hazard(x, 0, 0, W, 60, 24); hazard(x, 0, H - 60, W, 60, 24);
  x.save(); x.translate(W * .5, H * .45);
  x.fillStyle = C.yellow; x.beginPath(); x.arc(0, 0, 150, 0, 7); x.fill();
  x.fillStyle = C.ink;
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 - Math.PI / 2; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, 130, a - .5, a + .5); x.closePath(); x.fill(); }
  x.fillStyle = C.yellow; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill();
  x.fillStyle = C.ink; x.beginPath(); x.arc(0, 0, 24, 0, 7); x.fill();
  x.restore();
  text(x, 'WARNING', { cx: W * .5, cy: H * .78, size: 64, font: 'Michroma, sans-serif', color: C.yellow, align: 'center' });
  text(x, 'FUSION CORE', { cx: W * .5, cy: H * .85, size: 30, font: '"JetBrains Mono", monospace', weight: 500, color: C.yellow, align: 'center', spacing: 4 });
  return c;
}

function paintBump() {
  const W = 2048, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#2a2a2a'; x.lineWidth = 3;
  const line = (a, bb, cc, d) => { x.beginPath(); x.moveTo(a, bb); x.lineTo(cc, d); x.stroke(); };
  const seams = [.12, .24, .36, .47, .6, .72, .86];
  for (const u of seams) line(u * W, 0, u * W, H);
  for (const i of [2, 12]) line(0, ((VB[i] + VB[i + 1]) / 2) * H, W, ((VB[i] + VB[i + 1]) / 2) * H);
  x.fillStyle = '#d6d6d6';
  for (const u of seams) for (let y = 6; y < H; y += 14) x.fillRect(u * W + 5, y, 3, 3);
  for (const i of [2, 12]) for (let u = 0; u < W; u += 18) { x.fillRect(u, VB[i] * H + 5, 3, 3); x.fillRect(u, VB[i + 1] * H - 8, 3, 3); }
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
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const tex = (canvas, srgb = true) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false; t.anisotropy = aniso;
    return t;
  };
  const maps = { fsr_livery: tex(paintHull()), fsr_wing: tex(paintWing()), fsr_fin: tex(paintFin()), fsr_hazard: tex(paintHazard()) };
  const bump = tex(paintBump(), false);
  const carbon = tex(paintCarbon()); carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping; carbon.repeat.set(10, 10);
  root.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (maps[m.name]) {
        m.map = maps[m.name]; m.color.set(0xffffff);
        if (m.name === 'fsr_livery') { m.bumpMap = bump; m.bumpScale = 3; }
      } else if (m.name === 'fsr_carbon') { m.map = carbon; m.color.set(0xffffff); } else return;
      m.needsUpdate = true;
    });
  });
}
