// Furnishing Hollow Lane and Hollow Park: furniture, playground, pond, gazebo, the dead.
import * as THREE from 'three';
import { G, T, WALL_H, R, W3, rr } from './state.js';
import * as GO from './gore.js';
import * as TX from './textures.js';
import * as AU from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const pick = a => a[(R() * a.length) | 0];

export async function furnish(L, H) {
  const { box, cyl, trail, pool, splat, M, step } = H;
  const root = L.root, w = t => t * T, mats = GO.goreMats();
  const wood = M.paintedWood(0x6a4a30), darkWood = M.paintedWood(0x3a2618), white = M.paintedWood(0xd8d2c4), cream = M.paintedWood(0xcfc6aa);
  const group = (x, z, ry = 0) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g); return g; };
  const gm = (g, geo, mat, x, y, z) => GO.mesh(geo, mat, g, x, y, z);
  const B = (g, w_, h, d, mat, x, y, z) => gm(g, new THREE.BoxGeometry(w_, h, d), mat, x, y, z);
  const C = (g, rt, rb, h, mat, x, y, z, seg = 12) => gm(g, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);
  const solidAt = (x, z, hw, hd, nav = true) => L.addCollider(x - hw, x + hw, z - hd, z + hd, nav);
  const drip = (parent, x, y, z, rate) => { const e = new THREE.Object3D(); e.position.set(x, y, z); parent.add(e); L.dripEmitter(e, rate); return e; };

  // ---------- furniture ----------
  const table = (x, z, lx, lz, h = 0.76, mat = wood, ry = 0) => { const g = group(x, z, ry); B(g, lx, 0.05, lz, mat, 0, h, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.06, h, 0.06, mat, sx * (lx / 2 - 0.06), h / 2, sz * (lz / 2 - 0.06)); GO.bake(g); const c = Math.abs(Math.sin(ry)) > 0.5; solidAt(x, z, (c ? lz : lx) / 2, (c ? lx : lz) / 2); return g; };
  const chair = (x, z, ry, mat = wood, fallen = false) => { const g = group(x, z, ry); B(g, 0.45, 0.05, 0.45, mat, 0, 0.46, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.04, 0.46, 0.04, mat, sx * 0.19, 0.23, sz * 0.19); B(g, 0.45, 0.5, 0.04, mat, 0, 0.72, -0.2); if (fallen) { g.rotation.x = -1.4; g.position.y = 0.22; } GO.bake(g); return g; };
  const bed = (x, z, ry, dbl, opts = {}) => {
    const wd = dbl ? 1.6 : 1.0, g = group(x, z, ry);
    B(g, wd, 0.3, 2.05, darkWood, 0, 0.25, 0); B(g, wd - 0.06, 0.2, 1.95, M.mattress, 0, 0.5, 0.02); B(g, wd, 0.95, 0.06, darkWood, 0, 0.48, -1.03);
    B(g, wd * 0.36, 0.1, 0.4, M.sheet, -wd * 0.22, 0.65, -0.78); if (dbl) B(g, wd * 0.36, 0.1, 0.4, M.sheet, wd * 0.22, 0.65, -0.78);
    if (opts.quilt) B(g, wd - 0.02, 0.06, 1.3, opts.quilt, 0, 0.62, 0.32);
    if (opts.shroud) { B(g, wd * 0.55, 0.22, 1.5, M.sheet, 0, 0.72, 0.15); gm(g, new THREE.SphereGeometry(0.16, 12, 9), M.sheet, 0, 0.72, -0.62); const arm = new THREE.Group(); arm.position.set(wd / 2 + 0.02, 0.62, -0.1); g.add(arm); GO.limb(arm, V(0, 0, 0), V(0.05, -0.38, 0.05), 0.04, 0.035, mats.skinGrey); GO.ball(arm, V(0.06, -0.43, 0.06), 0.04, mats.skinGrey, 0.8, 1.4, 0.5); }
    if (opts.body) { const c = GO.tableCorpse({ open: true, missing: opts.missing || ['rArmLower'] }); c.position.y = -0.28; g.add(c); }
    GO.bake(g); const c = Math.abs(Math.sin(ry)) > 0.5; solidAt(x, z, c ? 1.05 : wd / 2, c ? wd / 2 : 1.05); return g;
  };
  const sofa = (x, z, ry, mat = M.sofa) => { const g = group(x, z, ry); B(g, 2.0, 0.42, 0.85, mat, 0, 0.21, 0); B(g, 2.0, 0.5, 0.2, mat, 0, 0.62, -0.33); for (const s of [-1, 1]) B(g, 0.2, 0.62, 0.85, mat, s * 0.9, 0.31, 0); for (const s of [-0.5, 0.5]) B(g, 0.8, 0.14, 0.62, mat, s, 0.48, 0.06); GO.bake(g); const c = Math.abs(Math.sin(ry)) > 0.5; solidAt(x, z, c ? 0.43 : 1, c ? 1 : 0.43); return g; };
  const shelf = (x, z, ry, books = true, wdt = 1.0) => { const g = group(x, z, ry); B(g, wdt, 2.0, 0.35, darkWood, 0, 1.0, 0); for (let s = 0; s < 5; s++) { B(g, wdt - 0.04, 0.03, 0.32, wood, 0, 0.1 + s * 0.42, 0.02); if (books) for (let b = 0; b < 9; b++) if (R() < 0.8) { const hh = 0.22 + R() * 0.12; B(g, 0.06 + R() * 0.03, hh, 0.22, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(R() * 0.12, 0.35, 0.12 + R() * 0.15), roughness: 0.8 }), -wdt / 2 + 0.08 + b * (wdt - 0.12) / 9, 0.12 + s * 0.42 + hh / 2, 0.03); } } GO.bake(g); const c = Math.abs(Math.sin(ry)) > 0.5; solidAt(x, z, c ? 0.18 : wdt / 2, c ? wdt / 2 : 0.18, false); return g; };
  const frame = (tx, ty, side, off, y, s = 0.4) => { const f = H.wallFrame(tx, ty, side, off), g = new THREE.Group(); g.position.copy(f.p).addScaledVector(f.nrm, 0.02); g.position.y = y; g.rotation.y = f.yaw; root.add(g); B(g, s, s * 1.25, 0.03, darkWood, 0, 0, 0); B(g, s * 0.8, s * 1.05, 0.01, new THREE.MeshStandardMaterial({ map: photoTex(), roughness: 0.3 }), 0, 0, 0.016); };
  const counter = (x, z, lx, lz, opts = {}) => { const g = group(x, z); B(g, lx, 0.88, lz, cream, 0, 0.44, 0); B(g, lx + 0.04, 0.04, lz + 0.04, new THREE.MeshStandardMaterial({ color: 0x5a5650, roughness: 0.35 }), 0, 0.9, 0); GO.bake(g); solidAt(x, z, lx / 2, lz / 2); return g; };
  const lamp = (tx, ty, type = 'bulb', flicker = 0, o = {}) => L.fixture(tx, ty, type, flicker, o);

  // ===================== THE HOUSE =====================
  await step('Furnishing the house', 0.62);
  // --- hall: where you come in ---
  lamp(7.5, 4, 'bulb', 0.15); lamp(7.5, 11, 'bulb', 0, { dead: true }); L.specials.hallFlicker = lamp(7.5, 16, 'bulb', 0.5);
  table(w(7.5) + 0.62, w(3.6), 0.35, 0.9, 0.8, darkWood);
  L.addItem('flashlight', 'flashlight', w(7.5) + 0.62, 0.84, w(3.4));
  L.addItem('note_dad', 'note', w(7.5) + 0.6, 0.84, w(3.95), 'Read the note');
  for (let y = 5; y <= 17; y += 3) frame(7, y, R() < 0.5 ? 'w' : 'e', 0, 1.6, 0.35);
  trail(w(7.5), w(5), w(7.5), w(15.5), 0.55); L.decalWall(7, 8, 'e', 0, 1.1, 0.8, 0.8, 'hands'); L.decalWall(7, 13, 'w', 0.4, 1.3, 0.9, 1.2, 'drips');
  L.waypoints.push(W3(7.5, 5), W3(7.5, 12), W3(7.5, 17));

  // --- garage ---
  L.specials.lobbyRed = lamp(4.5, 4.5, 'fluoro', 0.35, { ry: Math.PI / 2 });
  { // the car. the hood's up; the battery's gone
    const g = group(w(4.5), w(4.6)), paint = new THREE.MeshStandardMaterial({ color: 0x1e2a36, roughness: 0.28, metalness: 0.7 });
    B(g, 1.8, 0.55, 4.4, paint, 0, 0.58, 0); B(g, 1.6, 0.5, 2.1, paint, 0, 1.1, 0.25);
    B(g, 1.55, 0.42, 2.0, M.glass, 0, 1.12, 0.25);
    for (const [x, z] of [[-0.82, -1.35], [0.82, -1.35], [-0.82, 1.4], [0.82, 1.4]]) { const wh = C(g, 0.34, 0.34, 0.22, M.black, x, 0.34, z, 16); wh.rotation.z = Math.PI / 2; C(g, 0.18, 0.18, 0.23, M.chrome, x, 0.34, z, 10).rotation.z = Math.PI / 2; }
    const hl = new THREE.MeshStandardMaterial({ color: 0xffeecc, emissive: 0x000000, roughness: 0.2 }); L.specials.headlights = hl;
    for (const s of [-1, 1]) { B(g, 0.35, 0.12, 0.05, hl, s * 0.6, 0.7, -2.2); B(g, 0.3, 0.1, 0.05, new THREE.MeshStandardMaterial({ color: 0x5a0808, roughness: 0.3 }), s * 0.62, 0.72, 2.2); }
    const hood = new THREE.Group(); hood.position.set(0, 0.86, -1.0); g.add(hood); B(hood, 1.7, 0.04, 1.15, paint, 0, 0, -0.57); hood.rotation.x = -0.9;
    B(g, 1.5, 0.3, 1.0, M.black, 0, 0.75, -1.6);
    GO.bake(g); solidAt(w(4.5), w(4.6), 0.95, 2.25, true); L.specials.car = g;
    L.specials.panelInteract = { pos: V(w(4.5) - 1.0, 1.0, w(4.6) + 0.2), r: 2.2, prompt: () => L.onPanelPrompt?.(), act: () => L.onItem?.('panel') };
    L.interact.push(L.specials.panelInteract);
    const cl = lamp(4.5, 4.9, 'car', 0, { y: 0.8 }); cl.forced = 0; L.specials.carLight = cl;
  }
  { const g = group(w(2) + 0.35, w(5)); B(g, 0.7, 0.9, 2.4, wood, 0, 0.45, 0); for (let i = 0; i < 6; i++) B(g, 0.03, 0.03 + R() * 0.3, 0.2, M.metal, -0.33, 1.5 + R() * 0.6, -1 + i * 0.4); B(g, 0.04, 1.2, 2.4, M.paintedWood(0x8a7a5a), -0.33, 1.6, 0); GO.bake(g); solidAt(w(2) + 0.35, w(5), 0.35, 1.2); }
  { // the chest freezer, lid up, the light still on
    const g = group(w(6) + 0.4, w(2) + 0.6, Math.PI / 2); B(g, 1.3, 0.85, 0.7, white, 0, 0.43, 0); B(g, 1.2, 0.02, 0.6, M.black, 0, 0.84, 0); const lid = B(g, 1.3, 0.06, 0.7, white, 0, 1.15, -0.36); lid.rotation.x = -1.3;
    for (let i = 0; i < 3; i++) { const p = new THREE.Group(); p.position.set(-0.35 + i * 0.35, 0.82, 0); g.add(p); if (i === 1) GO.severedHead(p, 0, 0, 0, Math.PI, 'grey'); else GO.severedLimb(p, 0, 0, R() * 3, i === 2); }
    GO.bake(g); solidAt(w(6) + 0.4, w(2) + 0.6, 0.35, 0.65); lamp(6.2, 1.3, 'fridge', 0.08, { y: 1.0, int: 4 });
  }
  pool(w(6), w(3), 1.2); trail(w(6.2), w(3.2), w(6.9), w(4.5), 0.5);
  L.addLocker(2, 6, 's', 0.4, { kind: 'locker', hide: true });
  L.waypoints.push(W3(3.5, 3));

  // --- living room ---
  L.specials.tv = lamp(2.6, 9.5, 'tv', 0.6, { y: 0.95 });
  { const g = group(w(2) + 0.3, w(9.5), Math.PI / 2); B(g, 1.2, 0.5, 0.45, darkWood, 0, 0.25, 0); B(g, 0.9, 0.65, 0.55, M.black, 0, 0.82, 0); B(g, 0.78, 0.55, 0.01, new THREE.MeshStandardMaterial({ color: 0x8aa0c8, emissive: 0x6a7ab0, emissiveIntensity: 0.9, roughness: 0.2 }), 0, 0.82, 0.28); GO.bake(g); solidAt(w(2) + 0.3, w(9.5), 0.25, 0.6); }
  sofa(w(5.2), w(9.5), -Math.PI / 2);
  table(w(3.9), w(9.5), 0.6, 1.1, 0.42, darkWood);
  { const c = GO.seatedCorpse(); const g = group(w(3.8), w(11.6), -Math.PI / 2 - 0.5); g.add(c); const ch = new THREE.Group(); g.add(ch); B(ch, 0.8, 0.45, 0.8, M.sofa, 0, 0.22, 0); B(ch, 0.8, 0.6, 0.2, M.sofa, 0, 0.75, -0.32); for (const s of [-1, 1]) B(ch, 0.15, 0.6, 0.8, M.sofa, s * 0.38, 0.4, 0); c.position.z = 0.05; GO.bake(g); solidAt(w(3.8), w(11.6), 0.45, 0.45); pool(w(3.8), w(11.6), 1.4); drip(g, 0, 0.9, 0.2, 2); }
  { const g = group(w(4.5), w(7) + 0.3); B(g, 1.6, 1.1, 0.5, M.cinder, 0, 0.55, 0); B(g, 0.9, 0.7, 0.2, M.black, 0, 0.4, 0.16); B(g, 1.8, 0.08, 0.6, darkWood, 0, 1.12, 0); GO.bonePile(g, 0, 0.14, 4); GO.bake(g); solidAt(w(4.5), w(7) + 0.3, 0.8, 0.25); }
  lamp(6.6, 7.4, 'lamp', 0.08, { y: 1.35, table: true }); table(w(6.6), w(7.4), 0.45, 0.45, 0.72, darkWood);
  shelf(w(6.8), w(11.5), -Math.PI / 2, true, 1.2);
  for (const [tx, ty, s] of [[3, 7, 'n'], [5, 12, 's'], [6, 8, 'e']]) frame(tx, ty, s, 0.2, 1.7, 0.38);
  L.decalFloor(w(4.4), w(9.6), 2.2, 1.6, 'pool'); L.writing(6, 9, 'e', 0, 1.8, 'SMILE FOR DADDY', 1.9, 0.65);
  L.waypoints.push(W3(4.5, 10));

  // --- kitchen / dining ---
  lamp(4.5, 15.5, 'bulb', 0.25);
  counter(w(2) + 0.32, w(15.5), 0.62, 5.6); counter(w(4.5), w(18) + 0.68, 4.2, 0.62);
  { const g = group(w(2) + 0.32, w(14.4)); B(g, 0.5, 0.02, 0.7, M.chrome, 0, 0.91, 0); gm(g, new THREE.CircleGeometry(0.25, 14), mats.bloodLiquid, 0, 0.9, 0).rotation.x = -Math.PI / 2; GO.bake(g); drip(root, w(2) + 0.62, 0.88, w(14.4), 1.5); L.decalWall(2, 14, 'w', 0, 1.3, 1.2, 1.2, 'drips'); }
  { const g = group(w(2) + 0.32, w(16.6)); for (let i = 0; i < 4; i++) C(g, 0.1, 0.1, 0.02, M.black, (i % 2 - 0.5) * 0.3, 0.92, (i < 2 ? -0.2 : 0.2), 12); GO.bake(g); }
  { // the fridge, door open, its light on what's inside
    const g = group(w(5.6), w(18) + 0.4); B(g, 0.85, 1.85, 0.7, white, 0, 0.93, 0); B(g, 0.78, 1.7, 0.02, new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.5 }), 0, 0.93, -0.33);
    const door = B(g, 0.85, 1.8, 0.06, white, -0.42, 0.93, -0.38); door.geometry.translate(0.42, 0, 0); door.rotation.y = -2.0;
    for (let i = 0; i < 3; i++) B(g, 0.78, 0.02, 0.6, M.glass, 0, 0.5 + i * 0.45, 0);
    GO.severedHead(g, -0.15, 1.42, -0.05, Math.PI, 'flayed'); GO.severedLimb(g, 0.1, -0.05, 0.4, false).position.y = 0.98; const ent = GO.entrailsPile(g, 0, -0.05, 0.6); ent.position.y = 0.52;
    GO.bake(g); solidAt(w(5.6), w(18) + 0.4, 0.43, 0.38); lamp(5.6, 18.0, 'fridge', 0.05, { y: 1.1 }); pool(w(5.6), w(17.6), 1.0); drip(root, w(5.6), 0.5, w(18) + 0.05, 1.2);
  }
  { // dinner is served
    table(w(4.6), w(15.2), 1.0, 2.0, 0.76, darkWood);
    B(group(w(4.6), w(15.2)), 0.9, 0.01, 1.9, M.sheet, 0, 0.79, 0);
    for (const [dx, dz, ry] of [[-0.75, -0.5, Math.PI / 2], [-0.75, 0.5, Math.PI / 2], [0.75, -0.5, -Math.PI / 2], [0, 1.2, Math.PI]]) chair(w(4.6) + dx, w(15.2) + dz, ry, darkWood, dx > 0 && dz < 0);
    for (let i = 0; i < 4; i++) {
      const g = group(w(4.6) + (i % 2 - 0.5) * 0.45, w(15.2) - 0.6 + (i >> 1) * 0.9); C(g, 0.17, 0.15, 0.02, M.porcelain, 0, 0.8, 0, 20);
      if (i === 0) GO.severedHead(g, 0, 0.81, 0, R() * 6, 'grey'); else if (i === 1) GO.severedLimb(g, 0, 0, R() * 3, false).position.y = 0.84; else if (i === 2) { gm(g, new THREE.SphereGeometry(0.1, 10, 8), mats.liver, 0, 0.84, 0).scale.set(1.3, 0.5, 1); } else GO.intestines(g, V(0, 0.86, 0), 0.08, 8, 0.022);
      GO.bake(g);
    }
    pool(w(4.6), w(15.2), 2.2);
  }
  L.addItem('cell1', 'cell', w(2) + 0.35, 0.92, w(17.6));
  L.addLocker(6, 17, 'e', 0, { kind: 'closet', hide: true }); // pantry
  L.waypoints.push(W3(4.5, 14), W3(4.5, 17.5));

  // --- master bedroom ---
  lamp(10, 3.5, 'bulb', 0.05, { dead: false });
  bed(w(11.2), w(3.6), -Math.PI / 2, true, { shroud: true, quilt: M.quilt });
  table(w(11.9) + 0.25, w(2.2), 0.45, 0.4, 0.55, darkWood); L.addItem('key', 'key', w(11.9) + 0.25, 0.59, w(2.2), 'Take the small brass key');
  L.addLocker(8, 2, 'n', 0.3, { hide: true }); L.addLocker(9, 2, 'n', 0.2, { special: 'corpseLocker', bloody: true });
  { const g = group(w(8) + 0.3, w(5), Math.PI / 2); B(g, 1.3, 0.85, 0.5, darkWood, 0, 0.43, 0); B(g, 0.9, 1.1, 0.03, M.mirror, 0, 1.45, -0.2); GO.bake(g); solidAt(w(8) + 0.3, w(5), 0.25, 0.65); }
  pool(w(9.6), w(2.8), 1.3); trail(w(9.6), w(3), w(8.2), w(3.3), 0.5); L.writing(12, 4, 'e', 0, 1.9, 'IT WAS ALWAYS IN THE PARK', 1.9, 0.55);
  L.waypoints.push(W3(10, 4));

  // --- bathroom ---
  lamp(10, 6.8, 'bulb', 0.45);
  { // the tub, full
    const g = group(w(11.6), w(7)); B(g, 0.75, 0.55, 1.7, M.porcelain, 0, 0.28, 0); gm(g, new THREE.PlaneGeometry(0.62, 1.55), mats.bloodLiquid, 0, 0.52, 0).rotation.x = -Math.PI / 2;
    GO.severedHead(g, 0, 0.46, -0.6, 0, 'grey'); for (const s of [-0.1, 0.1]) GO.ball(g, V(s, 0.56, 0.25), 0.07, mats.skinGrey, 1, 0.6, 1);
    const arm = new THREE.Group(); arm.position.set(-0.37, 0.55, -0.1); g.add(arm); GO.limb(arm, V(0, 0, 0), V(-0.1, -0.4, 0.05), 0.04, 0.035, mats.skinGrey); GO.ball(arm, V(-0.11, -0.45, 0.06), 0.04, mats.skinGrey, 0.8, 1.4, 0.5); drip(arm, -0.11, -0.48, 0.06, 3);
    GO.bake(g); solidAt(w(11.6), w(7), 0.38, 0.85); pool(w(11.1), w(7), 1.3);
  }
  { const g = group(w(8) + 0.3, w(6.5)); C(g, 0.2, 0.18, 0.42, M.porcelain, 0, 0.21, 0); B(g, 0.2, 0.4, 0.45, M.porcelain, -0.15, 0.6, 0); GO.bake(g); solidAt(w(8) + 0.3, w(6.5), 0.25, 0.25, false); }
  { const g = group(w(10), w(6) + 0.3); B(g, 0.6, 0.85, 0.45, white, 0, 0.43, 0); B(g, 0.7, 0.9, 0.02, M.mirror, 0, 1.55, -0.2); GO.bake(g); solidAt(w(10), w(6) + 0.3, 0.3, 0.23, false); L.writing(10, 6, 'n', 0, 1.55, 'SMILE', 0.7, 0.35); }
  L.addLocker(9, 7, 's', 0, { kind: 'closet', hide: true });
  L.waypoints.push(W3(10, 7));

  // --- study (locked) ---
  lamp(10.2, 9, 'lamp', 0.05, { y: 1.15, table: true });
  table(w(10.2), w(9), 1.5, 0.75, 0.76, darkWood);
  L.addItem('note_journal', 'note', w(10.2) - 0.3, 0.8, w(9) + 0.05, "Read Dad's journal");
  { const ph = new THREE.Group(); ph.position.set(w(10.2) + 0.5, 0.79, w(9)); root.add(ph); B(ph, 0.22, 0.08, 0.18, new THREE.MeshStandardMaterial({ color: 0x5a1010, roughness: 0.4 }), 0, 0.04, 0); B(ph, 0.24, 0.05, 0.06, new THREE.MeshStandardMaterial({ color: 0x5a1010, roughness: 0.4 }), 0, 0.11, 0); L.specials.phone = ph; }
  chair(w(10.2), w(9) - 0.7, 0, darkWood);
  shelf(w(8) + 0.2, w(9), Math.PI / 2, true, 1.6); shelf(w(12) + 1.8, w(8) + 0.2, 0, true, 1.4);
  { // the corkboard: the park, circled; missing posters going back thirty years
    const f = H.wallFrame(10, 10, 's', 0), g = new THREE.Group(); g.position.copy(f.p).addScaledVector(f.nrm, 0.02); g.position.y = 1.6; g.rotation.y = f.yaw; root.add(g);
    B(g, 1.6, 1.0, 0.03, new THREE.MeshStandardMaterial({ map: corkTex(), roughness: 0.9 }), 0, 0, 0);
  }
  L.addItem('cell2', 'cell', w(11.6), 0.05, w(8.4));
  L.waypoints.push(W3(10, 9.5));

  // --- your old room ---
  L.specials.killFlicker = lamp(10, 12, 'lamp', 0.05, { y: 0.85, table: true, int: 6 });
  bed(w(11.4), w(12.2), -Math.PI / 2, false, { quilt: M.quilt });
  table(w(10), w(12), 0.4, 0.4, 0.5, white);
  { const g = group(w(8) + 0.4, w(13.4)); B(g, 0.9, 0.9, 0.45, white, 0, 0.45, 0); const mb = B(g, 0.18, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0x8a2a3a, roughness: 0.4 }), 0.1, 0.96, 0); L.specials.musicBox = V(w(8) + 0.5, 1, w(13.4)); GO.bake(g); solidAt(w(8) + 0.4, w(13.4), 0.45, 0.23, false); }
  { // toys, a bear with its stuffing out
    const g = group(w(9.5), w(11.6)); for (let i = 0; i < 6; i++) B(g, 0.12, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: pick([0xa02020, 0x2050a0, 0xd0a020, 0x208040]), roughness: 0.6 }), rr(-0.4, 0.4), 0.06, rr(-0.4, 0.4)).rotation.y = R() * 3;
    const bear = new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }); GO.ball(g, V(0.5, 0.15, 0.3), 0.14, bear, 1, 1.1, 0.9); GO.ball(g, V(0.5, 0.36, 0.3), 0.1, bear); for (const s of [-1, 1]) GO.ball(g, V(0.5 + s * 0.07, 0.45, 0.3), 0.035, bear); GO.ball(g, V(0.5, 0.14, 0.42), 0.06, new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 1 }));
    GO.bake(g);
  }
  L.addLocker(8, 11, 'w', 0, { hide: true });
  L.waypoints.push(W3(10, 12.5));

  // --- laundry ---
  lamp(10, 14.5, 'fluoro', 0.55);
  { const g = group(w(9), w(14) + 0.38); for (const s of [-0.35, 0.35]) { B(g, 0.66, 0.9, 0.62, white, s, 0.45, 0); C(g, 0.2, 0.2, 0.02, M.glass, s, 0.5, 0.31, 18).rotation.x = Math.PI / 2; } GO.bake(g); solidAt(w(9), w(14) + 0.38, 0.7, 0.32); pool(w(9.2), w(15), 1.6); drip(root, w(9) - 0.35, 0.25, w(14) + 0.7, 2); }
  L.addItem('cell3', 'cell', w(11.6), 0.92, w(14) + 0.3);
  box(0.8, 0.9, 0.5, cream, w(11.6), 0.45, w(14) + 0.3, { col: true, nav: false });
  L.waypoints.push(W3(10, 15));

  // --- guest room: someone hangs from the light fitting ---
  lamp(9, 17.6, 'bulb', 0.3);
  bed(w(11.5), w(17.4), -Math.PI / 2, false, { body: true, missing: ['lLeg'] });
  L.specials.watcher = L.hang(w(9.6), w(16.8), 'ankles', { y: WALL_H - 0.05, chain: 0.15, noBake: true, drip: 2 });
  L.addLocker(8, 18, 's', 0, { kind: 'closet', hide: true });
  L.writing(10, 16, 'n', 0, 1.8, 'HE TAKES THEM HOME', 1.9, 0.55);
  L.waypoints.push(W3(10, 17));

  // ===================== THE YARD =====================
  await step('Mowing the yard', 0.7);
  lamp(13.4, 15.4, 'porch', 0.25, { y: 2.3 });
  { // clothesline: bedsheets, soaked through, moving in the wind
    for (const z of [8, 13]) { cyl(0.04, 0.04, 2.2, M.metal, w(16), 1.1, w(z), 8, { col: true, nav: false }); box(0.8, 0.04, 0.04, M.metal, w(16), 2.18, w(z)); }
    const sheets = [];
    for (let i = 0; i < 4; i++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.6, 6, 6), new THREE.MeshStandardMaterial({ map: M.sheet.map, normalMap: M.sheet.normalMap, side: THREE.DoubleSide, roughness: 0.9 })); sh.position.set(w(16), 1.35, w(8.6) + i * 2.2); sh.rotation.y = Math.PI / 2; sh.castShadow = true; root.add(sh); sheets.push(sh); }
    L.updaters.push((dt) => { for (const [i, sh] of sheets.entries()) { const p = sh.geometry.attributes.position; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, Math.sin(G.time * 1.7 + x * 2 + i) * 0.12 * (0.8 - y) ); } p.needsUpdate = true; } });
  }
  { // an old swing set; one swing moves
    const g = group(w(19), w(13)); for (const s of [-1, 1]) for (const k of [-1, 1]) { const leg = B(g, 0.08, 2.4, 0.08, M.red, s * 1.1, 1.15, k * 0.5); leg.rotation.x = k * 0.2; }
    B(g, 2.4, 0.08, 0.08, M.red, 0, 2.35, 0); GO.bake(g);
    const sw = new THREE.Group(); sw.position.set(w(19), 2.3, w(13)); root.add(sw); for (const s of [-0.22, 0.22]) GO.mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.9, 4), M.metal, sw, s, -0.95, 0); GO.mesh(new THREE.BoxGeometry(0.55, 0.04, 0.22), M.black, sw, 0, -1.9, 0);
    let ph = 0; L.updaters.push((dt) => { ph += dt; sw.rotation.x = Math.sin(ph * 1.6) * 0.35; if (Math.abs(Math.sin(ph * 1.6)) > 0.995 && G.camera.position.distanceTo(sw.position) < 14 && R() < 0.5) AU.doorCreak(sw.position, 0.06); });
    solidAt(w(19), w(13), 1.2, 0.3, false);
  }
  // the shed
  lamp(18.5, 4, 'bulb', 0.6);
  { const g = group(w(18.5), w(3) + 0.3); B(g, 2.2, 0.05, 0.5, wood, 0, 0.9, 0); B(g, 2.2, 0.05, 0.5, wood, 0, 1.6, 0); for (let i = 0; i < 5; i++) C(g, 0.1, 0.1, 0.25, M.metal, -0.9 + i * 0.4, 1.06, 0, 10); GO.bake(g); solidAt(w(18.5), w(3) + 0.3, 1.1, 0.25, false); }
  L.addItem('battery', 'battery', w(19.6), 0.93, w(3) + 0.35);
  { const c = GO.slumpedCorpse({ gutsOut: 0.6, face: 'flayed' }); const g = group(w(20.5), w(4.7), -Math.PI / 2); g.add(c); GO.bake(g); pool(w(20.2), w(4.7), 1.3); }
  L.addLocker(17, 4, 'w', 0, { kind: 'closet', hide: true });
  trail(w(17.5), w(6.5), w(17.4), w(10), 0.5); trail(w(17.4), w(10), w(21.5), w(10.5), 0.5);
  { const g = group(w(15), w(5)); for (let i = 0; i < 3; i++) { const h = gm(g, new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), mats.skinGrey, -0.4 + i * 0.35, 0.12, rr(-0.2, 0.2)); h.rotation.set(rr(-0.4, 0.4), 0, rr(-0.4, 0.4)); GO.ball(g, V(-0.4 + i * 0.35, 0.33, h.position.z), 0.045, mats.skinGrey, 1.2, 0.6, 1.5); } gm(g, new THREE.CircleGeometry(0.9, 16), M.dirt, 0, 0.01, 0).rotation.x = -Math.PI / 2; GO.bake(g); } // hands out of the vegetable bed
  L.waypoints.push(W3(17, 9), W3(17, 16), W3(19, 4));

  // ===================== THE PARK =====================
  await step('Unlocking the park', 0.76);
  const lampSpots = [[24, 10.5], [30, 10.5], [36, 10.5], [40.5, 6], [40.5, 14], [40.5, 22], [40.5, 30], [40.5, 38.5], [47, 18.5], [55, 18.5], [60.5, 9], [60.5, 25], [60.5, 34], [32, 38.5], [48, 38.5], [55, 4.5], [47, 4.5], [28.5, 22]];
  const lamps = lampSpots.map(([x, y], i) => lamp(x, y, 'street', i % 5 === 3 ? 0.6 : i % 7 === 2 ? 0.25 : 0, { dead: i === 8 || i === 15 }));
  L.specials.sightLight = lamps[1];
  const bench = (x, z, ry) => { const g = group(x, z, ry); B(g, 1.7, 0.05, 0.45, wood, 0, 0.45, 0); B(g, 1.7, 0.4, 0.05, wood, 0, 0.75, -0.2); for (const s of [-0.7, 0.7]) B(g, 0.06, 0.45, 0.45, M.metal, s, 0.22, 0); GO.bake(g); const c = Math.abs(Math.sin(ry)) > 0.5; solidAt(x, z, c ? 0.25 : 0.85, c ? 0.85 : 0.25, false); };
  for (const [x, y, ry] of [[33, 9.3, 0], [42.2, 26, -Math.PI / 2], [42.2, 12, -Math.PI / 2], [50, 17.3, 0], [58, 37.3, 0], [36, 37.3, 0], [62.2, 16, -Math.PI / 2]]) bench(w(x), w(y), ry);
  const bin = (x, z) => { cyl(0.25, 0.22, 0.9, M.metal, x, 0.45, z, 12, { col: true, nav: false }); };
  for (const [x, y] of [[34.5, 9.4], [42.3, 20.5], [59.4, 20], [44, 37.6]]) bin(w(x), w(y));
  { // the sign
    const g = group(w(23.2), w(9.3)); B(g, 0.08, 1.6, 0.08, M.metal, -0.6, 0.8, 0); B(g, 0.08, 1.6, 0.08, M.metal, 0.6, 0.8, 0); B(g, 1.5, 0.6, 0.04, new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.7 }), 0, 1.4, 0); GO.bake(g);
  }
  // trees with people in them, along the paths
  const deadTree = (x, z, bodies = 1) => {
    const g = group(x, z, R() * 6);
    const trunk = new THREE.CylinderGeometry(0.16, 0.3, 4.2, 10); trunk.translate(0, 2.1, 0); gm(g, trunk, M.bark, 0, 0, 0);
    const br = new THREE.CylinderGeometry(0.05, 0.1, 2.4, 8); br.translate(0, 1.2, 0); const b = gm(g, br, M.bark, 0, 3.0, 0); b.rotation.z = -1.25;
    const br2 = br.clone(); const b2 = gm(g, br2, M.bark, 0, 3.6, 0); b2.rotation.set(0.9, 0, 0.5);
    GO.bake(g); L.trees.push({ x, z, r: 0.3 }); L.addCollider(x - 0.3, x + 0.3, z - 0.3, z + 0.3, false);
    const out = []; for (let i = 0; i < bodies; i++) { const d = 1.0 + i * 0.7, a = g.rotation.y; out.push(L.hang(x + Math.cos(a) * d, z - Math.sin(a) * d, pick(['back', 'ankles']), { y: 3.0 + 2.0 * 0.35 - 0.5, chain: 0.5 + R() * 0.4, missing: R() < 0.5 ? [pick(['lArm', 'rLegLower'])] : [] })); }
    return out;
  };
  deadTree(w(35), w(16.5), 2); deadTree(w(43.5), w(9), 1); deadTree(w(58.5), w(28), 2); deadTree(w(33), w(23), 1); deadTree(w(52), w(41.5), 1);

  // --- the restrooms ---
  await step('Cleaning the restrooms', 0.79);
  lamp(27, 5, 'fluoro', 0.7); lamp(31, 5, 'fluoro', 0.2);
  L.addLocker(25, 3, 'n', 0.4, { kind: 'stall', hide: true }); L.addLocker(27, 3, 'n', 0.2, { kind: 'stall', hide: true });
  L.addLocker(30, 3, 'n', 0.3, { kind: 'stall', hide: true }); L.addLocker(32, 3, 'n', 0, { kind: 'stall' });
  { const c = GO.slumpedCorpse({ openChest: true }); const g = group(w(32.5), w(3.6), Math.PI); c.position.set(0, 0.35, 0); g.add(c); GO.bake(g); pool(w(32.5), w(4), 1.4); drip(g, 0.2, 0.4, 0.3, 2); }
  for (const [x, z] of [[w(26), w(7) + 0.75], [w(27.5), w(7) + 0.75], [w(30), w(7) + 0.75], [w(31.8), w(7) + 0.75]]) { const g = group(x, z); B(g, 0.6, 0.15, 0.45, M.porcelain, 0, 0.8, 0); B(g, 0.1, 0.8, 0.1, M.porcelain, 0, 0.4, 0.1); B(g, 0.6, 0.8, 0.02, M.mirror, 0, 1.55, 0.21); GO.bake(g); }
  L.writing(28, 6, 'e', 0, 1.7, 'MR SMILES SEES YOU', 1.9, 0.55); L.writing(29, 4, 'w', 0, 1.7, 'COUNT TO TEN', 1.6, 0.5);
  L.addItem('note_kids', 'wallnote', w(25) + 0.08, 1.5, w(5.5), 'Read the scratched wall').group.rotation.y = Math.PI / 2;
  pool(w(30.5), w(5.5), 1.6); trail(w(30.5), w(5.5), w(31.5), w(8), 0.5);
  L.waypoints.push(W3(27, 5.5), W3(31, 5.5));

  // --- the playground ---
  await step('Oiling the swings', 0.82);
  lamp(30.5, 30.5, 'street', 0.15);
  const swings = [];
  { const g = group(w(27.5), w(27.5)); for (const s of [-1, 1]) for (const k of [-1, 1]) { const leg = B(g, 0.08, 2.7, 0.08, M.red, s * 1.8, 1.3, k * 0.55); leg.rotation.x = k * 0.22; } B(g, 3.8, 0.1, 0.1, M.red, 0, 2.62, 0); GO.bake(g); L.addCollider(w(27.5) - 1.9, w(27.5) - 1.7, w(27.5) - 0.6, w(27.5) + 0.6, false); L.addCollider(w(27.5) + 1.7, w(27.5) + 1.9, w(27.5) - 0.6, w(27.5) + 0.6, false);
    for (let i = 0; i < 3; i++) { const sw = new THREE.Group(); sw.position.set(w(27.5) - 1.1 + i * 1.1, 2.58, w(27.5)); root.add(sw); for (const s of [-0.22, 0.22]) GO.mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.95, 4), M.chrome, sw, s, -0.97, 0); GO.mesh(new THREE.BoxGeometry(0.5, 0.04, 0.22), M.black, sw, 0, -1.95, 0);
      if (i === 2) { const c = GO.slumpedCorpse({ face: 'flayed' }); c.scale.setScalar(0.95); c.position.set(0, -2.12, 0.1); c.rotation.y = 0; sw.add(c); GO.bake(c); drip(sw, 0, -1.98, 0.1, 2); }
      swings.push({ sw, ph: R() * 6, amp: i === 0 ? 0.5 : i === 2 ? 0.08 : 0.15 }); }
  }
  L.updaters.push((dt) => { for (const s of swings) { s.ph += dt * 1.55; s.sw.rotation.x = Math.sin(s.ph) * s.amp; } if (swings[0] && Math.abs(Math.sin(swings[0].ph)) > 0.995 && G.camera.position.distanceTo(swings[0].sw.position) < 16 && R() < 0.6) AU.doorCreak(swings[0].sw.position, 0.07); });
  { // slide, smeared all the way down
    const g = group(w(34), w(27.5)); for (const s of [-0.3, 0.3]) B(g, 0.06, 2.0, 0.06, M.yellowM, s, 1.0, -1.2); B(g, 0.7, 0.06, 0.7, M.yellowM, 0, 2.0, -1.2);
    const sl = B(g, 0.6, 0.05, 3.2, M.chrome, 0, 1.0, 0.25); sl.rotation.x = 0.62; for (const s of [-0.31, 0.31]) { const r_ = B(g, 0.04, 0.2, 3.2, M.yellowM, s, 1.1, 0.25); r_.rotation.x = 0.62; }
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3.0), new THREE.MeshStandardMaterial({ map: TX.decalTex('trail'), transparent: true, depthWrite: false, roughness: 0.15, polygonOffset: true, polygonOffsetFactor: -2 })); sm.position.set(0, 1.035, 0.25); sm.rotation.set(-Math.PI / 2 + 0.62, 0, Math.PI / 2); g.add(sm);
    for (let i = 0; i < 5; i++) { const st = B(g, 0.55, 0.04, 0.12, M.metal, 0, 0.35 + i * 0.35, -1.62); }
    GO.bake(g); L.addCollider(w(34) - 0.4, w(34) + 0.4, w(27.5) - 1.6, w(27.5) + 1.6, false); pool(w(34), w(28.9), 1.2);
  }
  { // climbing frame; they've been hung from the bars
    const g = group(w(30.5), w(33.5)); for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.08, 2.6, 0.08, M.blueM, sx * 1.3, 1.3, sz * 1.0); for (let i = -1; i <= 1; i++) B(g, 2.6, 0.06, 0.06, M.blueM, 0, 2.6, i); for (const sx of [-1, 1]) B(g, 0.06, 0.06, 2.0, M.blueM, sx * 1.3, 2.6, 0);
    GO.bake(g); for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.addCollider(w(30.5) + sx * 1.3 - 0.06, w(30.5) + sx * 1.3 + 0.06, w(33.5) + sz - 0.06, w(33.5) + sz + 0.06, false);
    L.hang(w(30.5) - 0.7, w(33.5), 'ankles', { y: 2.55, chain: 0.15 }); L.specials.dropper = L.hang(w(30.5) + 0.7, w(33.5) + 0.4, 'back', { y: 2.55, chain: 0.25, openChest: true });
  }
  { // the roundabout, turning very slowly on its own
    const g = new THREE.Group(); g.position.set(w(34.5), 0, w(33.5)); root.add(g); gm(g, new THREE.CylinderGeometry(1.2, 1.2, 0.08, 24), M.red, 0, 0.3, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const bar = gm(g, new THREE.BoxGeometry(0.04, 0.6, 0.04), M.yellowM, Math.cos(a) * 0.9, 0.6, Math.sin(a) * 0.9); }
    GO.severedHead(g, 0.5, 0.34, 0.2, 1, 'grey'); GO.severedLimb(g, -0.4, -0.3, 1, false).position.y = 0.37; drip(g, 1.1, 0.32, 0, 1);
    L.updaters.push(dt => { g.rotation.y += dt * 0.12; }); L.addCollider(w(34.5) - 1.1, w(34.5) + 1.1, w(33.5) - 1.1, w(33.5) + 1.1, false);
    pool(w(34.5) + 1.3, w(33.5), 1.2);
  }
  { // the sandbox. something's buried in it. so are the keys.
    const g = group(w(26), w(33.5)); for (const [x, z, lx, lz] of [[0, -1.2, 2.6, 0.12], [0, 1.2, 2.6, 0.12], [-1.25, 0, 0.12, 2.4], [1.25, 0, 0.12, 2.4]]) B(g, lx, 0.25, lz, wood, x, 0.12, z);
    gm(g, new THREE.BoxGeometry(2.4, 0.18, 2.3), new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 1, normalMap: M.dirt.normalMap }), 0, 0.09, 0);
    const c = GO.slumpedCorpse({ openChest: true }); c.position.set(0.2, -0.45, 0.2); c.rotation.set(-0.6, 0.4, 0); g.add(c);
    const arm = new THREE.Group(); arm.position.set(-0.6, 0.18, -0.5); g.add(arm); GO.limb(arm, V(0, 0, 0), V(0.05, 0.42, 0.1), 0.045, 0.04, mats.skinGrey); GO.ball(arm, V(0.05, 0.48, 0.12), 0.05, mats.skinGrey, 1, 1.3, 0.6);
    GO.bake(g); pool(w(26) + 0.5, w(33.5) + 0.4, 1.4);
    L.addItem('keys', 'keys', w(26) - 0.55, 0.2, w(33.5) - 0.3);
  }
  { const g = group(w(31), w(29)); C(g, 0.1, 0.12, 0.45, M.metal, 0, 0.22, 0, 10); const plank = B(g, 3.0, 0.08, 0.3, M.yellowM, 0, 0.5, 0); plank.rotation.z = 0.25; GO.bake(g); L.addCollider(w(31) - 1.4, w(31) + 1.4, w(29) - 0.15, w(29) + 0.15, false); }
  L.waypoints.push(W3(27, 30), W3(33, 31), W3(28.5, 23));

  // --- the pond ---
  await step('Filling the pond', 0.85);
  { const g = group(w(51.5), w(29)); for (let i = 0; i < 6; i++) for (const s of [-0.85, 0.85]) C(g, 0.08, 0.08, 1.2, darkWood, s, -0.3, -2 + i * 1.2, 8); for (const s of [-0.9, 0.9]) B(g, 0.06, 0.06, 10, darkWood, s, 0.9, 0); GO.bake(g); }
  L.vats = [{ x: w(51.5) - 1.6, z: w(27) }, { x: w(51.5), z: w(26.3) }, { x: w(51.5) + 1.8, z: w(26.8) }];
  { // floaters, face down
    for (const [x, y, ry] of [[47.5, 24, 0.3], [54.5, 23, 2], [49.5, 21.5, 1.2]]) { const c = GO.tableCorpse({ open: false, missing: R() < 0.5 ? ['lArm'] : [] }); const g = group(w(x), w(y), ry); c.rotation.x = Math.PI; c.position.y = 0.85; g.add(c); GO.bake(g); const ph = R() * 6; L.updaters.push(() => { g.position.y = 0.02 + Math.sin(G.time * 0.6 + ph) * 0.015; }); }
  }
  L.waypoints.push(W3(51.5, 33), W3(47, 18.5), W3(56, 18.5));

  // --- the gazebo ---
  await step('Lighting candles in the gazebo', 0.87);
  {
    const cx = w(51.5), cz = w(11.5), g = group(cx, cz), white2 = M.paintedWood(0xd8d4c8);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B(g, 0.12, 2.7, 0.12, white2, Math.cos(a) * 3.6, 1.35, Math.sin(a) * 3.6); if (i % 2) B(g, 2.6, 0.06, 0.06, white2, Math.cos(a + 0.39) * 3.35, 0.95, Math.sin(a + 0.39) * 3.35).rotation.y = -a - 0.39 + Math.PI / 2; }
    const roof = gm(g, new THREE.ConeGeometry(4.6, 1.8, 8, 1, true), M.shingles, 0, 3.6, 0); roof.rotation.y = Math.PI / 8; roof.material = M.shingles.clone(); roof.material.side = THREE.DoubleSide;
    gm(g, new THREE.CylinderGeometry(4.0, 4.0, 0.25, 8), M.wood, 0, 0.12, 0).rotation.y = Math.PI / 8;
    GO.bake(g);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; L.addCollider(cx + Math.cos(a) * 3.6 - 0.08, cx + Math.cos(a) * 3.6 + 0.08, cz + Math.sin(a) * 3.6 - 0.08, cz + Math.sin(a) * 3.6 + 0.08, false); }
    // a circle of them, lying with their feet to the middle, candles between
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3, c = GO.tableCorpse({ open: true, face: i % 2 ? 'flayed' : 'grey' }); const bg = group(cx + Math.cos(a) * 2.1, cz + Math.sin(a) * 2.1, -a + Math.PI / 2); c.position.y = -0.62; bg.add(c); GO.bake(bg); pool(cx + Math.cos(a) * 2.1, cz + Math.sin(a) * 2.1, 1.2); }
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; lamp((cx + Math.cos(a) * 1.0) / T, (cz + Math.sin(a) * 1.0) / T, 'candle', 0.05, { y: 0.45 + 0.2 }); }
    L.hang(cx, cz, 'back', { y: 3.4, chain: 0.5, openChest: true, gutsOut: 0.8 });
    L.addItem('note_run', 'note', cx + 0.3, 0.27, cz - 0.2, 'Read the page');
  }
  L.waypoints.push(W3(51.5, 11.5), W3(51.5, 6), W3(58.5, 11.5));

  // --- the groundskeeper's hut ---
  await step("Opening the groundskeeper's hut", 0.88);
  lamp(54, 34.5, 'bulb', 0.2); lamp(57.5, 34.5, 'bulb', 0.6);
  { const g = group(w(54), w(36) + 0.6); B(g, 2.4, 0.06, 0.7, wood, 0, 0.9, 0); for (const s of [-1, 1]) B(g, 0.06, 0.9, 0.6, wood, s * 1.1, 0.45, 0); for (let i = 0; i < 6; i++) B(g, 0.03, rr(0.2, 0.5), 0.12, M.metal, -1 + i * 0.35, 1.4 + R() * 0.3, -0.3); GO.bake(g); solidAt(w(54), w(36) + 0.6, 1.2, 0.35, false); }
  L.addItem('gas', 'gas', w(53) + 0.5, 0.0, w(33) + 0.6);
  L.addLocker(55, 36, 's', 0.3, { kind: 'locker', hide: true });
  // the back room: they're hung up like coats
  for (let i = 0; i < 4; i++) { const p = GO.mesh(new THREE.PlaneGeometry(0.7, 1.45), mats.pelt, root, w(56) + 0.6 + i * 1.2, 1.55, w(36) + 1.75); const e = new THREE.Object3D(); e.position.set(0, -0.7, 0); p.add(e); L.dripEmitter(e, 0.8); pool(w(56) + 0.6 + i * 1.2, w(36) + 1.6, 0.8); }
  box(4.6, 0.06, 0.06, M.metal, w(57.5), 2.3, w(36) + 1.8);
  { const g = group(w(57.5), w(34)); B(g, 0.9, 0.06, 2.0, M.chrome, 0, 0.88, 0); for (const sx of [-0.4, 0.4]) for (const sz of [-0.9, 0.9]) B(g, 0.05, 0.88, 0.05, M.metal, sx, 0.44, sz); const c = GO.tableCorpse({ open: true, face: 'flayed', missing: ['rArm'] }); g.add(c); GO.bake(g); solidAt(w(57.5), w(34), 0.5, 1.05); pool(w(57.5), w(34), 2); drip(g, 0.45, 0.86, 0.2, 3); }
  L.addItem('note_watch', 'note', w(56) + 0.7, 0.03, w(33) + 0.5, 'Pick up the watch');
  L.waypoints.push(W3(54, 34.5), W3(57.5, 35.5));

  // --- the crawler, out on the south path ---
  { const cr = GO.crawler(); cr.group.position.set(w(46), 0, w(38.5)); cr.group.rotation.y = -Math.PI / 2; root.add(cr.group); L.specials.crawler = cr; pool(w(46.3), w(38.5), 1.1); }
  // writing on the path, under a lamp
  L.decalFloor(w(40.5), w(31), 1.6, 1.6, 'pool');
  for (const [x, y] of [[40.5, 9], [60.5, 18], [36, 38.5], [47, 4.5]]) trail(w(x) - 2, w(y), w(x) + 2, w(y) + 0.3, 0.5);
  L.addItem('cell4', 'cell', w(42.3), 0.5, w(12.2)); L.addItem('cell5', 'cell', w(58.2), 0.05, w(37.8));
  L.waypoints.push(W3(40.5, 6), W3(40.5, 22), W3(40.5, 38.5), W3(60.5, 9), W3(60.5, 30), W3(32, 38.5), W3(30, 10.5), W3(48, 4.5));
}

// ---------- small textures ----------
function photoTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 80); g.addColorStop(0, '#6a6050'); g.addColorStop(1, '#3a3228'); x.fillStyle = g; x.fillRect(0, 0, 64, 80);
  const n = 1 + (R() * 3 | 0); for (let i = 0; i < n; i++) { const px = 64 / (n + 1) * (i + 1); x.fillStyle = '#2a2018'; x.fillRect(px - 9, 40, 18, 40); x.fillStyle = '#c8a890'; x.beginPath(); x.arc(px, 32, 8, 0, 6.28); x.fill(); x.strokeStyle = '#0a0000'; x.lineWidth = 3; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(px - 9 + R() * 4, 24 + R() * 16); x.lineTo(px + 9 - R() * 4, 24 + R() * 16); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function corkTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#8a6a44'; x.fillRect(0, 0, 256, 160); for (let i = 0; i < 2000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '60,40,20' : '160,120,80'},0.4)`; x.fillRect(R() * 256, R() * 160, 1.5, 1.5); }
  x.fillStyle = '#d8d0b8'; x.fillRect(70, 20, 110, 80); x.strokeStyle = '#4a7a3a'; x.lineWidth = 3; x.strokeRect(80, 30, 90, 60); x.fillStyle = '#4a6a8a'; x.beginPath(); x.ellipse(140, 65, 14, 9, 0, 0, 6.28); x.fill();
  x.strokeStyle = '#a01010'; x.lineWidth = 2; for (const [cx, cy] of [[100, 75], [140, 45], [155, 82], [96, 42]]) { x.beginPath(); x.arc(cx, cy, 7, 0, 6.28); x.stroke(); }
  for (let i = 0; i < 7; i++) { const px = 8 + (i % 4) * 62 + (i > 3 ? 190 - 62 * 3 : 0), py = i > 3 ? 108 : 12; if (i < 4 && px > 60 && px < 190) continue; x.fillStyle = '#e8e4d8'; x.fillRect(px, py, 48, 44); x.fillStyle = '#1a1a1a'; x.font = 'bold 9px sans-serif'; x.fillText('MISSING', px + 6, py + 11); x.fillStyle = '#8a7a6a'; x.fillRect(px + 14, py + 15, 20, 22); }
  x.strokeStyle = '#c01010'; x.lineWidth = 1; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(30 + R() * 200, 30 + R() * 100); x.lineTo(120, 60); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 100; const x = c.getContext('2d');
  x.fillStyle = '#2a4a2a'; x.fillRect(0, 0, 256, 100); x.strokeStyle = '#d8d0b0'; x.lineWidth = 4; x.strokeRect(6, 6, 244, 88);
  x.fillStyle = '#e0d8b8'; x.font = 'bold 30px Georgia, serif'; x.textAlign = 'center'; x.fillText('HOLLOW PARK', 128, 44); x.font = '14px Georgia, serif'; x.fillText('Park closes at dusk', 128, 70);
  for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(${90 + R() * 40 | 0},0,0,0.8)`; x.beginPath(); x.arc(R() * 256, R() * 100, 3 + R() * 9, 0, 6.28); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
