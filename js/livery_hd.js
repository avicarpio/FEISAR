/* ==========================================================
   FEISAR FX350 (Wipeout HD) livery — painted at runtime on canvas.
   UV layout comes from tools/build_feisar.py:
   hull  x = 0 nose → 1 rear face, y = band around the hull profile (VB)
   wing  x = 0..0.5 top surface (leading → trailing edge), 0.5..1 underside (trailing → leading),
         y = 0 root → 1 tip (both wings share it, so the art is symmetric)
   ========================================================== */
import * as THREE from 'three';

// strips: bottom, lipR, lowerR, upperR, shoulderR, deckR, crown, deckL, shoulderL, upperL, lowerL, lipL
const VB = [0, .30, .34, .42, .50, .56, .61, .69, .74, .80, .88, .96, 1];
const C = {
  teal: '#2fa3cf', tealDark: '#1d7fae', white: '#eef2f6', grey: '#c9d2dc', yellow: '#f2c418',
  dark: '#2b313a', black: '#14181f', ink: '#0a1530', red: '#e5293b', blue: '#0047bb',
};

function text(x, str, { cx, cy, size, font, color, weight = '', align = 'left', flipX = false, flipY = false, spacing = 0, stroke = 0 }) {
  x.save();
  x.translate(cx, cy);
  x.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  x.font = `${weight} ${size}px ${font}`;
  x.textBaseline = 'middle'; x.textAlign = align;
  if ('letterSpacing' in x) x.letterSpacing = spacing + 'px';
  if (stroke) { x.lineWidth = stroke; x.strokeStyle = color; x.strokeText(str, 0, 0); }
  else { x.fillStyle = color; x.fillText(str, 0, 0); }
  x.restore();
}

// FEISAR roundel: white disc, blue swoosh, yellow base
function roundel(x, cx, cy, r) {
  x.save(); x.translate(cx, cy);
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
  x.beginPath(); x.arc(0, 0, r * .9, 0, 7); x.clip();
  x.fillStyle = '#1a8fc4'; x.beginPath(); x.moveTo(-r, -r * .1); x.bezierCurveTo(-r * .3, -r * .2, -r * .1, -r * .9, r, -r * .75); x.lineTo(r, -r); x.lineTo(-r, -r); x.fill();
  x.fillStyle = '#9fd4ec'; x.fillRect(-r, -r * .05, r * 2, r * .14);
  x.fillStyle = C.yellow; x.beginPath(); x.moveTo(-r, r * .55); x.bezierCurveTo(-r * .2, r * .45, 0, r * .2, r, r * .25); x.lineTo(r, r); x.lineTo(-r, r); x.fill();
  x.restore();
}

function paintHull() {
  const W = 4096, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const band = i => [VB[i] * H, VB[i + 1] * H];
  const fill = (i, col, x0 = 0, x1 = 1) => { const [a, b] = band(i); x.fillStyle = col; x.fillRect(x0 * W, a, (x1 - x0) * W, b - a); };
  const U = u => u / .905 * W; // ship length fraction -> canvas x

  fill(0, C.dark); fill(1, C.black); fill(11, C.black);
  for (const i of [2, 3, 4, 8, 9, 10]) fill(i, C.teal);
  for (const i of [5, 7]) fill(i, C.grey);
  fill(6, C.white);
  // light grey mid-body panel on the lower sides (as in the side elevation)
  for (const i of [2, 10]) fill(i, C.white, .25 / .905, .62 / .905);
  for (const i of [3, 9]) fill(i, C.grey, .44 / .905, .62 / .905);
  // nose cap tint
  for (const i of [5, 6, 7]) fill(i, C.teal, 0, .06 / .905);

  // side graphics: right side reads with flipY, left side with flipX
  const sides = [{ up: band(3), lo: band(2), fy: true, fx: false }, { up: band(9), lo: band(10), fy: false, fx: true }];
  for (const s of sides) {
    const at = u => s.fx ? W - U(u) : U(u);
    const uc = (s.up[0] + s.up[1]) / 2, lc = (s.lo[0] + s.lo[1]) / 2;
    const al = s.fx ? 'right' : 'left';
    text(x, 'feisar.', { cx: at(.05), cy: uc, size: 70, font: 'Michroma, sans-serif', color: C.white, flipX: s.fx, flipY: s.fy, align: al });
    text(x, 'race for e-unity', { cx: at(.06), cy: lc, size: 40, font: 'Saira, sans-serif', weight: 600, color: C.white, flipX: s.fx, flipY: s.fy, align: al, spacing: 2 });
    text(x, 'mogoc', { cx: at(.535), cy: uc + (s.fy ? -4 : 4), size: 78, font: 'Michroma, sans-serif', color: C.ink, flipX: s.fx, flipY: s.fy, align: al });
    text(x, 'FX350 · BOLOGNA BUILD', { cx: at(.535), cy: lc, size: 24, font: '"JetBrains Mono", monospace', weight: 500, color: C.ink, flipX: s.fx, flipY: s.fy, align: al, spacing: 3 });
    // panel seams + red/white hazard tabs
    x.strokeStyle = 'rgba(10,21,48,.35)'; x.lineWidth = 3;
    for (const u of [.17, .36, .44, .62, .74]) { x.beginPath(); x.moveTo(at(u), s.up[0]); x.lineTo(at(u), s.lo[1]); x.stroke(); }
    x.fillStyle = C.red; x.fillRect(at(.415) - 14, uc - 14, 28, 28);
    x.fillStyle = C.white; x.fillRect(at(.415) - 6, uc - 6, 12, 12);
    // tail vent grille
    x.fillStyle = 'rgba(10,21,48,.85)';
    for (let k = 0; k < 8; k++) x.fillRect(at(.8) + (s.fx ? -1 : 1) * k * 22, uc - 26, (s.fx ? -1 : 1) * 10, 52);
  }
  // deck: teal edge pinlines, roundel, small print
  for (const i of [5, 7]) { const [a, b] = band(i); x.fillStyle = C.teal; x.fillRect(U(.06), (a + b) / 2 - 3, U(.4), 6); }
  const [c0, c1] = band(6), cc = (c0 + c1) / 2;
  roundel(x, U(.33), cc, 62);
  text(x, 'FEISAR', { cx: U(.14), cy: cc, size: 64, font: 'Michroma, sans-serif', color: C.teal, flipY: true });
  // underside panels
  const [b0, b1] = band(0);
  x.fillStyle = 'rgba(255,255,255,.06)';
  for (let k = 0; k < 8; k++) x.fillRect(200 + k * 480, b0 + 30, 400, b1 - b0 - 60);
  return c;
}

function paintWing() {
  const W = 2048, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const T = (q, s) => [q * W * .5, s * H];          // top surface
  const Bt = (q, s) => [W - q * W * .5, s * H];      // underside
  // base
  x.fillStyle = C.teal; x.fillRect(0, 0, W / 2, H);
  x.fillStyle = C.tealDark; x.fillRect(W / 2, 0, W / 2, H);
  // root band (the yellow chevron of the top elevation)
  x.fillStyle = C.yellow; x.fillRect(0, 0, W / 2, H * .07);
  // leading-edge yellow band, widest at the root, then grey stripe
  const poly = (pts, col) => { x.fillStyle = col; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
  poly([T(0, 0), T(.36, 0), T(.3, .55), T(.12, 1), T(0, 1)], C.yellow);
  poly([T(.36, 0), T(.44, 0), T(.38, .55), T(.18, 1), T(.12, 1), T(.3, .55)], C.grey);
  poly([Bt(0, 0), Bt(.3, 0), Bt(.2, 1), Bt(0, 1)], C.yellow);
  // wingtip oval "eye"
  const [ox, oy] = T(.64, .86);
  x.save(); x.translate(ox, oy); x.scale(1, 1.25);
  x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(0, 0, 150, 100, 0, 0, 7); x.fill();
  x.beginPath(); x.ellipse(0, 0, 138, 88, 0, 0, 7); x.clip();
  x.fillStyle = C.grey; x.fillRect(-160, -30, 320, 18); x.fillRect(-160, 0, 320, 10);
  x.fillStyle = C.yellow; x.fillRect(-160, 30, 320, 80);
  x.restore();
  x.strokeStyle = C.ink; x.lineWidth = 6; x.beginPath(); x.ellipse(ox, oy, 150, 125, 0, 0, 7); x.stroke();
  // trailing-edge dark band + hazard
  x.fillStyle = C.black; x.fillRect(T(.96, 0)[0], 0, W * .02, H);
  x.save(); x.beginPath(); x.rect(T(.88, .55)[0], H * .55, W * .035, H * .22); x.clip();
  for (let i = -4; i < 30; i++) { x.fillStyle = i % 2 ? C.yellow : C.ink; x.fillRect(T(.88, 0)[0], H * .55 + i * 24, W * .04, 12); }
  x.restore();
  // small decals
  x.fillStyle = C.red; x.fillRect(T(.8, .62)[0], T(.8, .62)[1], 40, 26);
  x.fillStyle = C.white; x.fillRect(T(.8, .62)[0] + 6, T(.8, .62)[1] + 6, 12, 14);
  // panel seams
  x.strokeStyle = 'rgba(10,21,48,.3)'; x.lineWidth = 3;
  for (const s of [.4, .62]) { x.beginPath(); x.moveTo(0, s * H); x.lineTo(W / 2, s * H); x.stroke(); }
  for (const q of [.55, .8]) { x.beginPath(); x.moveTo(T(q, 0)[0], 0); x.lineTo(T(q, 0)[0], H); x.stroke(); }
  return c;
}

function paintCheek() {
  // u: front -> rear of the flank (ship u .53 - .88), v: shoulder (top) -> belly (bottom)
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const band = (a0, a1, b0, b1, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(a0 * W, 0); x.lineTo(a1 * W, 0); x.lineTo(b1 * W, H); x.lineTo(b0 * W, H); x.closePath(); x.fill(); };
  x.fillStyle = C.teal; x.fillRect(0, 0, W, H);
  band(0, .09, 0, .31, C.grey);
  band(.09, .37, .31, .57, C.yellow);
  band(.37, .46, .57, .66, C.grey);
  x.fillStyle = 'rgba(10,21,48,.3)'; x.fillRect(0, H * .92, W, H * .08);
  x.strokeStyle = 'rgba(10,21,48,.35)'; x.lineWidth = 3;
  for (const u of [.5, .75]) { x.beginPath(); x.moveTo(u * W, 0); x.lineTo(u * W, H); x.stroke(); }
  x.fillStyle = C.red; x.fillRect(W * .82, H * .7, 34, 22); x.fillStyle = C.white; x.fillRect(W * .82 + 6, H * .7 + 5, 10, 12);
  return c;
}

function paintBump(kind) {
  const W = 2048, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  x.strokeStyle = '#2c2c2c'; x.lineWidth = 3;
  const line = (a, b, cc, d) => { x.beginPath(); x.moveTo(a, b); x.lineTo(cc, d); x.stroke(); };
  if (kind === 'hull') {
    const U = u => u / .905 * W;
    for (const i of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) line(0, VB[i] * H, W, VB[i] * H);
    for (const u of [.17, .36, .44, .62, .74]) { line(U(u), VB[2] * H, U(u), VB[5] * H); line(W - 0, 0, W, 0); line(U(u), VB[7] * H, U(u), VB[10] * H); }
    x.fillStyle = '#d0d0d0';
    for (let u = .08; u < .45; u += .012) { x.fillRect(U(u), VB[6] * H + 8, 3, 3); x.fillRect(U(u), VB[7] * H - 10, 3, 3); }
  } else {
    for (const s of [.4, .62]) line(0, s * H, W / 2, s * H);
    for (const q of [.55, .8]) line(q * W * .5, 0, q * W * .5, H);
    x.fillStyle = '#d0d0d0';
    for (let s = .05; s < .95; s += .03) x.fillRect(.02 * W, s * H, 3, 3);
  }
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
  const hull = tex(paintHull()), wing = tex(paintWing()), cheek = tex(paintCheek());
  const hullBump = tex(paintBump('hull'), false), wingBump = tex(paintBump('wing'), false);
  const carbon = tex(paintCarbon()); carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping; carbon.repeat.set(10, 10);
  root.traverse(o => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (m.name === 'fsr_livery') { m.map = hull; m.bumpMap = hullBump; m.bumpScale = 3; m.color.set(0xffffff); }
      else if (m.name === 'fsr_wing') { m.map = wing; m.bumpMap = wingBump; m.bumpScale = 3; m.color.set(0xffffff); }
      else if (m.name === 'fsr_cheek') { m.map = cheek; m.color.set(0xffffff); }
      else if (m.name === 'fsr_carbon') { m.map = carbon; m.color.set(0xffffff); }
      else return;
      m.needsUpdate = true;
    });
  });
}
