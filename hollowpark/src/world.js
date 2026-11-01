// Hollow Lane and Hollow Park. Map, thin walls with real doors and windows, indoor + outdoor zones,
// collision, line of sight, navigation, lights, hiding spots, items, decals and blood.
import * as THREE from 'three';
import { G, T, WALL_H, R, W3, toTile, rr, clamp } from './state.js';
import * as TX from './textures.js';
import * as PB from './pbr.js';
import * as GO from './gore.js';
import * as AU from './audio.js';
import { furnish } from './furnish.js';

export const MW = 66, MH = 46;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const INDOOR = new Set(['garage', 'living', 'kitchen', 'hall', 'master', 'bath', 'study', 'kid', 'laundry', 'guest', 'shed', 'wc_m', 'wc_w', 'hut', 'hut_back']);
const EAVE = 0.55;   // exterior walls rise this much above the ceiling to meet the roof

// ------------------------------------------------------------------ map
function makeMap() {
  const room = Array.from({ length: MH }, () => Array(MW).fill(null));
  const solid = Array.from({ length: MH }, () => Array(MW).fill('woods'));
  const rect = (x0, y0, x1, y1, id) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { room[y][x] = id; solid[y][x] = null; } };
  const block = (x0, y0, x1, y1, kind) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { room[y][x] = null; solid[y][x] = kind; } };
  // the house
  rect(2, 2, 6, 6, 'garage'); rect(2, 7, 6, 12, 'living'); rect(2, 13, 6, 18, 'kitchen'); rect(7, 2, 7, 18, 'hall');
  rect(8, 2, 12, 5, 'master'); rect(8, 6, 12, 7, 'bath'); rect(8, 8, 12, 10, 'study'); rect(8, 11, 12, 13, 'kid'); rect(8, 14, 12, 15, 'laundry'); rect(8, 16, 12, 18, 'guest');
  // the yard and the shed
  rect(13, 2, 21, 18, 'yard'); rect(17, 3, 20, 5, 'shed');
  // the park
  rect(22, 1, 63, 44, 'lawn');
  rect(22, 10, 40, 11, 'path'); rect(40, 2, 41, 42, 'path'); rect(24, 38, 62, 39, 'path'); rect(41, 18, 60, 19, 'path'); rect(60, 4, 61, 39, 'path'); rect(41, 4, 60, 5, 'path'); rect(31, 8, 32, 9, 'path'); rect(26, 8, 27, 9, 'path');
  rect(24, 25, 36, 36, 'play'); rect(28, 20, 29, 24, 'path'); rect(28, 37, 29, 37, 'path');
  rect(25, 3, 28, 7, 'wc_m'); rect(29, 3, 32, 7, 'wc_w');
  rect(49, 9, 53, 13, 'gazebo');
  rect(53, 33, 55, 36, 'hut'); rect(56, 33, 58, 36, 'hut_back');
  // hedges and woods inside the park
  block(24, 13, 29, 14, 'hedge'); block(32, 13, 38, 14, 'hedge');
  block(45, 7, 48, 7, 'hedge'); block(54, 7, 57, 7, 'hedge'); block(45, 15, 48, 15, 'hedge'); block(54, 15, 57, 15, 'hedge'); block(45, 8, 45, 10, 'hedge'); block(45, 12, 45, 14, 'hedge'); block(57, 8, 57, 10, 'hedge'); block(57, 12, 57, 14, 'hedge');
  block(44, 31, 48, 36, 'woods'); block(24, 40, 27, 43, 'woods'); block(33, 41, 38, 44, 'woods'); block(62, 22, 63, 30, 'woods'); block(22, 1, 23, 7, 'woods'); block(34, 1, 39, 3, 'woods');
  block(37, 24, 38, 31, 'hedge'); block(22, 19, 23, 34, 'hedge');
  // the pond
  for (let y = 20; y <= 31; y++) for (let x = 43; x <= 59; x++) { const dx = (x + 0.5 - 51) / 7.2, dy = (y + 0.5 - 25.5) / 5; if (dx * dx + dy * dy < 1) block(x, y, x, y, 'water'); }
  rect(51, 27, 51, 31, 'pier');
  return { room, solid };
}

// ------------------------------------------------------------------ geometry accumulator
class Acc {
  constructor() { this.p = []; this.n = []; this.u = []; }
  quad(a, b, c, d, n, uv) { // uv: [[u,v] x4] for a,b,c,d
    this.p.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) this.n.push(...n);
    const [ua, ub, uc, ud] = uv; this.u.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
  }
  geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.computeBoundingSphere(); return g; }
}

// ------------------------------------------------------------------ build (async so the loading screen can breathe)
export async function buildWorld(scene, progress = () => { }) {
  const step = async (label, frac) => { progress(label, frac); await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0))); };
  const { room, solid } = makeMap();
  const L = {
    room, solid, doors: [], lockers: [], fixtures: [], interact: [], hangers: [], items: {}, colGrid: [], colliders: [], nav: [], trees: [],
    updaters: [], waypoints: [], vats: [], specials: {}, gateOpen: false, onItem: null, decals: new THREE.Group(), hE: [], vE: [],
  };
  G.level = L;
  const root = new THREE.Group(); scene.add(root); L.root = root; root.add(L.decals);
  for (let i = 0; i < MW * MH; i++) { L.colGrid.push([]); L.nav.push(true); }
  for (let y = 0; y <= MH; y++) { L.hE.push(Array(MW + 1).fill(null)); L.vE.push(Array(MW + 1).fill(null)); }
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;
  const zone = (x, y) => inb(x, y) ? room[y][x] : null;
  const isIn = (x, y) => INDOOR.has(zone(x, y));

  // ---------- edges ----------
  // edge between two orthogonally adjacent tiles
  const edgeRef = (ax, ay, bx, by) => {
    if (bx === ax + 1) return [L.vE, bx, ay]; if (ax === bx + 1) return [L.vE, ax, ay];
    if (by === ay + 1) return [L.hE, ax, by]; if (ay === by + 1) return [L.hE, ax, ay]; return null;
  };
  L.edge = (ax, ay, bx, by) => { const r = edgeRef(ax, ay, bx, by); return r ? r[0][r[2]]?.[r[1]] : null; };
  const setEdge = (ax, ay, bx, by, e) => { const r = edgeRef(ax, ay, bx, by); r[0][r[2]][r[1]] = e; };
  // walls wherever an indoor zone meets anything else that's floor
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const a = zone(x, y); if (!a) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const b = zone(x + dx, y + dy); if (!b || a === b) continue;
      if (INDOOR.has(a) || INDOOR.has(b)) setEdge(x, y, x + dx, y + dy, { kind: 'wall' });
    }
  }
  // the yard fence
  for (let y = 2; y <= 18; y++) setEdge(21, y, 22, y, { kind: 'fence' });
  const openings = [[2, 12, 2, 13], [3, 12, 3, 13]]; // living room -> kitchen archway
  for (const o of openings) setEdge(...o, null);
  const windows = [[12, 3, 13, 3], [12, 9, 13, 9], [12, 12, 13, 12], [12, 17, 13, 17], [24, 5, 25, 5], [32, 4, 33, 4], [54, 32, 54, 33], [58, 35, 59, 35], [20, 4, 21, 4], [6, 9, 7, 9]];
  for (const w of windows) setEdge(...w, { kind: 'window' });
  const doorDefs = [
    // [ax, ay, bx, by, type, open]
    [7, 1, 7, 2, 'front', 0], [6, 4, 7, 4, 'n', 0], [6, 10, 7, 10, 'n', 1], [6, 16, 7, 16, 'n', 1], [7, 3, 8, 3, 'n', 0], [7, 7, 8, 7, 'n', 1], [7, 9, 8, 9, 'locked', 0], [7, 12, 8, 12, 'n', 0],
    [7, 14, 8, 14, 'n', 1], [7, 17, 8, 17, 'n', 0], [12, 15, 13, 15, 'n', 0], [17, 5, 17, 6, 'n', 0], [21, 10, 22, 10, 'gate', 0],
    [26, 7, 26, 8, 'n', 1], [31, 7, 31, 8, 'n', 0], [55, 32, 55, 33, 'n', 0], [55, 35, 56, 35, 'n', 0],
  ];
  for (let x = 3; x <= 5; x++) setEdge(x, 1, x, 2, { kind: 'gdoor' });  // the garage door (to a drive that isn't on the map)
  for (const d of doorDefs) setEdge(d[0], d[1], d[2], d[3], { kind: 'door', def: d });

  L.cell = (x, y) => zone(x, y) ? '.' : '#';
  L.roomAt = (wx, wz) => { const [x, y] = toTile(wx, wz); return zone(x, y) || ''; };
  L.isIndoorAt = (wx, wz) => INDOOR.has(L.roomAt(wx, wz));
  const blocksSight = (e) => e && (e.kind === 'wall' || e.kind === 'fence' || e.kind === 'gdoor' || (e.kind === 'door' && Math.abs(e.door.angle) < 0.35));
  const blocksNav = (e) => e && (e.kind !== 'door' || e.door.locked);
  L.solidTile = (x, y) => !zone(x, y);
  L.passable = (x, y) => !!zone(x, y) && L.nav[y * MW + x];
  L.canStep = (ax, ay, bx, by) => {
    if (!L.passable(bx, by)) return false;
    if (ax === bx || ay === by) return !blocksNav(L.edge(ax, ay, bx, by));
    if (!L.passable(bx, ay) || !L.passable(ax, by)) return false;
    return !blocksNav(L.edge(ax, ay, bx, ay)) && !blocksNav(L.edge(bx, ay, bx, by)) && !blocksNav(L.edge(ax, ay, ax, by)) && !blocksNav(L.edge(ax, by, bx, by));
  };
  L.doorBetween = (a, b) => {
    const [ax, ay] = toTile(a.x, a.z), [bx, by] = toTile(b.x, b.z);
    if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) return null;
    const e = L.edge(ax, ay, bx, by); return e && e.kind === 'door' ? e.door : null;
  };
  // line of sight: walls, closed doors, hedges, woods and tree trunks block; windows, water and the gate don't
  L.los = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z, dist = Math.hypot(dx, dz), steps = Math.ceil(dist / 0.25);
    let [px, py] = toTile(a.x, a.z);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, x = a.x + dx * t, z = a.z + dz * t, [tx, ty] = toTile(x, z);
      if (tx === px && ty === py) continue;
      const s = inb(tx, ty) ? solid[ty][tx] : 'woods';
      if (s && s !== 'water') return false;
      if (tx !== px && ty !== py) {
        const r1 = blocksSight(L.edge(px, py, tx, py)) || blocksSight(L.edge(tx, py, tx, ty));
        const r2 = blocksSight(L.edge(px, py, px, ty)) || blocksSight(L.edge(px, ty, tx, ty));
        if (r1 && r2) return false;
      } else if (blocksSight(L.edge(px, py, tx, ty))) return false;
      px = tx; py = ty;
    }
    for (const tr of L.trees) { // trunks
      const ux = tr.x - a.x, uz = tr.z - a.z, k = clamp((ux * dx + uz * dz) / (dist * dist || 1), 0, 1);
      if (k <= 0.02 || k >= 0.98) continue;
      if (Math.hypot(a.x + dx * k - tr.x, a.z + dz * k - tr.z) < tr.r) return false;
    }
    return true;
  };
  L.collide = (p, r) => {
    const [cx, cy] = toTile(p.x, p.z);
    for (let it = 0; it < 2; it++) for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (L.solidTile(x, y)) pushOut(p, r, x * T, x * T + T, y * T, y * T + T);
      if (inb(x, y)) for (const c of L.colGrid[y * MW + x]) if (c.on) pushOut(p, r, c.x0, c.x1, c.z0, c.z1);
    }
  };
  function pushOut(p, r, x0, x1, z0, z1) {
    const qx = clamp(p.x, x0, x1), qz = clamp(p.z, z0, z1), dx = p.x - qx, dz = p.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
    else { const l = p.x - x0, rt = x1 - p.x, tp = p.z - z0, bt = z1 - p.z, m = Math.min(l, rt, tp, bt); if (m === l) p.x = x0 - r; else if (m === rt) p.x = x1 + r; else if (m === tp) p.z = z0 - r; else p.z = z1 + r; }
  }
  L.addCollider = (x0, x1, z0, z1, nav = true) => {
    const c = { x0, x1, z0, z1, on: true }; L.colliders.push(c);
    const [ax, ay] = toTile(x0 - 0.01, z0 - 0.01), [bx, by] = toTile(x1 + 0.01, z1 + 0.01);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) if (inb(x, y)) {
      L.colGrid[y * MW + x].push(c);
      const mx = (x + 0.5) * T, mz = (y + 0.5) * T;
      if (nav && mx > x0 - 0.25 && mx < x1 + 0.25 && mz > z0 - 0.25 && mz < z1 + 0.25) L.nav[y * MW + x] = false;
    }
    return c;
  };
  L.path = (from, to) => {
    const [sx, sy] = toTile(from.x, from.z), [gx, gy] = toTile(to.x, to.z);
    if (!L.passable(gx, gy)) return null;
    const N = MW * MH, g = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N), open = [];
    const s = sy * MW + sx; g[s] = 0; open.push([Math.hypot(gx - sx, gy - sy), s]);
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, cur] = open.splice(bi, 1)[0]; if (closed[cur]) continue; closed[cur] = 1;
      const cx = cur % MW, cy = (cur / MW) | 0; if (cx === gx && cy === gy) break;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = cx + dx, ny = cy + dy;
        if (!inb(nx, ny) || !L.canStep(cx, cy, nx, ny)) continue;
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
    for (let k = 0; k < 40; k++) { const x = px + Math.round(rr(-rad, rad)), y = py + Math.round(rr(-rad, rad)); if (L.passable(x, y) && L.path(p, W3(x + 0.5, y + 0.5))) return W3(x + 0.5, y + 0.5); }
    return p.clone();
  };

  // ---------- materials ----------
  await step('Painting the wallpaper', 0.04);
  const M = {};
  const mk = (key, fn, o) => { M[key] = PB.stdMat(fn(), o); return M[key]; };
  mk('wpDamask', () => PB.wallpaper('damask', 0.3)); mk('wpStripe', () => PB.wallpaper('stripe', 0.5)); mk('wpRose', () => PB.wallpaper('rose', 0.2));
  await step('Painting the wallpaper', 0.1);
  mk('wpStars', () => PB.wallpaper('stars', 0)); mk('wpYellow', () => PB.wallpaper('yellow', 0.9));
  await step('Laying tiles', 0.16);
  mk('tileCream', () => PB.tiles([196, 186, 150], 0.4)); mk('tileWhite', () => PB.tiles([200, 205, 200], 1.3)); mk('tileFloor', () => PB.tiles([150, 150, 145], 0.6, 128));
  await step('Sanding the floors', 0.22);
  mk('wood', () => PB.woodFloor(0)); mk('woodDark', () => PB.woodFloor(0.3, [62, 40, 26])); mk('woodBloody', () => PB.woodFloor(1.4, [80, 58, 40]));
  mk('carpetRed', () => PB.carpet([92, 40, 38], 0.6)); mk('carpetBlue', () => PB.carpet([50, 62, 92], 0)); mk('carpetGreen', () => PB.carpet([60, 72, 50], 1));
  await step('Plastering', 0.28);
  mk('ceiling', () => PB.ceiling()); mk('cinder', () => PB.cinder([150, 156, 148], 0)); mk('cinderBloody', () => PB.cinder([140, 140, 130], 1.2)); mk('fence', () => PB.fencePlanks());
  await step('Painting the siding', 0.34);
  mk('siding', () => PB.siding()); mk('shingles', () => PB.shingles());
  await step('Growing the hedges', 0.4);
  mk('hedge', () => PB.hedge()); M.hedge.map.repeat.set(1, 1);
  mk('grass', () => PB.grass()); mk('asphalt', () => PB.asphalt()); mk('chips', () => PB.woodchips()); mk('dirt', () => PB.dirt());
  await step('Peeling bark', 0.46);
  mk('bark', () => PB.bark()); mk('red', () => PB.paintedMetal([150, 30, 24])); mk('yellowM', () => PB.paintedMetal([170, 130, 30])); mk('blueM', () => PB.paintedMetal([40, 70, 120]));
  M.metal = new THREE.MeshStandardMaterial({ color: 0x5a5c5e, roughness: 0.45, metalness: 0.85 });
  M.chrome = new THREE.MeshStandardMaterial({ color: 0xb0b4b8, roughness: 0.2, metalness: 1 });
  M.black = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.7 });
  M.glass = new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.45 });
  M.mirror = new THREE.MeshStandardMaterial({ color: 0x9aa4ac, roughness: 0.05, metalness: 1 });
  M.porcelain = new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: 0.2 });
  M.trim = new THREE.MeshStandardMaterial({ color: 0xc8c2b4, roughness: 0.6 });
  M.paintedWood = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, map: M.wood.map, normalMap: M.wood.normalMap });
  await step('Upholstering', 0.5);
  mk('sofa', () => PB.fabric([70, 56, 40], 0.5)); mk('mattress', () => PB.fabric([160, 150, 130], 1.0)); mk('sheet', () => PB.fabric([180, 176, 166], 0.7)); mk('quilt', () => PB.fabric([90, 70, 110], 0.2));
  const water = PB.waterNormal(); M.water = new THREE.MeshStandardMaterial({ color: 0x04080a, roughness: 0.04, metalness: 0.1, normalMap: water.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.94 });
  water.normalMap.repeat.set(6, 6);
  L.mats = M;

  const wallStyle = { garage: 'cinder', living: 'wpDamask', kitchen: 'tileCream', hall: 'wpStripe', master: 'wpRose', bath: 'tileWhite', study: 'wpDamask', kid: 'wpStars', laundry: 'cinderBloody', guest: 'wpYellow', shed: 'fence', wc_m: 'tileWhite', wc_w: 'tileWhite', hut: 'fence', hut_back: 'cinderBloody' };
  const floorStyle = { garage: 'asphalt', living: 'wood', kitchen: 'tileFloor', hall: 'woodBloody', master: 'carpetRed', bath: 'tileFloor', study: 'woodDark', kid: 'carpetBlue', laundry: 'tileFloor', guest: 'carpetGreen', shed: 'woodDark', wc_m: 'tileFloor', wc_w: 'tileFloor', hut: 'woodBloody', hut_back: 'woodBloody', yard: 'grass', lawn: 'grass', path: 'asphalt', play: 'chips', gazebo: 'wood', pier: 'wood' };
  const outdoorScale = { grass: 2, asphalt: 2, chips: 1.5 };

  await step('Building the house', 0.56);
  const accs = new Map(); const acc = (m) => { if (!accs.has(m)) accs.set(m, new Acc()); return accs.get(m); };
  // ---------- floors, ceilings, the pond ----------
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const z = zone(x, y), s = solid[y][x], x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T;
    if (z) {
      const fs = floorStyle[z] || 'grass', sc = outdoorScale[fs] || 1;
      acc(M[fs]).quad([x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0], [[x0 / T / sc, z1 / T / sc], [x1 / T / sc, z1 / T / sc], [x1 / T / sc, z0 / T / sc], [x0 / T / sc, z0 / T / sc]].map(([u, v]) => [u, -v]));
      if (INDOOR.has(z)) acc(M.ceiling).quad([x0, WALL_H, z0], [x1, WALL_H, z0], [x1, WALL_H, z1], [x0, WALL_H, z1], [0, -1, 0], [[x0 / T, z0 / T], [x1 / T, z0 / T], [x1 / T, z1 / T], [x0 / T, z1 / T]]);
    } else if (s === 'water') {
      acc(M.dirt).quad([x0, -0.5, z1], [x1, -0.5, z1], [x1, -0.5, z0], [x0, -0.5, z0], [0, 1, 0], [[0, 1], [1, 1], [1, 0], [0, 0]]);
    }
  }
  { const wm = new THREE.Mesh(new THREE.PlaneGeometry(17 * T, 12 * T), M.water); wm.rotation.x = -Math.PI / 2; wm.position.set(W3(51, 0).x, -0.12, W3(0, 25.5).z); wm.receiveShadow = true; root.add(wm); L.waterMesh = wm; L.updaters.push(dt => { water.normalMap.offset.x += dt * 0.004; water.normalMap.offset.y += dt * 0.0025; }); }

  // ---------- faces against solid cells (indoor wall / hedge / woods / pond bank) ----------
  const vface = (m, ax, az, bx, bz, y0, y1, nrm, uScale = 1, vMax = 1, vAbs = null) => {
    // a vertical quad from (ax,az) to (bx,bz) seen from the side the normal points to; UVs from world coords
    const ua = (Math.abs(nrm[0]) > 0.5 ? az : ax) / T * uScale, ub = (Math.abs(nrm[0]) > 0.5 ? bz : bx) / T * uScale;
    const v0 = vAbs ? vAbs[0] : y0 / WALL_H * vMax, v1 = vAbs ? vAbs[1] : y1 / WALL_H * vMax;
    acc(m).quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], nrm, [[ua, v0], [ub, v0], [ub, v1], [ua, v1]]);
  };
  // side helpers: the four tile edges, oriented so the face looks into the tile
  const tileFace = (m, x, y, side, y0, y1, inset = 0, uS = 1, vM = 1, vA = null) => {
    const x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T;
    if (side === 'n') vface(m, x0, z0 + inset, x1, z0 + inset, y0, y1, [0, 0, 1], uS, vM, vA);
    if (side === 's') vface(m, x1, z1 - inset, x0, z1 - inset, y0, y1, [0, 0, -1], uS, vM, vA);
    if (side === 'w') vface(m, x0 + inset, z1, x0 + inset, z0, y0, y1, [1, 0, 0], uS, vM, vA);
    if (side === 'e') vface(m, x1 - inset, z0, x1 - inset, z1, y0, y1, [-1, 0, 0], uS, vM, vA);
  };
  const fringe = []; // leafy tops of hedges
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const z = zone(x, y); if (!z) continue;
    for (const [side, dx, dy] of [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]]) {
      const nx = x + dx, ny = y + dy; if (zone(nx, ny) || L.edge(x, y, nx, ny)) continue;
      const s = inb(nx, ny) ? solid[ny][nx] : 'woods';
      if (INDOOR.has(z)) tileFace(M[wallStyle[z]], x, y, side, 0, WALL_H, 0.07);
      else if (s === 'water') tileFace(M.dirt, x, y, side, -0.5, 0.02, 0);
      else { const hh = s === 'hedge' ? 2.4 : 3.4; tileFace(M.hedge, x, y, side, 0, hh, 0, 0.5, hh / WALL_H * 0.6); fringe.push([x, y, side, hh]); }
    }
  }
  // the hedge tops: cut-out leaf cards so the skyline isn't a ruler
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.drawImage(M.hedge.map.image, 0, 0, 256, 64);
    x.globalCompositeOperation = 'destination-in';
    x.beginPath(); x.moveTo(0, 64); for (let i = 0; i <= 256; i += 4) x.lineTo(i, 30 + Math.sin(i * 0.15) * 8 + R() * 22); x.lineTo(256, 64); x.fill();
    const ft = new THREE.CanvasTexture(c); ft.colorSpace = THREE.SRGBColorSpace; ft.wrapS = THREE.RepeatWrapping;
    const fm = new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, normalMap: M.hedge.normalMap });
    for (const [x, y, side, hh] of fringe) tileFace(fm, x, y, side, hh - 0.05, hh + 0.55, 0.02, 1, 1, [0, 1]);
  }

  // ---------- thin walls on edges ----------
  const TH = 0.07; // half thickness
  const sideMat = (z) => INDOOR.has(z) ? M[wallStyle[z]] : M.siding;
  const sideTop = (z, other) => INDOOR.has(z) ? WALL_H : (INDOOR.has(other) ? WALL_H + EAVE : WALL_H);
  // a straight wall piece along an edge, from a to b (along-axis coords), y0..y1, with each side's material
  const wallPiece = (vert, line, a, b, y0, y1, zA, zB, col = true) => {
    // vert: edge runs along z at x=line (A = west tile, B = east tile); else runs along x at z=line (A = north, B = south)
    const tA = Math.min(y1, sideTop(zA, zB)), tB = Math.min(y1, sideTop(zB, zA));
    if (vert) {
      if (zA && tA > y0) vface(sideMat(zA), line - TH, b, line - TH, a, y0, tA, [-1, 0, 0]);
      if (zB && tB > y0) vface(sideMat(zB), line + TH, a, line + TH, b, y0, tB, [1, 0, 0]);
      if (col) L.addCollider(line - TH, line + TH, a, b, false);
    } else {
      if (zA && tA > y0) vface(sideMat(zA), b, line - TH, a, line - TH, y0, tA, [0, 0, -1]);
      if (zB && tB > y0) vface(sideMat(zB), a, line + TH, b, line + TH, y0, tB, [0, 0, 1]);
      if (col) L.addCollider(a, b, line - TH, line + TH, false);
    }
  };
  const cap = (vert, line, at, y0, y1, m) => { // end of a wall at a door/window jamb
    if (vert) acc(m).quad([line - TH, y0, at], [line + TH, y0, at], [line + TH, y1, at], [line - TH, y1, at], [0, 0, 1], [[0, 0], [0.07, 0], [0.07, 1], [0, 1]]);
    else acc(m).quad([at, y0, line + TH], [at, y0, line - TH], [at, y1, line - TH], [at, y1, line + TH], [1, 0, 0], [[0, 0], [0.07, 0], [0.07, 1], [0, 1]]);
  };
  const doorPending = new Map(doorDefs.map(d => [d.slice(0, 4).join(','), d]));
  const forEachEdge = (fn) => {
    for (let y = 0; y < MH; y++) for (let x = 1; x < MW; x++) { const e = L.vE[y][x]; if (e) fn(e, true, x * T, y * T, (y + 1) * T, zone(x - 1, y), zone(x, y), [x - 1, y, x, y]); }
    for (let y = 1; y < MH; y++) for (let x = 0; x < MW; x++) { const e = L.hE[y][x]; if (e) fn(e, false, y * T, x * T, (x + 1) * T, zone(x, y - 1), zone(x, y), [x, y - 1, x, y]); }
  };
  const doorMats = { n: M.paintedWood(0x8a8270), front: M.paintedWood(0x3a2420), locked: M.paintedWood(0x6a5a48), gate: M.fence };
  forEachEdge((e, vert, line, a, b, zA, zB, tiles) => {
    const mid = (a + b) / 2, trimM = M.trim;
    if (e.kind === 'wall') { wallPiece(vert, line, a, b, 0, WALL_H + EAVE, zA, zB); return; }
    if (e.kind === 'fence') {
      const fh = 1.9;
      if (vert) { vface(M.fence, line - 0.04, b, line - 0.04, a, 0, fh, [-1, 0, 0], 1, 1.4); vface(M.fence, line + 0.04, a, line + 0.04, b, 0, fh, [1, 0, 0], 1, 1.4); L.addCollider(line - 0.05, line + 0.05, a, b, false); }
      else { vface(M.fence, b, line - 0.04, a, line - 0.04, 0, fh, [0, 0, -1], 1, 1.4); vface(M.fence, a, line + 0.04, b, line + 0.04, 0, fh, [0, 0, 1], 1, 1.4); L.addCollider(a, b, line - 0.05, line + 0.05, false); }
      return;
    }
    if (e.kind === 'window') {
      const w0 = mid - 0.6, w1 = mid + 0.6;
      wallPiece(vert, line, a, w0, 0, WALL_H + EAVE, zA, zB, false); wallPiece(vert, line, w1, b, 0, WALL_H + EAVE, zA, zB, false);
      wallPiece(vert, line, w0, w1, 0, 0.9, zA, zB, false); wallPiece(vert, line, w0, w1, 2.05, WALL_H + EAVE, zA, zB, false);
      if (vert) L.addCollider(line - TH, line + TH, a, b, false); else L.addCollider(a, b, line - TH, line + TH, false);
      const g = new THREE.Group(); root.add(g);
      if (vert) { g.position.set(line, 0, mid); g.rotation.y = Math.PI / 2; } else g.position.set(mid, 0, line);
      GO.mesh(new THREE.BoxGeometry(1.2, 1.15, 0.02), M.glass, g, 0, 1.475, 0).castShadow = false;
      for (const [w, h, x, y] of [[1.3, 0.07, 0, 0.9], [1.3, 0.07, 0, 2.05], [0.07, 1.2, -0.62, 1.475], [0.07, 1.2, 0.62, 1.475], [0.04, 1.15, 0, 1.475], [1.2, 0.04, 0, 1.5]]) GO.mesh(new THREE.BoxGeometry(w, h, 0.18), trimM, g, x, y, 0);
      GO.mesh(new THREE.BoxGeometry(1.4, 0.05, 0.3), trimM, g, 0, 0.88, 0);
      return;
    }
    if (e.kind === 'gdoor') {
      wallPiece(vert, line, a, b, 2.3, WALL_H + EAVE, zA, zB, false);
      if (!L.specials.gdoor) { const g = new THREE.Group(); root.add(g); L.specials.gdoor = g; L.specials.gdoorCol = L.addCollider(3 * T, 6 * T, line - TH, line + TH, false); }
      const g = L.specials.gdoor;
      for (let k = 0; k < 7; k++) { const p = GO.mesh(new THREE.BoxGeometry(T, 0.32, 0.06), M.paintedWood(0x9a968a), g, mid, 0.16 + k * 0.325, line); p.castShadow = true; }
      return;
    }
    if (e.kind === 'door') {
      const d = e.def, type = d[4], dw = 0.95, dh = 2.1, d0 = mid - dw / 2, d1 = mid + dw / 2;
      if (type === 'gate') {
        const fh = 1.9;
        for (const [p0, p1] of [[a, d0], [d1, b]]) { if (vert) { vface(M.fence, line - 0.04, p1, line - 0.04, p0, 0, fh, [-1, 0, 0]); vface(M.fence, line + 0.04, p0, line + 0.04, p1, 0, fh, [1, 0, 0]); L.addCollider(line - 0.05, line + 0.05, p0, p1, false); } }
      } else {
        wallPiece(vert, line, a, d0, 0, WALL_H + EAVE, zA, zB); wallPiece(vert, line, d1, b, 0, WALL_H + EAVE, zA, zB); wallPiece(vert, line, d0, d1, dh, WALL_H + EAVE, zA, zB, false);
        cap(vert, line, d0, 0, dh, sideMat(zA || zB)); cap(vert, line, d1, 0, dh, sideMat(zA || zB));
        // frame
        const fg = new THREE.Group(); root.add(fg); if (vert) { fg.position.set(line, 0, mid); fg.rotation.y = Math.PI / 2; } else fg.position.set(mid, 0, line);
        for (const [w, h, x, y] of [[0.08, dh + 0.04, -dw / 2 - 0.04, dh / 2], [0.08, dh + 0.04, dw / 2 + 0.04, dh / 2], [dw + 0.16, 0.08, 0, dh + 0.04]]) GO.mesh(new THREE.BoxGeometry(w, h, 0.2), M.trim, fg, x, y, 0);
      }
      makeDoor(e, vert, line, mid, dw, type === 'gate' ? 1.8 : dh, type, d[5], doorMats[type] || doorMats.n, tiles);
    }
  });
  // posts where walls meet, so corners close
  {
    const posts = new Set();
    forEachEdge((e, vert, line, a, b, zA, zB) => { if (e.kind === 'fence') return; for (const p of [a, b]) posts.add(vert ? `${line},${p}` : `${p},${line}`); });
    for (const k of posts) { const [px, pz] = k.split(',').map(Number); const [tx, ty] = toTile(px - 0.1, pz - 0.1); const m = INDOOR.has(zone(tx, ty)) ? M[wallStyle[zone(tx, ty)]] : M.siding; GO.mesh(new THREE.BoxGeometry(TH * 2.2, WALL_H + EAVE, TH * 2.2), m, root, px, (WALL_H + EAVE) / 2, pz).castShadow = true; }
  }

  // ---------- doors ----------
  function makeDoor(e, vert, line, mid, dw, dh, type, startOpen, mat, tiles) {
    const pivot = new THREE.Group();
    // vert: door spans z (mid +- dw/2) at x=line; panel extends along +z from the hinge
    if (vert) pivot.position.set(line, 0, mid - dw / 2); else pivot.position.set(mid - dw / 2, 0, line);
    const panel = GO.mesh(new THREE.BoxGeometry(vert ? 0.05 : dw, dh, vert ? dw : 0.05), mat, pivot, vert ? 0 : dw / 2, dh / 2, vert ? dw / 2 : 0);
    if (type !== 'gate') {
      for (const s of [-1, 1]) GO.mesh(new THREE.SphereGeometry(0.03, 8, 6), M.chrome, pivot, vert ? s * 0.05 : dw - 0.1, 1.0, vert ? dw - 0.1 : s * 0.05);
      // recessed panels
      for (const py of [0.55, 1.5]) GO.mesh(new THREE.BoxGeometry(vert ? 0.06 : dw * 0.7, 0.7, vert ? dw * 0.7 : 0.06), mat, pivot, vert ? 0 : dw / 2, py, vert ? dw / 2 : 0);
    }
    root.add(pivot);
    const col = vert ? L.addCollider(line - 0.06, line + 0.06, mid - dw / 2, mid + dw / 2, false) : L.addCollider(mid - dw / 2, mid + dw / 2, line - 0.06, line + 0.06, false);
    const d = { tiles, type, vert, pivot, panel, col, angle: 0, target: 0, locked: type === 'locked' || type === 'front', pos: V(vert ? line : mid, 1.2, vert ? mid : line), stuck: type === 'front' };
    e.door = d;
    d.swingFor = (from) => { const toFrom = vert ? from.x - line : from.z - line; return vert ? (toFrom > 0 ? -1.5 : 1.5) : (toFrom > 0 ? 1.5 : -1.5); };
    d.open = (from, slam = false) => { d.target = d.swingFor(from); if (slam) { AU.doorSlam(d.pos, 1); d.angle = d.target * 0.6; } else AU.doorCreak(d.pos, 0.3); };
    d.close = () => { d.target = 0; AU.doorCreak(d.pos, 0.25); setTimeout(() => AU.thud(d.pos, 0.35), 500); };
    if (startOpen) d.target = d.angle = (vert ? 1.5 : -1.5) * (R() < 0.5 ? 1 : 0.55);
    L.doors.push(d);
    L.interact.push({
      pos: d.pos, r: 2.0, door: d,
      prompt: () => d.stuck ? 'The front door' : d.locked ? (G.hasKey ? 'Unlock' : 'Locked') : Math.abs(d.target) > 0.1 ? 'Close' : 'Open',
      act: () => {
        if (d.stuck) { AU.thud(d.pos, 0.5); AU.doorCreak(d.pos, 0.2); L.onItem?.('frontdoor', d); return; }
        if (d.locked) { if (G.hasKey) { d.locked = false; AU.click(0.3); AU.metalHit(d.pos, 0.2, false, 400); L.onItem?.('unlock', d); } else { AU.thud(d.pos, 0.2); AU.metalHit(d.pos, 0.08, false, 300); L.onItem?.('lockedDoor', d); } return; }
        if (Math.abs(d.target) > 0.1) d.close(); else { d.open(G.player.pos); G.noise?.(d.pos, 6); }
      },
    });
  }
  L.doorAtDef = (key) => L.doors.find(d => d.tiles.join(',') === key);
  L.updaters.push((dt) => {
    for (const d of L.doors) { d.angle += (d.target - d.angle) * Math.min(1, dt * (Math.abs(d.target) > 0.1 ? 3.5 : 5)); d.pivot.rotation.y = d.angle; d.col.on = Math.abs(d.angle) < 0.6; }
  });

  for (const [mat, a] of accs) { const m = new THREE.Mesh(a.geo(), mat); m.receiveShadow = true; m.castShadow = mat !== M.grass && mat !== M.asphalt && mat !== M.chips; m.matrixAutoUpdate = false; m.updateMatrix(); root.add(m); }
  accs.clear();

  // ---------- roofs ----------
  const roofBox = (x0, y0, x1, y1, h = WALL_H + EAVE, gable = true) => {
    const ax = x0 * T - 0.4, bx = (x1 + 1) * T + 0.4, az = y0 * T - 0.4, bz = (y1 + 1) * T + 0.4, cx = (ax + bx) / 2, wdt = bx - ax, len = bz - az;
    if (gable) {
      const rise = wdt * 0.35, sl = Math.hypot(wdt / 2, rise), ang = Math.atan2(rise, wdt / 2);
      for (const s of [-1, 1]) { const p = GO.mesh(new THREE.BoxGeometry(sl, 0.12, len), M.shingles, root, cx + s * wdt / 4, h + rise / 2, (az + bz) / 2); p.rotation.z = -s * ang; }
      const tri = new THREE.Shape([new THREE.Vector2(-wdt / 2, 0), new THREE.Vector2(wdt / 2, 0), new THREE.Vector2(0, rise)]);
      for (const z of [az + 0.01, bz - 0.01]) GO.mesh(new THREE.ShapeGeometry(tri), M.siding, root, cx, h, z).material.side = THREE.DoubleSide;
    } else GO.mesh(new THREE.BoxGeometry(wdt, 0.2, len), M.shingles, root, cx, h + 0.1, (az + bz) / 2);
    GO.mesh(new THREE.BoxGeometry(wdt, 0.2, len), M.trim, root, cx, h - 0.05, (az + bz) / 2).receiveShadow = true;
  };
  roofBox(2, 2, 12, 18); roofBox(17, 3, 20, 5, WALL_H + EAVE, false); roofBox(25, 3, 32, 7, WALL_H + EAVE, false); roofBox(53, 33, 58, 36, WALL_H + EAVE, false);

  // ---------- prop helpers ----------
  const box = (w, h, d, mat, x, y, z, opts = {}) => {
    const m = GO.mesh(new THREE.BoxGeometry(w, h, d), mat, opts.parent || root, x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    if (opts.col) { const sw = Math.abs(Math.round(Math.sin(opts.ry || 0))) ? d : w, sd = Math.abs(Math.round(Math.sin(opts.ry || 0))) ? w : d; L.addCollider(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2, opts.nav !== false); }
    return m;
  };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 12, opts = {}) => {
    const m = GO.mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, opts.parent || root, x, y, z);
    if (opts.col) L.addCollider(x - rb, x + rb, z - rb, z + rb, opts.nav !== false);
    return m;
  };
  // inside face of a tile edge: point on the wall, normal into the tile, yaw
  const wallFrame = (tx, ty, side, off = 0) => {
    const c = W3(tx + 0.5, ty + 0.5), nrm = { n: V(0, 0, 1), s: V(0, 0, -1), w: V(1, 0, 0), e: V(-1, 0, 0) }[side];
    const p = c.clone().addScaledVector(nrm, -T / 2 + TH); const along = V(-nrm.z, 0, nrm.x); p.addScaledVector(along, off);
    return { p, nrm, along, yaw: Math.atan2(nrm.x, nrm.z) };
  };

  // ---------- decals ----------
  const decalMats = {};
  const dmat = (kind) => {
    if (!decalMats[kind]) decalMats[kind] = Array.from({ length: kind === 'pool' ? 3 : 4 }, () => new THREE.MeshStandardMaterial({ map: TX.decalTex(kind), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, roughness: 0.15, metalness: 0 }));
    return decalMats[kind][(R() * decalMats[kind].length) | 0];
  };
  L.decalFloor = (x, z, w, d, kind, rot = R() * 6.28, mat) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat || dmat(kind)); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, 0.006 + R() * 0.004, z); m.receiveShadow = true; L.decals.add(m); return m; };
  L.decalWall = (tx, ty, side, off, y, w, h, kind, mat) => { const f = wallFrame(tx, ty, side, off); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || dmat(kind)); m.position.copy(f.p).addScaledVector(f.nrm, 0.012); m.position.y = y; m.rotation.y = f.yaw; m.receiveShadow = true; L.decals.add(m); return m; };
  L.writing = (tx, ty, side, off, y, text, w = 1.8, h = 0.6) => L.decalWall(tx, ty, side, off, y, w, h, null, new THREE.MeshStandardMaterial({ map: TX.writingTex(text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, roughness: 0.2 }));
  const trail = (ax, az, bx, bz, w = 0.6) => { const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / 1.8)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; L.decalFloor(ax + dx * t + (R() - 0.5) * 0.12, az + dz * t + (R() - 0.5) * 0.12, len / n * 1.15, w, 'trail', -Math.atan2(dz, dx) + (R() - 0.5) * 0.15); } };
  const pool = (x, z, s = 1.1) => L.decalFloor(x, z, s, s, 'pool');
  const splat = (x, z, s = 0.8) => L.decalFloor(x, z, s, s, 'splat');

  // ---------- blood drips ----------
  const DMAX = 600, dpos = new Float32Array(DMAX * 3), dvel = new Float32Array(DMAX * 3), dlife = new Float32Array(DMAX);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dpts = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x5a0000, size: 0.025, sizeAttenuation: true })); dpts.frustumCulled = false; root.add(dpts);
  for (let i = 0; i < DMAX; i++) dpos[i * 3 + 1] = -50;
  let dnext = 0; const emitters = [];
  const spawnDrop = (x, y, z, vx = 0, vy = 0, vz = 0) => { const i = dnext; dnext = (dnext + 1) % DMAX; dpos[i * 3] = x; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = z; dvel[i * 3] = vx; dvel[i * 3 + 1] = vy; dvel[i * 3 + 2] = vz; dlife[i] = 4; };
  L.dripEmitter = (obj, rate, local = V(0, 0, 0)) => emitters.push({ obj, rate, local, acc: R() });
  L.burst = (p, n = 40, sp = 3) => { for (let i = 0; i < n; i++) spawnDrop(p.x, p.y, p.z, (Math.random() - 0.5) * sp, Math.random() * sp * 0.8, (Math.random() - 0.5) * sp); };
  const _w = V(0, 0, 0);
  L.updaters.push((dt) => {
    const cam = G.camera.position;
    for (const e of emitters) { e.acc += dt * e.rate; while (e.acc > 1) { e.acc -= 1; _w.copy(e.local); e.obj.localToWorld(_w); if (_w.distanceToSquared(cam) < 900) spawnDrop(_w.x + (Math.random() - 0.5) * 0.03, _w.y, _w.z + (Math.random() - 0.5) * 0.03); } }
    for (let i = 0; i < DMAX; i++) {
      if (dlife[i] <= 0) continue;
      dlife[i] -= dt; dvel[i * 3 + 1] -= 9.8 * dt;
      dpos[i * 3] += dvel[i * 3] * dt; dpos[i * 3 + 1] += dvel[i * 3 + 1] * dt; dpos[i * 3 + 2] += dvel[i * 3 + 2] * dt;
      if (dpos[i * 3 + 1] < 0.01) { dlife[i] = 0; const dx = dpos[i * 3] - cam.x, dz = dpos[i * 3 + 2] - cam.z; if (dx * dx + dz * dz < 25 && Math.random() < 0.12) AU.drip(V(dpos[i * 3], 0, dpos[i * 3 + 2]), 0.05); dpos[i * 3 + 1] = -50; }
    }
    dgeo.attributes.position.needsUpdate = true;
  });

  // ---------- hanging bodies ----------
  L.hang = (wx, wz, kind, opts = {}) => {
    const h = GO.hangingBody(kind, opts);
    h.pivot.position.set(wx, opts.y ?? (WALL_H - 0.1), wz); h.pivot.rotation.y = opts.ry ?? R() * 6.28; root.add(h.pivot);
    if (!opts.noBake) GO.bake(h.pivot);
    const hg = { ...h, ax: 0, az: 0, vx: (R() - 0.5) * 0.1, vz: (R() - 0.5) * 0.1, x: wx, z: wz, chainT: 0, baseRy: h.pivot.rotation.y };
    L.hangers.push(hg);
    const low = new THREE.Object3D(); low.position.set(0, h.lowest + 0.05, 0.05); h.pivot.add(low);
    L.dripEmitter(low, opts.drip ?? (0.4 + R() * 1.2));
    const groundY = (opts.y ?? WALL_H - 0.1) + h.lowest; if (groundY < 1.5) pool(wx + (R() - 0.5) * 0.2, wz + (R() - 0.5) * 0.2, 0.9 + R() * 0.6);
    return hg;
  };
  L.updaters.push((dt) => {
    const pp = G.player?.pos, mp = G.monster?.active ? G.monster.pos : null;
    for (const h of L.hangers) {
      if (h.dropped) continue;
      for (const q of [pp, mp]) { if (!q) continue; const dx = h.x - q.x, dz = h.z - q.z, d = Math.hypot(dx, dz); if (d < 0.55 && d > 0.001) { h.vx += dz / d * dt * 2.2 * (q === mp ? 2.5 : 1); h.vz -= dx / d * dt * 2.2 * (q === mp ? 2.5 : 1); if (G.time > h.chainT) { AU.chain(V(h.x, 2.4, h.z), q === mp ? 0.3 : 0.15); h.chainT = G.time + 1.2; } } }
      const wind = L.isIndoorAt(h.x, h.z) ? 0 : 0.25;
      h.vx += (-h.ax * 3.2 - h.vx * 0.35) * dt + (Math.random() - 0.5) * dt * (0.04 + wind); h.vz += (-h.az * 3.2 - h.vz * 0.35) * dt + (Math.random() - 0.5) * dt * (0.04 + wind);
      h.ax += h.vx * dt; h.az += h.vz * dt;
      h.pivot.rotation.set(h.ax, h.baseRy + Math.sin(G.time * 0.3 + h.x) * (0.05 + wind), h.az, 'YXZ');
    }
  });

  // ---------- hiding spots (wardrobes, closets, stalls) ----------
  const hideMats = { wardrobe: M.paintedWood(0x5a3a26), closet: M.paintedWood(0xb8b0a0), stall: M.blueM, locker: M.metal };
  const inside = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 });
  L.addLocker = (tx, ty, side, off, opts = {}) => {
    const kind = opts.kind || 'wardrobe', f = wallFrame(tx, ty, side, off), w = kind === 'stall' ? 0.95 : 0.9, h = kind === 'stall' ? 2.0 : 2.05, dep = kind === 'stall' ? 1.2 : 0.6;
    const g = new THREE.Group(); g.position.copy(f.p).addScaledVector(f.nrm, dep / 2); g.rotation.y = f.yaw; root.add(g);
    const mat = opts.bloody ? M.paintedWood(0x4a1a12) : hideMats[kind];
    GO.mesh(new THREE.BoxGeometry(w, h, 0.03), mat, g, 0, h / 2, -dep / 2 + 0.015);
    GO.mesh(new THREE.BoxGeometry(0.03, h, dep), mat, g, -w / 2 + 0.015, h / 2, 0); GO.mesh(new THREE.BoxGeometry(0.03, h, dep), mat, g, w / 2 - 0.015, h / 2, 0);
    if (kind !== 'stall') { GO.mesh(new THREE.BoxGeometry(w + 0.06, 0.06, dep + 0.04), mat, g, 0, h, 0); GO.mesh(new THREE.BoxGeometry(w, 0.08, dep), mat, g, 0, 0.04, 0); GO.mesh(new THREE.BoxGeometry(w - 0.06, h - 0.1, 0.01), inside, g, 0, h / 2, -dep / 2 + 0.04); }
    else { GO.mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.4, 12), M.porcelain, g, 0, 0.2, -0.3); GO.mesh(new THREE.BoxGeometry(0.4, 0.4, 0.18), M.porcelain, g, 0, 0.55, -0.52); }
    const dp = new THREE.Group(); dp.position.set(-w / 2, kind === 'stall' ? 0.25 : 0, dep / 2); g.add(dp); dp.userData.noBake = true;
    const dh = kind === 'stall' ? 1.65 : h - 0.06;
    GO.mesh(new THREE.BoxGeometry(w - 0.02, dh, 0.03), mat, dp, w / 2, dh / 2 + (kind === 'stall' ? 0 : 0.03), 0);
    if (kind === 'wardrobe' || kind === 'closet') { for (let i = 0; i < 6; i++) GO.mesh(new THREE.BoxGeometry(w * 0.6, 0.015, 0.035), M.black, dp, w / 2, 0.9 + i * 0.09, 0.01); GO.mesh(new THREE.SphereGeometry(0.025, 8, 6), M.chrome, dp, w - 0.1, 1.05, 0.03); }
    GO.bake(g);
    const world = g.position.clone();
    L.addCollider(world.x - (Math.abs(f.nrm.x) ? dep / 2 : w / 2), world.x + (Math.abs(f.nrm.x) ? dep / 2 : w / 2), world.z - (Math.abs(f.nrm.z) ? dep / 2 : w / 2), world.z + (Math.abs(f.nrm.z) ? dep / 2 : w / 2), false);
    const lk = { group: g, door: dp, hide: !!opts.hide, special: opts.special, nrm: f.nrm.clone(), yaw: f.yaw, kind, pos: world.clone(), front: world.clone().addScaledVector(f.nrm, dep / 2 + 0.5), inside: world.clone().setY(1.5).addScaledVector(f.nrm, kind === 'stall' ? 0.2 : 0.05), doorTarget: 0, doorAngle: 0, used: false };
    L.lockers.push(lk);
    const verb = { wardrobe: 'Hide in the wardrobe', closet: 'Hide in the closet', stall: 'Hide in the stall', locker: 'Hide in the locker' }[kind];
    if (lk.hide || lk.special) L.interact.push({ pos: world.clone().setY(1.2), r: 1.7, locker: lk, prompt: () => lk.special ? (lk.used ? null : 'Open') : verb, act: () => lk.special ? L.onItem?.(lk.special, lk) : G.player.enterLocker(lk) });
    return lk;
  };
  L.updaters.push((dt) => { for (const l of L.lockers) { l.doorAngle += (l.doorTarget - l.doorAngle) * Math.min(1, dt * 9); l.door.rotation.y = -l.doorAngle; } });

  // ---------- lights ----------
  const FIX = {
    street: { color: 0xffa25a, int: 60, dist: 18 }, lamp: { color: 0xffb070, int: 14, dist: 9 }, bulb: { color: 0xffd8a8, int: 16, dist: 9 }, tv: { color: 0x7a9aff, int: 12, dist: 8 },
    fridge: { color: 0xd8f0ff, int: 10, dist: 6 }, fluoro: { color: 0xd8ffe6, int: 24, dist: 10 }, red: { color: 0xff2410, int: 16, dist: 10 }, porch: { color: 0xffe0a0, int: 14, dist: 9 }, candle: { color: 0xffa040, int: 6, dist: 6 }, car: { color: 0xffe8c8, int: 30, dist: 14 },
  };
  L.fixture = (tx, ty, type, flicker = 0, opts = {}) => {
    const d = FIX[type], pos = W3(tx, ty, opts.y ?? WALL_H - 0.05);
    const mat = new THREE.MeshBasicMaterial({ color: d.color }); let m;
    if (type === 'street') { // a park lamp post
      cyl(0.06, 0.09, 4.2, M.metal, pos.x, 2.1, pos.z, 10, { col: true, nav: false }); cyl(0.14, 0.16, 0.3, M.metal, pos.x, 0.15, pos.z, 10);
      m = GO.mesh(new THREE.SphereGeometry(0.15, 14, 10), mat, root, pos.x, 4.25, pos.z); box(0.4, 0.06, 0.4, M.metal, pos.x, 4.42, pos.z); GO.mesh(new THREE.ConeGeometry(0.28, 0.2, 4), M.metal, root, pos.x, 4.55, pos.z).rotation.y = Math.PI / 4;
      pos.y = 4.1;
    } else if (type === 'fluoro') { m = GO.mesh(new THREE.BoxGeometry(1.2, 0.05, 0.12), mat, root, pos.x, pos.y - 0.04, pos.z); if (opts.ry) m.rotation.y = opts.ry; }
    else if (type === 'tv' || type === 'fridge' || type === 'car') { m = GO.mesh(new THREE.SphereGeometry(0.01, 3, 2), mat, root, pos.x, pos.y, pos.z); m.visible = false; }
    else if (type === 'candle') { m = GO.mesh(new THREE.ConeGeometry(0.015, 0.05, 5), mat, root, pos.x, pos.y, pos.z); cyl(0.02, 0.025, 0.18, M.porcelain, pos.x, pos.y - 0.12, pos.z, 8); }
    else { // ceiling bulb with a shade, or a table lamp
      if (opts.table) { m = GO.mesh(new THREE.SphereGeometry(0.06, 10, 8), mat, root, pos.x, pos.y, pos.z); GO.mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.22, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8d8b0, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x3a2a10 }), root, pos.x, pos.y + 0.05, pos.z); cyl(0.015, 0.05, pos.y - 0.75, M.metal, pos.x, 0.75 + (pos.y - 0.75) / 2, pos.z, 8); }
      else { m = GO.mesh(new THREE.SphereGeometry(0.06, 10, 8), mat, root, pos.x, pos.y - 0.32, pos.z); cyl(0.006, 0.006, 0.3, M.black, pos.x, pos.y - 0.15, pos.z, 4); GO.mesh(new THREE.ConeGeometry(0.2, 0.15, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3630, side: THREE.DoubleSide, roughness: 0.6 }), root, pos.x, pos.y - 0.27, pos.z); pos.y -= 0.36; }
    }
    m.castShadow = false;
    const fx = { pos, type, def: d, flicker, dead: !!opts.dead, forced: null, on: true, t: R() * 3, cur: 1, mesh: m, mat, base: new THREE.Color(d.color), room: L.roomAt(pos.x, pos.z), int: opts.int ?? d.int };
    L.fixtures.push(fx); return fx;
  };
  const POOL = 8, lights = [];
  for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.castShadow = false; root.add(l); lights.push(l); }
  let assignT = 0, assigned = [];
  L.updaters.push((dt) => {
    for (const f of L.fixtures) {
      if (f.forced !== null) f.on = !!f.forced; else if (f.dead) f.on = false;
      else if (f.flicker > 0) { f.t -= dt; if (f.t <= 0) { f.on = !f.on; f.t = f.on ? rr(0.1, 5) * (1.05 - f.flicker) + 0.05 : rr(0.02, 0.18) * (f.flicker > 0.6 ? 3 : 1); } }
      else f.on = true;
      const tvish = f.type === 'tv' ? 0.5 + Math.random() * 0.5 : 1;
      const target = f.on ? tvish * (f.type === 'fluoro' ? 0.93 + Math.random() * 0.07 : 1) : 0;
      f.cur = f.type === 'tv' || f.type === 'fluoro' ? target : f.cur + (target - f.cur) * Math.min(1, dt * 25);
      f.mat.color.copy(f.base).multiplyScalar(0.05 + f.cur * 2.5);
    }
    assignT -= dt; const cam = G.camera.position;
    if (assignT <= 0) {
      assignT = 0.2;
      const cand = L.fixtures.filter(f => !f.dead || f.forced).map(f => ({ f, d: f.pos.distanceTo(cam) })).filter(o => o.d < 34 && (o.d < 5 || L.los(cam, o.f.pos)));
      cand.sort((a, b) => a.d - b.d); assigned = cand.slice(0, POOL).map(o => o.f);
    }
    for (let i = 0; i < POOL; i++) { const f = assigned[i], l = lights[i]; if (!f) { l.intensity = 0; continue; } l.position.copy(f.pos); l.position.y -= 0.1; l.color.copy(f.base); l.distance = f.def.dist; l.intensity = f.int * f.cur; }
    let best = null, bd = 1e9; for (const f of L.fixtures) { if (f.type !== 'fluoro' || !f.on) continue; const dd = f.pos.distanceTo(cam); if (dd < bd) { bd = dd; best = f; } }
    AU.setBuzz(best?.pos, best && bd < 10 ? (best.flicker > 0.3 ? 1 : 0.4) : 0);
  });
  L.litAt = (p) => { for (const f of L.fixtures) if (f.cur > 0.5 && Math.hypot(f.pos.x - p.x, f.pos.z - p.z) < f.def.dist * 0.4) return true; return false; };

  // ---------- items ----------
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xc0a050, roughness: 0.25, metalness: 1 }), paperMat = new THREE.MeshStandardMaterial({ map: TX.paperTex(), side: THREE.DoubleSide, roughness: 0.9 });
  L.addItem = (id, kind, x, y, z, prompt) => {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    if (kind === 'keys') { GO.mesh(new THREE.TorusGeometry(0.025, 0.004, 6, 16), M.chrome, g, 0, 0.005, 0).rotation.x = Math.PI / 2; GO.mesh(new THREE.BoxGeometry(0.06, 0.006, 0.02), keyMat, g, 0.05, 0.005, 0.01); GO.mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), M.black, g, -0.04, 0.008, 0.02); }
    else if (kind === 'gas') { GO.mesh(new THREE.BoxGeometry(0.3, 0.32, 0.16), M.red, g, 0, 0.16, 0); cyl(0.025, 0.025, 0.12, M.black, x, 0, z, 6, { parent: g }).position.set(0.1, 0.36, 0); box(0.14, 0.03, 0.04, M.black, -0.03, 0.34, 0, { parent: g }); }
    else if (kind === 'battery') { GO.mesh(new THREE.BoxGeometry(0.3, 0.2, 0.17), M.black, g, 0, 0.1, 0); for (const s of [-1, 1]) cyl(0.015, 0.015, 0.03, s < 0 ? M.red : M.metal, 0, 0, 0, 8, { parent: g }).position.set(s * 0.09, 0.215, 0); }
    else if (kind === 'key') { GO.mesh(new THREE.TorusGeometry(0.02, 0.005, 6, 12), keyMat, g, -0.04, 0.005, 0).rotation.x = Math.PI / 2; GO.mesh(new THREE.BoxGeometry(0.07, 0.006, 0.012), keyMat, g, 0.02, 0.005, 0); }
    else if (kind === 'cell') { GO.mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.4 }), g).rotation.z = Math.PI / 2; }
    else if (kind === 'flashlight') { GO.mesh(new THREE.CylinderGeometry(0.03, 0.026, 0.22, 10), M.black, g).rotation.z = Math.PI / 2; GO.mesh(new THREE.CircleGeometry(0.028, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), g, 0.111, 0, 0).rotation.y = Math.PI / 2; g.position.y += 0.03; }
    else if (kind === 'note') { const p = GO.mesh(new THREE.PlaneGeometry(0.2, 0.26), paperMat, g); p.rotation.x = -Math.PI / 2; p.rotation.z = R() * 0.6 - 0.3; }
    else if (kind === 'wallnote') GO.mesh(new THREE.PlaneGeometry(0.22, 0.3), paperMat, g);
    if (['keys', 'gas', 'battery'].includes(kind)) { const gl = new THREE.PointLight(0xffd090, 0.5, 1.4, 2); gl.position.y = 0.3; g.add(gl); g.userData.glow = gl; }
    const names = { flashlight: 'Take the flashlight', keys: 'Take the car keys', gas: 'Take the gas can', battery: 'Take the car battery', key: 'Take the key', cell: 'Take batteries', note: 'Read', wallnote: 'Read' };
    const it = { id, kind, group: g, pos: g.position.clone(), r: 1.8, on: true, prompt: () => prompt || names[kind], act: () => L.onItem?.(id, it) };
    L.interact.push(it); L.items[id] = it; return it;
  };
  L.removeItem = (it) => { it.on = false; it.group.visible = false; const i = L.interact.indexOf(it); if (i >= 0) L.interact.splice(i, 1); };
  L.updaters.push(() => { for (const id in L.items) { const it = L.items[id]; if (it.group.userData.glow && it.on) it.group.userData.glow.intensity = 0.35 + Math.sin(G.time * 3) * 0.2; } });

  const H = { box, cyl, wallFrame, trail, pool, splat, M, step };
  await furnish(L, H);
  await step('Planting the trees', 0.86);
  plantNature(L, H);
  return L;
}

// ---------------------------------------------------------------- trees and grass
function bareTree(M) {
  // a trunk and recursive bare branches as one geometry, plus a few clumps of dead leaves
  const geos = [], leaves = [];
  const branch = (from, dir, len, r, depth) => {
    const to = from.clone().addScaledVector(dir, len);
    const g = new THREE.CylinderGeometry(r * 0.65, r, len, depth < 2 ? 9 : 5, 1); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir)); g.translate(from.x, from.y, from.z); geos.push(g);
    if (depth >= 4 || r < 0.02) { if (R() < 0.5) leaves.push(to); return; }
    const n = depth === 0 ? 4 : 2 + (R() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone().add(V(rr(-0.9, 0.9), rr(-0.1, 0.6), rr(-0.9, 0.9))).normalize();
      branch(to.clone().addScaledVector(dir, -len * rr(0, 0.25)), nd, len * rr(0.55, 0.75), r * 0.62, depth + 1);
    }
  };
  branch(V(0, -0.2, 0), V(rr(-0.06, 0.06), 1, rr(-0.06, 0.06)).normalize(), rr(2.6, 3.6), rr(0.2, 0.3), 0);
  const merged = mergeGeos(geos);
  return { trunk: merged, leaves };
}
function mergeGeos(geos) {
  let n = 0; const ng = geos.map(g => g.index ? g.toNonIndexed() : g); for (const g of ng) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let o = 0;
  for (const g of ng) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.BufferAttribute(U, 2)); out.computeBoundingSphere(); return out;
}
function leafCardTex() {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  for (let i = 0; i < 60; i++) { const px = n / 2 + rr(-40, 40), py = n / 2 + rr(-40, 40); x.fillStyle = `rgb(${rr(60, 110) | 0},${rr(40, 70) | 0},${rr(15, 30) | 0})`; x.save(); x.translate(px, py); x.rotate(R() * 6.28); x.beginPath(); x.ellipse(0, 0, rr(5, 9), rr(2.5, 4), 0, 0, 6.28); x.fill(); x.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function plantNature(L, H) {
  const { M } = H; const root = L.root;
  // tree templates
  const temps = [bareTree(M), bareTree(M), bareTree(M)];
  const spots = []; // [x, z, scale, template]
  const okSpot = (x, z, pad) => { const [tx, ty] = [Math.floor(x / T), Math.floor(z / T)]; const r = L.room[ty]?.[tx]; return r; };
  // woods: dense trees on solid woods cells near the edge of the playable area, so the skyline is all branches
  for (let y = 0; y < 46; y++) for (let x = 0; x < 66; x++) {
    if (L.solid[y][x] !== 'woods') continue;
    let near = false; for (let dy = -3; dy <= 3 && !near; dy++) for (let dx = -3; dx <= 3; dx++) if (L.room[y + dy]?.[x + dx] && !['garage', 'living', 'kitchen', 'hall', 'master', 'bath', 'study', 'kid', 'laundry', 'guest'].includes(L.room[y + dy][x + dx])) { near = true; break; }
    if (near && R() < 0.55) spots.push([(x + rr(0.2, 0.8)) * T, (y + rr(0.2, 0.8)) * T, rr(0.9, 1.5), (R() * 3) | 0, false]);
  }
  // lawn trees (these ones you can hide behind)
  for (let i = 0; i < 70; i++) {
    const x = rr(22.5, 63.5) * T, z = rr(1.5, 44.5) * T, [tx, ty] = toTile(x, z), r = L.room[ty]?.[tx];
    if (r !== 'lawn' && r !== 'yard') continue;
    let bad = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = L.room[ty + dy]?.[tx + dx]; if (q !== 'lawn' && q !== 'yard') bad = true; }
    if (bad || spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 4)) continue;
    spots.push([x, z, rr(0.85, 1.25), (R() * 3) | 0, true]);
  }
  for (const [x, z, s, , col] of spots) if (col) { L.trees.push({ x, z, r: 0.28 * s }); L.addCollider(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s, false); }
  const leafMat = new THREE.MeshStandardMaterial({ map: leafCardTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 });
  const leafGeo = new THREE.PlaneGeometry(1.4, 1.4);
  temps.forEach((tp, ti) => {
    const mine = spots.filter(s => s[3] === ti); if (!mine.length) return;
    const im = new THREE.InstancedMesh(tp.trunk, M.bark, mine.length); im.castShadow = true; im.receiveShadow = true;
    const lm = new THREE.InstancedMesh(leafGeo, leafMat, mine.length * tp.leaves.length * 2); lm.castShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); let li = 0;
    mine.forEach(([x, z, s], i) => {
      const ry = R() * 6.28; q.setFromAxisAngle(V(0, 1, 0), ry); sc.setScalar(s); m4.compose(V(x, 0, z), q, sc); im.setMatrixAt(i, m4);
      for (const lp of tp.leaves) for (let k = 0; k < 2; k++) {
        const p = lp.clone().applyQuaternion(q).multiplyScalar(s).add(V(x, 0, z)); const lq = new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 3, R() * 3, R() * 3));
        m4.compose(p, lq, sc.setScalar(s * rr(0.6, 1.1))); lm.setMatrixAt(li++, m4); sc.setScalar(s);
      }
    });
    lm.count = li; root.add(im); root.add(lm);
  });
  L.treeSpots = spots;
  // tufts of long grass on the lawns and in the yard
  const gc = document.createElement('canvas'); gc.width = 64; gc.height = 64; const gx = gc.getContext('2d');
  for (let i = 0; i < 26; i++) { const x0 = rr(4, 60); gx.strokeStyle = `rgb(${rr(40, 80) | 0},${rr(60, 100) | 0},${rr(20, 40) | 0})`; gx.lineWidth = rr(1.5, 3); gx.beginPath(); gx.moveTo(x0, 64); gx.quadraticCurveTo(x0 + rr(-6, 6), 30, x0 + rr(-14, 14), rr(4, 24)); gx.stroke(); }
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const tuft = new THREE.PlaneGeometry(0.6, 0.45); tuft.translate(0, 0.22, 0); const t2 = tuft.clone().rotateY(Math.PI / 2); const tg = mergeGeos([tuft, t2]);
  const gm = new THREE.MeshStandardMaterial({ map: gt, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  const pts = [];
  for (let y = 0; y < 46; y++) for (let x = 0; x < 66; x++) { const r = L.room[y][x]; if (r !== 'lawn' && r !== 'yard') continue; for (let k = 0; k < 3; k++) pts.push([(x + R()) * T, (y + R()) * T]); }
  const gi = new THREE.InstancedMesh(tg, gm, pts.length); gi.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  pts.forEach(([x, z], i) => { q.setFromAxisAngle(V(0, 1, 0), R() * 3); const s = rr(0.6, 1.4); m4.compose(V(x, 0, z), q, V(s, s * rr(0.7, 1.4), s)); gi.setMatrixAt(i, m4); });
  root.add(gi);
}
