// Shared state, timers and small helpers for MARROW.
import * as THREE from 'three';

export const T = 2.0;        // tile size in metres
export const WALL_H = 2.7;   // ceiling height

export const G = {
  state: 'title',            // title | play | note | paused | dying | dead | ending | end
  time: 0, dt: 0, playTime: 0,
  // screen + mood
  fear: 0, blood: 0, flash: 0, flashCol: new THREE.Color(1, 0, 0), distort: 0, black: 1, shake: 0,
  brightness: 1,
  // progress
  fuses: 0, fusesPlaced: false, hasKey: false, deaths: 0, elevatorArrived: false,
  flags: {},
  timers: [],
  updaters: [],              // per-frame callbacks (dt, t), run while playing
  scene: null, camera: null, renderer: null, level: null, player: null, monster: null, post: null,
};

// game-time timers (they stop while paused / reading)
export function after(sec, fn) { G.timers.push({ t: G.time + sec, fn }); }
export function runTimers() {
  if (!G.timers.length) return;
  const due = G.timers.filter(t => G.time >= t.t);
  if (!due.length) return;
  G.timers = G.timers.filter(t => G.time < t.t);
  due.sort((a, b) => a.t - b.t).forEach(d => d.fn());
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export const R = mulberry32(666);              // deterministic: level + textures
export const rr = (a, b) => a + (b - a) * Math.random();
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
// tile coords (x.5 = tile centre) -> world
export const W3 = (tx, ty, y = 0) => new THREE.Vector3(tx * T, y, ty * T);
export const toTile = (x, z) => [Math.floor(x / T), Math.floor(z / T)];
export function angDiff(a, b) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
