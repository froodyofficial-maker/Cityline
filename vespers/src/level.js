// Halloran Provisions, night shift. Map, geometry, lights, doors, lockers, props and the gore.
import * as THREE from 'three';
import { G, T, WALL_H, R, W3, toTile, rr, clamp } from './state.js';
import * as TX from './textures.js';
import * as GO from './gore.js';
import * as AU from './audio.js';

export const MW = 44, MH = 29;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ map
function makeMap() {
  const cells = Array.from({ length: MH }, () => Array(MW).fill('#'));
  const room = Array.from({ length: MH }, () => Array(MW).fill(''));
  const rect = (x0, y0, x1, y1, id, ch = '.') => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { cells[y][x] = ch; room[y][x] = id; } };
  rect(2, 2, 9, 8, 'locker'); rect(2, 11, 7, 15, 'shower'); rect(11, 10, 41, 11, 'corridor'); rect(14, 1, 27, 7, 'cold');
  rect(29, 4, 34, 7, 'office'); rect(37, 3, 42, 7, 'lobby'); rect(12, 14, 28, 24, 'kill'); rect(32, 15, 41, 24, 'render'); rect(4, 27, 38, 27, 'tunnel');
  rect(11, 3, 13, 3, 'hall'); rect(11, 6, 11, 9, 'hall'); rect(4, 10, 4, 10, 'shower'); rect(20, 9, 20, 9, 'corridor'); rect(31, 9, 31, 9, 'corridor');
  rect(39, 8, 40, 9, 'lobby'); rect(16, 13, 16, 13, 'corridor'); rect(25, 13, 25, 13, 'corridor'); rect(36, 13, 36, 14, 'hall');
  rect(4, 17, 4, 26, 'tunnel'); rect(20, 26, 20, 26, 'tunnel'); rect(37, 26, 37, 26, 'tunnel');
  rect(39, 1, 40, 1, 'car'); rect(39, 2, 40, 2, 'gate', 'G');
  const doors = [[10, 3, 'n', 1], [10, 6, 'n', 0], [4, 9, 'n', 1], [20, 8, 'n', 0], [31, 8, 'n', 0], [16, 12, 'n', 1], [25, 12, 'n', 0], [36, 12, 'locked', 0], [4, 16, 'n', 0], [20, 25, 'n', 0], [37, 25, 'bolted', 0]];
  for (const [x, y] of doors) { cells[y][x] = 'D'; room[y][x] = 'door'; }
  return { cells, room, doorDefs: doors };
}

// ------------------------------------------------------------------ geometry accumulator
class Acc {
  constructor() { this.p = []; this.n = []; this.u = []; }
  quad(a, b, c, d, n, u0 = 0, v0 = 0, u1 = 1, v1 = 1) {
    this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.n.push(...n);
    this.u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); return g; }
}

export function buildLevel(scene) {
  const { cells, room, doorDefs } = makeMap();
  const L = {
    cells, room, doors: [], lockers: [], fixtures: [], interact: [], hangers: [], items: {}, colGrid: [], colliders: [], nav: [],
    updaters: [], waypoints: [], vats: [], specials: {}, gateOpen: false, onItem: null, decals: new THREE.Group(),
  };
  G.level = L;
  const root = new THREE.Group(); scene.add(root); L.root = root; root.add(L.decals);
  for (let i = 0; i < MW * MH; i++) { L.colGrid.push([]); L.nav.push(true); }

  // ---------- queries ----------
  L.cell = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? '#' : cells[y][x];
  L.roomAt = (wx, wz) => { const [x, y] = toTile(wx, wz); return (x < 0 || y < 0 || x >= MW || y >= MH) ? '' : room[y][x]; };
  L.doorAt = (x, y) => L.doors.find(d => d.tx === x && d.ty === y);
  L.solidTile = (x, y) => { const c = L.cell(x, y); return c === '#' || (c === 'G' && !L.gateOpen); };
  L.passable = (x, y) => {
    const c = L.cell(x, y);
    if (c === '#' || c === 'G') return false;
    if (c === 'D') { const d = L.doorAt(x, y); return !d.locked && !d.bolted; }
    return L.nav[y * MW + x];
  };
  // line of sight between two world points (walls + closed doors block; the gate is bars, it doesn't)
  L.los = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), steps = Math.ceil(dist / 0.3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps, x = a.x + dx * t, z = a.z + dz * t, [tx, ty] = toTile(x, z), c = L.cell(tx, ty);
      if (c === '#') return false;
      if (c === 'D') { const d = L.doorAt(tx, ty); if (d.angle < 0.35 && d.angle > -0.35) return false; }
    }
    return true;
  };
  // circle vs walls + colliders. mutates p (x,z)
  L.collide = (p, r) => {
    const [cx, cy] = toTile(p.x, p.z);
    for (let it = 0; it < 2; it++) for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (L.solidTile(x, y)) pushOut(p, r, x * T, x * T + T, y * T, y * T + T);
      if (x >= 0 && y >= 0 && x < MW && y < MH) for (const c of L.colGrid[y * MW + x]) if (c.on) pushOut(p, r, c.x0, c.x1, c.z0, c.z1);
    }
  };
  function pushOut(p, r, x0, x1, z0, z1) {
    const qx = clamp(p.x, x0, x1), qz = clamp(p.z, z0, z1), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { // centre inside the box: push out along the shallowest axis
      const l = p.x - x0, rt = x1 - p.x, tp = p.z - z0, bt = z1 - p.z, m = Math.min(l, rt, tp, bt);
      if (m === l) p.x = x0 - r; else if (m === rt) p.x = x1 + r; else if (m === tp) p.z = z0 - r; else p.z = z1 + r;
    }
  }
  L.addCollider = (x0, x1, z0, z1, nav = true) => {
    const c = { x0, x1, z0, z1, on: true }; L.colliders.push(c);
    const [ax, ay] = toTile(x0, z0), [bx, by] = toTile(x1, z1);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (x >= 0 && y >= 0 && x < MW && y < MH) {
      L.colGrid[y * MW + x].push(c);
      const mx = (x + 0.5) * T, mz = (y + 0.5) * T;
      if (nav && mx > x0 - 0.3 && mx < x1 + 0.3 && mz > z0 - 0.3 && mz < z1 + 0.3) L.nav[y * MW + x] = false;
    }
    return c;
  };
  // A* over tiles (8-way, no corner cutting)
  L.path = (from, to) => {
    const [sx, sy] = toTile(from.x, from.z), [gx, gy] = toTile(to.x, to.z);
    const ok = (x, y) => L.passable(x, y) || (x === sx && y === sy);
    if (!ok(gx, gy)) return null;
    const N = MW * MH, g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
    const s = sy * MW + sx; g[s] = 0; open.push([Math.hypot(gx - sx, gy - sy), s]);
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % MW, cy = (cur / MW) | 0;
      if (cx === gx && cy === gy) break;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy;
        if (!ok(nx, ny)) continue;
        if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
        const ni = ny * MW + nx, ng = g[cur] + (dx && dy ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; open.push([ng + Math.hypot(gx - nx, gy - ny), ni]); }
      }
    }
    const goal = gy * MW + gx; if (prev[goal] < 0 && goal !== s) return null;
    const out = []; for (let c = goal; c !== s && c >= 0; c = prev[c]) out.push(W3((c % MW) + 0.5, ((c / MW) | 0) + 0.5));
    return out.reverse();
  };
  L.randomFloorNear = (p, rad) => {
    const [px, py] = toTile(p.x, p.z);
    for (let k = 0; k < 30; k++) { const x = px + Math.round(rr(-rad, rad)), y = py + Math.round(rr(-rad, rad)); if (L.passable(x, y) && L.cell(x, y) === '.') return W3(x + 0.5, y + 0.5); }
    return p.clone();
  };

  // ---------- materials ----------
  const lam = (map, o = {}) => new THREE.MeshLambertMaterial({ map, ...o });
  const styleCache = {};
  const style = (name) => {
    if (styleCache[name]) return styleCache[name];
    const mk = {
      tile: () => TX.wallTiles(0, 0.8), tileDirty: () => TX.wallTiles(R() < 0.5 ? 0.35 : 0, 1.3), tileBloody: () => TX.wallTiles(0.6 + R() * 0.6, 1.4),
      concrete: () => TX.wallConcrete(0), concreteBloody: () => TX.wallConcrete(0.5 + R() * 0.7, [80, 74, 70]), office: () => TX.wallOffice(R() < 0.3 ? 0.4 : 0),
      brick: () => TX.wallBrick(R() < 0.4 ? 0.5 : 0), metal: () => { const t = TX.wallMetal(); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; },
      quarry: () => TX.floorQuarry(R() < 0.3 ? 0.4 : 0), quarryBloody: () => TX.floorQuarry(0.7 + R() * 0.8), concreteF: () => TX.floorConcrete(R() < 0.25 ? 0.4 : 0),
      concreteFBloody: () => TX.floorConcrete(0.8 + R()), drain: () => TX.floorConcrete(0.6, true), lino: () => TX.floorLino(), ceiling: () => TX.ceilingTex(),
      stone: () => TX.wallStone(R() < 0.25 ? 0.35 : 0), stoneBloody: () => TX.wallStone(0.6 + R() * 0.6, [90, 80, 72]), plaster: () => TX.wallPlaster(R() < 0.3 ? 0.35 : 0),
      plasterBloody: () => TX.wallPlaster(0.7 + R() * 0.6), skulls: () => TX.wallSkulls(), flag: () => TX.floorFlag(R() < 0.3 ? 0.4 : 0), flagBloody: () => TX.floorFlag(0.7 + R() * 0.8),
      boards: () => TX.floorBoards(R() < 0.3 ? 0.5 : 0), beams: () => TX.ceilingBeams(), vault: () => TX.wallStone(0, [78, 72, 64]), snow: () => TX.snowTex(),
    }[name];
    const n = (name === 'metal' || name === 'lino' || name === 'drain' || name === 'snow') ? 1 : 3;
    styleCache[name] = Array.from({ length: n }, () => lam(mk()));
    return styleCache[name];
  };
  // internal room ids -> St. Aldric's: locker = dormitory, shower = lavatorium, corridor = cloister, cold = hall of penitents,
  // office = abbot's study, lobby = gatehouse, kill = refectory, render = chapel, tunnel = catacombs, car = outside (the pass)
  const wallStyle = { locker: 'plaster', shower: 'stoneBloody', hall: 'stone', corridor: 'stone', cold: 'stone', office: 'office', lobby: 'stone', kill: 'plasterBloody', render: 'stoneBloody', tunnel: 'skulls', car: 'stone', gate: 'stone', door: 'stone' };
  const floorStyle = { locker: 'boards', shower: 'flagBloody', hall: 'flag', corridor: 'flag', cold: 'flag', office: 'boards', lobby: 'flag', kill: 'flagBloody', render: 'flagBloody', tunnel: 'flag', gate: 'flag', door: 'flag', car: 'snow' };
  const ceilStyle = { locker: 'beams', office: 'beams', kill: 'beams' };
  const drains = new Set();
  const accs = new Map();
  const acc = (mat) => { if (!accs.has(mat)) accs.set(mat, new Acc()); return accs.get(mat); };
  const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  // ---------- walls, floors, ceilings ----------
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = cells[y][x]; if (c === '#') continue;
    const rid = room[y][x], x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T;
    const wy0 = 0, wy1 = rid === 'car' ? WALL_H + 3 : WALL_H, vr = 1;
    const ws = style(wallStyle[rid] || 'concrete');
    const wm = (k) => ws[Math.floor(hash(x, y, k) * ws.length)];
    if (cells[y - 1]?.[x] === '#') acc(wm(1)).quad([x0, wy0, z0], [x1, wy0, z0], [x1, wy1, z0], [x0, wy1, z0], [0, 0, 1], 0, 0, 1, vr);
    if (cells[y + 1]?.[x] === '#') acc(wm(2)).quad([x1, wy0, z1], [x0, wy0, z1], [x0, wy1, z1], [x1, wy1, z1], [0, 0, -1], 0, 0, 1, vr);
    if (cells[y][x - 1] === '#') acc(wm(3)).quad([x0, wy0, z1], [x0, wy0, z0], [x0, wy1, z0], [x0, wy1, z1], [1, 0, 0], 0, 0, 1, vr);
    if (cells[y][x + 1] === '#') acc(wm(4)).quad([x1, wy0, z0], [x1, wy0, z1], [x1, wy1, z1], [x1, wy1, z0], [-1, 0, 0], 0, 0, 1, vr);
    const fsName = drains.has(x + ',' + y) ? 'drain' : (floorStyle[rid] || 'concreteF'), fs = style(fsName);
    acc(fs[Math.floor(hash(x, y, 5) * fs.length)]).quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0]);
    if (rid === 'gate' || rid === 'car') continue; // open to the sky
    const cs = style(ceilStyle[rid] || 'vault');
    acc(cs[Math.floor(hash(x, y, 6) * cs.length)]).quad([x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0]);
  }
  for (const [mat, a] of accs) { const m = new THREE.Mesh(a.geo(), mat); m.receiveShadow = true; m.castShadow = true; m.matrixAutoUpdate = false; root.add(m); }

  // ---------- prop helpers ----------
  const mats = GO.goreMats();
  const wood = lam(TX.floorBoards(0), { color: 0xb08a68 });
  const darkMetal = lam(TX.metalTex(0.8), { color: 0x555555 });
  const lockerMat = lam(TX.woodTex(false)), lockerBloodyMat = lam(TX.woodTex(true)), coffinMat = lam(TX.woodTex(false), { color: 0x8a7060 }), lockerInside = lam(null, { color: 0x0a0a0a });
  const paperMat = lam(TX.paperTex(), { side: THREE.DoubleSide });
  const box = (w, h, d, mat, x, y, z, opts = {}) => {
    const m = GO.mesh(new THREE.BoxGeometry(w, h, d), mat, opts.parent || root, x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.col) { const sw = Math.abs(Math.round(Math.sin(opts.ry || 0))) ? d : w, sd = Math.abs(Math.round(Math.sin(opts.ry || 0))) ? w : d; L.addCollider(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2, opts.nav !== false); }
    return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 10, opts = {}) => {
    const m = GO.mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, opts.parent || root, x, y, z);
    if (opts.col) L.addCollider(x - rb, x + rb, z - rb, z + rb, opts.nav !== false);
    return m;
  };
  // wall placement helper: tile + side -> point on wall, inward normal, along-wall vector
  const wallFrame = (tx, ty, side, off = 0) => {
    const c = W3(tx + 0.5, ty + 0.5);
    const nrm = { n: V(0, 0, 1), s: V(0, 0, -1), w: V(1, 0, 0), e: V(-1, 0, 0) }[side];
    const p = c.clone().addScaledVector(nrm, -T / 2);
    const along = V(-nrm.z, 0, nrm.x); // right-hand when facing the wall... (looking at the wall from inside)
    p.addScaledVector(along, off);
    return { p, nrm, along, yaw: Math.atan2(nrm.x, nrm.z) };
  };

  // ---------- decals ----------
  const decalMats = {};
  const dmat = (kind) => {
    if (!decalMats[kind]) decalMats[kind] = Array.from({ length: kind === 'pool' ? 3 : 4 }, () => new THREE.MeshLambertMaterial({ map: TX.decalTex(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    return decalMats[kind][(R() * decalMats[kind].length) | 0];
  };
  L.decalFloor = (x, z, w, d, kind, rot = R() * 6.28, mat) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat || dmat(kind)); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, 0.006 + R() * 0.004, z); m.receiveShadow = true; L.decals.add(m); return m;
  };
  L.decalWall = (tx, ty, side, off, y, w, h, kind, mat) => {
    const f = wallFrame(tx, ty, side, off);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || dmat(kind));
    m.position.copy(f.p).addScaledVector(f.nrm, 0.012); m.position.y = y; m.rotation.y = f.yaw; m.receiveShadow = true; L.decals.add(m); return m;
  };
  L.writing = (tx, ty, side, off, y, text, w = 2.2, h = 0.55) => {
    const t = TX.writingTex(text);
    return L.decalWall(tx, ty, side, off, y, w, h, null, new THREE.MeshLambertMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  };
  const trail = (ax, az, bx, bz, w = 0.7) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 2.2));
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; L.decalFloor(ax + dx * t + (R() - 0.5) * 0.15, az + dz * t + (R() - 0.5) * 0.15, len / n * 1.15, w, 'trail', -Math.atan2(dz, dx) + (R() - 0.5) * 0.15); }
  };
  const pool = (x, z, s = 1.2) => L.decalFloor(x, z, s, s, 'pool');
  const splat = (x, z, s = 0.9) => L.decalFloor(x, z, s, s, 'splat');

  // ---------- blood drips (particles) ----------
  const DMAX = 500, dpos = new Float32Array(DMAX * 3), dvel = new Float32Array(DMAX * 3), dlife = new Float32Array(DMAX);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dpts = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x6a0000, size: 0.035, sizeAttenuation: true }));
  dpts.frustumCulled = false; root.add(dpts);
  for (let i = 0; i < DMAX; i++) dpos[i * 3 + 1] = -50;
  let dnext = 0; const emitters = [];
  const spawnDrop = (x, y, z, vx = 0, vy = 0, vz = 0) => { const i = dnext; dnext = (dnext + 1) % DMAX; dpos[i * 3] = x; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = z; dvel[i * 3] = vx; dvel[i * 3 + 1] = vy; dvel[i * 3 + 2] = vz; dlife[i] = 4; };
  L.dripEmitter = (obj, rate, local = V(0, 0, 0)) => emitters.push({ obj, rate, local, acc: R() });
  L.burst = (p, n = 40, sp = 3) => { for (let i = 0; i < n; i++) spawnDrop(p.x, p.y, p.z, (Math.random() - 0.5) * sp, Math.random() * sp * 0.8, (Math.random() - 0.5) * sp); };
  const _w = V(0, 0, 0);
  L.updaters.push((dt) => {
    for (const e of emitters) {
      e.acc += dt * e.rate;
      while (e.acc > 1) { e.acc -= 1; _w.copy(e.local); e.obj.localToWorld(_w); spawnDrop(_w.x + (Math.random() - 0.5) * 0.03, _w.y, _w.z + (Math.random() - 0.5) * 0.03); }
    }
    const cam = G.camera.position;
    for (let i = 0; i < DMAX; i++) {
      if (dlife[i] <= 0) continue;
      dlife[i] -= dt; dvel[i * 3 + 1] -= 9.8 * dt;
      dpos[i * 3] += dvel[i * 3] * dt; dpos[i * 3 + 1] += dvel[i * 3 + 1] * dt; dpos[i * 3 + 2] += dvel[i * 3 + 2] * dt;
      if (dpos[i * 3 + 1] < 0.01) {
        dlife[i] = 0;
        const dx = dpos[i * 3] - cam.x, dz = dpos[i * 3 + 2] - cam.z;
        if (dx * dx + dz * dz < 30 && Math.random() < 0.15) AU.drip(V(dpos[i * 3], 0, dpos[i * 3 + 2]), 0.06);
        dpos[i * 3 + 1] = -50;
      }
    }
    dgeo.attributes.position.needsUpdate = true;
  });

  // ---------- hanging bodies (they swing when touched) ----------
  L.hang = (wx, wz, kind, opts = {}) => {
    const h = GO.hangingBody(kind, opts);
    h.pivot.position.set(wx, WALL_H - 0.25, wz); h.pivot.rotation.y = opts.ry ?? R() * 6.28; root.add(h.pivot);
    if (!opts.noBake) GO.bake(h.pivot);
    const hg = { ...h, ax: 0, az: 0, vx: (R() - 0.5) * 0.1, vz: (R() - 0.5) * 0.1, x: wx, z: wz, chainT: 0, baseRy: h.pivot.rotation.y };
    L.hangers.push(hg);
    const low = new THREE.Object3D(); low.position.set(0, h.lowest + 0.05, 0.05); h.pivot.add(low);
    L.dripEmitter(low, opts.drip ?? (0.4 + R() * 1.2));
    pool(wx + (R() - 0.5) * 0.2, wz + (R() - 0.5) * 0.2, 0.9 + R() * 0.8);
    return hg;
  };
  L.updaters.push((dt) => {
    const pp = G.player?.pos, mp = G.monster?.active ? G.monster.pos : null;
    for (const h of L.hangers) {
      if (h.dropped) continue;
      for (const q of [pp, mp]) {
        if (!q) continue;
        const dx = h.x - q.x, dz = h.z - q.z, d = Math.hypot(dx, dz);
        if (d < 0.55 && d > 0.001) {
          h.vx += dz / d * dt * 2.2 * (q === mp ? 2.5 : 1); h.vz -= dx / d * dt * 2.2 * (q === mp ? 2.5 : 1);
          if (G.time > h.chainT) { AU.chain(V(h.x, 2.6, h.z), q === mp ? 0.3 : 0.18); h.chainT = G.time + 1.2; }
        }
      }
      h.vx += (-h.ax * 3.2 - h.vx * 0.35) * dt; h.vz += (-h.az * 3.2 - h.vz * 0.35) * dt;
      h.vx += (Math.random() - 0.5) * dt * 0.04; h.vz += (Math.random() - 0.5) * dt * 0.04;
      h.ax += h.vx * dt; h.az += h.vz * dt;
      h.pivot.rotation.set(h.ax, h.baseRy + Math.sin(G.time * 0.3 + h.x) * 0.05, h.az, 'YXZ');
    }
  });

  // ---------- doors ----------
  for (const [tx, ty, type, startOpen] of doorDefs) {
    const alongX = L.cell(tx - 1, ty) !== '#' && L.cell(tx + 1, ty) !== '#'; // passage runs along x
    const cx = (tx + 0.5) * T, cz = (ty + 0.5) * T, jw = 0.55, open = T - jw * 2, dh = 2.3;
    const jm = style('stone')[0];
    if (alongX) {
      box(T, WALL_H, jw, jm, cx, WALL_H / 2, ty * T + jw / 2, { col: true, nav: false });
      box(T, WALL_H, jw, jm, cx, WALL_H / 2, (ty + 1) * T - jw / 2, { col: true, nav: false });
    } else {
      box(jw, WALL_H, T, jm, tx * T + jw / 2, WALL_H / 2, cz, { col: true, nav: false });
      box(jw, WALL_H, T, jm, (tx + 1) * T - jw / 2, WALL_H / 2, cz, { col: true, nav: false });
    }
    box(T, WALL_H - dh, T, jm, cx, dh + (WALL_H - dh) / 2, cz);
    const pivot = new THREE.Group();
    const doorMat = type === 'n' ? lam(TX.woodTex(R() < 0.3)) : lam(TX.woodTex(false), { color: 0x9a7a6a });
    if (alongX) { pivot.position.set(cx, 0, ty * T + jw); } else { pivot.position.set(tx * T + jw, 0, cz); }
    const panel = GO.mesh(new THREE.BoxGeometry(alongX ? 0.07 : open, dh, alongX ? open : 0.07), doorMat, pivot, alongX ? 0 : open / 2, dh / 2, alongX ? open / 2 : 0);
    // a small wired window at head height and a push plate
    GO.mesh(new THREE.BoxGeometry(alongX ? 0.09 : 0.08, 0.08, alongX ? 0.08 : 0.09), darkMetal, pivot, alongX ? 0 : open * 0.85, 1.05, alongX ? open * 0.85 : 0); // iron ring handle
    for (const hy of [0.4, 1.9]) GO.mesh(new THREE.BoxGeometry(alongX ? 0.09 : open * 0.6, 0.06, alongX ? open * 0.6 : 0.09), darkMetal, pivot, alongX ? 0 : open * 0.3, hy, alongX ? open * 0.3 : 0); // strap hinges
    if (type === 'n' && R() < 0.6) { const hp = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), dmat('hand')); hp.position.set(alongX ? 0.04 : open * 0.7, 1.2, alongX ? open * 0.7 : 0.04); hp.rotation.y = alongX ? Math.PI / 2 : 0; pivot.add(hp); }
    root.add(pivot);
    const col = alongX ? L.addCollider(cx - 0.1, cx + 0.1, ty * T + jw, (ty + 1) * T - jw, false) : L.addCollider(tx * T + jw, (tx + 1) * T - jw, cz - 0.1, cz + 0.1, false);
    const d = {
      tx, ty, type, alongX, pivot, panel, col, angle: 0, target: 0, locked: type === 'locked', bolted: type === 'bolted', pos: V(cx, 1.2, cz), slamT: 0,
      // which side the bolt is on: bolted door between render (z<) and tunnel (z>) - bolt is on the render side
      boltSideZ: -1,
    };
    // swing away from whoever opens it
    d.swingFor = (from) => {
      const toFrom = alongX ? from.x - cx : from.z - cz;
      // alongX: panel extends +z; rotating +y by +1.5 points it to +x. open away from opener.
      if (alongX) return toFrom > 0 ? -1.5 : 1.5;
      // panel extends +x; rotating +1.5 points it to -z.
      return toFrom > 0 ? 1.5 : -1.5;
    };
    d.open = (from, slam = false) => {
      d.target = d.swingFor(from);
      if (slam) { AU.doorSlam(d.pos, 1); d.angle = d.target * 0.6; } else AU.doorCreak(d.pos, 0.3);
    };
    d.close = () => { d.target = 0; AU.doorCreak(d.pos, 0.25); setTimeout(() => AU.thud(d.pos, 0.35), 500); };
    if (startOpen) { d.target = d.angle = (alongX ? 1.5 : -1.5) * (R() < 0.5 ? 1 : 0.6); }
    L.doors.push(d);
    L.interact.push({
      pos: d.pos, r: 2.3, door: d,
      prompt: () => {
        if (d.locked) return G.hasKey ? 'Unlock' : 'Locked';
        if (d.bolted) { const side = Math.sign(G.player.pos.z - cz); return side === d.boltSideZ ? 'Slide the bolt' : 'Bolted from the other side'; }
        return Math.abs(d.target) > 0.1 ? 'Close' : 'Open';
      },
      act: () => {
        if (d.locked) { if (G.hasKey) { d.locked = false; AU.click(0.3); AU.metalHit(d.pos, 0.2, false, 400); L.onItem?.('unlock', d); } else { AU.thud(d.pos, 0.2); AU.metalHit(d.pos, 0.08, false, 300); } return; }
        if (d.bolted) { const side = Math.sign(G.player.pos.z - cz); if (side === d.boltSideZ) { d.bolted = false; AU.metalHit(d.pos, 0.3, false, 220); AU.click(0.25); } else AU.thud(d.pos, 0.3); return; }
        if (Math.abs(d.target) > 0.1) d.close(); else { d.open(G.player.pos); G.noise?.(d.pos, 7); }
      },
    });
  }
  L.updaters.push((dt) => {
    for (const d of L.doors) {
      d.angle += (d.target - d.angle) * Math.min(1, dt * (Math.abs(d.target) > 0.1 ? 3.5 : 5));
      d.pivot.rotation.y = d.angle;
      d.col.on = Math.abs(d.angle) < 0.6;
    }
  });

  // ---------- lockers ----------
  // side: which wall of the tile it's against. hide: can you get inside.
  L.addLocker = (tx, ty, side, off, opts = {}) => {
    const f = wallFrame(tx, ty, side, off), w = 0.78, h = 2.0, dep = 0.55;
    const g = new THREE.Group(); g.position.copy(f.p).addScaledVector(f.nrm, dep / 2); g.rotation.y = f.yaw; root.add(g);
    const mat = opts.bloody ? lockerBloodyMat : opts.kind === 'coffin' ? coffinMat : lockerMat;
    // shell: back, sides, top, bottom (open front)
    GO.mesh(new THREE.BoxGeometry(w, h, 0.03), mat, g, 0, h / 2, -dep / 2 + 0.015);
    GO.mesh(new THREE.BoxGeometry(0.03, h, dep), mat, g, -w / 2 + 0.015, h / 2, 0);
    GO.mesh(new THREE.BoxGeometry(0.03, h, dep), mat, g, w / 2 - 0.015, h / 2, 0);
    GO.mesh(new THREE.BoxGeometry(w, 0.03, dep), mat, g, 0, h - 0.015, 0);
    GO.mesh(new THREE.BoxGeometry(w, 0.05, dep), mat, g, 0, 0.025, 0);
    GO.mesh(new THREE.BoxGeometry(w - 0.06, h - 0.08, 0.01), lockerInside, g, 0, h / 2, -dep / 2 + 0.04);
    const dp = new THREE.Group(); dp.position.set(-w / 2, 0, dep / 2); g.add(dp); dp.userData.noBake = true;
    GO.mesh(new THREE.BoxGeometry(w - 0.02, h - 0.04, 0.025), mat, dp, w / 2, h / 2, 0);
    GO.bake(g);
    const world = g.position.clone();
    L.addCollider(world.x - (Math.abs(f.nrm.x) ? dep / 2 : w / 2), world.x + (Math.abs(f.nrm.x) ? dep / 2 : w / 2), world.z - (Math.abs(f.nrm.z) ? dep / 2 : w / 2), world.z + (Math.abs(f.nrm.z) ? dep / 2 : w / 2), false);
    const lk = {
      group: g, door: dp, hide: !!opts.hide, special: opts.special, nrm: f.nrm.clone(), yaw: f.yaw,
      pos: world.clone(), front: world.clone().addScaledVector(f.nrm, dep / 2 + 0.55), inside: world.clone().setY(1.5).addScaledVector(f.nrm, 0.05),
      doorTarget: 0, doorAngle: 0, used: false,
    };
    L.lockers.push(lk);
    if (lk.hide || lk.special) L.interact.push({ pos: world.clone().setY(1.2), r: 1.7, locker: lk, prompt: () => lk.special ? (lk.used ? null : 'Open the wardrobe') : opts.kind === 'coffin' ? 'Hide in the standing coffin' : 'Hide in the wardrobe', act: () => lk.special ? L.onItem?.(lk.special, lk) : G.player.enterLocker(lk) });
    return lk;
  };
  L.updaters.push((dt) => { for (const l of L.lockers) { l.doorAngle += (l.doorTarget - l.doorAngle) * Math.min(1, dt * 9); l.door.rotation.y = -l.doorAngle; } });

  // ---------- light fixtures ----------
  const FIX = {
    fluoro: { color: 0xd8ffe6, int: 26, dist: 13 }, red: { color: 0xff2410, int: 20, dist: 12 }, cold: { color: 0x7fa6ff, int: 22, dist: 13 },
    lamp: { color: 0xffa050, int: 9, dist: 7 }, bulb: { color: 0xffc880, int: 12, dist: 9 }, redbulb: { color: 0xff3018, int: 11, dist: 9 }, car: { color: 0xfff0d0, int: 22, dist: 9 },
    candle: { color: 0xffa040, int: 18, dist: 10 }, lantern: { color: 0xffb060, int: 30, dist: 13 }, moon: { color: 0x7f9fe0, int: 26, dist: 12 }, sanct: { color: 0xff2810, int: 22, dist: 11 },
  };
  L.fixture = (tx, ty, type, flicker = 0, opts = {}) => {
    const d = FIX[type], pos = W3(tx, ty, opts.y ?? WALL_H - 0.12);
    const mat = new THREE.MeshBasicMaterial({ color: d.color });
    let m;
    if (type === 'fluoro') { m = GO.mesh(new THREE.BoxGeometry(1.3, 0.06, 0.14), mat, root, pos.x, pos.y, pos.z); if (opts.ry) m.rotation.y = opts.ry; box(1.4, 0.04, 0.22, darkMetal, pos.x, pos.y + 0.06, pos.z, { ry: opts.ry }); }
    else if (type === 'red') { m = GO.mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), mat, root, pos.x, pos.y, pos.z); }
    else if (type === 'candle') { // a cluster of tallow candles; pos is the flame
      m = GO.mesh(new THREE.ConeGeometry(0.018, 0.06, 4), mat, root, pos.x, pos.y, pos.z);
      for (let i = 0; i < 4; i++) { const hh = 0.12 + R() * 0.25, ox = i ? (R() - 0.5) * 0.25 : 0, oz = i ? (R() - 0.5) * 0.25 : 0; cyl(0.025, 0.03, hh, candleMat, pos.x + ox, pos.y - 0.03 - hh / 2 + (i ? -0.05 : 0), pos.z + oz, 6); if (i) GO.mesh(new THREE.ConeGeometry(0.014, 0.045, 4), mat, root, pos.x + ox, pos.y - 0.04, pos.z + oz).castShadow = false; }
    }
    else if (type === 'lantern') { m = GO.mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), mat, root, pos.x, pos.y - 0.45, pos.z); box(0.22, 0.04, 0.22, darkMetal, pos.x, pos.y - 0.33, pos.z); box(0.2, 0.03, 0.2, darkMetal, pos.x, pos.y - 0.56, pos.z); cyl(0.006, 0.006, 0.35, darkMetal, pos.x, pos.y - 0.15, pos.z, 3); pos.y -= 0.45; }
    else if (type === 'moon') { m = GO.mesh(new THREE.SphereGeometry(0.01, 3, 2), mat, root, pos.x, pos.y, pos.z); m.visible = false; }
    else if (type === 'sanct') { m = GO.mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.14, 8), mat, root, pos.x, pos.y - 0.7, pos.z); for (let i = 0; i < 3; i++) cyl(0.004, 0.004, 0.7, darkMetal, pos.x + Math.cos(i * 2.1) * 0.07, pos.y - 0.33, pos.z + Math.sin(i * 2.1) * 0.07, 3); pos.y -= 0.7; }
    else { m = GO.mesh(new THREE.SphereGeometry(0.07, 6, 5), mat, root, pos.x, pos.y - 0.25, pos.z); cyl(0.005, 0.005, 0.25, mats.black, pos.x, pos.y - 0.1, pos.z, 3); pos.y -= 0.3; }
    m.castShadow = false;
    const fx = { pos, type, def: d, flicker, dead: !!opts.dead, forced: null, on: true, t: R() * 3, cur: 1, mesh: m, mat, base: new THREE.Color(d.color), room: L.roomAt(pos.x, pos.z), int: opts.int ?? d.int };
    L.fixtures.push(fx); return fx;
  };
  const candleMat = lam(null, { color: 0xd8cca8 });
  // a lancet window: moonlight and snow, with a cold light just inside
  L.window = (tx, ty, side, off = 0) => {
    const f = wallFrame(tx, ty, side, off);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.9), winMat); m.position.copy(f.p).addScaledVector(f.nrm, 0.015); m.position.y = 2.05; m.rotation.y = f.yaw; root.add(m);
    box(1.05, 0.12, 0.3, style('stone')[0], m.position.x - f.nrm.x * 0.0, 1.05, m.position.z, { ry: f.yaw }); // sill
    const p = f.p.clone().addScaledVector(f.nrm, 1.1); return L.fixture(p.x / T, p.z / T, 'moon', 0, { y: 2.3 });
  };
  const winMat = new THREE.MeshBasicMaterial({ map: TX.windowTex(), transparent: true, alphaTest: 0.3, fog: true });
  // the pool of real lights, handed to the nearest visible fixtures
  const POOL = 6, lights = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.castShadow = false; root.add(l); lights.push(l); }
  let assignT = 0, assigned = [];
  L.updaters.push((dt) => {
    for (const f of L.fixtures) {
      if (f.forced !== null) f.on = !!f.forced;
      else if (f.dead) f.on = false;
      else if (f.flicker > 0) {
        f.t -= dt;
        if (f.t <= 0) { f.on = !f.on; f.t = f.on ? rr(0.1, 5) * (1.05 - f.flicker) + 0.05 : rr(0.02, 0.18) * (f.flicker > 0.6 ? 3 : 1); }
      } else f.on = true;
      const flame = f.type === 'candle' || f.type === 'lantern' || f.type === 'sanct';
      if (flame) f.ph = (f.ph || R() * 9) + dt * (5 + Math.random() * 4);
      const target = f.on ? (f.type === 'fluoro' ? 0.93 + Math.random() * 0.07 : flame ? 0.82 + Math.sin(f.ph) * 0.06 + Math.sin(f.ph * 2.7) * 0.05 + Math.random() * 0.06 : 1) : 0;
      f.cur = f.type === 'bulb' || f.type === 'lamp' || f.type === 'redbulb' || flame ? f.cur + (target - f.cur) * Math.min(1, dt * 25) : target;
      f.mat.color.copy(f.base).multiplyScalar(0.1 + f.cur * 1.4);
    }
    assignT -= dt;
    const cam = G.camera.position;
    if (assignT <= 0) {
      assignT = 0.2;
      const cand = L.fixtures.filter(f => !f.dead || f.forced).map(f => ({ f, d: f.pos.distanceTo(cam) })).filter(o => o.d < 26 && (o.d < 5 || L.los(cam, o.f.pos)));
      cand.sort((a, b) => a.d - b.d); assigned = cand.slice(0, POOL).map(o => o.f);
    }
    for (let i = 0; i < POOL; i++) {
      const f = assigned[i], l = lights[i];
      if (!f) { l.intensity = 0; continue; }
      l.position.copy(f.pos); l.position.y -= 0.15; l.color.copy(f.base); l.distance = f.def.dist; l.intensity = f.int * f.cur;
    }
    // fluorescent buzz follows the nearest flickering tube
    let best = null, bd = 1e9; for (const f of L.fixtures) { if (f.type !== 'fluoro' || !f.on) continue; const dd = f.pos.distanceTo(cam); if (dd < bd) { bd = dd; best = f; } }
    AU.setBuzz(best?.pos, best && bd < 12 ? (best.flicker > 0.3 ? 1 : 0.4) : 0);
  });
  L.litAt = (p) => { for (const f of L.fixtures) if (f.cur > 0.5 && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < f.def.dist * 0.4) return true; return false; };

  // ---------- items ----------
  const fuseMat = new THREE.MeshBasicMaterial({ color: 0xffb030 }), keyMat = new THREE.MeshPhongMaterial({ color: 0xc0a050, shininess: 90, emissive: 0x332200 });
  const batMat = new THREE.MeshLambertMaterial({ color: 0x2a6a2a, emissive: 0x0a2a0a });
  L.addItem = (id, kind, x, y, z, prompt) => {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    if (kind === 'fuse') { // a big iron gate key on a loop of red cord
      const im = new THREE.MeshPhongMaterial({ color: 0x8a8070, shininess: 60, emissive: 0x201408 });
      GO.mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 10), im, g, -0.12, 0.015, 0).rotation.x = Math.PI / 2;
      GO.mesh(new THREE.BoxGeometry(0.2, 0.018, 0.02), im, g, 0.03, 0.015, 0); GO.mesh(new THREE.BoxGeometry(0.03, 0.018, 0.06), im, g, 0.12, 0.015, 0.03); GO.mesh(new THREE.BoxGeometry(0.02, 0.018, 0.04), im, g, 0.085, 0.015, 0.025);
      GO.mesh(new THREE.TorusGeometry(0.07, 0.006, 3, 10), new THREE.MeshLambertMaterial({ color: 0x6a0a08 }), g, -0.16, 0.006, 0).rotation.x = Math.PI / 2;
      const gl = new THREE.PointLight(0xffa040, 0.6, 1.6, 2); gl.position.y = 0.15; g.add(gl); g.userData.glow = gl; }
    else if (kind === 'key') { GO.mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10), keyMat, g, -0.05, 0.01, 0).rotation.x = Math.PI / 2; GO.mesh(new THREE.BoxGeometry(0.1, 0.008, 0.015), keyMat, g, 0.03, 0.01, 0); }
    else if (kind === 'battery') { GO.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), batMat, g).rotation.z = Math.PI / 2; GO.mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 6), mats.steel, g, 0.06, 0, 0).rotation.z = Math.PI / 2; }
    else if (kind === 'flashlight') { GO.mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.24, 8), lam(null, { color: 0x1a1a1a }), g).rotation.z = Math.PI / 2; GO.mesh(new THREE.CircleGeometry(0.032, 8), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), g, 0.121, 0, 0).rotation.y = Math.PI / 2; g.position.y += 0.03; }
    else if (kind === 'note') { const p = GO.mesh(new THREE.PlaneGeometry(0.22, 0.28), paperMat, g); p.rotation.x = -Math.PI / 2; p.rotation.z = R() * 0.6 - 0.3; }
    else if (kind === 'wallnote') { GO.mesh(new THREE.PlaneGeometry(0.24, 0.32), paperMat, g); }
    const it = { id, kind, group: g, pos: g.position.clone(), r: 1.9, on: true, prompt: () => prompt || ({ flashlight: 'Take flashlight', fuse: 'Take the iron key', key: 'Take the brass key', battery: 'Take battery', note: 'Read', wallnote: 'Read' })[kind], act: () => L.onItem?.(id, it) };
    L.interact.push(it); L.items[id] = it; return it;
  };
  L.removeItem = (it) => { it.on = false; it.group.visible = false; const i = L.interact.indexOf(it); if (i >= 0) L.interact.splice(i, 1); };
  L.updaters.push(() => { for (const id in L.items) { const it = L.items[id]; if (it.kind === 'fuse' && it.on) it.group.userData.glow.intensity = 0.4 + Math.sin(G.time * 3) * 0.2; } });

  furnish(L, { box, cyl, wallFrame, trail, pool, splat, mats, wood, darkMetal, lam, style });
  return L;
}

// ======================================================================
// St. Aldric's Abbey, Kessel Pass. Rooms.
// ======================================================================
function furnish(L, H) {
  const { box, cyl, trail, pool, splat, mats, wood, darkMetal, lam } = H;
  const root = L.root, w = (t) => t * T;
  const iron = darkMetal, stone = H.style('stone')[0];
  const linen = lam(TX.sheetTex()), wax = lam(null, { color: 0xd8cca8 });
  const candles = (x, z, y = 0, n = 5, spread = 0.5) => { // unlit dressing candles (cheap), many of them
    for (let i = 0; i < n; i++) { const hh = 0.1 + R() * 0.3; cyl(0.025, 0.03, hh, wax, x + (R() - 0.5) * spread, y + hh / 2, z + (R() - 0.5) * spread, 5); }
  };
  const bench = (x, z, len, alongX = true) => { box(alongX ? len : 0.35, 0.06, alongX ? 0.35 : len, wood, x, 0.45, z, { col: true, nav: false }); for (const s of [-1, 1]) box(alongX ? 0.06 : 0.3, 0.45, alongX ? 0.3 : 0.06, wood, x + (alongX ? s * len * 0.42 : 0), 0.22, z + (alongX ? 0 : s * len * 0.42)); };
  const longTable = (x, z, lx, lz, h = 0.82) => { box(lx, 0.08, lz, wood, x, h, z, { col: true }); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, h, 0.08, wood, x + sx * (lx / 2 - 0.1), h / 2, z + sz * (lz / 2 - 0.1)); };
  const cross = (tx, ty, side, off, y = 2.2, s = 1, inverted = false) => { const f = H.wallFrame(tx, ty, side, off); const g = new THREE.Group(); g.position.copy(f.p).addScaledVector(f.nrm, 0.04); g.position.y = y; g.rotation.y = f.yaw; root.add(g); GO.mesh(new THREE.BoxGeometry(0.06 * s, 0.6 * s, 0.04), wood, g); GO.mesh(new THREE.BoxGeometry(0.36 * s, 0.06 * s, 0.04), wood, g, 0, (inverted ? -0.12 : 0.12) * s, 0); };
  const bed = (x, z, ry, opts = {}) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    GO.mesh(new THREE.BoxGeometry(0.9, 0.3, 2.0), wood, g, 0, 0.3, 0); GO.mesh(new THREE.BoxGeometry(0.86, 0.12, 1.94), opts.bloody ? lam(TX.sheetTex()) : lam(null, { color: 0x6e685a }), g, 0, 0.51, 0);
    GO.mesh(new THREE.BoxGeometry(0.9, 0.7, 0.06), wood, g, 0, 0.5, -1.0);
    if (opts.shroud) { // something under the blanket, the wrong shape, one hand out
      GO.mesh(new THREE.BoxGeometry(0.6, 0.2, 1.4), mats.sheet, g, 0, 0.66, 0.15); GO.mesh(new THREE.SphereGeometry(0.15, 6, 5), mats.sheet, g, 0, 0.66, -0.7);
      const arm = new THREE.Group(); arm.position.set(0.42, 0.6, -0.1); g.add(arm); GO.limb(arm, V(0, 0, 0), V(0.05, -0.38, 0.05), 0.04, 0.035, mats.skinGrey); GO.ball(arm, V(0.06, -0.43, 0.06), 0.04, mats.skinGrey, 0.8, 1.4, 0.5);
    }
    if (opts.body) { const c = GO.tableCorpse({ open: true, missing: ['rArmLower'] }); c.position.y = -0.38; g.add(c); }
    GO.bake(g); L.addCollider(x - (Math.abs(Math.sin(ry)) > 0.5 ? 1 : 0.45), x + (Math.abs(Math.sin(ry)) > 0.5 ? 1 : 0.45), z - (Math.abs(Math.sin(ry)) > 0.5 ? 0.45 : 1), z + (Math.abs(Math.sin(ry)) > 0.5 ? 0.45 : 1));
    return g;
  };

  // ===== DORMITORY (start) =====
  L.fixture(5.5, 5.3, 'candle', 0, { y: 0.92 }); box(0.6, 0.05, 0.6, wood, w(5.5), 0.82, w(5.3), { col: true, nav: false }); box(0.06, 0.82, 0.06, wood, w(5.5), 0.41, w(5.3));
  L.window(2, 4, 'w', 0);
  for (let x = 2; x <= 7; x++) {
    const special = x === 5 ? 'maraLocker' : x === 7 ? 'corpseLocker' : null;
    L.addLocker(x, 2, 'n', 0, { hide: x === 3 || x === 6 || x === 2, special, bloody: special === 'corpseLocker' });
  }
  bed(w(6.5), w(8.1), 0, { shroud: true, bloody: true }); bed(w(8.4), w(8.1), 0, { body: true, bloody: true }); bed(w(2.6), w(8.1), 0);
  pool(w(8.4), w(7.6), 1.4); L.dripEmitter((() => { const e = new THREE.Object3D(); e.position.set(w(8.4) + 0.45, 0.55, w(8.1)); root.add(e); return e; })(), 2.2);
  cross(5, 8, 's', 0, 2.3); cross(7, 2, 'n', 0, 2.6, 1, true);
  L.addItem('flashlight', 'flashlight', w(3.9), 0.02, w(5.9));
  L.addItem('bat1', 'battery', w(5.5) + 0.15, 0.86, w(5.3) + 0.1);
  pool(w(7.5), w(3.3), 1.3); trail(w(7.6), w(3.6), w(9.8), w(3.5)); L.decalFloor(w(8.6), w(4.4), 0.8, 0.8, 'splat');
  L.decalWall(9, 4, 'e', 0, 1.3, 1.0, 1.0, 'hands'); L.decalWall(9, 3, 'e', 0.6, 1.0, 0.6, 1.2, 'drips');

  // ===== LAVATORIUM =====
  L.fixture(4.5, 12.7, 'lantern', 0.35);
  box(0.6, 0.7, 4.6, stone, w(2) + 0.32, 0.35, w(13.5), { col: true, nav: false }); // stone trough
  { const s2 = GO.mesh(new THREE.PlaneGeometry(0.5, 4.5), mats.bloodLiquid, root, w(2) + 0.32, 0.68, w(13.5)); s2.rotation.x = -Math.PI / 2; }
  cyl(0.03, 0.03, 1.2, iron, w(2) + 0.12, 1.3, w(13.5), 5); box(0.35, 0.04, 0.04, iron, w(2) + 0.25, 1.85, w(13.5));
  { const e = new THREE.Object3D(); e.position.set(w(2) + 0.42, 1.82, w(13.5)); root.add(e); L.dripEmitter(e, 26); }
  { // a bath full of blood with someone still in it
    const bx = w(5.6), bz = w(14.2);
    box(1.8, 0.6, 0.8, stone, bx, 0.3, bz, { col: true }); const surf = GO.mesh(new THREE.PlaneGeometry(1.65, 0.65), mats.bloodLiquid, root, bx, 0.58, bz); surf.rotation.x = -Math.PI / 2;
    GO.bake(GO.severedHead(root, bx - 0.6, 0.52, bz, Math.PI / 2, 'grey'));
    for (const s of [-0.1, 0.1]) GO.ball(root, V(bx + 0.25, 0.62, bz + s), 0.07, mats.skinGrey, 1, 0.6, 1); // knees
    const arm = new THREE.Group(); arm.position.set(bx - 0.25, 0.6, bz + 0.4); root.add(arm); GO.limb(arm, V(0, 0, 0), V(0, -0.4, 0.12), 0.04, 0.035, mats.skinGrey); GO.ball(arm, V(0, -0.45, 0.14), 0.04, mats.skinGrey, 0.8, 1.4, 0.5);
    const e = new THREE.Object3D(); e.position.set(0, -0.48, 0.14); arm.add(e); L.dripEmitter(e, 3); pool(bx - 0.2, bz + 0.6, 1.2);
  }
  { const c = GO.slumpedCorpse({ gutsOut: 0.5 }); c.position.set(w(2) + 0.95, 0, w(12.2)); c.rotation.y = Math.PI / 2; root.add(c); GO.bake(c); pool(w(2) + 1.2, w(12.2), 1.8); }
  trail(w(2.6), w(13.6), w(4.5), w(13.5));
  L.writing(7, 13, 'e', 0, 1.9, 'IT WEARS THEIR FACES', 2.45, 0.8);
  L.decalWall(2, 13, 'w', 0.3, 1.2, 1.2, 1.4, 'drips');
  L.addLocker(6, 11, 'n', 0, { hide: true });
  L.addItem('bat2', 'battery', w(6.6), 0.05, w(15.2));
  L.waypoints.push(W3(4.5, 13.5));

  // ===== HALLS =====
  L.decalWall(11, 3, 'n', 0, 1.4, 0.9, 0.9, 'hand'); splat(w(12), w(3.5));
  trail(w(11.5), w(6.2), w(11.5), w(9.8));
  L.fixture(11.5, 7.5, 'candle', 0, { y: 0.3 });

  // ===== CLOISTER =====
  L.fixture(13.5, 10.2, 'lantern', 0.1);
  L.specials.sightLight = L.fixture(19.5, 10.6, 'lantern', 0, { dead: true });
  L.fixture(25, 10.8, 'lantern', 0.7); L.fixture(33.5, 10.6, 'lantern', 0, { dead: true });
  L.fixture(40.5, 10.8, 'candle', 0, { y: 0.3 });
  for (const wx of [15.5, 23, 27, 35]) L.window(Math.floor(wx), 10, 'n', (wx % 1) - 0.5);
  for (let x = 12.5; x < 41; x += 2.5) { if ([16.5, 25.5, 36.5].some(d => Math.abs(d - x) < 1.1)) continue; cyl(0.24, 0.28, WALL_H, stone, w(x), WALL_H / 2, w(12) - 0.3, 8, { col: true, nav: false }); }
  L.addLocker(14, 10, 'n', 0.3, { hide: true });
  L.addLocker(28, 11, 's', 0.4, { hide: true }); L.addLocker(28, 11, 's', -0.4);
  trail(w(12), w(10.7), w(16.4), w(11.9)); trail(w(20.5), w(9.2), w(22), w(10.8)); trail(w(22), w(10.8), w(25.5), w(11.9));
  pool(w(16.4), w(11.6), 1.1);
  L.decalWall(18, 11, 's', 0.2, 1.3, 1, 1, 'hands'); L.decalWall(23, 10, 'n', -0.5, 1.1, 0.7, 0.7, 'hand'); L.decalWall(33, 10, 'n', 0, 1.2, 0.9, 1.4, 'drips');
  L.writing(30, 10, 'n', 0.1, 1.9, "DON'T RUN", 2.45, 0.85);
  { // a funeral bier, a shroud over something that isn't the right shape
    const gx = w(22.5), gz = w(11.2);
    box(2.0, 0.08, 0.75, wood, gx, 0.75, gz, { col: true, nav: false });
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.3, 0.3]) box(0.06, 0.75, 0.06, wood, gx + sx, 0.37, gz + sz);
    GO.mesh(new THREE.BoxGeometry(1.7, 0.16, 0.62), mats.sheet, root, gx, 0.86, gz); GO.mesh(new THREE.SphereGeometry(0.14, 6, 5), mats.sheet, root, gx - 0.75, 0.9, gz);
    const arm = new THREE.Group(); arm.position.set(gx - 0.1, 0.8, gz + 0.33); root.add(arm);
    GO.limb(arm, V(0, 0, 0), V(0.05, -0.35, 0.05), 0.04, 0.035, mats.skinGrey); GO.ball(arm, V(0.06, -0.4, 0.06), 0.04, mats.skinGrey, 0.8, 1.4, 0.5);
    pool(gx - 0.1, gz + 0.4, 1.0); const e = new THREE.Object3D(); e.position.set(0.06, -0.45, 0.06); arm.add(e); L.dripEmitter(e, 1.2);
    candles(gx + 1.2, gz, 0, 4, 0.3); candles(gx - 1.2, gz, 0, 4, 0.3);
  }
  { const lec = box(0.5, 1.1, 0.4, wood, w(18.5), 0.55, w(11.6), { col: true, nav: false }); }
  L.addItem('note_log', 'note', w(18.5), 1.12, w(11.6), 'Read the ledger');
  // coffins stacked at the east end
  for (let i = 0; i < 3; i++) { const c = box(0.65, 0.45, 2.0, lam(TX.woodTex(false), { color: 0x7a6050 }), w(41.4) - (i % 2) * 0.7, 0.23 + Math.floor(i / 2) * 0.46, w(10.9), { col: i < 2, nav: false }); c.rotation.y = 0.05 * i; }
  L.addItem('bat3', 'battery', w(33.5), 0.05, w(10.3));
  [W3(13, 10.5), W3(22, 10.5), W3(30, 10.5), W3(38, 10.8)].forEach(p => L.waypoints.push(p));

  // ===== HALL OF PENITENTS: they hang from the vault on chains, candles burning under them =====
  L.window(17, 1, 'n', 0); L.window(24, 1, 'n', 0);
  L.fixture(17.6, 4.3, 'candle', 0.02, { y: 0.35 }); L.fixture(23.6, 6.3, 'candle', 0.05, { y: 0.35 }); L.fixture(21.6, 2.3, 'candle', 0.3, { y: 0.35 });
  for (const rz of [2.3, 4.3, 6.3]) box(w(12), 0.12, 0.12, wood, w(21), WALL_H - 0.12, w(rz));
  const kinds = ['back', 'back', 'ankles', 'back', 'torso', 'ankles'];
  let n = 0;
  for (const rz of [2.3, 4.3, 6.3]) for (let x = 15.6; x < 26.5; x += 2.0) {
    if (rz === 6.3 && Math.abs(x - 20.6) < 0.8) continue;
    const kind = kinds[(n++ * 7 + 3) % kinds.length];
    const miss = R() < 0.4 ? [GO_pick(['lArm', 'rArm', 'lArmLower', 'rLegLower', 'lLeg'])] : [];
    const isWatcher = Math.abs(x - 23.6) < 0.1 && rz === 4.3;
    const hx = w(x) + (R() - 0.5) * 0.4, hz = w(rz) + (R() - 0.5) * 0.2;
    const hg = L.hang(hx, hz, isWatcher ? 'back' : kind, { missing: miss, openChest: R() < 0.35, gutsOut: kind === 'back' && R() < 0.3 ? 0.7 : 0, noBake: isWatcher });
    if (isWatcher) L.specials.watcher = hg;
    if (Math.abs(x - 25.6) < 0.1 && rz === 2.3) L.specials.dropper = hg;
    candles(hx, hz, 0, 3, 0.6);
  }
  for (let i = 0; i < 4; i++) bench(w(27.3), w(3.4 + i * 1.05), 1.5, false);
  box(0.9, 0.9, 0.7, stone, w(26.6), 0.45, w(1.4), { col: true, nav: false }); candles(w(26.6), w(1.4), 0.9, 4, 0.5);
  L.addItem('fuse1', 'fuse', w(26.6) - 0.1, 0.92, w(1.4) + 0.15);
  L.decalWall(14, 5, 'w', 0, 1.5, 1.2, 1.3, 'hands'); L.decalWall(27, 2, 'e', 0, 1.1, 1, 1.4, 'drips');
  L.writing(14, 3, 'w', 0, 2.0, 'FORGIVE US', 2.45, 0.85);
  L.waypoints.push(W3(20.5, 5.3), W3(16, 3.3));

  // ===== ABBOT'S STUDY =====
  L.fixture(32.5, 5.3, 'lamp', 0.05, { y: 1.15 });
  box(1.8, 0.06, 0.8, wood, w(32.5), 0.78, w(5.3), { col: true });
  box(1.7, 0.75, 0.05, wood, w(32.5), 0.4, w(5.3) + 0.38);
  cyl(0.02, 0.08, 0.35, iron, w(32.5) + 0.6, 0.98, w(5.3) - 0.2, 6);
  box(0.5, 0.05, 0.5, wood, w(32.5), 0.48, w(4.7)); box(0.5, 0.9, 0.05, wood, w(32.5), 0.9, w(4.7) - 0.25);
  { const c = GO.seatedCorpse(); c.position.set(w(32.5), 0, w(4.7) - 0.1); root.add(c); GO.bake(c); pool(w(32.5), w(4.7), 1.6); const e = new THREE.Object3D(); e.position.set(0, 0.95, -0.25); c.add(e); L.dripEmitter(e, 2); }
  L.addItem('key', 'key', w(32.5) - 0.5, 0.82, w(5.3) + 0.1);
  L.addItem('note_journal', 'note', w(32.5) - 0.1, 0.82, w(5.3) + 0.15, 'Read the journal');
  { // the abbey's old valve radio
    const rg = new THREE.Group(); rg.position.set(w(32.5) + 0.35, 0.81, w(5.3) + 0.05); root.add(rg);
    GO.mesh(new THREE.BoxGeometry(0.36, 0.24, 0.2), wood, rg, 0, 0.12, 0); GO.mesh(new THREE.CircleGeometry(0.06, 10), lam(null, { color: 0x2a2018 }), rg, -0.07, 0.13, 0.101);
    GO.mesh(new THREE.BoxGeometry(0.1, 0.05, 0.01), new THREE.MeshBasicMaterial({ color: 0x8a6a20 }), rg, 0.08, 0.16, 0.101);
    L.specials.phone = rg;
  }
  // shelves of books
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(); g.position.set(w(29) + 0.25, 0, w(5 + i * 1.2)); root.add(g);
    GO.mesh(new THREE.BoxGeometry(0.45, 2.2, 1.1), wood, g, 0, 1.1, 0);
    for (let sh = 0; sh < 4; sh++) for (let b = 0; b < 9; b++) { const hh = 0.22 + R() * 0.12; GO.mesh(new THREE.BoxGeometry(0.3, hh, 0.07 + R() * 0.04), lam(null, { color: new THREE.Color().setHSL(R() * 0.1, 0.4, 0.12 + R() * 0.12) }), g, 0.1, 0.3 + sh * 0.5 + hh / 2, -0.45 + b * 0.105); }
    GO.bake(g); L.addCollider(w(29), w(29) + 0.5, w(5 + i * 1.2) - 0.55, w(5 + i * 1.2) + 0.55, false);
  }
  L.decalFloor(w(30.2), w(6.2), 1.2, 1.2, 'splat');
  const tally = new THREE.MeshLambertMaterial({ map: TX.tallyTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  L.decalWall(32, 4, 'n', 0, 1.8, 2.4, 1.2, null, tally); L.decalWall(30, 4, 'n', 0, 1.6, 2.4, 1.2, null, tally);
  cross(33, 4, 'n', 0.6, 2.7, 1.2, true);
  L.addLocker(34, 6, 'e', 0, { hide: true });
  L.waypoints.push(W3(31, 6.5));

  // ===== GATEHOUSE =====
  L.specials.lobbyRed = L.fixture(39.5, 5, 'lantern', 0.1);
  { // the portcullis winch, chained shut with three padlocks
    box(0.5, 1.2, 1.4, wood, w(43) - 0.25, 0.6, w(5.5), { col: true, nav: false });
    cyl(0.18, 0.18, 1.3, iron, w(43) - 0.3, 1.35, w(5.5), 10).rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const s = GO.mesh(new THREE.BoxGeometry(0.1, 0.12, 0.08), mats.black, root, w(43) - 0.55, 1.5 - i * 0.25, w(5.5) - 0.3); L.specials['socket' + i] = s; GO.mesh(new THREE.TorusGeometry(0.035, 0.008, 3, 8), iron, root, w(43) - 0.55, 1.58 - i * 0.25, w(5.5) - 0.3); }
    const lever = GO.mesh(new THREE.BoxGeometry(0.06, 0.06, 0.6), mats.steel, root, w(43) - 0.3, 1.35, w(5.5) + 0.85); L.specials.lever = lever;
    L.specials.panelInteract = { pos: V(w(43) - 0.5, 1.3, w(5.5)), r: 1.9, prompt: () => L.onPanelPrompt?.(), act: () => L.onItem?.('panel') };
    L.interact.push(L.specials.panelInteract);
    for (let i = 0; i < 2; i++) cyl(0.012, 0.012, 2.2, iron, w(43) - 0.3 - i * 0.15, 2.3, w(5.5) - 0.5 - i * 0.2, 3);
  }
  { // the portcullis: oak and iron, spiked at the foot. beyond it, snow.
    const gate = new THREE.Group(); root.add(gate);
    for (let i = 0; i <= 12; i++) { GO.mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), iron, gate, w(39) + 0.1 + i * 0.4, 1.4, w(3) - 0.1); GO.mesh(new THREE.ConeGeometry(0.05, 0.18, 4), iron, gate, w(39) + 0.1 + i * 0.4, -0.05, w(3) - 0.1).rotation.x = Math.PI; }
    for (const y of [0.3, 1.2, 2.1]) GO.mesh(new THREE.BoxGeometry(5, 0.1, 0.1), iron, gate, w(40), y, w(3) - 0.1);
    L.specials.gate = gate;
    box(5, 0.7, 0.4, stone, w(40), 3.05, w(3) - 0.15);
    box(5, 4, 0.4, stone, w(40), WALL_H + 2, w(3) - 0.15);
    const car = new THREE.Group(); root.add(car); L.specials.car = car; // (kept for the ending code: nothing rides it)
    const fx = L.fixture(40, 1.5, 'moon', 0, { y: 3 }); L.specials.carLight = fx;
    // snow falling outside and blowing through the bars
    const N = 260, sp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { sp[i * 3] = w(39) + R() * 5; sp[i * 3 + 1] = R() * 6; sp[i * 3 + 2] = w(1) + R() * 4.5; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6f0, size: 0.04 })); snow.frustumCulled = false; root.add(snow);
    L.updaters.push((dt) => { for (let i = 0; i < N; i++) { sp[i * 3 + 1] -= dt * (0.6 + (i % 5) * 0.15); sp[i * 3 + 2] += dt * 0.5; sp[i * 3] += Math.sin(G.time + i) * dt * 0.3; if (sp[i * 3 + 1] < 0 || sp[i * 3 + 2] > w(4.4)) { sp[i * 3 + 1] = 5 + R(); sp[i * 3 + 2] = w(1) + R() * 2; } } sg.attributes.position.needsUpdate = true; });
  }
  L.writing(37, 5, 'w', 0, 1.9, 'NO ONE LEAVES THE FAST', 2.45, 0.8);
  { const c = GO.slumpedCorpse({ missing: ['rArmLower'], openChest: true }); c.position.set(w(42) + 0.6, 0, w(3) + 0.5); c.rotation.y = -Math.PI / 2 - 0.4; root.add(c); GO.bake(c); pool(w(42), w(3.5), 1.6); }
  { const c = GO.slumpedCorpse({ face: 'flayed' }); c.position.set(w(39) + 0.4, 0, w(3) + 0.45); c.rotation.y = 0.3; root.add(c); GO.bake(c); pool(w(39.4), w(3.4), 1.4); L.decalWall(39, 3, 'n', 0, 1.0, 1.6, 1.0, 'hands'); }
  for (let i = 0; i < 2; i++) box(0.9, 0.9, 0.9, wood, w(37.5), 0.45, w(6.5 + i * 0.4) - i * 0.3, { col: true, nav: false });
  L.waypoints.push(W3(39.5, 5.5));

  // ===== REFECTORY: the brothers' last meal, laid out on the long table =====
  L.fixture(16, 18.5, 'candle', 0.02, { y: 1.05 }); L.fixture(22.5, 18.5, 'candle', 0.05, { y: 1.05 }); L.specials.killFlicker = L.fixture(17, 22, 'lantern', 0.5);
  L.fixture(26, 20.5, 'lantern', 0.2); L.fixture(21, 15.5, 'lantern', 0, { dead: true }); L.window(28, 17, 'e', 0); L.window(12, 16, 'w', 0);
  box(w(15), 0.14, 0.14, wood, w(20.5), WALL_H - 0.14, w(15.5));
  for (let x = 13.5; x <= 27.5; x += 2) {
    if (Math.abs(x - 16.5) < 0.6 || Math.abs(x - 25.5) < 0.6) continue;
    L.hang(w(x), w(15.5), R() < 0.65 ? 'torso' : 'back', { ry: Math.PI / 2 + (R() - 0.5) * 0.4, openChest: true, gutsOut: 0.8, drip: 1.5 + R() * 2, chain: 0.4 });
  }
  {
    const x0 = w(13.2), x1 = w(24.8), cz = w(18.5), len = x1 - x0;
    longTable((x0 + x1) / 2, cz, len, 1.1, 0.85);
    { const cloth = GO.mesh(new THREE.BoxGeometry(len - 0.4, 0.01, 1.0), lam(TX.sheetTex()), root, (x0 + x1) / 2, 0.895, cz); cloth.receiveShadow = true; }
    bench((x0 + x1) / 2, cz - 0.95, len - 1); bench((x0 + x1) / 2, cz + 0.95, len - 1);
    const plat = lam(TX.metalTex(0.2), { color: 0x9a9080 });
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(); root.add(g); const k = i % 4, gx = x0 + 0.9 + i * (len - 1.8) / 8;
      GO.mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.03, 12), plat, g, 0, 0.015, 0);
      if (k === 0) { GO.mesh(new THREE.BoxGeometry(0.4, 0.18, 0.3), mats.meat, g, 0, 0.11, 0); GO.mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4), mats.bone, g, 0, 0.14, 0).rotation.z = 1.4; }
      else if (k === 1) GO.severedLimb(g, 0, 0, R() * 3, R() < 0.5);
      else if (k === 2) GO.severedHead(g, 0, 0.02, 0, R() * 6);
      else { GO.mesh(new THREE.SphereGeometry(0.16, 7, 5), mats.meat, g, 0, 0.1, 0).scale.set(1.4, 0.6, 1); GO.intestines(g, V(0, 0.14, 0), 0.12, 10, 0.025); }
      const gob = GO.mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.12, 6), plat, g, 0.4, 0.06, 0.25); GO.mesh(new THREE.CircleGeometry(0.035, 6), mats.bloodLiquid, g, 0.4, 0.121, 0.25).rotation.x = -Math.PI / 2;
      g.position.set(gx, 0.9, cz + (R() - 0.5) * 0.2); GO.bake(g);
      candles(gx + 0.6, cz + 0.3, 0.9, 2, 0.15);
    }
    for (let i = 0; i < 10; i++) L.decalFloor(x0 + R() * len, cz + (R() - 0.5) * 2.2, 0.7, 0.7, 'splat');
    L.specials.conveyorEnd = V(x1, 1, cz);
  }
  const tables = [[14.6, 21.3, 0.1, {}], [18, 21.4, -0.15, { missing: ['lArmLower'] }], [21.2, 20.8, 0.3, { missing: ['rLeg'], face: 'flayed' }]];
  for (const [tx, tz, ry, o] of tables) {
    const g = new THREE.Group(); g.position.set(w(tx), 0, w(tz)); g.rotation.y = ry; root.add(g);
    GO.mesh(new THREE.BoxGeometry(0.9, 0.08, 2.1), wood, g, 0, 0.9, 0);
    for (const sx of [-0.4, 0.4]) for (const sz of [-0.95, 0.95]) GO.mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), wood, g, sx, 0.45, sz);
    const c = GO.tableCorpse(o); g.add(c);
    pool(w(tx), w(tz), 2.0); pool(w(tx) + 0.5, w(tz) - 0.3, 1.2);
    for (let i = 0; i < 3; i++) { const tool = GO.mesh(new THREE.BoxGeometry(0.02, 0.01, 0.25), mats.steel, g, -0.3 + i * 0.1, 0.95, 0.85); tool.rotation.y = R(); }
    GO.bake(g);
    L.addCollider(w(tx) - 0.6, w(tx) + 0.6, w(tz) - 1.1, w(tz) + 1.1);
    const e = new THREE.Object3D(); e.position.set(0.45, 0.88, -0.2); g.add(e); L.dripEmitter(e, 3);
    const e2 = new THREE.Object3D(); e2.position.set(0.45, 0.5, -0.15); g.add(e2); L.dripEmitter(e2, 1.5);
  }
  { // the butcher's block, cleaver still in it
    const bx = w(24.5), bz = w(21.7);
    box(1.0, 0.85, 1.0, lam(TX.floorBoards(1.5)), bx, 0.42, bz, { col: true });
    const cl = box(0.04, 0.22, 0.32, mats.steel, bx + 0.1, 0.95, bz); cl.rotation.z = 0.3; box(0.04, 0.04, 0.25, wood, bx + 0.1, 1.08, bz + 0.25);
    GO.severedLimb(root, bx - 0.15, bz - 0.1, 0.4, true).position.y = 0.87;
    pool(bx + 0.6, bz, 1.8); L.decalWall(24, 23, 's', 0, 1.0, 1.4, 1.4, 'drips');
  }
  const pail = (x, z) => { cyl(0.2, 0.17, 0.4, wood, x, 0.2, z, 9, { col: true, nav: false }); GO.mesh(new THREE.CircleGeometry(0.18, 9), mats.bloodLiquid, root, x, 0.38, z).rotation.x = -Math.PI / 2; GO.intestines(root, V(x, 0.42, z), 0.1, 8, 0.03); splat(x, z, 1); };
  pail(w(15.6), w(22.6)); pail(w(19.2), w(22.4)); pail(w(22.4), w(19.8)); pail(w(26.7), w(17)); pail(w(13.1), w(16.8));
  GO.bake(GO.entrailsPile(root, w(17.4), w(19.9), 1.3)); GO.bake(GO.entrailsPile(root, w(23.3), w(23.3), 1)); GO.bake(GO.entrailsPile(root, w(27.2), w(21.3), 1.1));
  {
    longTable(w(26.6), w(23.8), 1.8, 0.8, 0.9);
    for (let i = 0; i < 4; i++) GO.bake(GO.severedHead(root, w(26.6) - 0.6 + i * 0.4, 0.94, w(23.8), Math.PI + (R() - 0.5) * 0.6, i === 2 ? 'flayed' : 'grey'));
    pool(w(26.6), w(23.6), 1.6);
  }
  for (let i = 0; i < 16; i++) pool(w(13 + R() * 15), w(14.5 + R() * 10), 0.8 + R() * 1.8);
  L.decalWall(12, 18, 'w', 0, 1.4, 1.2, 1.2, 'hands'); L.decalWall(28, 19, 'e', 0, 1.6, 1.3, 1.3, 'drips'); L.decalWall(20, 14, 'n', 0.5, 1.2, 1.3, 1.6, 'drips');
  L.writing(13, 14, 'n', 0, 2.1, 'HE IS STILL HUNGRY', 2.45, 0.75);
  box(0.6, 0.6, 0.6, wood, w(12.6), 0.3, w(24.5) - 0.1, { col: true, nav: false });
  L.addItem('fuse2', 'fuse', w(12.6), 0.62, w(24.5) - 0.1);
  box(1.2, 0.06, 0.6, wood, w(17.6), 0.9, w(14.4), { col: true, nav: false });
  L.addItem('note_run', 'note', w(17.6), 0.94, w(14.4), 'Read');
  L.addLocker(28, 23, 'e', -0.3, { hide: true }); L.addLocker(12, 20, 'w', 0, { hide: true });
  L.addItem('bat4', 'battery', w(27.6), 0.05, w(14.6));
  L.waypoints.push(W3(16.5, 16.5), W3(24, 16.5), W3(20, 23.5), W3(13, 21), W3(27, 19));

  // ===== CHAPEL =====
  L.fixture(38.6, 20.6, 'sanct', 0.05); L.fixture(35, 17.5, 'candle', 0.05, { y: 1.35 }); L.fixture(40.6, 19.4, 'candle', 0.05, { y: 1.3 }); L.fixture(33.5, 23.5, 'candle', 0.3, { y: 0.35 });
  L.window(41, 16, 'e', 0); L.window(32, 18, 'w', 0);
  const font = (x, z, idx) => { // stone fonts, brim-full
    cyl(0.95, 0.7, 1.15, stone, x, 0.58, z, 12, { col: true });
    const surf = GO.mesh(new THREE.CircleGeometry(0.88, 14), mats.bloodLiquid, root, x, 1.12, z); surf.rotation.x = -Math.PI / 2;
    const floaters = [];
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group(); root.add(g);
      if (i === 0) GO.skull(g, 0, 0, 0, R() * 6); else if (i === 1) { GO.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 5), mats.bone, g).rotation.z = Math.PI / 2; } else if (i === 2) GO.mesh(new THREE.SphereGeometry(0.1, 6, 5), mats.meat, g).scale.set(1.5, 0.5, 1); else GO.severedLimb(g, 0, 0, 0, false).position.y = -0.04;
      GO.bake(g); g.userData = { a: R() * 6.28, r: 0.2 + R() * 0.45, s: (R() - 0.5) * 0.3 }; floaters.push(g);
    }
    let bt = R() * 2;
    L.updaters.push((dt) => {
      for (const g of floaters) { g.userData.a += dt * g.userData.s; g.position.set(x + Math.cos(g.userData.a) * g.userData.r, 1.13 + Math.sin(G.time * 1.3 + g.userData.r * 9) * 0.02, z + Math.sin(g.userData.a) * g.userData.r); g.rotation.y += dt * g.userData.s; }
      bt -= dt; if (bt < 0) { bt = rr(0.3, 1.6); if (G.camera.position.distanceTo(V(x, 1, z)) < 10) AU.bubble(V(x, 1.1, z), 0.12); }
    });
    candles(x + 1.0, z + 0.4, 0, 5, 0.35); splat(x + 1.1, z, 1.2); pool(x - 1.0, z + 0.6, 1.4);
    const v = { x, z, idx, surf }; L.vats.push(v); return v;
  };
  font(w(34.3), w(18.8), 0); font(w(37.6), w(18.8), 1); font(w(34.3), w(22), 2);
  { // the altar, with someone laid open on it
    const ax = w(40.2), az = w(20.6);
    box(1.0, 1.0, 2.2, stone, ax, 0.5, az, { col: true }); GO.mesh(new THREE.BoxGeometry(1.1, 0.02, 2.3), linen, root, ax, 1.01, az);
    const g = new THREE.Group(); g.position.set(ax, 0.06, az); root.add(g); g.add(GO.tableCorpse({ open: true, face: 'flayed', missing: ['lArm'] })); GO.bake(g);
    candles(ax, az - 1.3, 1.0, 2, 0.2); candles(ax, az + 1.3, 1.0, 2, 0.2); pool(ax - 0.7, az, 2.2);
    const e = new THREE.Object3D(); e.position.set(ax - 0.5, 0.98, az + 0.3); root.add(e); L.dripEmitter(e, 3);
  }
  // behind the altar: the vestments. they are skins.
  box(0.08, 2.7, 0.08, iron, w(41.7), 1.35, w(18.6)); box(0.08, 2.7, 0.08, iron, w(41.7), 1.35, w(22.6)); box(0.08, 0.08, 4.1, iron, w(41.7), 2.62, w(20.6));
  for (let i = 0; i < 5; i++) {
    const p = GO.mesh(new THREE.PlaneGeometry(0.75, 1.5), mats.pelt, root, w(41.7) - 0.05, 1.8, w(18.9) + i * 0.95);
    p.rotation.y = -Math.PI / 2 + (R() - 0.5) * 0.2; p.rotation.z = (R() - 0.5) * 0.06;
    const e = new THREE.Object3D(); e.position.set(0, -0.7, 0); p.add(e); L.dripEmitter(e, 0.8);
    pool(w(41.5), w(18.9) + i * 0.95, 0.9);
  }
  for (const pz of [23.15, 24.0]) bench(w(37.4), w(pz), 2.6);
  cross(41, 21, 'e', 0, 2.9, 1.6, true);
  GO.bake(GO.bonePile(root, w(40.6), w(23.9), 18)); GO.bake(GO.bonePile(root, w(32.8), w(16), 14)); GO.bake(GO.bonePile(root, w(40.5), w(16.8), 8));
  box(1.0, 0.8, 0.6, lam(TX.woodTex(false), { color: 0xb09060 }), w(40.8), 0.4, w(15.6), { col: true, nav: false }); // reliquary chest
  L.addItem('fuse3', 'fuse', w(40.8), 0.82, w(15.6));
  L.addItem('note_mara', 'note', w(33.2), 0.05, w(23.9), 'Pick up the rosary');
  L.addLocker(32, 20, 'w', 0, { hide: true });
  L.decalWall(32, 17, 'w', 0.5, 1.5, 1.4, 1.4, 'drips'); L.decalWall(41, 24, 's', 0, 1.3, 1.2, 1.2, 'hands');
  L.waypoints.push(W3(36, 20.5), W3(39.5, 17));
  L.specials.renderWaypoints = [L.waypoints.length - 2, L.waypoints.length - 1];

  // ===== CATACOMBS =====
  L.fixture(4.5, 22, 'candle', 0.1, { y: 1.2 }); L.fixture(12, 27.6, 'candle', 0.1, { y: 1.2 }); L.fixture(28, 27.6, 'candle', 0.25, { y: 1.2 }); L.fixture(36, 27.6, 'candle', 0, { y: 1.2, dead: true });
  for (const [x, z] of [[4.3, 22], [12, 27.3], [28, 27.3], [36, 27.3]]) box(0.4, 0.06, 0.25, stone, w(x), 1.02, w(z));
  for (let x = 6; x < 38; x += 3.3) { const e = new THREE.Object3D(); e.position.set(w(x) + R() * 2, WALL_H - 0.05, w(27) + 0.5 + R()); root.add(e); L.dripEmitter(e, 0.4 + R() * 0.6); }
  for (let x = 7; x < 37; x += 4.7) GO.bake(GO.bonePile(root, w(x), w(27.85), 6));
  trail(w(4.5), w(17.5), w(4.5), w(26.5), 0.6); trail(w(5), w(27.5), w(19.5), w(27.5), 0.6);
  GO.bake(GO.entrailsPile(root, w(15.2), w(27.6), 0.9)); pool(w(15), w(27.5), 1.3);
  L.writing(24, 27, 'n', 0, 1.9, 'IT HEARS YOU', 2.45, 0.85);
  L.addLocker(31, 27, 's', 0, { hide: true, kind: 'coffin' }); L.addLocker(4, 19, 'w', 0, { hide: true, kind: 'coffin' });
  L.addItem('bat5', 'battery', w(9.3), 0.05, w(27.7));
  {
    const cr = GO.crawler(); cr.group.position.set(w(19), 0, w(27.5)); cr.group.rotation.y = -Math.PI / 2; root.add(cr.group);
    L.specials.crawler = cr; pool(w(19.3), w(27.5), 1.1);
  }
  L.waypoints.push(W3(4.5, 21), W3(12, 27.5), W3(28, 27.5));
}
function GO_pick(a) { return a[(R() * a.length) | 0]; }
