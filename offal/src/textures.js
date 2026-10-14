// Every texture in the game is painted here on 2D canvases at startup: tiles, concrete, meat, skin,
// rust, and a lot of blood. The blood painters are also used by the HUD to splatter the screen.
import * as THREE from 'three';
import { makeRng } from './rng.js';

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

function toTex(c, { srgb = true, nearest = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = 2;
  return t;
}

const TAU = Math.PI * 2;
function blob(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, Math.max(0.4, r), 0, TAU);
  g.fill();
}

// ---------- blood painters ----------
export const BLOOD = { fresh: '128,4,4', dark: '70,2,2', dried: '42,8,5', black: '18,2,2' };

export function splat(g, x, y, s, rng, col = BLOOD.fresh, a = 0.92) {
  g.fillStyle = `rgba(${col},${a})`;
  for (let i = 0; i < 9; i++) {
    const ang = rng() * TAU, d = rng() * s * 0.35;
    blob(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, s * (0.18 + rng() * 0.3));
  }
  const spikes = 10 + ((rng() * 16) | 0);
  for (let i = 0; i < spikes; i++) {
    const ang = rng() * TAU, len = s * (0.5 + rng() * 1.4), w = s * (0.03 + rng() * 0.08);
    g.beginPath();
    g.moveTo(x + Math.cos(ang + 1.57) * w, y + Math.sin(ang + 1.57) * w);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.lineTo(x + Math.cos(ang - 1.57) * w, y + Math.sin(ang - 1.57) * w);
    g.fill();
    blob(g, x + Math.cos(ang) * len, y + Math.sin(ang) * len, w * 1.3);
  }
  for (let i = 0; i < 36; i++) {
    const ang = rng() * TAU, d = s * (0.6 + rng() * 1.8);
    blob(g, x + Math.cos(ang) * d, y + Math.sin(ang) * d, s * 0.015 + rng() * s * 0.05);
  }
}

export function drip(g, x, y, len, w, col = BLOOD.fresh, a = 0.85) {
  g.fillStyle = `rgba(${col},${a})`;
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.quadraticCurveTo(x - w * 0.2, y + len * 0.5, x - w * 0.25, y + len);
  g.lineTo(x + w * 0.25, y + len);
  g.quadraticCurveTo(x + w * 0.2, y + len * 0.5, x + w / 2, y);
  g.fill();
  blob(g, x, y + len, w * 0.55);
}

// a splatter that runs: the default for anything on a wall
export function wallSplat(g, x, y, s, rng, col = BLOOD.fresh) {
  splat(g, x, y, s, rng, col, 0.9);
  const n = 3 + ((rng() * 6) | 0);
  for (let i = 0; i < n; i++) drip(g, x + (rng() - 0.5) * s * 1.2, y + rng() * s * 0.3, s * (0.8 + rng() * 3.5), 2 + rng() * 4, col, 0.8);
}

// the row of shrinking drops a cut artery leaves across a wall
export function arterial(g, x, y, len, ang, rng, col = BLOOD.fresh) {
  const n = 22 + ((rng() * 20) | 0);
  g.fillStyle = `rgba(${col},0.9)`;
  for (let i = 0; i < n; i++) {
    const t = i / n, w = Math.sin(t * 9 + rng()) * 6;
    const px = x + Math.cos(ang) * len * t - Math.sin(ang) * w, py = y + Math.sin(ang) * len * t + Math.cos(ang) * w;
    const r = (1 - t) * 6 + rng() * 3;
    blob(g, px, py, r);
    if (rng() < 0.4) drip(g, px, py, 10 + rng() * 60, r * 0.7, col, 0.75);
  }
}

export function handprint(g, x, y, s, rot, rng, col = BLOOD.dark, smearLen = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  for (let k = smearLen > 0 ? 6 : 1; k > 0; k--) {
    const off = (k - 1) * smearLen / 6;
    g.fillStyle = `rgba(${col},${k === 1 ? 0.85 : 0.18})`;
    g.beginPath();
    g.ellipse(0, off, s * 0.45, s * 0.5, 0, 0, TAU);
    g.fill();
    const fingers = [[-0.38, -0.62, 0.42], [-0.15, -0.78, 0.5], [0.1, -0.8, 0.52], [0.33, -0.68, 0.44], [0.58, -0.1, 0.36]];
    for (const [fx, fy, fl] of fingers) {
      g.save();
      g.translate(fx * s, fy * s * 0.6 + off);
      g.rotate(fx * 0.5 + (fx > 0.5 ? 0.9 : 0));
      g.beginPath();
      g.ellipse(0, -fl * s * 0.5, s * 0.1, fl * s * 0.55, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  }
  g.restore();
}

export function smear(g, x, y, w, len, ang, rng, col = BLOOD.dried) {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  for (let i = 0; i < 60; i++) {
    const t = i / 60;
    g.fillStyle = `rgba(${col},${0.08 + (1 - t) * 0.12})`;
    g.beginPath();
    g.ellipse((rng() - 0.5) * w * 0.3, t * len, w * (0.5 - t * 0.3) * (0.7 + rng() * 0.5), w * 0.25, 0, 0, TAU);
    g.fill();
  }
  // streaks from the fingers dragging through it
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(${col},0.35)`;
    g.lineWidth = 1 + rng() * 2;
    g.beginPath();
    g.moveTo((i / 4 - 0.5) * w * 0.7, 0);
    g.lineTo((i / 4 - 0.5) * w * 0.5 + (rng() - 0.5) * 6, len * (0.7 + rng() * 0.3));
    g.stroke();
  }
  g.restore();
}

function blotches(g, w, h, n, rMin, rMax, rgb, aMax, rng) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rgb},${rng() * aMax})`;
    blob(g, rng() * w, rng() * h, rMin + rng() * (rMax - rMin));
  }
}

function speckle(g, w, h, amt, rng) {
  const id = g.getImageData(0, 0, w, h), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}

function streaks(g, w, h, n, rgb, aMax, rng, fromTop = true) {
  for (let i = 0; i < n; i++) {
    const x = rng() * w, len = h * (0.1 + rng() * 0.6), y0 = fromTop ? 0 : h - len;
    const gr = g.createLinearGradient(0, y0, 0, y0 + len);
    gr.addColorStop(fromTop ? 0 : 1, `rgba(${rgb},${aMax * rng()})`);
    gr.addColorStop(fromTop ? 1 : 0, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x, y0, 1 + rng() * 5, len);
  }
}

// ---------- surfaces ----------
// wall: 2 m wide x 3 m tall, one face per canvas. gore 0 (grimy) .. 3 (soaked)
function wallCanvas(gore, style) {
  const W = 256, H = 384, { c, g } = canvas(W, H), rng = makeRng(101 + gore * 17 + style * 131);
  const band = H - 128; // lower metre is painted
  const tileCol = style === 1 ? [150, 170, 172] : style === 2 ? [178, 160, 130] : [186, 182, 164];
  g.fillStyle = '#4e4a41';
  g.fillRect(0, 0, W, H);
  const ts = 16;
  for (let y = 0; y < band; y += ts)
    for (let x = 0; x < W; x += ts) {
      const v = rng() * 26 - 13;
      if (rng() < 0.025) { g.fillStyle = '#26221d'; g.fillRect(x + 1, y + 1, ts - 2, ts - 2); continue; } // missing tile
      g.fillStyle = `rgb(${tileCol[0] + v | 0},${tileCol[1] + v | 0},${tileCol[2] + v | 0})`;
      g.fillRect(x + 1, y + 1, ts - 2, ts - 2);
      if (rng() < 0.05) { g.strokeStyle = 'rgba(40,30,20,.6)'; g.beginPath(); g.moveTo(x + 2, y + rng() * ts); g.lineTo(x + ts - 2, y + rng() * ts); g.stroke(); }
    }
  g.fillStyle = style === 1 ? '#2b3a3c' : style === 2 ? '#4a2a1c' : '#2f3c31';
  g.fillRect(0, band, W, 128);
  g.fillStyle = '#151311';
  g.fillRect(0, band - 4, W, 5);
  blotches(g, W, 128, 120, 1, 6, '190,180,150', 0.25, rng); // paint chips
  g.save(); g.translate(0, band); blotches(g, W, 128, 70, 1, 5, '150,140,120', 0.3, rng); g.restore();
  streaks(g, W, H, 26, '70,40,15', 0.5, rng, true); // rust/water from the ceiling
  const gr = g.createLinearGradient(0, H, 0, H - 200);
  gr.addColorStop(0, 'rgba(25,15,8,.8)');
  gr.addColorStop(1, 'rgba(25,15,8,0)');
  g.fillStyle = gr;
  g.fillRect(0, H - 200, W, 200);
  blotches(g, W, H, 60, 6, 40, '30,24,14', 0.12, rng);
  // blood
  const n = [0, 2, 4, 7][gore];
  for (let i = 0; i < n; i++) {
    const kind = rng();
    const col = rng() < 0.4 ? BLOOD.dried : rng() < 0.5 ? BLOOD.dark : BLOOD.fresh;
    if (kind < 0.35) wallSplat(g, rng() * W, 60 + rng() * 220, 14 + rng() * 30, rng, col);
    else if (kind < 0.55) arterial(g, rng() * W * 0.5, 40 + rng() * 140, 120 + rng() * 120, rng() * 0.8 - 0.2, rng, col);
    else if (kind < 0.8) handprint(g, rng() * W, 160 + rng() * 170, 18 + rng() * 6, (rng() - 0.5) * 0.8, rng, col, rng() < 0.6 ? 40 + rng() * 80 : 0);
    else smear(g, rng() * W, 250 + rng() * 40, 40 + rng() * 30, 90 + rng() * 40, (rng() - 0.5) * 0.4, rng, col);
  }
  if (gore >= 2) for (let i = 0; i < 8 * gore; i++) drip(g, rng() * W, 0, 20 + rng() * 120, 1.5 + rng() * 3, BLOOD.dark, 0.7);
  speckle(g, W, H, 22, rng);
  return c;
}

function floorCanvas(kind) {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(707 + kind * 33);
  g.fillStyle = '#3d3a35';
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 260, 4, 30, '20,18,15', 0.14, rng);
  blotches(g, S, S, 160, 2, 16, '95,90,80', 0.08, rng);
  g.strokeStyle = 'rgba(15,12,10,.6)';
  for (let i = 0; i < 6; i++) {
    g.lineWidth = 0.6 + rng();
    g.beginPath();
    let x = rng() * S, y = rng() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = 'rgba(0,0,0,.5)'; // expansion joints on the 2 m grid
  g.lineWidth = 2;
  g.strokeRect(0, 0, S, S);
  if (kind === 1) { splat(g, S / 2, S / 2, 46, rng, BLOOD.dark, 0.85); splat(g, S / 2 + 10, S / 2 - 6, 28, rng, BLOOD.fresh, 0.7); }
  if (kind === 2) {
    const gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, 90);
    gr.addColorStop(0, 'rgba(40,0,0,.95)');
    gr.addColorStop(1, 'rgba(40,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#0b0908';
    g.fillRect(S / 2 - 22, S / 2 - 22, 44, 44);
    g.fillStyle = '#4a3a30';
    for (let i = 0; i < 6; i++) g.fillRect(S / 2 - 20, S / 2 - 18 + i * 7, 40, 3);
  }
  if (kind === 3) {
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${BLOOD.dried},${0.25 + rng() * 0.3})`;
      g.beginPath();
      g.ellipse(S / 2 + (rng() - 0.5) * 30, i * 10, 26 + rng() * 10, 9, 0, 0, TAU);
      g.fill();
    }
  }
  speckle(g, S, S, 26, rng);
  return c;
}

function ceilingCanvas() {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(9);
  g.fillStyle = '#26231f';
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 140, 6, 50, '60,45,25', 0.12, rng);
  blotches(g, S, S, 80, 3, 20, '8,6,4', 0.3, rng);
  speckle(g, S, S, 18, rng);
  return c;
}

// raw muscle with fat marbling
function meatCanvas(seed = 3, pale = false) {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(seed);
  g.fillStyle = pale ? '#b0544c' : '#7a1612';
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 220, 4, 26, pale ? '170,70,60' : '120,20,18', 0.5, rng);
  blotches(g, S, S, 120, 3, 18, '50,4,4', 0.5, rng);
  for (let i = 0; i < 40; i++) { // fat
    g.strokeStyle = `rgba(232,${200 + rng() * 30 | 0},170,${0.25 + rng() * 0.5})`;
    g.lineWidth = 1 + rng() * 4;
    g.beginPath();
    let x = rng() * S, y = rng() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (rng() - 0.5) * 50; y += rng() * 30; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 30; i++) { // sinew
    g.strokeStyle = `rgba(230,220,210,${rng() * 0.3})`;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(rng() * S, rng() * S);
    g.lineTo(rng() * S, rng() * S);
    g.stroke();
  }
  speckle(g, S, S, 24, rng);
  return c;
}

function skinCanvas(seed, base = [168, 150, 128]) {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(seed);
  g.fillStyle = `rgb(${base})`;
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 120, 6, 40, '110,120,95', 0.18, rng); // lividity
  blotches(g, S, S, 50, 6, 30, '80,40,70', 0.18, rng); // bruising
  for (let i = 0; i < 30; i++) { // veins
    g.strokeStyle = `rgba(60,70,90,${0.15 + rng() * 0.2})`;
    g.lineWidth = 0.7;
    g.beginPath();
    let x = rng() * S, y = rng() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rng() - 0.5) * 30; y += (rng() - 0.5) * 30; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 6; i++) splat(g, rng() * S, rng() * S, 6 + rng() * 14, rng, BLOOD.dark, 0.8);
  speckle(g, S, S, 20, rng);
  return c;
}

// the Foreman's mask is somebody's face, stitched on
function maskCanvas() {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(666);
  g.fillStyle = '#c7b49a';
  g.fillRect(0, 0, S, S);
  blotches(g, S, S, 100, 4, 30, '150,120,100', 0.3, rng);
  blotches(g, S, S, 50, 3, 14, '100,60,50', 0.3, rng);
  g.strokeStyle = '#2a1a12';
  g.lineWidth = 2;
  for (const [x0, y0, x1, y1] of [[20, 40, 230, 70], [128, 0, 120, 256], [30, 180, 220, 200], [60, 0, 40, 256]]) {
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const n = 18;
    for (let i = 0; i <= n; i++) { // cross stitches
      const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
      g.beginPath(); g.moveTo(x - nx / l * 5, y - ny / l * 5); g.lineTo(x + nx / l * 5, y + ny / l * 5); g.stroke();
    }
  }
  for (let i = 0; i < 4; i++) drip(g, 70 + rng() * 120, 100 + rng() * 30, 60 + rng() * 90, 4 + rng() * 4, BLOOD.fresh, 0.85);
  speckle(g, S, S, 22, rng);
  return c;
}

function rustCanvas(seed, paint = '#3e4a3c') {
  const W = 128, H = 256, { c, g } = canvas(W, H), rng = makeRng(seed);
  g.fillStyle = paint;
  g.fillRect(0, 0, W, H);
  blotches(g, W, H, 90, 2, 16, '110,55,20', 0.45, rng);
  blotches(g, W, H, 50, 1, 8, '60,25,10', 0.6, rng);
  streaks(g, W, H, 20, '90,40,15', 0.5, rng, true);
  g.fillStyle = '#121212'; // vents
  for (let i = 0; i < 6; i++) g.fillRect(28, 22 + i * 7, 72, 3);
  for (let i = 0; i < 6; i++) g.fillRect(28, 200 + i * 7, 72, 3);
  g.fillStyle = '#1a1a1a';
  g.fillRect(104, 110, 8, 30); // latch
  if (rng() < 0.7) handprint(g, 64, 130, 16, 0.2, rng, BLOOD.dark, 50);
  speckle(g, W, H, 24, rng);
  return c;
}

function steelCanvas() {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(55);
  g.fillStyle = '#7c7f80';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(0, rng() * S, S, 1); }
  for (let i = 0; i < 5; i++) splat(g, rng() * S, rng() * S, 14 + rng() * 26, rng, rng() < 0.5 ? BLOOD.dark : BLOOD.fresh, 0.9);
  smear(g, rng() * S, 20, 50, 160, 0.1, rng, BLOOD.dark);
  speckle(g, S, S, 16, rng);
  return c;
}

function clothCanvas(seed, base, bloody) {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.06})`; g.fillRect(rng() * S, 0, 1, S); }
  blotches(g, S, S, 60, 5, 30, '40,30,20', 0.18, rng);
  for (let i = 0; i < bloody; i++) splat(g, rng() * S, rng() * S, 16 + rng() * 34, rng, rng() < 0.5 ? BLOOD.dark : BLOOD.fresh, 0.85);
  speckle(g, S, S, 16, rng);
  return c;
}

// transparent decals laid over floors and props
function decalCanvas(kind, seed) {
  const S = 256, { c, g } = canvas(S, S), rng = makeRng(seed);
  if (kind === 'pool') {
    g.fillStyle = `rgba(${BLOOD.dark},0.95)`;
    for (let i = 0; i < 14; i++) blob(g, S / 2 + (rng() - 0.5) * 90, S / 2 + (rng() - 0.5) * 90, 30 + rng() * 40);
    g.fillStyle = `rgba(${BLOOD.fresh},0.5)`;
    for (let i = 0; i < 6; i++) blob(g, S / 2 + (rng() - 0.5) * 60, S / 2 + (rng() - 0.5) * 60, 14 + rng() * 26);
  } else if (kind === 'splat') {
    splat(g, S / 2, S / 2, 40, rng, rng() < 0.5 ? BLOOD.fresh : BLOOD.dark, 0.92);
  } else if (kind === 'drag') {
    for (let i = 0; i < 40; i++) {
      const y = i * 6.4;
      g.fillStyle = `rgba(${BLOOD.dark},${0.3 + rng() * 0.4})`;
      g.beginPath();
      g.ellipse(S / 2 + Math.sin(i * 0.3) * 8, y, 34 + rng() * 14, 10, 0, 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 4; i++) { handprint(g, S / 2 + (rng() - 0.5) * 120, 30 + rng() * 200, 18, Math.PI + (rng() - 0.5), rng, BLOOD.dark, 30); }
  }
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---------- materials ----------
export function makeMaterials() {
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  const tx = (c, rx = 1, ry = 1) => { const t = toTex(c); t.repeat.set(rx, ry); return t; };

  const walls = [];
  for (let gore = 0; gore < 4; gore++) for (let style = 0; style < 3; style++) {
    const t = tx(wallCanvas(gore, style));
    walls.push(phong({ map: t, bumpMap: t, bumpScale: 1.5, shininess: 18, specular: 0x222222 }));
  }
  const floors = [0, 1, 2, 3].map((k) => { const t = tx(floorCanvas(k)); return phong({ map: t, bumpMap: t, bumpScale: 1.2, shininess: k ? 50 : 10, specular: k ? 0x331111 : 0x111111 }); });
  const ceil = phong({ map: tx(ceilingCanvas()), shininess: 4 });
  const meatTex = tx(meatCanvas(3));
  const decalMat = (kind, seed, extra = {}) => new THREE.MeshPhongMaterial({
    map: decalCanvas(kind, seed), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    shininess: 90, specular: 0x441111, ...extra,
  });

  return {
    walls, // [gore*3 + style]
    floors,
    ceil,
    meat: phong({ map: meatTex, shininess: 70, specular: 0x552222 }),
    meatPale: phong({ map: tx(meatCanvas(8, true)), shininess: 40, specular: 0x332222 }),
    gut: phong({ color: 0xc87070, map: tx(meatCanvas(12, true)), shininess: 110, specular: 0x886666 }),
    blood: phong({ color: 0x2a0000, shininess: 120, specular: 0x662222 }),
    bone: new THREE.MeshLambertMaterial({ color: 0xd9ceb2 }),
    skin: phong({ map: tx(skinCanvas(21)), shininess: 12, specular: 0x111111 }),
    skinGrey: phong({ map: tx(skinCanvas(22, [140, 140, 125])), shininess: 12, specular: 0x111111 }),
    fat: phong({ map: tx(skinCanvas(23, [214, 184, 160])), shininess: 30, specular: 0x222222 }),
    mask: phong({ map: tx(maskCanvas()), shininess: 8 }),
    flesh: phong({ map: tx(meatCanvas(31)), shininess: 80, specular: 0x552222 }),
    apron: phong({ map: tx(clothCanvas(41, '#3a2a1e', 10)), shininess: 40, specular: 0x221111 }),
    coverall: phong({ map: tx(clothCanvas(42, '#2c3440', 4)), shininess: 6 }),
    coverall2: phong({ map: tx(clothCanvas(43, '#4a4232', 5)), shininess: 6 }),
    sheet: phong({ map: tx(clothCanvas(44, '#bdb8aa', 3)), shininess: 6 }),
    bag: phong({ color: 0x0b0b0c, shininess: 90, specular: 0x444444 }),
    steel: phong({ map: tx(steelCanvas()), shininess: 70, specular: 0x777777 }),
    darkMetal: phong({ color: 0x2a2826, shininess: 40, specular: 0x333333 }),
    chain: phong({ color: 0x3a3330, shininess: 60, specular: 0x555555 }),
    rust: [0, 1, 2].map((i) => phong({ map: tx(rustCanvas(61 + i, ['#3e4a3c', '#3c4450', '#4f4636'][i])), shininess: 20, specular: 0x222222 })),
    brass: phong({ color: 0xb08a3a, emissive: 0x2a1a04, shininess: 100, specular: 0xffdd88 }),
    lampOn: new THREE.MeshBasicMaterial({ color: 0xf2f6e8 }),
    lampOff: new THREE.MeshLambertMaterial({ color: 0x2a2a28 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xff2a10, fog: false }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    tooth: new THREE.MeshLambertMaterial({ color: 0x9c8a62 }),
    pool: [decalMat('pool', 1), decalMat('pool', 2), decalMat('pool', 3)],
    splat: [decalMat('splat', 4), decalMat('splat', 5), decalMat('splat', 6), decalMat('splat', 7)],
    drag: decalMat('drag', 8),
  };
}
