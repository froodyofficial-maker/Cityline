// Procedural PBR textures: every surface is painted as albedo + height + roughness on canvases,
// and the normal map is derived from the height field. Tileable where it matters.
import * as THREE from 'three';
import { R } from './state.js';

// ---------- tileable value noise ----------
const PERM = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = (R() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const fade = t => t * t * (3 - 2 * t);
function vnoise(x, y, period) { // period in cells: makes it tile
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const P = (a, b) => PERM[(((a % period) + period) % period) + PERM[(((b % period) + period) % period) & 255]] / 255;
  const a = P(xi, yi), b = P(xi + 1, yi), c = P(xi, yi + 1), d = P(xi + 1, yi + 1), u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, base = 4, oct = 4) { let s = 0, amp = 0.5, f = base; for (let o = 0; o < oct; o++) { s += vnoise(x * f, y * f, f) * amp; amp *= 0.5; f *= 2; } return s; }

// ---------- canvases ----------
function cv(n) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d', { willReadFrequently: true })]; }
// fill a canvas per pixel: fn(u, v) -> [r,g,b] (0..255)
export function pixels(ctx, n, fn) {
  const img = ctx.getImageData(0, 0, n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, c = fn(x / n, y / n, x, y); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3] ?? 255; }
  ctx.putImageData(img, 0, 0);
}
const clampB = v => v < 0 ? 0 : v > 255 ? 255 : v;
function normalFromHeight(hctx, n, strength) {
  const h = hctx.getImageData(0, 0, n, n).data, [c, ctx] = cv(n), img = ctx.createImageData(n, n), d = img.data;
  const H = (x, y) => h[((((y + n) % n) * n + ((x + n) % n)) * 4)] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), o = (y * n + x) * 4;
    d[o] = (-dx / l * 0.5 + 0.5) * 255; d[o + 1] = (dy / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
function tex(c, srgb, repeat) { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; }

// painter gets (a, h, r, n): albedo, height, roughness contexts (all n x n). Height starts mid-grey, roughness starts at `rough`.
export function makePBR(n, painter, { rough = 0.8, normal = 3, repeat = true } = {}) {
  const [ac, a] = cv(n), [hc, h] = cv(n), [rc, r] = cv(n);
  h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
  const rv = Math.round(rough * 255); r.fillStyle = `rgb(${rv},${rv},${rv})`; r.fillRect(0, 0, n, n);
  a.fillStyle = '#808080'; a.fillRect(0, 0, n, n);
  painter(a, h, r, n);
  return { map: tex(ac, true, repeat), normalMap: tex(normalFromHeight(h, n, normal), false, repeat), roughnessMap: tex(rc, false, repeat), canvas: ac };
}
export function stdMat(set, o = {}) {
  return new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(o.ns ?? 1, o.ns ?? 1), ...o.extra });
}

// ---------- shared painting helpers ----------
const rnd = (a, b) => a + (b - a) * R();
const circle = (x, cx, cy, rr) => { x.beginPath(); x.arc(cx, cy, Math.max(0.3, rr), 0, 6.2832); x.fill(); };
export function noiseLayer(ctx, n, base, oct, fn) { // fn(noise, u, v) -> [r,g,b]
  pixels(ctx, n, (u, v) => fn(fbm(u, v, base, oct), u, v));
}
function grime(a, n, from = 0.75, alpha = 0.6) { const g = a.createLinearGradient(0, n * from, 0, n); g.addColorStop(0, 'rgba(20,15,8,0)'); g.addColorStop(1, `rgba(20,15,8,${alpha})`); a.fillStyle = g; a.fillRect(0, n * from, n, n); }
function stains(a, n, k, col, maxA, rmin = 8, rmax = 60) {
  for (let i = 0; i < k; i++) { const x = R() * n, y = R() * n, rr = rnd(rmin, rmax) * n / 512; const g = a.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(${col},${rnd(0.05, maxA)})`); g.addColorStop(1, `rgba(${col},0)`); a.fillStyle = g; a.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
}
// water damage: brown tide-mark rings running down from the top
function waterDamage(a, n, k) {
  for (let i = 0; i < k; i++) {
    const x = R() * n, w = rnd(30, 120) * n / 512, len = rnd(0.2, 0.7) * n;
    const g = a.createLinearGradient(0, 0, 0, len); g.addColorStop(0, 'rgba(90,60,25,0.45)'); g.addColorStop(1, 'rgba(90,60,25,0)');
    a.fillStyle = g; a.beginPath(); a.moveTo(x - w / 2, 0); a.bezierCurveTo(x - w / 2, len * 0.6, x - w * 0.1, len, x, len); a.bezierCurveTo(x + w * 0.1, len, x + w / 2, len * 0.6, x + w / 2, 0); a.fill();
    a.strokeStyle = 'rgba(70,40,15,0.35)'; a.lineWidth = 2; a.stroke();
  }
}
// blood: dark, glossy (low roughness), slightly raised
export function bloodPass(a, h, r, n, amount, wall = true) {
  const col = () => `rgba(${(70 + R() * 50) | 0},${(R() * 6) | 0},${(R() * 6) | 0},${rnd(0.75, 0.97)})`;
  const both = (fn) => { a.fillStyle = col(); fn(a); r.fillStyle = 'rgba(40,40,40,0.9)'; fn(r); h.fillStyle = 'rgba(150,150,150,0.5)'; fn(h); };
  const S = n / 512;
  for (let i = 0; i < amount * 5; i++) {
    const cx = R() * n, cy = wall ? n * rnd(0.15, 0.75) : R() * n, rr = rnd(6, 22) * S;
    both(x => { for (let k = 0; k < 7; k++) circle(x, cx + rnd(-rr, rr) * 0.6, cy + rnd(-rr, rr) * 0.6, rr * rnd(0.3, 0.7)); for (let k = 0; k < 18; k++) { const an = R() * 6.28, d = rr * rnd(1, 3.5); circle(x, cx + Math.cos(an) * d, cy + Math.sin(an) * d, rr * rnd(0.04, 0.15)); } });
    if (wall) for (let k = 0; k < 4; k++) { const dx = cx + rnd(-rr, rr), len = rnd(30, 200) * S, w = rnd(1.2, 3.5) * S; both(x => { x.fillRect(dx - w / 2, cy, w, len); circle(x, dx, cy + len, w * 0.9); }); }
  }
  if (R() < amount) { // a smear where someone was dragged along it
    const y0 = wall ? n * rnd(0.4, 0.6) : R() * n;
    for (let k = 0; k < 40 * S; k++) { const o = rnd(-14, 14) * S; a.strokeStyle = `rgba(${(80 + R() * 40) | 0},0,0,${rnd(0.08, 0.3)})`; a.lineWidth = rnd(1, 3) * S; a.beginPath(); a.moveTo(0, y0 + o); a.lineTo(n, y0 + o + rnd(-20, 20) * S); a.stroke(); }
    r.fillStyle = 'rgba(60,60,60,0.5)'; r.fillRect(0, y0 - 14 * S, n, 28 * S);
  }
}

// =====================================================================
// interior
// =====================================================================
export function wallpaper(kind = 'damask', blood = 0) {
  return makePBR(512, (a, h, r, n) => {
    const P = { damask: ['#3d4a3a', '#56634f'], rose: ['#8a6f6a', '#a3807a'], stars: ['#4a5a78', '#c8c09a'], stripe: ['#8a7e62', '#9d906f'], yellow: ['#8f8350', '#a89a62'] }[kind];
    a.fillStyle = P[0]; a.fillRect(0, 0, n, n);
    if (kind === 'stripe') for (let x = 0; x < n; x += 64) { a.fillStyle = P[1]; a.fillRect(x, 0, 32, n); a.fillStyle = 'rgba(60,40,20,0.25)'; a.fillRect(x + 30, 0, 3, n); }
    else if (kind === 'stars') { for (let i = 0; i < 26; i++) { const x = (i * 97) % n, y = (i * 173) % n; a.fillStyle = P[1]; a.font = '28px serif'; a.fillText(i % 3 ? '★' : '☾', x, y); } }
    else for (let y = 0; y < n; y += 128) for (let x = 0; x < n; x += 128) { // damask / rose motif
      const ox = ((y / 128) % 2) * 64; a.fillStyle = P[1]; a.save(); a.translate(x + ox + 64, y + 64);
      for (let k = 0; k < 4; k++) { a.rotate(Math.PI / 2); a.beginPath(); a.ellipse(0, -22, 9, 22, 0, 0, 6.28); a.fill(); }
      a.beginPath(); a.arc(0, 0, 10, 0, 6.28); a.fill(); a.restore();
    }
    // paper texture and fade
    const img = a.getImageData(0, 0, n, n), d = img.data;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const o = (y * n + x) * 4, f = fbm(x / n, y / n, 6, 4) - 0.5, g = (R() - 0.5) * 10; d[o] += f * 40 + g; d[o + 1] += f * 38 + g; d[o + 2] += f * 30 + g; }
    a.putImageData(img, 0, 0);
    pixels(h, n, (u, v) => { const k = 128 + (fbm(u, v, 32, 2) - 0.5) * 30; return [k, k, k]; });
    waterDamage(a, n, 3); stains(a, n, 14, '40,30,15', 0.35);
    // peeling strips: curled paper with plaster behind
    for (let i = 0; i < 3; i++) {
      const x = R() * n, y = rnd(0.05, 0.6) * n, w = rnd(18, 60), hh = rnd(40, 160);
      a.fillStyle = '#b8b0a0'; a.fillRect(x, y, w, hh); a.fillStyle = 'rgba(0,0,0,0.35)'; a.fillRect(x + w, y, 4, hh);
      h.fillStyle = '#5a5a5a'; h.fillRect(x, y, w, hh); h.fillStyle = '#e0e0e0'; h.fillRect(x + w, y, 4, hh);
      r.fillStyle = '#f0f0f0'; r.fillRect(x, y, w, hh);
    }
    // skirting board
    const sb = n * 0.9; a.fillStyle = '#3a2a1c'; a.fillRect(0, sb, n, n - sb); a.fillStyle = '#4a3624'; a.fillRect(0, sb, n, 6);
    h.fillStyle = '#c0c0c0'; h.fillRect(0, sb, n, n - sb); h.fillStyle = '#ffffff'; h.fillRect(0, sb, n, 6);
    r.fillStyle = '#707070'; r.fillRect(0, sb, n, n - sb);
    grime(a, n, 0.7, 0.45);
    if (blood) bloodPass(a, h, r, n, blood);
  }, { rough: 0.85, normal: 3 });
}
export function tiles(color = [200, 205, 198], blood = 0, size = 64) {
  return makePBR(512, (a, h, r, n) => {
    a.fillStyle = '#5a5850'; a.fillRect(0, 0, n, n); h.fillStyle = '#404040'; h.fillRect(0, 0, n, n); r.fillStyle = '#e8e8e8'; r.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += size) for (let x = 0; x < n; x += size) {
      const v = rnd(-14, 10), cracked = R() < 0.06;
      a.fillStyle = `rgb(${clampB(color[0] + v)},${clampB(color[1] + v)},${clampB(color[2] + v - R() * 12)})`; a.fillRect(x + 3, y + 3, size - 6, size - 6);
      h.fillStyle = '#c8c8c8'; h.fillRect(x + 3, y + 3, size - 6, size - 6); h.fillStyle = '#e0e0e0'; h.fillRect(x + 6, y + 6, size - 12, size - 12);
      const rk = 50 + R() * 30 | 0; r.fillStyle = `rgb(${rk},${rk},${rk})`; r.fillRect(x + 3, y + 3, size - 6, size - 6);
      if (cracked) { a.strokeStyle = 'rgba(30,25,20,0.8)'; h.strokeStyle = '#303030'; for (const c of [a, h]) { c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + R() * size, y); c.lineTo(x + R() * size, y + size); c.stroke(); } }
    }
    stains(a, n, 18, '60,50,20', 0.3); grime(a, n, 0.6, 0.5);
    if (blood) bloodPass(a, h, r, n, blood);
  }, { rough: 0.3, normal: 4 });
}
export function woodFloor(blood = 0, tone = [96, 62, 36]) {
  return makePBR(512, (a, h, r, n) => {
    const pw = 64;
    for (let x = 0; x < n; x += pw) {
      let y = -R() * n;
      while (y < n) {
        const len = rnd(180, 420), v = rnd(0.75, 1.15);
        const g = a.createLinearGradient(x, 0, x + pw, 0); g.addColorStop(0, `rgb(${tone[0] * v | 0},${tone[1] * v | 0},${tone[2] * v | 0})`); g.addColorStop(1, `rgb(${tone[0] * v * 0.9 | 0},${tone[1] * v * 0.9 | 0},${tone[2] * v * 0.9 | 0})`);
        a.fillStyle = g; a.fillRect(x, y, pw, len);
        for (let k = 0; k < 14; k++) { a.strokeStyle = `rgba(${R() < 0.5 ? '30,15,5' : '150,100,60'},${rnd(0.1, 0.3)})`; a.lineWidth = rnd(0.5, 2); a.beginPath(); const gx = x + R() * pw; a.moveTo(gx, y); a.bezierCurveTo(gx + rnd(-6, 6), y + len * 0.3, gx + rnd(-6, 6), y + len * 0.7, gx + rnd(-3, 3), y + len); a.stroke(); }
        h.fillStyle = '#909090'; h.fillRect(x + 2, y + 2, pw - 4, len - 4); h.fillStyle = '#202020'; h.fillRect(x, y, pw, 2); h.fillRect(x, y, 2, len);
        a.fillStyle = 'rgba(10,5,2,0.9)'; a.fillRect(x, y, pw, 2); a.fillRect(x, y, 2, len);
        y += len;
      }
    }
    pixels(r, n, (u, v) => { const k = (0.35 + fbm(u, v, 8, 3) * 0.45) * 255; return [k, k, k]; });
    stains(a, n, 16, '20,10,4', 0.4);
    if (blood) bloodPass(a, h, r, n, blood, false);
  }, { rough: 0.5, normal: 5 });
}
export function carpet(col = [92, 40, 38], blood = 0) {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 16, 3), g = R() * 30 - 15; return [clampB(col[0] * (0.7 + f * 0.6) + g), clampB(col[1] * (0.7 + f * 0.6) + g), clampB(col[2] * (0.7 + f * 0.6) + g)]; });
    pixels(h, n, () => { const k = 100 + R() * 80; return [k, k, k]; });
    stains(a, n, 12, '20,12,6', 0.45, 6, 40);
    if (blood) bloodPass(a, h, r, n, blood, false);
  }, { rough: 1, normal: 1.5 });
}
export function ceiling() {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 8, 3), k = 150 + f * 40 + R() * 12; return [k, k * 0.97, k * 0.9]; });
    pixels(h, n, () => { const k = 110 + R() * 60; return [k, k, k]; });
    stains(a, n, 6, '100,70,30', 0.5, 20, 80);
  }, { rough: 0.95, normal: 1.2 });
}
export function fabric(col, blood = 0) {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v, x, y) => { const w = ((x + y) % 4 < 2 ? 1 : 0.9) * (0.8 + fbm(u, v, 8, 2) * 0.4); return [clampB(col[0] * w), clampB(col[1] * w), clampB(col[2] * w)]; });
    pixels(h, n, (u, v, x, y) => { const k = (x % 4 < 2) !== (y % 4 < 2) ? 160 : 100; return [k, k, k]; });
    stains(a, n, 8, '30,20,10', 0.4, 10, 50);
    if (blood) bloodPass(a, h, r, n, blood, false);
  }, { rough: 0.95, normal: 1.5 });
}

// =====================================================================
// exterior
// =====================================================================
export function siding() {
  return makePBR(512, (a, h, r, n) => {
    const bh = 32;
    for (let y = 0; y < n; y += bh) {
      const g = a.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, '#a9aca6'); g.addColorStop(1, '#c8cbc4'); a.fillStyle = g; a.fillRect(0, y, n, bh);
      const hg = h.createLinearGradient(0, y, 0, y + bh); hg.addColorStop(0, '#303030'); hg.addColorStop(1, '#d0d0d0'); h.fillStyle = hg; h.fillRect(0, y, n, bh);
      a.fillStyle = 'rgba(30,30,25,0.6)'; a.fillRect(0, y, n, 2);
    }
    // mildew streaks under every board, flaking paint
    for (let i = 0; i < 60; i++) { const x = R() * n, y = Math.floor(R() * n / bh) * bh + bh - 2; const g = a.createLinearGradient(0, y, 0, y + 40); g.addColorStop(0, 'rgba(50,60,40,0.45)'); g.addColorStop(1, 'rgba(50,60,40,0)'); a.fillStyle = g; a.fillRect(x, y, rnd(2, 8), 40); }
    for (let i = 0; i < 30; i++) { const x = R() * n, y = R() * n, w = rnd(4, 26), hh = rnd(3, 10); a.fillStyle = '#6a6458'; a.fillRect(x, y, w, hh); r.fillStyle = '#fafafa'; r.fillRect(x, y, w, hh); }
    stains(a, n, 20, '40,45,30', 0.3); grime(a, n, 0.6, 0.5);
  }, { rough: 0.8, normal: 6 });
}
export function hedge() {
  return makePBR(512, (a, h, r, n) => {
    a.fillStyle = '#0d1a0c'; a.fillRect(0, 0, n, n); h.fillStyle = '#202020'; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 5200; i++) {
      const x = R() * n, y = R() * n, s = rnd(4, 10), an = R() * 6.28, d = R();
      const g = 40 + d * 60, col = `rgb(${(g * 0.55 + R() * 15) | 0},${(g + R() * 20) | 0},${(g * 0.35) | 0})`;
      for (const [c, f] of [[a, col], [h, `rgb(${60 + d * 190 | 0},${60 + d * 190 | 0},${60 + d * 190 | 0})`]]) { c.fillStyle = f; c.save(); c.translate(x, y); c.rotate(an); c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, 6.28); c.fill(); c.restore(); if (x < s * 2 || y < s * 2) { c.save(); c.translate(x + n, y + n); c.rotate(an); c.beginPath(); c.ellipse(0, 0, s, s * 0.45, 0, 0, 6.28); c.fill(); c.restore(); } }
    }
    for (let i = 0; i < 300; i++) { a.fillStyle = `rgba(90,70,30,${rnd(0.3, 0.8)})`; circle(a, R() * n, R() * n, rnd(2, 5)); } // dead leaves
  }, { rough: 0.85, normal: 4 });
}
export function grass() {
  return makePBR(512, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 4, 5), d = fbm(u + 7.3, v + 1.1, 3, 3); const dirt = d > 0.6 ? (d - 0.6) * 2.5 : 0; return [clampB(40 + f * 40 + dirt * 50), clampB(52 + f * 50 - dirt * 10), clampB(26 + f * 18 + dirt * 10)]; });
    for (let i = 0; i < 9000; i++) { const x = R() * n, y = R() * n, l = rnd(3, 9), g = rnd(40, 110); a.strokeStyle = `rgba(${g * 0.6 | 0},${g | 0},${g * 0.35 | 0},0.7)`; h.strokeStyle = `rgba(230,230,230,0.6)`; for (const c of [a, h]) { c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd(-2, 2), y - l); c.stroke(); } }
    for (let i = 0; i < 260; i++) { const x = R() * n, y = R() * n, s = rnd(3, 7); a.fillStyle = `rgb(${rnd(70, 120) | 0},${rnd(40, 70) | 0},${rnd(15, 30) | 0})`; a.save(); a.translate(x, y); a.rotate(R() * 6); a.beginPath(); a.ellipse(0, 0, s, s * 0.5, 0, 0, 6.28); a.fill(); a.restore(); }
  }, { rough: 0.95, normal: 2.5 });
}
export function asphalt() {
  return makePBR(512, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 6, 3), g = R() * 40 - 20, k = 46 + f * 26 + g; return [clampB(k), clampB(k), clampB(k + 2)]; });
    pixels(h, n, () => { const k = 80 + R() * 140; return [k, k, k]; });
    // puddles: dark and mirror-smooth
    pixels(r, n, (u, v) => { const p = fbm(u + 3.1, v + 9.2, 3, 4); const k = p > 0.62 ? 15 : p > 0.58 ? 120 : 210 + R() * 30; return [k, k, k]; });
    const img = a.getImageData(0, 0, n, n), d = img.data;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const p = fbm(x / n + 3.1, y / n + 9.2, 3, 4); if (p > 0.6) { const o = (y * n + x) * 4; d[o] *= 0.55; d[o + 1] *= 0.55; d[o + 2] *= 0.6; } }
    a.putImageData(img, 0, 0);
    for (let i = 0; i < 8; i++) { a.strokeStyle = 'rgba(10,10,10,0.8)'; h.strokeStyle = '#000'; let x = R() * n, y = R() * n; for (const c of [a, h]) { c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); } for (let k = 0; k < 10; k++) { x += rnd(-30, 30); y += rnd(-30, 30); a.lineTo(x, y); h.lineTo(x, y); } a.stroke(); h.stroke(); }
    for (let i = 0; i < 120; i++) { a.fillStyle = `rgba(${rnd(70, 110) | 0},${rnd(40, 60) | 0},20,0.8)`; circle(a, R() * n, R() * n, rnd(2, 5)); }
  }, { rough: 0.85, normal: 1.6 });
}
export function woodchips() {
  return makePBR(256, (a, h, r, n) => {
    a.fillStyle = '#3a2614'; a.fillRect(0, 0, n, n); h.fillStyle = '#303030'; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) { const x = R() * n, y = R() * n, l = rnd(4, 12), an = R() * 6.28, v = rnd(0.5, 1.2); a.fillStyle = `rgb(${110 * v | 0},${72 * v | 0},${40 * v | 0})`; const hk = 120 + v * 100 | 0; h.fillStyle = `rgb(${hk},${hk},${hk})`; for (const c of [a, h]) { c.save(); c.translate(x, y); c.rotate(an); c.fillRect(-l / 2, -1.5, l, 3); c.restore(); } }
  }, { rough: 0.95, normal: 3 });
}
export function bark() {
  return makePBR(256, (a, h, r, n) => {
    pixels(h, n, (u, v) => { const f = fbm(u * 3, v * 0.6, 4, 4); const ridge = Math.abs(Math.sin((u + f * 0.25) * 6.283 * 7)); const k = clampB(ridge * 200 + f * 40); return [k, k, k]; });
    pixels(a, n, (u, v) => { const f = fbm(u, v, 6, 3); return [clampB(38 + f * 40), clampB(32 + f * 32), clampB(28 + f * 26)]; });
    const hd = h.getImageData(0, 0, n, n).data, img = a.getImageData(0, 0, n, n), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const k = hd[i] / 255; d[i] *= 0.5 + k * 0.8; d[i + 1] *= 0.5 + k * 0.8; d[i + 2] *= 0.5 + k * 0.75; }
    a.putImageData(img, 0, 0);
    stains(a, n, 10, '40,60,30', 0.4, 10, 40);
  }, { rough: 0.9, normal: 6 });
}
export function fencePlanks() {
  return makePBR(256, (a, h, r, n) => {
    for (let x = 0; x < n; x += 32) {
      const v = rnd(0.8, 1.1); a.fillStyle = `rgb(${92 * v | 0},${86 * v | 0},${76 * v | 0})`; a.fillRect(x, 0, 32, n);
      for (let k = 0; k < 10; k++) { a.strokeStyle = `rgba(40,35,30,${rnd(0.2, 0.5)})`; a.beginPath(); const gx = x + R() * 30; a.moveTo(gx, 0); a.lineTo(gx + rnd(-3, 3), n); a.stroke(); }
      h.fillStyle = '#a0a0a0'; h.fillRect(x + 2, 0, 28, n); h.fillStyle = '#101010'; h.fillRect(x, 0, 2, n); a.fillStyle = '#0c0a08'; a.fillRect(x, 0, 2, n);
    }
    stains(a, n, 14, '30,40,20', 0.35); grime(a, n, 0.6, 0.6);
  }, { rough: 0.9, normal: 4 });
}
export function cinder(col = [150, 160, 150], blood = 0) {
  return makePBR(512, (a, h, r, n) => {
    a.fillStyle = '#4a4a46'; a.fillRect(0, 0, n, n); h.fillStyle = '#404040'; h.fillRect(0, 0, n, n);
    for (let row = 0, y = 0; y < n; row++, y += 64) for (let x = -(row % 2) * 64; x < n; x += 128) {
      const v = rnd(0.9, 1.05); a.fillStyle = `rgb(${col[0] * v | 0},${col[1] * v | 0},${col[2] * v | 0})`; a.fillRect(x + 3, y + 3, 122, 58);
      h.fillStyle = '#c0c0c0'; h.fillRect(x + 3, y + 3, 122, 58);
    }
    const img = a.getImageData(0, 0, n, n), d = img.data; for (let i = 0; i < d.length; i += 4) { const g = (R() - 0.5) * 22; d[i] += g; d[i + 1] += g; d[i + 2] += g; } a.putImageData(img, 0, 0);
    stains(a, n, 20, '50,40,20', 0.35); grime(a, n, 0.65, 0.6);
    if (blood) bloodPass(a, h, r, n, blood);
  }, { rough: 0.7, normal: 3 });
}
export function paintedMetal(col = [150, 30, 24]) {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 6, 3); return [clampB(col[0] * (0.8 + f * 0.4)), clampB(col[1] * (0.8 + f * 0.4)), clampB(col[2] * (0.8 + f * 0.4))]; });
    for (let i = 0; i < 40; i++) { const x = R() * n, y = R() * n, s = rnd(3, 16); a.fillStyle = `rgb(${rnd(80, 120) | 0},${rnd(40, 55) | 0},${rnd(20, 30) | 0})`; circle(a, x, y, s); r.fillStyle = '#f0f0f0'; circle(r, x, y, s); h.fillStyle = '#606060'; circle(h, x, y, s); }
  }, { rough: 0.45, normal: 2 });
}
export function waterNormal() {
  return makePBR(256, (a, h, r, n) => {
    a.fillStyle = '#05070a'; a.fillRect(0, 0, n, n);
    pixels(h, n, (u, v) => { const k = clampB(fbm(u, v, 4, 4) * 255); return [k, k, k]; });
  }, { rough: 0.05, normal: 5 });
}
export function dirt() {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 6, 4); return [clampB(58 + f * 40), clampB(44 + f * 30), clampB(30 + f * 20)]; });
    pixels(h, n, (u, v) => { const k = clampB(fbm(u, v, 12, 3) * 255); return [k, k, k]; });
  }, { rough: 0.95, normal: 3 });
}
export function shingles() {
  return makePBR(256, (a, h, r, n) => {
    for (let row = 0, y = 0; y < n; row++, y += 32) for (let x = -(row % 2) * 16; x < n; x += 32) {
      const v = rnd(0.7, 1.1); a.fillStyle = `rgb(${44 * v | 0},${40 * v | 0},${38 * v | 0})`; a.fillRect(x + 1, y, 30, 31);
      const g = h.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, '#202020'); g.addColorStop(1, '#d0d0d0'); h.fillStyle = g; h.fillRect(x + 1, y, 30, 31);
    }
    stains(a, n, 10, '50,60,40', 0.4);
  }, { rough: 0.9, normal: 4 });
}

// =====================================================================
// flesh
// =====================================================================
// the creature: pale, wet, veined
export function paleSkin() {
  return makePBR(512, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 5, 4), b = fbm(u + 5, v + 2, 3, 3); return [clampB(178 + f * 40 - b * 30), clampB(176 + f * 36 - b * 40), clampB(170 + f * 30 - b * 10)]; });
    // veins: branching blue-purple lines
    const vein = (x, y, an, len, w, depth) => {
      if (depth > 5 || len < 6) return;
      a.strokeStyle = `rgba(70,60,110,${0.55 - depth * 0.07})`; a.lineWidth = w; h.strokeStyle = `rgba(220,220,220,0.5)`; h.lineWidth = w;
      let px = x, py = y;
      for (const c of [a, h]) { c.beginPath(); c.moveTo(x, y); }
      for (let k = 0; k < 6; k++) { an += rnd(-0.4, 0.4); px += Math.cos(an) * len / 6; py += Math.sin(an) * len / 6; a.lineTo(px, py); h.lineTo(px, py); }
      a.stroke(); h.stroke();
      vein(px, py, an + rnd(0.3, 0.8), len * 0.65, w * 0.7, depth + 1); if (R() < 0.6) vein(px, py, an - rnd(0.3, 0.8), len * 0.6, w * 0.7, depth + 1);
    };
    for (let i = 0; i < 10; i++) vein(R() * n, R() * n, R() * 6.28, rnd(60, 160), rnd(2, 4), 0);
    stains(a, n, 16, '120,70,90', 0.35, 10, 50); stains(a, n, 10, '90,100,60', 0.3, 10, 40); stains(a, n, 8, '120,20,20', 0.4, 6, 30);
    const base = h.getImageData(0, 0, n, n).data;
    pixels(h, n, (u, v, x, y) => { const o = (y * n + x) * 4; const w = Math.abs(Math.sin(v * 160 + fbm(u, v, 6, 2) * 8)) * 30; const k = clampB(base[o] * 0.7 + w + R() * 20); return [k, k, k]; });
    pixels(r, n, (u, v) => { const k = clampB(70 + fbm(u, v, 8, 2) * 90); return [k, k, k]; });
  }, { rough: 0.35, normal: 3 });
}
export function muscle() {
  return makePBR(256, (a, h, r, n) => {
    pixels(h, n, (u, v) => { const f = fbm(u, v * 0.2, 6, 3); const k = clampB(Math.abs(Math.sin((v + f * 0.08) * 6.283 * 40)) * 160 + f * 80); return [k, k, k]; });
    const hd = h.getImageData(0, 0, n, n).data;
    pixels(a, n, (u, v, x, y) => { const k = hd[(y * n + x) * 4] / 255; const fat = fbm(u + 2, v, 3, 3) > 0.66; return fat ? [220, 190, 150] : [clampB(90 + k * 70), clampB(8 + k * 12), clampB(10 + k * 12)]; });
    pixels(r, n, () => { const k = 40 + R() * 50; return [k, k, k]; });
  }, { rough: 0.3, normal: 4 });
}
export function corpseSkin() {
  return makePBR(256, (a, h, r, n) => {
    pixels(a, n, (u, v) => { const f = fbm(u, v, 5, 4), b = fbm(u + 3, v + 1, 3, 3); return [clampB(150 + f * 40 - b * 30), clampB(138 + f * 30 - b * 20), clampB(128 + f * 26 + b * 10)]; });
    stains(a, n, 14, '90,60,100', 0.45, 8, 40); stains(a, n, 8, '110,20,20', 0.5, 4, 26); stains(a, n, 6, '70,90,50', 0.35);
    pixels(h, n, (u, v) => { const k = clampB(110 + fbm(u, v, 16, 3) * 60); return [k, k, k]; });
  }, { rough: 0.55, normal: 2 });
}
