// Floor generation: rooms joined by narrow corridors (with loops, so you can run circles around it),
// the freight lift in an alcove on the south wall, then geometry, props, collision, line of sight and A*.
import * as THREE from 'three';
import { TILE, WALL_H, difficulty } from './config.js';
import { makeRng } from './rng.js';
import * as P from './props.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export const tileCenter = (t) => t * TILE + TILE / 2;
export const toTile = (v) => Math.floor(v / TILE);

export function isWall(L, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= L.W || ty >= L.H || L.grid[ty * L.W + tx] === 0) return true;
  const d = L.door;
  return !!(d && d.closed && d.x === tx && d.y === ty);
}

// a floor that needs a sealed wing (the keypad puzzle) retries seeds until the map has a chokepoint for it
export function makeLayout(depth, seed, D) {
  for (let i = 0; i < 40; i++) {
    const L = generateLayout(depth, seed + i * 7919, D);
    if (!D.puzzles.includes('keypad')) return L;
    const wing = findWing(L);
    if (!wing) continue;
    L.door = wing.door;
    L.wing = wing;
    L.block[wing.door.y * L.W + wing.door.x] = 1;
    return L;
  }
  throw new Error('could not lay out a floor with a sealed wing');
}

// a straight piece of corridor that, shut, cuts off a good chunk of the floor (but never the lift)
function findWing(L) {
  const { W, H, grid, corridor, rooms, alcove } = L;
  const start = alcove.y * W + alcove.x;
  const reach = (shut) => {
    const seen = new Uint8Array(W * H), q = [start];
    seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], cx = c % W, cy = (c / W) | 0;
      for (const [dx, dy] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (!grid[n] || seen[n] || n === shut) continue;
        seen[n] = 1;
        q.push(n);
      }
    }
    return seen;
  };
  let best = null;
  for (let i = 0; i < W * H; i++) {
    if (!corridor[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const ew = !isWall(L, x - 1, y) && !isWall(L, x + 1, y) && isWall(L, x, y - 1) && isWall(L, x, y + 1);
    const ns = !isWall(L, x, y - 1) && !isWall(L, x, y + 1) && isWall(L, x - 1, y) && isWall(L, x + 1, y);
    if (!ew && !ns) continue;
    const seen = reach(i);
    const cut = [];
    rooms.forEach((r, ri) => { if (ri > 0 && !seen[r.cy * W + r.cx]) cut.push(ri); });
    if (cut.length < 2 || cut.length > (rooms.length - 1) * 0.55) continue;
    const score = -Math.abs(cut.length - (rooms.length - 1) * 0.35);
    if (!best || score > best.score) best = { score, x, y, ns, seen, cut };
  }
  if (!best) return null;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (grid[i] && !best.seen[i] && i !== best.y * W + best.x) mask[i] = 1;
  // which side of the shutter you arrive from
  const [sx, sy] = best.ns ? (best.seen[(best.y - 1) * W + best.x] ? [0, -1] : [0, 1]) : (best.seen[best.y * W + best.x - 1] ? [-1, 0] : [1, 0]);
  return { door: { x: best.x, y: best.y, ns: best.ns, side: [sx, sy], closed: true }, mask, rooms: best.cut };
}

// ---------- layout ----------
export function generateLayout(depth, seed, D = difficulty(depth)) {
  const rng = makeRng(seed);
  const W = D.size, H = D.size;
  const grid = new Uint8Array(W * H);
  const roomOf = new Int16Array(W * H).fill(-1);
  const corridor = new Uint8Array(W * H);
  const rooms = [];

  const lw = 4, lh = 3, lx = rng.int(2, W - lw - 2), ly = H - 2 - lh;
  rooms.push({ x: lx, y: ly, w: lw, h: lh, type: 'lift' });
  const ax = lx + rng.int(1, lw - 2), ay = H - 2;

  for (let tries = 0; rooms.length < D.rooms + 1 && tries < 600; tries++) {
    const w = rng.int(3, 7), h = rng.int(3, 6);
    const x = rng.int(1, W - w - 1), y = rng.int(1, H - h - 7);
    if (y < 1) continue;
    if (rooms.some((r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
    rooms.push({ x, y, w, h, type: '' });
  }
  rooms.forEach((r, i) => {
    r.cx = r.x + (r.w >> 1);
    r.cy = r.y + (r.h >> 1);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { grid[y * W + x] = 1; roomOf[y * W + x] = i; }
  });

  const carve = (a, b) => {
    let x = a.cx, y = a.cy;
    const step = (tx, ty) => {
      while (x !== tx || y !== ty) {
        if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y);
        const i = y * W + x;
        if (!grid[i]) { grid[i] = 1; corridor[i] = 1; }
      }
    };
    if (rng() < 0.5) { step(b.cx, y); step(b.cx, b.cy); } else { step(x, b.cy); step(b.cx, b.cy); }
  };
  // minimum spanning tree, then a few extra links so there is always another way round
  const inTree = [0], dist2 = (a, b) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
  const linked = new Set();
  while (inTree.length < rooms.length) {
    let best = null;
    for (const i of inTree) rooms.forEach((r, j) => {
      if (inTree.includes(j)) return;
      const d = dist2(rooms[i], r);
      if (!best || d < best[0]) best = [d, i, j];
    });
    carve(rooms[best[1]], rooms[best[2]]);
    linked.add(best[1] + ',' + best[2]).add(best[2] + ',' + best[1]);
    inTree.push(best[2]);
  }
  rooms.forEach((r, i) => {
    if (!rng.chance(D.puzzles && D.puzzles.includes('keypad') ? 0.2 : 0.45)) return;
    const near = rooms.map((o, j) => [dist2(r, o), j]).filter(([, j]) => j !== i).sort((a, b) => a[0] - b[0]).slice(0, 3);
    const [, j] = rng.pick(near);
    if (!linked.has(i + ',' + j)) { carve(r, rooms[j]); linked.add(i + ',' + j).add(j + ',' + i); }
  });
  grid[ay * W + ax] = 1;

  // room jobs
  // a morgue floor is mostly freezers
  const morgue = D.theme === 'morgue';
  const pool = morgue ? ['freezer', 'freezer', 'lockers', 'morgue', 'freezer', 'butcher'] : ['cold', 'butcher', 'lockers', 'morgue', 'pit'];
  const others = rooms.slice(1);
  rng.shuffle(others);
  others.forEach((r, i) => {
    if (i < pool.length) r.type = pool[i];
    else if (morgue) r.type = rng.pick(['freezer', 'freezer', 'morgue', 'lockers']);
    else r.type = r.w * r.h >= 16 ? rng.pick(['cold', 'cold', 'butcher', 'pit']) : rng.pick(['butcher', 'lockers', 'morgue']);
    if (r.type === 'cold' && r.w * r.h < 12) r.type = 'butcher';
  });

  // walking distance from the lift: what's far away is where the tags (and the Foreman) are
  const dist = new Int32Array(W * H).fill(-1);
  const q = [ay * W + ax];
  dist[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], cx = c % W, cy = (c / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, n = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !grid[n] || dist[n] >= 0) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return { depth, seed, W, H, grid, roomOf, corridor, rooms, alcove: { x: ax, y: ay }, dist, block: new Uint8Array(W * H), D };
}

// ---------- geometry ----------
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.i = []; }
  quad(p0, r, u, n, flip) {
    const b = this.p.length / 3;
    const v = [p0, [p0[0] + r[0], p0[1] + r[1], p0[2] + r[2]], [p0[0] + r[0] + u[0], p0[1] + r[1] + u[1], p0[2] + r[2] + u[2]], [p0[0] + u[0], p0[1] + u[1], p0[2] + u[2]]];
    const uv = flip ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (let k = 0; k < 4; k++) { this.p.push(...v[k]); this.n.push(...n); this.uv.push(...uv[k]); }
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i);
    return g;
  }
}

export function buildLevel(L, mats) {
  const rng = makeRng(L.seed * 7 + 3);
  const { W, H, grid, D } = L;
  const group = new THREE.Group();
  const out = {
    group, colliders: [], lamps: [], corpses: [], pickups: [], lockers: [], swingers: [], screamers: [],
    bloodTiles: new Uint8Array(W * H), hunterSpawns: [],
  };
  const add = (o, x, z, yaw = 0) => { o.position.x = x; o.position.z = z; o.rotation.y = yaw; group.add(o); return o; };
  const collider = (x0, z0, x1, z1, solidForHunters = true) => out.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), hunters: solidForHunters });

  // shell
  const wallBufs = new Map(), floorBufs = new Map(), ceil = new Geo();
  const buf = (map, k) => map.get(k) || map.set(k, new Geo()).get(k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!grid[i]) continue;
    const room = L.rooms[L.roomOf[i]];
    const goreBoost = room && (room.type === 'butcher' || room.type === 'pit') ? 1 : 0;
    const style = room ? (L.roomOf[i] + L.depth) % 3 : L.depth % 3;
    const cx = tileCenter(x), cz = tileCenter(y);
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H && grid[ny * W + nx]) continue; // geometry ignores the shutter
      const n = [-dx, 0, -dy];
      const r = [-dy, 0, dx]; // so that r x up points along n: the face is front-facing from inside the tile
      const p0 = [cx + dx * TILE / 2 - r[0] * TILE / 2, 0, cz + dy * TILE / 2 - r[2] * TILE / 2];
      let gore = rng() < 0.3 + 0.17 * D.gore + goreBoost * 0.2 ? Math.min(3, 1 + Math.floor(rng() * (D.gore + 1 + goreBoost))) : 0;
      buf(wallBufs, gore * 3 + style).quad(p0, [r[0] * TILE, 0, r[2] * TILE], [0, WALL_H, 0], n, rng() < 0.5);
    }
    let fk = 0;
    if (room && room.type === 'pit' && x === room.cx && y === room.cy) fk = 2;
    else if (rng() < 0.06 + D.gore * 0.05 + goreBoost * 0.1) fk = 1;
    else if (L.corridor[i] && rng() < 0.08) fk = 3;
    if (fk) out.bloodTiles[i] = 1;
    buf(floorBufs, fk).quad([x * TILE, 0, (y + 1) * TILE], [TILE, 0, 0], [0, 0, -TILE], [0, 1, 0], rng() < 0.5);
    ceil.quad([x * TILE, WALL_H, y * TILE], [TILE, 0, 0], [0, 0, TILE], [0, -1, 0], false);
  }
  for (const [k, g] of wallBufs) { const m = P.mesh(g.build(), D.theme === 'morgue' ? mats.morgueWalls[Math.floor(k / 3)] : mats.walls[k], false); group.add(m); }
  for (const [k, g] of floorBufs) { const m = P.mesh(g.build(), mats.floors[k], false); group.add(m); }
  group.add(P.mesh(ceil.build(), mats.ceil, false));

  const lampAt = (x, z, kind, room) => {
    const r = rng();
    const state = r < D.deadLamps ? 'dead' : r < D.deadLamps + 0.3 ? 'flicker' : 'ok';
    const o = add(P.makeLamp(mats, kind), x, z, rng() < 0.5 ? 0 : Math.PI / 2);
    out.lamps.push({ pos: new THREE.Vector3(x, WALL_H - (kind === 'tube' ? 0.2 : 0.75), z), obj: o, state, phase: rng() * 100, room, on: 1 });
    if (state === 'dead') o.userData.bulb.material = mats.lampOff;
  };

  // which wall faces a tile has, for things that stand against walls
  // real walls only: the wing's shutter is not somewhere to hang a fuse box
  const solid = (x, y) => x < 0 || y < 0 || x >= W || y >= H || !grid[y * W + x];
  const wallSides = (x, y) => DIRS.filter(([dx, dy]) => solid(x + dx, y + dy));

  const lockerAt = (x, y, [dx, dy], off = 0) => {
    const cx = tileCenter(x), cz = tileCenter(y);
    const fx = -dx, fz = -dy, yaw = Math.atan2(fx, fz);
    const sx = -fz, sz = fx; // sideways along the wall
    const ox = cx + dx * (TILE / 2 - 0.53) + sx * off, oz = cz + dy * (TILE / 2 - 0.53) + sz * off;
    const o = add(P.makeLocker(mats, rng), ox, oz, yaw);
    const bx = ox + dx * 0.53, bz = oz + dy * 0.53;
    collider(ox - Math.abs(sx) * 0.31, oz - Math.abs(sz) * 0.31, bx + Math.abs(sx) * 0.31, bz + Math.abs(sz) * 0.31);
    out.lockers.push({ obj: o, pos: new THREE.Vector3(ox, 0, oz), facing: new THREE.Vector3(fx, 0, fz), yaw, camYaw: yaw + Math.PI, open: 0, target: 0 });
  };

  // a drawer bank against the wall of tile (x, y) on side s
  const placeBank = (x, y, [dx, dy], labelTex, bodies) => {
    const b = P.drawerBank(mats, rng, labelTex, bodies);
    const ox = tileCenter(x) + dx * TILE / 2, oz = tileCenter(y) + dy * TILE / 2, yaw = Math.atan2(-dx, -dy);
    add(b.group, ox, oz, yaw);
    const ax = Math.abs(dy) * 1, az = Math.abs(dx) * 1; // half-width along the wall
    collider(ox - ax - Math.abs(dx) * 0.0, oz - az, ox - dx * 0.28 + ax, oz - dy * 0.28 + az);
    // world positions of each drawer front
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    for (const d of b.drawers) d.pos = new THREE.Vector3(ox + d.local.x * cos + d.local.z * sin, d.local.y, oz - d.local.x * sin + d.local.z * cos);
    b.pos = new THREE.Vector3(ox - dx * 0.8, 1.2, oz - dy * 0.8);
    return b;
  };
  out.placeBank = placeBank;
  out.drawerBanks = [];
  const interior = (r) => {
    const t = [];
    for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) t.push([x, y]);
    return t;
  };
  const allTiles = (r) => {
    const t = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) t.push([x, y]);
    return t;
  };
  const used = new Set();

  // rooms
  L.rooms.forEach((r, ri) => {
    const rx = r.x * TILE, rz = r.y * TILE, rw = r.w * TILE, rh = r.h * TILE;
    if (r.type !== 'lift') lampAt(rx + rw / 2, rz + rh / 2, r.w * r.h >= 12 ? 'tube' : 'bulb', ri);
    else lampAt(rx + rw / 2, rz + rh / 2 - 1, 'tube', ri);
    if (r.type === 'cold') {
      // rails of meat on the tile corners, so there is always a way between them (if you can stand to)
      for (let y = r.y + 1; y < r.y + r.h; y += 2) {
        const z = y * TILE;
        add(P.ceilingRail(mats, rw - 0.6), rx + rw / 2, z);
        for (let tx = r.x + 1; tx < r.x + r.w; tx++) {
          const x = tx * TILE;
          if (rng() < 0.2) continue;
          const human = rng() < 0.25 + L.depth * 0.12;
          const c = add(P.makeCarcass(mats, rng, human), x, z, rng() * 6);
          c.position.y = WALL_H;
          out.swingers.push(c);
          collider(x - 0.26, z - 0.26, x + 0.26, z + 0.26, false);
          if (human && out.screamers.length < D.screamers && rng() < 0.5) out.screamers.push({ obj: c, pos: new THREE.Vector3(x, 1.5, z), used: false });
          group.add(P.decal(mats.splat[(rng() * 4) | 0], 1, x + (rng() - 0.5) * 0.3, z + (rng() - 0.5) * 0.3, rng() * 6));
        }
      }
    } else if (r.type === 'butcher') {
      const spots = rng.shuffle(interior(r)).slice(0, Math.min(3, Math.max(1, (r.w * r.h) / 8 | 0)));
      for (const [x, y] of spots) {
        const along = rng() < 0.5, cx = tileCenter(x), cz = tileCenter(y);
        add(P.butcherTable(mats, rng), cx, cz, along ? 0 : Math.PI / 2);
        if (along) collider(cx - 0.92, cz - 0.42, cx + 0.92, cz + 0.42); else collider(cx - 0.42, cz - 0.92, cx + 0.42, cz + 0.92);
        L.block[y * W + x] = 1;
        used.add(x + ',' + y);
      }
      for (let i = 0; i < 3; i++) out.swingers.push(add(P.hangingChain(mats, rng), rx + 1 + rng() * (rw - 2), rz + 1 + rng() * (rh - 2)));
      for (let i = 0; i < 2; i++) { const b = add(P.bucket(mats), rx + 0.5 + rng() * (rw - 1), rz + 0.5 + rng() * (rh - 1)); b.position.y = 0; }
    } else if (r.type === 'freezer') {
      // walls of body drawers, a couple left hanging open, and a slab in the middle
      const segs = [];
      for (const [x, y] of allTiles(r)) { const ws = wallSides(x, y); if (ws.length === 1) segs.push([x, y, ws[0]]); }
      rng.shuffle(segs);
      let banks = 0;
      for (const [x, y, s] of segs) {
        if (banks >= 2) break;
        if (used.has(x + ',' + y)) continue;
        used.add(x + ',' + y).add(x + ',' + y + 'L' + s);
        out.drawerBanks.push(placeBank(x, y, s, null, 0.7));
        banks++;
      }
      for (const b of out.drawerBanks.slice(-banks)) {
        for (let k = 0; k < 1 + (rng() * 2 | 0); k++) { const d = rng.pick(b.drawers); d.open = d.target = 0.5 + rng() * 0.9; d.grp.position.z = d.open; }
      }
      const inner = rng.shuffle(interior(r));
      if (inner.length) {
        const [x, y] = inner[0], cx = tileCenter(x), cz = tileCenter(y);
        add(P.autopsyTable(mats, rng), cx, cz, 0);
        collider(cx - 1, cz - 0.42, cx + 1, cz + 0.42);
        L.block[y * W + x] = 1;
        used.add(x + ',' + y);
      }
    } else if (r.type === 'morgue') {
      for (const [x, y] of rng.shuffle(allTiles(r)).slice(0, 2 + (rng() * 3 | 0))) {
        if (used.has(x + ',' + y)) continue;
        used.add(x + ',' + y);
        add(P.bodyBag(mats, rng), tileCenter(x) + (rng() - 0.5) * 0.4, tileCenter(y) + (rng() - 0.5) * 0.4, rng() * 6);
      }
      for (const [x, y] of rng.shuffle(interior(r)).slice(0, 2)) {
        if (used.has(x + ',' + y)) continue;
        used.add(x + ',' + y);
        const cx = tileCenter(x), cz = tileCenter(y);
        add(P.gurney(mats, rng), cx, cz, 0);
        collider(cx - 0.96, cz - 0.34, cx + 0.96, cz + 0.34);
        L.block[y * W + x] = 1;
      }
    } else if (r.type === 'pit') {
      const cx = tileCenter(r.cx), cz = tileCenter(r.cy);
      for (let i = 0; i < 4; i++) group.add(P.decal(mats.pool[i % 3], 2.6 + rng() * 1.5, cx + (rng() - 0.5) * rw * 0.5, cz + (rng() - 0.5) * rh * 0.5, rng() * 6));
      for (let i = 0; i < 6; i++) out.swingers.push(add(P.hangingChain(mats, rng), rx + 0.8 + rng() * (rw - 1.6), rz + 0.8 + rng() * (rh - 1.6)));
      for (let i = 0; i < 10; i++) add(P.meatChunk(mats, rng), cx + (rng() - 0.5) * 2.5, cz + (rng() - 0.5) * 2.5, rng() * 6);
      add(P.entrails(mats, rng, new THREE.Vector3(0, 0.05, 0), 1.5, 14), cx + 0.4, cz - 0.3);
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.bloodTiles[y * W + x] = 1;
    }
    // lockers
    if (r.type === 'lockers' || (r.type !== 'lift' && rng() < 0.4)) {
      const sides = [];
      for (const [x, y] of allTiles(r)) for (const s of wallSides(x, y)) sides.push([x, y, s]);
      rng.shuffle(sides);
      const want = r.type === 'lockers' ? Math.min(6, sides.length) : 1;
      let placed = 0;
      for (const [x, y, s] of sides) {
        if (placed >= want) break;
        if (used.has(x + ',' + y + 'L' + s)) continue;
        // keep corners clear: two lockers meeting in a corner would overlap
        if (wallSides(x, y).length > 1) continue;
        used.add(x + ',' + y + 'L' + s).add(x + ',' + y);
        if (r.type === 'lockers') { lockerAt(x, y, s, -0.33); lockerAt(x, y, s, 0.33); } else lockerAt(x, y, s, 0);
        placed++;
      }
      if (r.type === 'lockers') {
        const [x, y] = rng.pick(interior(r).length ? interior(r) : allTiles(r));
        const b = add(P.mesh(new THREE.BoxGeometry(1.4, 0.06, 0.35), mats.darkMetal), tileCenter(x), tileCenter(y));
        b.position.y = 0.45;
      }
    }
  });

  // corridors: lamps every few metres, drag marks, and the odd locker to dive into
  const corridorTiles = [];
  for (let i = 0; i < W * H; i++) if (L.corridor[i]) corridorTiles.push([i % W, (i / W) | 0]);
  rng.shuffle(corridorTiles);
  const lampTiles = [];
  for (const [x, y] of corridorTiles) {
    if (lampTiles.some(([lx, ly]) => Math.abs(lx - x) + Math.abs(ly - y) < 5)) continue;
    lampTiles.push([x, y]);
    lampAt(tileCenter(x), tileCenter(y), 'bulb', -1);
  }
  let corridorLockers = 0;
  for (const [x, y] of corridorTiles) {
    if (L.door && Math.abs(L.door.x - x) + Math.abs(L.door.y - y) <= 1) continue; // keep the shutter clear
    const s = wallSides(x, y);
    const straight = s.length === 2 && s[0][0] === -s[1][0] && s[0][1] === -s[1][1];
    if (straight && corridorLockers < 3 + (L.depth > 2 ? 1 : 0) && rng() < 0.08) { lockerAt(x, y, s[0], 0); used.add(x + ',' + y); corridorLockers++; }
    else if (straight && rng() < 0.1) {
      const along = s[0][0] !== 0 ? Math.PI / 2 : 0;
      group.add(P.decal(mats.drag, 2, tileCenter(x), tileCenter(y), along + Math.PI / 2 + (rng() < 0.5 ? Math.PI : 0)));
    } else if (rng() < 0.05 + L.depth * 0.01) {
      const k = rng();
      const p = k < 0.3 ? P.severedArm(mats, rng) : k < 0.45 ? P.severedHead(mats, rng) : k < 0.7 ? P.meatChunk(mats, rng) : P.entrails(mats, rng, new THREE.Vector3(0, 0.04, 0), 0.8, 8);
      add(p, tileCenter(x) + (rng() - 0.5), tileCenter(y) + (rng() - 0.5), rng() * 6);
      group.add(P.decal(mats.splat[(rng() * 4) | 0], 1.4, tileCenter(x), tileCenter(y), rng() * 6));
    }
  }

  // tagged corpses, spread far apart and far from the lift
  const inWing = (x, y) => !!(L.wing && L.wing.mask[y * W + x]);
  const candidates = L.rooms.slice(1).map((r) => ({ r, d: L.dist[r.cy * W + r.cx] })).filter((c) => c.d > 0);
  candidates.sort((a, b) => b.d - a.d);
  const chosen = [];
  const choose = (pool, n) => {
    for (let k = 0; k < n && pool.length; k++) {
      let best = null, bestScore = -1;
      for (const c of pool) {
        const sep = chosen.length ? Math.min(...chosen.map((o) => Math.abs(o.r.cx - c.r.cx) + Math.abs(o.r.cy - c.r.cy))) : 99;
        const score = Math.min(sep, 14) * 2 + c.d * 0.5 + rng() * 6;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      chosen.push(best);
      pool.splice(pool.indexOf(best), 1);
      candidates.splice(candidates.indexOf(best), 1);
    }
  };
  // behind a sealed shutter there is always something you need
  if (L.wing) choose(candidates.filter((c) => inWing(c.r.cx, c.r.cy)), Math.max(1, Math.round(D.tags * 0.4)));
  choose(candidates.filter((c) => !inWing(c.r.cx, c.r.cy)), D.tags - chosen.length);
  choose(candidates.slice(), D.tags - chosen.length);
  // more tags than rooms on tiny maps: use corridor dead ends
  while (chosen.length < D.tags) {
    const t = rng.pick(corridorTiles.filter(([x, y]) => !(L.door && L.door.x === x && L.door.y === y)));
    chosen.push({ r: { x: t[0], y: t[1], w: 1, h: 1, cx: t[0], cy: t[1], type: 'corridor' } });
  }
  for (const { r } of chosen) {
    const opts = allTiles(r).filter(([x, y]) => !used.has(x + ',' + y) && !L.block[y * W + x]);
    const [x, y] = opts.length ? rng.pick(opts) : [r.cx, r.cy];
    used.add(x + ',' + y);
    const c = P.makeCorpse(mats, rng);
    const px = tileCenter(x) + (rng() - 0.5) * 0.5, pz = tileCenter(y) + (rng() - 0.5) * 0.5;
    add(c.group, px, pz, rng() * 6);
    out.corpses.push({ ...c, pos: new THREE.Vector3(px, 0.25, pz), progress: 0, harvested: false, room: r });
    out.bloodTiles[y * W + x] = 1;
  }

  // placement for everything that comes after (pickups here, puzzles in puzzles.js)
  const freeTiles = [];
  L.rooms.forEach((r, ri) => { if (r.type !== 'lift') for (const [x, y] of allTiles(r)) if (!used.has(x + ',' + y) && !L.block[y * W + x]) freeTiles.push([x, y, ri]); });
  rng.shuffle(freeTiles);
  out.inWing = inWing;
  out.takeTile = (pred = () => true) => {
    const i = freeTiles.findIndex((t) => !used.has(t[0] + ',' + t[1]) && pred(t));
    if (i < 0) return null;
    const t = freeTiles.splice(i, 1)[0];
    used.add(t[0] + ',' + t[1]);
    return t;
  };
  // a bare stretch of wall: [x, y, [dx, dy] toward the wall, room]
  out.takeWall = (pred = () => true) => {
    for (const [x, y, ri] of freeTiles) {
      if (used.has(x + ',' + y)) continue;
      for (const s of wallSides(x, y)) {
        const k = x + ',' + y + 'L' + s;
        if (used.has(k) || !pred([x, y, s, ri])) continue;
        used.add(k).add(x + ',' + y);
        return [x, y, s, ri];
      }
    }
    return null;
  };

  // batteries and adrenaline
  const pickup = (type) => {
    const t = out.takeTile();
    if (!t) return;
    const g = new THREE.Group();
    if (type === 'battery') {
      const b = P.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 8), mats.darkMetal);
      b.rotation.z = Math.PI / 2;
      const tip = P.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6), new THREE.MeshBasicMaterial({ color: 0x9a7a30 }), false);
      tip.rotation.z = Math.PI / 2;
      tip.position.x = 0.075;
      const led = P.mesh(new THREE.SphereGeometry(0.008, 4, 3), new THREE.MeshBasicMaterial({ color: 0x40ff60, fog: false }), false);
      led.position.y = 0.04;
      g.add(b, tip, led);
    } else {
      // a syringe of something bright red
      const barrel = P.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8), new THREE.MeshPhongMaterial({ color: 0xd8e0e0, transparent: true, opacity: 0.7, shininess: 100 }), false);
      barrel.rotation.z = Math.PI / 2;
      const fill = P.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xc01010, fog: false }), false);
      fill.rotation.z = Math.PI / 2;
      const needle = P.mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 4), mats.steel, false);
      needle.rotation.z = Math.PI / 2;
      needle.position.x = 0.1;
      g.add(barrel, fill, needle);
    }
    const x = tileCenter(t[0]) + (rng() - 0.5) * 1.2, z = tileCenter(t[1]) + (rng() - 0.5) * 1.2;
    add(g, x, z, rng() * 6).position.y = 0.04;
    out.pickups.push({ type, obj: g, pos: new THREE.Vector3(x, 0.1, z), taken: false });
  };
  for (let i = 0; i < D.batteries; i++) pickup('battery');
  for (let i = 0; i < D.adrenaline; i++) pickup('adrenaline');

  // the lift
  const { x: ax, y: ay } = L.alcove;
  const lift = P.makeLift(mats, D.tags);
  add(lift, tileCenter(ax), tileCenter(ay));
  out.lift = { obj: lift, pos: new THREE.Vector3(tileCenter(ax), 0, tileCenter(ay)), inserted: 0, gate: 1, ...lift.userData };
  out.lamps.push({ pos: new THREE.Vector3(tileCenter(ax), WALL_H - 0.3, tileCenter(ay) + 0.2), obj: null, state: 'lift', phase: 0, room: 0, on: 1 });
  out.spawn = { x: tileCenter(ax), z: tileCenter(ay) + 0.3, yaw: 0 };

  // the Foreman starts in the room furthest from you
  const far = L.rooms.slice(1).filter((r) => !inWing(r.cx, r.cy)).sort((a, b) => L.dist[b.cy * W + b.cx] - L.dist[a.cy * W + a.cx]);
  for (let i = 0; i < D.hunters; i++) {
    const r = far[Math.min(i * 2, far.length - 1)];
    out.hunterSpawns.push(new THREE.Vector3(tileCenter(r.cx), 0, tileCenter(r.cy)));
  }
  return out;
}

// ---------- collision ----------
function pushOut(p, r, x0, z0, x1, z1) {
  const cx = Math.max(x0, Math.min(p.x, x1)), cz = Math.max(z0, Math.min(p.z, z1));
  const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 < 1e-9) {
    const l = p.x - x0, rr = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, rr, t, b);
    if (m === l) p.x = x0 - r; else if (m === rr) p.x = x1 + r; else if (m === t) p.z = z0 - r; else p.z = z1 + r;
    return true;
  }
  const d = Math.sqrt(d2);
  p.x = cx + (dx / d) * r;
  p.z = cz + (dz / d) * r;
  return true;
}

export function collide(L, B, p, r, hunter = false) {
  let hit = false;
  for (let it = 0; it < 2; it++) {
    const tx0 = toTile(p.x - r), tx1 = toTile(p.x + r), tz0 = toTile(p.z - r), tz1 = toTile(p.z + r);
    for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++)
      if (isWall(L, tx, tz)) hit = pushOut(p, r, tx * TILE, tz * TILE, (tx + 1) * TILE, (tz + 1) * TILE) || hit;
    for (const c of B.colliders) {
      if (c.off || (hunter && !c.hunters)) continue;
      if (p.x + r < c.x0 || p.x - r > c.x1 || p.z + r < c.z0 || p.z - r > c.z1) continue;
      hit = pushOut(p, r, c.x0, c.z0, c.x1, c.z1) || hit;
    }
  }
  return hit;
}

// can something of radius r walk straight from a to b? walls and solid furniture (tables, gurneys) both count
export function pathClear(L, B, ax, az, bx, bz, r = 0.36) {
  if (!lineOfSight(L, ax, az, bx, bz)) return false;
  const dx = bx - ax, dz = bz - az;
  for (const c of B.colliders) {
    if (c.off || !c.hunters) continue;
    // slab test against the box grown by r
    let t0 = 0, t1 = 1;
    for (const [o, d, lo, hi] of [[ax, dx, c.x0 - r, c.x1 + r], [az, dz, c.z0 - r, c.z1 + r]]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } continue; }
      let a = (lo - o) / d, b = (hi - o) / d;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
      if (t0 > t1) break;
    }
    if (t0 <= t1) return false;
  }
  return true;
}

export function lineOfSight(L, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, n = Math.ceil(Math.hypot(dx, dz) / 0.25);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (isWall(L, toTile(ax + dx * t), toTile(az + dz * t))) return false;
  }
  return true;
}

// ---------- A* over the tile grid (8-way, no cutting corners) ----------
export function findPath(L, sx, sz, ex, ez) {
  const { W, H, grid, block } = L;
  const open = (x, y) => x >= 0 && y >= 0 && x < W && y < H && grid[y * W + x] && !block[y * W + x];
  let s = [toTile(sx), toTile(sz)], e = [toTile(ex), toTile(ez)];
  if (!open(...e)) {
    const alt = DIRS.map(([dx, dy]) => [e[0] + dx, e[1] + dy]).find((t) => open(...t));
    if (!alt) return null;
    e = alt;
  }
  if (!open(...s)) {
    const alt = DIRS.map(([dx, dy]) => [s[0] + dx, s[1] + dy]).find((t) => open(...t));
    if (alt) s = alt;
  }
  const si = s[1] * W + s[0], ei = e[1] * W + e[0];
  const g = new Float32Array(W * H).fill(1e9), came = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const heap = [];
  const push = (f, i) => {
    heap.push([f, i]);
    let k = heap.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  const hx = e[0], hy = e[1];
  const hfn = (x, y) => { const dx = Math.abs(x - hx), dy = Math.abs(y - hy); return dx + dy - 0.586 * Math.min(dx, dy); };
  g[si] = 0;
  push(hfn(s[0], s[1]), si);
  let found = false;
  while (heap.length) {
    const [, c] = pop();
    if (closed[c]) continue;
    if (c === ei) { found = true; break; }
    closed[c] = 1;
    const cx = c % W, cy = (c / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!open(nx, ny)) continue;
      if (dx && dy && (!open(cx + dx, cy) || !open(cx, cy + dy))) continue;
      const n = ny * W + nx, ng = g[c] + (dx && dy ? 1.414 : 1);
      if (ng < g[n]) { g[n] = ng; came[n] = c; push(ng + hfn(nx, ny), n); }
    }
  }
  if (!found) return null;
  const path = [];
  for (let c = ei; c !== -1 && c !== si; c = came[c]) path.push(new THREE.Vector3(tileCenter(c % W), 0, tileCenter((c / W) | 0)));
  path.reverse();
  return path;
}

export function randomFloorNear(L, x, z, radiusTiles, rng = Math.random) {
  const tx = toTile(x), tz = toTile(z);
  for (let i = 0; i < 40; i++) {
    const nx = tx + Math.round((rng() * 2 - 1) * radiusTiles), nz = tz + Math.round((rng() * 2 - 1) * radiusTiles);
    if (!isWall(L, nx, nz) && !L.block[nz * L.W + nx] && L.roomOf[nz * L.W + nx] !== 0 && !(nx === L.alcove.x && nz === L.alcove.y)) return new THREE.Vector3(tileCenter(nx), 0, tileCenter(nz));
  }
  return null;
}
