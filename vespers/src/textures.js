// Every texture in the game is painted procedurally onto small canvases.
// Low resolution + nearest filtering on purpose: it's a PS1-style look that hides what it should.
import * as THREE from 'three';
import { R } from './state.js';

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; }
export function toTex(c, { repeat = false, nearest = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) t.magFilter = THREE.NearestFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const circle = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.3, r), 0, 6.2832); ctx.fill(); };

function addNoise(ctx, w, h, amt, tint = 0) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (R() - 0.5) * amt;
    d[i] += n + (R() - 0.5) * tint; d[i + 1] += n; d[i + 2] += n + (R() - 0.5) * tint;
  }
  ctx.putImageData(img, 0, 0);
}
function stains(ctx, w, h, n, col = '30,24,12', maxA = 0.3) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, y = R() * h, r = 4 + R() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${0.08 + R() * maxA})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function streaks(ctx, w, y0, h, n, col = '35,28,15', a = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = R() * w, len = 10 + R() * (h - y0);
    const g = ctx.createLinearGradient(x, y0, x, y0 + len);
    g.addColorStop(0, `rgba(${col},${a * (0.5 + R())})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x, y0, 1 + R() * 3, len);
  }
}
function bottomGrime(ctx, w, h, height, a = 0.6) {
  const g = ctx.createLinearGradient(0, h - height, 0, h);
  g.addColorStop(0, 'rgba(18,14,8,0)'); g.addColorStop(1, `rgba(18,14,8,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, h - height, w, height);
}
function cracks(ctx, w, h, n) {
  ctx.strokeStyle = 'rgba(10,10,8,0.55)'; ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = R() * w, y = R() * h; ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (R() - 0.5) * 14; y += (R() - 0.3) * 12; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// ---------- blood painting ----------
export function bloodRGBA(a = 1, dark = 0) {
  const r = Math.floor((105 + R() * 55) * (1 - dark));
  return `rgba(${r},${Math.floor(R() * 8)},${Math.floor(R() * 6)},${a})`;
}
export function drawSplat(ctx, cx, cy, r, a = 1) {
  ctx.fillStyle = bloodRGBA(a);
  for (let i = 0; i < 8; i++) { const an = R() * 6.28, d = R() * r * 0.5; circle(ctx, cx + Math.cos(an) * d, cy + Math.sin(an) * d, r * (0.3 + R() * 0.4)); }
  const n = 10 + (R() * 14 | 0);
  for (let i = 0; i < n; i++) {
    const an = R() * 6.28, len = r * (0.8 + R() * 1.6), w = r * 0.12 * (0.4 + R());
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(an + 1.57) * w, cy + Math.sin(an + 1.57) * w);
    ctx.lineTo(cx + Math.cos(an) * len, cy + Math.sin(an) * len);
    ctx.lineTo(cx + Math.cos(an - 1.57) * w, cy + Math.sin(an - 1.57) * w); ctx.fill();
    circle(ctx, cx + Math.cos(an) * len * 1.12, cy + Math.sin(an) * len * 1.12, r * 0.06 * (0.5 + R() * 1.5));
  }
  for (let i = 0; i < 22; i++) { const an = R() * 6.28, d = r * (1 + R() * 2.2); circle(ctx, cx + Math.cos(an) * d, cy + Math.sin(an) * d, r * 0.03 * (0.5 + R() * 2)); }
}
export function drawPool(ctx, cx, cy, r) {
  const n = 28, rad = [];
  for (let i = 0; i < n; i++) rad.push(r * (0.7 + R() * 0.5));
  for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) rad[i] = (rad[i] + rad[(i + 1) % n] + rad[(i + n - 1) % n]) / 3;
  const shape = (s, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i <= n; i++) { const a = i / n * 6.2832, rr = rad[i % n] * s; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85); }
    ctx.fill();
  };
  shape(1.0, 'rgba(48,0,0,0.97)'); shape(0.86, 'rgba(92,3,3,0.97)'); shape(0.55, 'rgba(110,6,6,0.9)');
  ctx.fillStyle = 'rgba(150,40,35,0.18)'; ctx.beginPath(); ctx.ellipse(cx - r * 0.2, cy - r * 0.25, r * 0.18, r * 0.05, -0.4, 0, 6.28); ctx.fill();
  for (let i = 0; i < 6; i++) { const a = R() * 6.28; ctx.fillStyle = bloodRGBA(0.9, 0.4); circle(ctx, cx + Math.cos(a) * r * 1.15, cy + Math.sin(a) * r * 0.95, r * 0.06 * (1 + R())); }
}
export function drawDrips(ctx, x, y, len, w) {
  ctx.fillStyle = bloodRGBA(0.92);
  ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.45, y + len); ctx.lineTo(x - w * 0.45, y + len); ctx.fill();
  circle(ctx, x, y + len, w * 0.75);
}
export function drawHand(ctx, cx, cy, s, rot) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = bloodRGBA(0.85);
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.5, 0, 0, 6.28); ctx.fill();
  const fing = [[-0.3, -0.55, 0.5], [-0.1, -0.68, 0.62], [0.1, -0.66, 0.6], [0.29, -0.55, 0.48]];
  for (const [fx, fy, l] of fing) { ctx.save(); ctx.translate(fx * s, fy * s); ctx.rotate(fx * 0.4); ctx.fillRect(-s * 0.075, -l * s * 0.8, s * 0.15, l * s * 0.85); circle(ctx, 0, -l * s * 0.8, s * 0.075); ctx.restore(); }
  ctx.save(); ctx.translate(-s * 0.42, -s * 0.05); ctx.rotate(-0.9); ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.42); ctx.restore();
  for (let i = 0; i < 4; i++) drawDrips(ctx, (R() - 0.5) * s * 0.7, s * 0.3, s * (0.3 + R() * 1.2), s * 0.04);
  ctx.restore();
}
export function drawSmear(ctx, x0, y0, x1, y1, w) {
  for (let i = 0; i < w * 1.6; i++) {
    ctx.strokeStyle = bloodRGBA(0.08 + R() * 0.28); ctx.lineWidth = 1 + R() * 2.5;
    const o = (R() - 0.5) * w, o2 = o + (R() - 0.5) * w * 0.3;
    ctx.beginPath(); ctx.moveTo(x0 + (R() - 0.5) * 6, y0 + o); ctx.lineTo(x1 + (R() - 0.5) * 6, y1 + o2); ctx.stroke();
  }
}
function bloodyOver(ctx, w, h, amount) {
  // drips running down from random heights, smears at hand height, handprints, spatter
  const n = Math.floor(amount * 6);
  for (let i = 0; i < n; i++) drawSplat(ctx, R() * w, h * (0.2 + R() * 0.6), 3 + R() * 7, 0.85);
  for (let i = 0; i < n * 2; i++) drawDrips(ctx, R() * w, h * (0.15 + R() * 0.5), 10 + R() * 60, 0.8 + R() * 1.4);
  if (R() < amount) drawSmear(ctx, R() * w * 0.3, h * (0.45 + R() * 0.2), w * (0.6 + R() * 0.4), h * (0.5 + R() * 0.25), 8 + R() * 10);
  if (R() < amount * 0.8) drawHand(ctx, 15 + R() * (w - 30), h * (0.35 + R() * 0.3), 10 + R() * 4, (R() - 0.5) * 1.2);
  if (R() < amount * 0.5) drawHand(ctx, 15 + R() * (w - 30), h * (0.4 + R() * 0.3), 10 + R() * 4, (R() - 0.5) * 1.2);
}

// ---------- walls (one texture = one 2.5 m wide wall section, full height) ----------
export function wallTiles(bloody = 0, dirt = 1) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#50584c'; x.fillRect(0, 0, w, h);
  addNoise(x, w, h, 16);
  stains(x, w, 60, 10, '25,30,15');
  const ty = 62, ts = 16;
  for (let yy = ty; yy < h; yy += ts) for (let xx = 0; xx < w; xx += ts) {
    const v = 150 + R() * 30, yel = R() * 18;
    x.fillStyle = R() < 0.03 * dirt ? '#2a2620' : `rgb(${v + 6 | 0},${v + 4 | 0},${v - yel | 0})`;
    x.fillRect(xx + 1, yy + 1, ts - 1, ts - 1);
  }
  x.fillStyle = '#2b3029'; x.fillRect(0, ty - 4, w, 5);
  addNoise(x, w, h, 14);
  streaks(x, w, ty, h, 14 * dirt);
  stains(x, w, h, 18 * dirt, '40,32,16', 0.35);
  cracks(x, w, h, 4 * dirt);
  bottomGrime(x, w, h, 50, 0.75);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
export function wallConcrete(bloody = 0, tone = [88, 90, 84]) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = `rgb(${tone})`; x.fillRect(0, 0, w, h);
  addNoise(x, w, h, 26, 6);
  stains(x, w, h, 30, '20,18,10', 0.4);
  streaks(x, w, 0, h, 22);
  cracks(x, w, h, 6);
  // form-work lines
  x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 52, w, 1); x.fillRect(0, 106, w, 1);
  bottomGrime(x, w, h, 70, 0.8);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
export function wallBrick(bloody = 0) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#231a16'; x.fillRect(0, 0, w, h);
  for (let row = 0, yy = 0; yy < h; row++, yy += 10) for (let xx = -(row % 2) * 12; xx < w; xx += 24) {
    const v = 70 + R() * 35; x.fillStyle = `rgb(${v + 20 | 0},${v * 0.55 | 0},${v * 0.42 | 0})`; x.fillRect(xx + 1, yy + 1, 22, 8);
  }
  addNoise(x, w, h, 18);
  stains(x, w, h, 26, '10,10,6', 0.45); streaks(x, w, 0, h, 30, '20,24,18', 0.45);
  bottomGrime(x, w, h, 80, 0.85);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
export function wallOffice(bloody = 0) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#7a7058'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 14);
  // peeling paint
  for (let i = 0; i < 10; i++) { x.fillStyle = 'rgba(60,58,48,0.8)'; x.beginPath(); const px = R() * w, py = R() * 90; x.ellipse(px, py, 3 + R() * 8, 2 + R() * 5, R() * 3, 0, 6.28); x.fill(); }
  // wood paneling
  for (let xx = 0; xx < w; xx += 16) { const v = 50 + R() * 15; x.fillStyle = `rgb(${v + 15 | 0},${v * 0.7 | 0},${v * 0.45 | 0})`; x.fillRect(xx, 96, 15, h - 96); }
  x.fillStyle = '#2a1e12'; x.fillRect(0, 92, w, 5);
  addNoise(x, w, h, 10);
  stains(x, w, h, 16, '30,22,10', 0.35); streaks(x, w, 0, 96, 10);
  bottomGrime(x, w, h, 30, 0.6);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
export function wallMetal() {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#4a4c4c'; x.fillRect(0, 0, w, h);
  for (let yy = 0; yy < h; yy++) { x.fillStyle = `rgba(255,255,255,${R() * 0.05})`; x.fillRect(0, yy, w, 1); }
  for (let xx = 0; xx < w; xx += 32) { x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(xx, 0, 2, h); for (let yy = 6; yy < h; yy += 24) { x.fillStyle = '#777'; x.fillRect(xx + 4, yy, 2, 2); x.fillRect(xx + 26, yy, 2, 2); } }
  stains(x, w, h, 26, '70,35,10', 0.45); streaks(x, w, 0, h, 18, '80,40,12', 0.4);
  bottomGrime(x, w, h, 40, 0.7);
  return toTex(c);
}

// ---------- floors (one texture = one 2.5 m tile) ----------
export function floorQuarry(bloody = 0) {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1c1210'; x.fillRect(0, 0, w, h);
  for (let yy = 0; yy < h; yy += 16) for (let xx = 0; xx < w; xx += 16) {
    const v = 52 + R() * 18; x.fillStyle = `rgb(${v + 22 | 0},${v * 0.6 | 0},${v * 0.48 | 0})`; x.fillRect(xx + 1, yy + 1, 15, 15);
  }
  addNoise(x, w, h, 16);
  stains(x, w, h, 26, '12,8,4', 0.5);
  if (bloody) {
    for (let i = 0; i < bloody * 4; i++) drawSplat(x, R() * w, R() * h, 4 + R() * 9, 0.9);
    for (let i = 0; i < bloody * 2; i++) drawSmear(x, R() * w * 0.4, R() * h, w * (0.6 + R() * 0.4), R() * h, 10);
    if (R() < bloody * 0.5) drawPool(x, R() * w, R() * h, 12 + R() * 14);
  }
  return toTex(c);
}
export function floorConcrete(bloody = 0, drain = false) {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#3c3c38'; x.fillRect(0, 0, w, h);
  addNoise(x, w, h, 22, 4); stains(x, w, h, 36, '14,12,6', 0.45); cracks(x, w, h, 5);
  if (drain) {
    x.fillStyle = '#0b0b0b'; x.fillRect(52, 52, 24, 24); x.fillStyle = '#4b4b48';
    for (let i = 0; i < 6; i++) x.fillRect(54 + i * 4, 54, 1, 20);
    const g = x.createRadialGradient(64, 64, 8, 64, 64, 34); g.addColorStop(0, 'rgba(80,0,0,0.85)'); g.addColorStop(1, 'rgba(60,0,0,0)'); x.fillStyle = g; x.fillRect(20, 20, 88, 88);
  }
  if (bloody) { for (let i = 0; i < bloody * 4; i++) drawSplat(x, R() * w, R() * h, 4 + R() * 9, 0.9); if (R() < bloody * 0.5) drawPool(x, R() * w, R() * h, 12 + R() * 14); }
  return toTex(c);
}
export function floorLino() {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  for (let yy = 0; yy < h; yy += 32) for (let xx = 0; xx < w; xx += 32) { x.fillStyle = ((xx + yy) / 32) % 2 ? '#3f4a3a' : '#6a6a58'; x.fillRect(xx, yy, 32, 32); }
  addNoise(x, w, h, 14); stains(x, w, h, 30, '20,16,8', 0.45);
  return toTex(c);
}
export function ceilingTex() {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#2c2d2a'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 18);
  x.fillStyle = '#161714'; x.fillRect(0, 63, w, 2); x.fillRect(63, 0, 2, h);
  stains(x, w, h, 14, '45,35,15', 0.5);
  for (let i = 0; i < 2; i++) { const g = x.createRadialGradient(R() * w, R() * h, 2, R() * w, R() * h, 30); g.addColorStop(0, 'rgba(60,45,20,0.5)'); g.addColorStop(1, 'rgba(60,45,20,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  return toTex(c);
}

// ---------- materials for things ----------
export function lockerTex(bloody = false) {
  const w = 64, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#4d5a50'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 12);
  x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, 0, 2, h); x.fillRect(w - 2, 0, 2, h);
  for (let i = 0; i < 6; i++) { x.fillStyle = '#0c0c0c'; x.fillRect(14, 10 + i * 5, 36, 2); }
  for (let i = 0; i < 4; i++) { x.fillStyle = '#0c0c0c'; x.fillRect(14, 100 + i * 5, 36, 2); }
  x.fillStyle = '#999'; x.fillRect(48, 60, 4, 12);
  stains(x, w, h, 10, '80,40,10', 0.45); streaks(x, w, 0, h, 8, '70,35,10');
  if (bloody) { for (let i = 0; i < 9; i++) drawDrips(x, 6 + R() * 52, 30 + R() * 50, 20 + R() * 60, 1 + R()); drawHand(x, 32, 70, 12, 0.2); x.fillStyle = bloodRGBA(0.95); x.fillRect(0, h - 10, w, 10); }
  return toTex(c);
}
export function metalTex(rust = 0.4) {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#7a7d7e'; x.fillRect(0, 0, w, h);
  for (let yy = 0; yy < h; yy++) { x.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},${R() * 0.08})`; x.fillRect(0, yy, w, 1); }
  addNoise(x, w, h, 10); stains(x, w, h, 18 * rust, '90,40,12', 0.5); stains(x, w, h, 10, '10,10,10', 0.4);
  return toTex(c, { repeat: true });
}
export function muscleTex() {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#6a0c0c'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) {
    const v = 70 + R() * 90, yy = R() * h; x.strokeStyle = `rgba(${v | 0},${v * 0.1 | 0},${v * 0.1 | 0},0.7)`; x.lineWidth = 1 + R();
    x.beginPath(); x.moveTo(0, yy); x.bezierCurveTo(20, yy + (R() - 0.5) * 8, 44, yy + (R() - 0.5) * 8, 64, yy + (R() - 0.5) * 4); x.stroke();
  }
  for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(220,200,180,0.55)'; x.lineWidth = 1 + R() * 2; const yy = R() * h; x.beginPath(); x.moveTo(0, yy); x.lineTo(64, yy + (R() - 0.5) * 10); x.stroke(); }
  stains(x, w, h, 12, '30,0,10', 0.5);
  addNoise(x, w, h, 14);
  return toTex(c, { repeat: true });
}
export function meatTex() {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#7a1414'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 30, 10);
  for (let i = 0; i < 14; i++) { x.strokeStyle = `rgba(235,210,180,${0.4 + R() * 0.4})`; x.lineWidth = 1 + R() * 3; x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
  stains(x, w, h, 14, '40,0,20', 0.6); stains(x, w, h, 6, '160,40,40', 0.4);
  return toTex(c, { repeat: true });
}
export function skinTex(tone = [178, 150, 136], stitched = false) {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = `rgb(${tone})`; x.fillRect(0, 0, w, h); addNoise(x, w, h, 16, 6);
  stains(x, w, h, 10, '90,60,90', 0.4); stains(x, w, h, 8, '120,40,40', 0.35); stains(x, w, h, 10, '70,80,60', 0.25);
  if (stitched) {
    x.strokeStyle = 'rgba(30,10,10,0.9)'; x.lineWidth = 1;
    for (let s = 0; s < 3; s++) {
      const vert = R() < 0.5, p = 8 + R() * 48;
      x.beginPath(); vert ? (x.moveTo(p, 0), x.lineTo(p + (R() - 0.5) * 8, 64)) : (x.moveTo(0, p), x.lineTo(64, p + (R() - 0.5) * 8)); x.stroke();
      for (let k = 2; k < 64; k += 4) { x.beginPath(); vert ? (x.moveTo(p - 3, k), x.lineTo(p + 3, k + 2)) : (x.moveTo(k, p - 3), x.lineTo(k + 2, p + 3)); x.stroke(); }
      x.fillStyle = 'rgba(110,10,10,0.6)'; for (let k = 0; k < 6; k++) circle(x, vert ? p : R() * 64, vert ? R() * 64 : p, 1.5);
    }
  }
  return toTex(c, { repeat: true });
}
export function boneTex() {
  const w = 32, h = 32, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#cfc4a6'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 22); stains(x, w, h, 6, '90,50,30', 0.5); stains(x, w, h, 4, '90,10,10', 0.5);
  return toTex(c, { repeat: true });
}
export function beltTex() {
  const w = 64, h = 16, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#141414'; x.fillRect(0, 0, w, h);
  for (let xx = 0; xx < w; xx += 8) { x.fillStyle = '#222'; x.fillRect(xx, 0, 1, h); }
  for (let i = 0; i < 4; i++) drawSmear(x, R() * 20, 4 + R() * 8, 40 + R() * 24, 4 + R() * 8, 5);
  return toTex(c, { repeat: true });
}
export function sheetTex() {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#a9a69a'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 10);
  for (let i = 0; i < 5; i++) { const g = x.createRadialGradient(R() * w, R() * h, 1, R() * w, R() * h, 18); g.addColorStop(0, 'rgba(100,0,0,0.95)'); g.addColorStop(0.7, 'rgba(120,10,10,0.6)'); g.addColorStop(1, 'rgba(120,10,10,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  return toTex(c, { repeat: true });
}
// a flayed human pelt, hung like a coat. alpha cut out.
export function peltTex() {
  const w = 64, h = 128, c = canvas(w, h), x = c.getContext('2d');
  const sk = skinTex([170, 140, 125], true).image;
  x.save(); x.beginPath();
  x.ellipse(32, 16, 10, 13, 0, 0, 6.28);                // head
  x.moveTo(20, 28); x.lineTo(44, 28); x.lineTo(62, 46); x.lineTo(58, 52); x.lineTo(46, 40); // right arm
  x.lineTo(44, 78); x.lineTo(48, 124); x.lineTo(38, 124); x.lineTo(33, 84); x.lineTo(31, 84); x.lineTo(26, 124); x.lineTo(16, 124); x.lineTo(20, 78);
  x.lineTo(18, 40); x.lineTo(6, 52); x.lineTo(2, 46); x.lineTo(20, 28);
  x.clip();
  for (let yy = 0; yy < h; yy += 64) x.drawImage(sk, 0, yy, 64, 64);
  x.fillStyle = 'rgba(100,20,20,0.35)'; x.fillRect(0, 0, w, h);
  // ragged red edges + face holes
  x.restore();
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = '#000';
  x.beginPath(); x.ellipse(27, 14, 2.6, 3.4, 0, 0, 6.28); x.fill();
  x.beginPath(); x.ellipse(37, 14, 2.6, 3.4, 0, 0, 6.28); x.fill();
  x.beginPath(); x.ellipse(32, 23, 4, 2.2, 0, 0, 6.28); x.fill();
  for (let i = 0; i < 40; i++) { circle(x, R() * w, R() * h, 1 + R() * 1.5); }
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = 'rgba(80,0,0,0.9)';
  for (let i = 0; i < 8; i++) drawDrips(x, 18 + R() * 28, 60 + R() * 30, 10 + R() * 30, 1);
  return toTex(c);
}
export function paperTex() {
  const w = 32, h = 40, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#d8d0b8'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 12);
  x.fillStyle = 'rgba(20,20,40,0.6)'; for (let yy = 6; yy < 36; yy += 3) x.fillRect(4, yy, 18 + R() * 8, 1);
  drawSplat(x, 8 + R() * 16, 10 + R() * 20, 3, 0.9);
  return toTex(c);
}

// ---------- decals (transparent) ----------
export function decalTex(kind) {
  const s = kind === 'trail' ? [128, 32] : kind === 'drips' ? [64, 128] : [128, 128];
  const c = canvas(s[0], s[1]), x = c.getContext('2d');
  if (kind === 'splat') drawSplat(x, 64, 64, 18 + R() * 8);
  else if (kind === 'pool') drawPool(x, 64, 64, 44);
  else if (kind === 'trail') { drawSmear(x, 0, 16, 128, 16, 16); for (let i = 0; i < 6; i++) drawSplat(x, R() * 128, 16 + (R() - 0.5) * 14, 2 + R() * 3); }
  else if (kind === 'drips') { drawSplat(x, 32, 22, 12); for (let i = 0; i < 9; i++) drawDrips(x, 14 + R() * 36, 20 + R() * 10, 20 + R() * 90, 1 + R() * 1.8); }
  else if (kind === 'hand') { drawHand(x, 64, 56, 34, (R() - 0.5) * 0.6); }
  else if (kind === 'hands') { for (let i = 0; i < 5; i++) drawHand(x, 20 + R() * 88, 25 + R() * 70, 14 + R() * 6, (R() - 0.5) * 1.4); }
  return toTex(c);
}
// messy finger-painted writing, with runs
export function writingTex(text, w = 512, h = 128) {
  const c = canvas(w, h), x = c.getContext('2d');
  const size = Math.min(h * 0.6, w / (text.length * 0.7));
  x.font = `900 ${size | 0}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
  x.textBaseline = 'middle';
  let tw = 0; for (const ch of text) tw += x.measureText(ch).width * 1.12;
  let px = (w - tw) / 2;
  for (const ch of text) {
    const cw = x.measureText(ch).width * 1.12;
    const rot = (R() - 0.5) * 0.12, dy = (R() - 0.5) * 5;
    for (let p = 0; p < 2; p++) {
      x.save(); x.translate(px + cw / 2 + (p ? 2.5 : 0), h * 0.42 + dy + (p ? 2 : 0)); x.rotate(rot);
      const col = p ? 'rgba(70,0,0,0.45)' : 'rgba(150,6,4,0.97)';
      x.fillStyle = col; x.strokeStyle = col; x.lineWidth = size * 0.13; x.lineJoin = 'round';
      x.strokeText(ch, -cw / 2, 0); x.fillText(ch, -cw / 2, 0); x.restore();
    }
    if (ch !== ' ' && R() < 0.7) drawDrips(x, px + cw * (0.2 + R() * 0.6), h * 0.55, 8 + R() * h * 0.4, 1 + R() * 1.6);
    px += cw;
  }
  return toTex(c);
}
// tally marks: the foreman's quota
export function tallyTex() {
  const w = 256, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.lineCap = 'round';
  for (let g = 0; g < 26; g++) {
    const gx = 8 + (g % 9) * 27, gy = 10 + Math.floor(g / 9) * 40;
    x.strokeStyle = bloodRGBA(0.9); x.lineWidth = 3;
    for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(gx + k * 5 + (R() - 0.5) * 2, gy); x.lineTo(gx + k * 5 + (R() - 0.5) * 3, gy + 28); x.stroke(); }
    x.beginPath(); x.moveTo(gx - 3, gy + 24); x.lineTo(gx + 21, gy + 4); x.stroke();
    if (R() < 0.5) drawDrips(x, gx + R() * 15, gy + 26, 6 + R() * 12, 1);
  }
  return toTex(c);
}

// ---------- 2D images for the screen ----------
// the face you see for a frame when your nerve goes
export function faceImage() {
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  const g = x.createRadialGradient(128, 120, 20, 128, 130, 120); g.addColorStop(0, '#8a7a72'); g.addColorStop(0.6, '#4a3a36'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.ellipse(128, 128, 78, 110, 0, 0, 6.28); x.fill();
  // flayed patches
  for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(${110 + R() * 60 | 0},10,10,0.8)`; x.beginPath(); x.ellipse(70 + R() * 116, 60 + R() * 150, 10 + R() * 22, 8 + R() * 18, R() * 3, 0, 6.28); x.fill(); }
  // eyes: huge black sockets with pinpoint pupils
  for (const ex of [94, 162]) {
    x.fillStyle = '#000'; x.beginPath(); x.ellipse(ex, 108, 22, 28, 0, 0, 6.28); x.fill();
    x.fillStyle = '#f2efe0'; circle(x, ex + (R() - 0.5) * 4, 110, 3);
    for (let k = 0; k < 3; k++) drawDrips(x, ex - 10 + R() * 20, 130, 30 + R() * 60, 2);
  }
  // mouth: torn far too wide
  x.fillStyle = '#050000'; x.beginPath(); x.moveTo(60, 178); x.quadraticCurveTo(128, 150, 196, 176); x.quadraticCurveTo(128, 250, 60, 178); x.fill();
  x.fillStyle = '#d8ccb0';
  for (let i = 0; i < 16; i++) { const tx = 70 + i * 7.6, ty = 172 - Math.sin(i / 15 * 3.14) * 12; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + 6, ty); x.lineTo(tx + 3, ty + 9 + R() * 6); x.fill(); }
  for (let i = 0; i < 14; i++) { const tx = 74 + i * 8, ty = 205 + Math.sin(i / 13 * 3.14) * 16; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + 6, ty); x.lineTo(tx + 3, ty - 9 - R() * 6); x.fill(); }
  for (let i = 0; i < 6; i++) drawSplat(x, R() * w, R() * h, 4 + R() * 10);
  // grain
  const img = x.getImageData(0, 0, w, h), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 50; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(img, 0, 0);
  return c.toDataURL();
}
// blood that runs down the screen when you get hurt / killed (alpha mask for the post shader)
export function screenBloodTex() {
  const w = 256, h = 256, c = canvas(w, h), x = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const edge = R() < 0.5;
    const px = edge ? (R() < 0.5 ? R() * 50 : w - R() * 50) : R() * w, py = R() < 0.6 ? R() * 60 : R() * h;
    drawSplat(x, px, py, 8 + R() * 20, 1);
  }
  for (let i = 0; i < 40; i++) drawDrips(x, R() * w, R() * 40, 30 + R() * 200, 1.5 + R() * 3.5);
  return toTex(c, { nearest: false, srgb: false });
}

// the face it wears: somebody's skin, stitched, with the eyes cut out. alpha-cut ragged edge.
export function maskTex() {
  const w = 64, h = 64, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = 'rgb(186,164,148)'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 18, 6);
  stains(x, w, h, 10, '120,90,100', 0.35); stains(x, w, h, 6, '110,30,30', 0.4);
  // seams
  x.strokeStyle = 'rgba(40,12,10,0.95)'; x.lineWidth = 1;
  const seam = (pts) => { x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [c2, d] = pts[i]; for (let t = 0; t < 1; t += 0.2) { const px = a + (c2 - a) * t, py = b + (d - b) * t; x.beginPath(); x.moveTo(px - 2, py - 2); x.lineTo(px + 2, py + 2); x.stroke(); } } };
  seam([[30, 0], [33, 18], [29, 34], [34, 64]]); seam([[0, 40], [20, 44], [44, 42], [64, 46]]); seam([[8, 6], [20, 14]]);
  // eye holes: torn, black, weeping
  for (const ex of [21, 43]) {
    x.fillStyle = 'rgba(90,10,8,1)'; x.beginPath(); x.ellipse(ex, 27, 7.5, 8.5, 0, 0, 6.28); x.fill();
    x.fillStyle = '#000'; x.beginPath(); x.ellipse(ex, 27, 5.5, 6.5, (ex - 32) * 0.02, 0, 6.28); x.fill();
    for (let k = 0; k < 3; k++) drawDrips(x, ex - 4 + R() * 8, 33, 8 + R() * 20, 1);
  }
  // nose: two slits where the nose was
  x.fillStyle = '#100'; x.fillRect(29, 40, 2, 5); x.fillRect(34, 40, 2, 5);
  // mouth edge: lips cut away
  x.fillStyle = 'rgba(100,8,8,1)'; x.fillRect(14, 54, 36, 10);
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(R() * 64, R() < 0.5 ? R() * 4 : 60 + R() * 4, 1 + R() * 3, 0, 6.28); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  return toTex(c);
}

// =====================================================================
// St. Aldric's Abbey
// =====================================================================
// rough ashlar blocks, damp, with soot above head height
export function wallStone(bloody = 0, tone = [128, 120, 106]) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#1e1b17'; x.fillRect(0, 0, w, h);
  for (let row = 0, yy = 0; yy < h; row++) {
    const bh = 18 + (R() * 8 | 0);
    for (let xx = -(row % 2) * 20 - R() * 10; xx < w; ) {
      const bw = 28 + R() * 22, v = 0.8 + R() * 0.35;
      x.fillStyle = `rgb(${tone[0] * v | 0},${tone[1] * v | 0},${tone[2] * v | 0})`;
      x.fillRect(xx + 1.5, yy + 1.5, bw - 2, bh - 2);
      xx += bw;
    }
    yy += bh;
  }
  addNoise(x, w, h, 26, 4);
  stains(x, w, h, 26, '30,34,20', 0.4); stains(x, w, h, 10, '15,12,10', 0.5);
  streaks(x, w, 0, h, 20, '20,22,14', 0.4);
  const g = x.createLinearGradient(0, 0, 0, 50); g.addColorStop(0, 'rgba(8,6,4,0.7)'); g.addColorStop(1, 'rgba(8,6,4,0)'); x.fillStyle = g; x.fillRect(0, 0, w, 50);
  bottomGrime(x, w, h, 60, 0.7);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
// limewashed plaster over a stone plinth, flaking
export function wallPlaster(bloody = 0) {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#8f887a'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 14);
  for (let i = 0; i < 14; i++) { x.fillStyle = `rgba(${70 + R() * 20 | 0},${64 + R() * 15 | 0},${55},0.85)`; x.beginPath(); x.ellipse(R() * w, R() * 110, 2 + R() * 10, 2 + R() * 7, R() * 3, 0, 6.28); x.fill(); }
  stains(x, w, h, 22, '50,40,22', 0.35); streaks(x, w, 0, 110, 14, '40,32,18', 0.35);
  // painted border band, a faded red and ochre fret
  x.fillStyle = 'rgba(90,30,20,0.55)'; x.fillRect(0, 26, w, 6); x.fillStyle = 'rgba(120,90,40,0.45)'; for (let xx = 0; xx < w; xx += 12) x.fillRect(xx, 28, 6, 2);
  // stone plinth
  for (let xx = 0; xx < w; xx += 32) { const v = 60 + R() * 18; x.fillStyle = `rgb(${v | 0},${v * 0.95 | 0},${v * 0.85 | 0})`; x.fillRect(xx + 1, 112, 30, h - 112); }
  x.fillStyle = '#2a2620'; x.fillRect(0, 110, w, 3);
  addNoise(x, w, h, 10); bottomGrime(x, w, h, 40, 0.7);
  if (bloody) bloodyOver(x, w, h, bloody);
  return toTex(c);
}
// the catacomb wall: niches packed with skulls and long bones
export function wallSkulls() {
  const w = 128, h = 160, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#100d0a'; x.fillRect(0, 0, w, h);
  for (let yy = 4; yy < h - 8; yy += 15) {
    if (((yy / 15) | 0) % 3 === 2) { // a course of femurs, ends out
      for (let xx = 2; xx < w; xx += 6) { const v = 150 + R() * 50; x.fillStyle = `rgb(${v | 0},${v * 0.92 | 0},${v * 0.75 | 0})`; x.beginPath(); x.arc(xx + 2, yy + 6, 2.6, 0, 6.28); x.fill(); x.fillStyle = 'rgba(30,20,10,0.6)'; x.fillRect(xx + 1.5, yy + 5.5, 1, 1); }
      continue;
    }
    for (let xx = (yy % 2) * 6; xx < w; xx += 12) {
      const v = 140 + R() * 60, sx = xx + 6, sy = yy + 7;
      x.fillStyle = `rgb(${v | 0},${v * 0.9 | 0},${v * 0.72 | 0})`;
      x.beginPath(); x.ellipse(sx, sy - 1, 5.2, 5.6, 0, 0, 6.28); x.fill();
      x.fillRect(sx - 3, sy + 2, 6, 3.5);
      x.fillStyle = '#080604'; x.beginPath(); x.ellipse(sx - 2, sy, 1.6, 1.9, 0, 0, 6.28); x.fill(); x.beginPath(); x.ellipse(sx + 2, sy, 1.6, 1.9, 0, 0, 6.28); x.fill();
      x.fillRect(sx - 0.5, sy + 2, 1, 1.5); x.fillRect(sx - 2.5, sy + 4.5, 5, 0.8);
    }
  }
  stains(x, w, h, 20, '10,8,4', 0.6); addNoise(x, w, h, 16);
  bottomGrime(x, w, h, 40, 0.8);
  return toTex(c);
}
export function floorFlag(bloody = 0) {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#16130f'; x.fillRect(0, 0, w, h);
  const cells = [[0, 0, 64, 48], [64, 0, 64, 40], [0, 48, 40, 44], [40, 48, 50, 44], [90, 40, 38, 52], [0, 92, 70, 36], [70, 92, 58, 36]];
  for (const [cx, cy, cw, ch] of cells) { const v = 80 + R() * 22; x.fillStyle = `rgb(${v | 0},${v * 0.94 | 0},${v * 0.84 | 0})`; x.fillRect(cx + 1.5, cy + 1.5, cw - 3, ch - 3); }
  addNoise(x, w, h, 18); stains(x, w, h, 26, '12,10,6', 0.5); cracks(x, w, h, 3);
  if (bloody) {
    for (let i = 0; i < bloody * 4; i++) drawSplat(x, R() * w, R() * h, 4 + R() * 9, 0.9);
    for (let i = 0; i < bloody * 2; i++) drawSmear(x, R() * w * 0.4, R() * h, w * (0.6 + R() * 0.4), R() * h, 10);
    if (R() < bloody * 0.5) drawPool(x, R() * w, R() * h, 12 + R() * 14);
  }
  return toTex(c);
}
export function floorBoards(bloody = 0) {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  for (let xx = 0; xx < w; xx += 16) {
    const v = 62 + R() * 18; x.fillStyle = `rgb(${v + 18 | 0},${v * 0.74 | 0},${v * 0.48 | 0})`; x.fillRect(xx, 0, 15, h);
    for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(20,10,4,0.35)'; x.fillRect(xx + R() * 14, R() * h, 1, 10 + R() * 30); }
    const cut = R() * h; x.fillStyle = '#120a05'; x.fillRect(xx, cut, 15, 1);
  }
  x.fillStyle = '#0d0703'; for (let xx = 15; xx < w; xx += 16) x.fillRect(xx, 0, 1, h);
  addNoise(x, w, h, 12); stains(x, w, h, 18, '15,8,3', 0.5);
  if (bloody) { for (let i = 0; i < bloody * 4; i++) drawSplat(x, R() * w, R() * h, 4 + R() * 9, 0.9); if (R() < bloody * 0.5) drawPool(x, R() * w, R() * h, 12 + R() * 14); }
  return toTex(c);
}
export function ceilingBeams() {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#2a2621'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 14);
  stains(x, w, h, 14, '10,8,6', 0.6);
  for (const yy of [0, 64]) { x.fillStyle = '#1a110a'; x.fillRect(0, yy, w, 18); x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(0, yy + 17, w, 3); for (let k = 0; k < 8; k++) { x.fillStyle = 'rgba(60,40,20,0.3)'; x.fillRect(R() * w, yy + R() * 16, 10 + R() * 30, 1); } }
  return toTex(c);
}
// a lancet window with lead cames and iron bars, snow and moon behind
export function windowTex() {
  const w = 64, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.beginPath(); x.moveTo(6, h); x.lineTo(6, 40); x.quadraticCurveTo(6, 4, 32, 2); x.quadraticCurveTo(58, 4, 58, 40); x.lineTo(58, h); x.closePath(); x.save(); x.clip();
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9ab4d8'); g.addColorStop(1, '#3a4c6a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) { x.fillStyle = `rgba(230,240,255,${0.3 + R() * 0.6})`; x.fillRect(R() * w, R() * h, 1.5, 1.5); }
  x.strokeStyle = 'rgba(20,24,30,0.9)'; x.lineWidth = 1.5;
  for (let yy = 20; yy < h; yy += 14) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy + 4); x.stroke(); x.beginPath(); x.moveTo(0, yy + 4); x.lineTo(w, yy); x.stroke(); }
  x.fillStyle = '#0c0c0e'; for (const bx of [20, 32, 44]) x.fillRect(bx - 1.5, 0, 3, h); x.fillRect(0, 70, w, 3);
  // somebody's handprints on the inside of the glass
  drawHand(x, 24, 92, 9, 0.2); drawHand(x, 42, 80, 8, -0.3);
  x.restore();
  return toTex(c);
}
export function woodTex(bloody = false) {
  const w = 64, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#3a2416'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(${R() < 0.5 ? '20,10,4' : '90,60,36'},${0.2 + R() * 0.3})`; x.beginPath(); const xx = R() * w; x.moveTo(xx, 0); x.bezierCurveTo(xx + (R() - 0.5) * 8, h * 0.3, xx + (R() - 0.5) * 8, h * 0.7, xx + (R() - 0.5) * 6, h); x.stroke(); }
  x.strokeStyle = 'rgba(10,5,2,0.8)'; x.lineWidth = 2; x.strokeRect(6, 8, w - 12, 50); x.strokeRect(6, 66, w - 12, 54);
  // carved cross in the upper panel; slats lower down
  x.fillStyle = 'rgba(8,4,2,0.9)'; x.fillRect(30, 16, 4, 32); x.fillRect(22, 24, 20, 4);
  for (let i = 0; i < 5; i++) x.fillRect(12, 76 + i * 8, 40, 2);
  x.fillStyle = '#7a6a40'; x.fillRect(52, 60, 4, 6);
  stains(x, w, h, 10, '10,5,2', 0.4);
  if (bloody) { for (let i = 0; i < 9; i++) drawDrips(x, 6 + R() * 52, 30 + R() * 50, 20 + R() * 60, 1 + R()); drawHand(x, 32, 70, 12, 0.2); x.fillStyle = bloodRGBA(0.95); x.fillRect(0, h - 10, w, 10); }
  return toTex(c);
}
// the Saint's robe: black wool, stiff with old blood, hem in rags (alpha)
export function robeTex() {
  const w = 64, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#16120f'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 14, 4);
  for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); const xx = R() * w; x.moveTo(xx, 0); x.lineTo(xx + (R() - 0.5) * 6, h); x.stroke(); }
  const g = x.createLinearGradient(0, h * 0.4, 0, h); g.addColorStop(0, 'rgba(70,0,0,0)'); g.addColorStop(1, 'rgba(70,4,2,0.9)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(120,90,40,0.6)'; x.fillRect(0, 6, w, 2); x.fillRect(0, 10, w, 1);
  x.globalCompositeOperation = 'destination-out';
  for (let xx = 0; xx < w; xx += 3) { const len = 4 + R() * 22; x.fillRect(xx, h - len, 2 + R() * 2, len); }
  for (let i = 0; i < 18; i++) { x.beginPath(); x.arc(R() * w, h * 0.5 + R() * h * 0.45, 1 + R() * 2.5, 0, 6.28); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  return toTex(c, { repeat: true });
}
export function snowTex() {
  const w = 128, h = 128, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#c4ccd6'; x.fillRect(0, 0, w, h); addNoise(x, w, h, 16);
  stains(x, w, h, 14, '150,160,175', 0.4);
  for (let i = 0; i < 6; i++) drawSplat(x, R() * w, R() * h, 2 + R() * 3, 0.8);
  return toTex(c);
}
