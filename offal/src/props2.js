// Props for the floors that aren't the meatworks: the hospital wing (morgue), the offices, the drains and the
// deep freeze. Built from boxes and cylinders like everything else; materials are made the first time they're needed.
import * as THREE from 'three';
import { keepsakeModel } from './keepsakes3d.js';
import { WALL_H } from './config.js';
import { mesh, geo, box, sph, cyl, cap, decal, makeBody, trayBody, meatChunk, severedArm } from './props.js';
import { canvas, BLOOD, wallSplat } from './textures.js';

const phong = (o) => new THREE.MeshPhongMaterial(o);
function M(mats) {
  if (mats.p2) return mats.p2;
  const tex = (w, h, draw) => { const { c, g } = canvas(w, h); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const p = {
    porcelain: phong({ color: 0xd8d6cc, shininess: 120, specular: 0x666666 }),
    chrome: phong({ color: 0xa8b0b4, shininess: 140, specular: 0xaaaaaa }),
    greenMetal: phong({ color: 0x5e7262, shininess: 40, specular: 0x222222 }),
    beigeMetal: phong({ color: 0x8e8670, shininess: 30, specular: 0x222222 }),
    wood: phong({ color: 0x5a3a20, shininess: 20, specular: 0x111111 }),
    plastic: phong({ color: 0xb8b09a, shininess: 30, specular: 0x222222 }),
    black: phong({ color: 0x141414, shininess: 40, specular: 0x222222 }),
    fabric: phong({ color: 0x4a5464, shininess: 4 }),
    chairFabric: phong({ color: 0x3a2e2a, shininess: 4 }),
    curtain: phong({ color: 0x8aa294, side: THREE.DoubleSide, shininess: 6, transparent: true, opacity: 0.92 }),
    paper: phong({ color: 0xd8d2c0, side: THREE.DoubleSide, shininess: 2 }),
    glass: phong({ color: 0x9ab0a8, transparent: true, opacity: 0.35, shininess: 120, specular: 0x888888, depthWrite: false }),
    formalin: phong({ color: 0xb0a860, transparent: true, opacity: 0.55, shininess: 100, depthWrite: false }),
    rackOrange: phong({ color: 0xb0561a, shininess: 30, specular: 0x222222 }),
    rackBlue: phong({ color: 0x1e3a6a, shininess: 30, specular: 0x222222 }),
    cardboard: phong({ color: 0x8a6a42, shininess: 4 }),
    wrap: phong({ color: 0xd8dce0, transparent: true, opacity: 0.8, shininess: 110, specular: 0x999999 }),
    ice: phong({ color: 0xd8eef8, transparent: true, opacity: 0.75, shininess: 140, specular: 0xffffff }),
    yellow: phong({ color: 0xc89a1a, shininess: 40, specular: 0x333333 }),
    pipe: phong({ color: 0x3a3a30, shininess: 50, specular: 0x333333 }),
    slime: phong({ color: 0x1e2a10, shininess: 120, specular: 0x445533 }),
    rag: phong({ color: 0x4a3e30, shininess: 4 }),
    screen: new THREE.MeshBasicMaterial({ color: 0x0a120c }),
    screenOn: new THREE.MeshBasicMaterial({ color: 0x2a6a40 }),
    vend: new THREE.MeshBasicMaterial({ color: 0x9a3020 }),
    exitSign: new THREE.MeshBasicMaterial({ color: 0x30c050 }),
  };
  p.whiteboard = phong({ map: tex(256, 160, (g, w, h) => {
    g.fillStyle = '#d8d8d0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a3a6a'; g.lineWidth = 3; g.font = 'bold 22px "Courier New", monospace'; g.fillStyle = '#2a3a6a';
    g.fillText('Q4 THROUGHPUT', 16, 32);
    g.strokeRect(16, 44, 140, 90);
    g.beginPath(); g.moveTo(20, 120); g.lineTo(60, 100); g.lineTo(90, 106); g.lineTo(150, 50); g.stroke(); // the line only goes up
    g.fillStyle = '#7a1010'; g.font = 'bold 18px "Courier New", monospace'; g.fillText('HEADCOUNT', 170, 60);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 5; k++) g.fillRect(172 + k * 12, 72 + i * 18, 3, 14); // tallies
    wallSplat(g, 200, 140, 14, Math.random, BLOOD.dark);
  }), shininess: 80, specular: 0x444444 });
  p.files = phong({ map: tex(64, 64, (g) => { g.fillStyle = '#c8b890'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 8; i++) { g.fillStyle = ['#a08a5a', '#8a2a20', '#2a4a7a', '#c8c0a0'][i % 4]; g.fillRect(i * 8, 0, 6, 64); } }), shininess: 4 });
  p.boxes = phong({ map: tex(64, 64, (g) => { g.fillStyle = '#8a6a42'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3a2a1a'; g.font = 'bold 9px monospace'; g.fillText('HOLLOW', 6, 22); g.fillText('PINES', 6, 34); g.fillText('-20°C', 6, 50); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 28, 64, 4); }), shininess: 4 });
  const wt = tex(128, 128, (g, w, h) => { g.fillStyle = '#16200e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(120,140,90,${Math.random() * 0.25})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 2 + Math.random() * 5, 0, 0, Math.PI * 2); g.stroke(); } });
  wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  p.water = phong({ map: wt, color: 0x6a7458, transparent: true, opacity: 0.8, shininess: 200, specular: 0xb0b8a0, depthWrite: false });
  mats.p2 = p;
  return p;
}
export const p2mats = M;

const g0 = () => new THREE.Group();
const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; return o; };

// ---------- hospital wing ----------
export function ivStand(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(cyl(0.012, 0.012, 1.9, 6), m.chrome), 0, 0.95, 0));
  for (let i = 0; i < 5; i++) { const leg = mesh(box(0.32, 0.02, 0.03), m.chrome); leg.position.set(Math.cos(i * 1.257) * 0.15, 0.04, Math.sin(i * 1.257) * 0.15); leg.rotation.y = -i * 1.257; g.add(leg); }
  g.add(at(mesh(box(0.3, 0.012, 0.012), m.chrome, false), 0, 1.88, 0));
  const bag = mesh(cap(0.06, 0.12), rng() < 0.6 ? phong({ color: 0x701010, transparent: true, opacity: 0.8, shininess: 100 }) : m.glass, false);
  bag.scale.z = 0.4;
  g.add(at(bag, 0.12, 1.7, 0));
  const line = mesh(cyl(0.003, 0.003, 1.2, 4), m.glass, false);
  line.rotation.z = 0.15;
  g.add(at(line, 0.18, 1.05, 0));
  return g;
}
export function instrumentCart(mats, rng) {
  const m = M(mats), g = g0();
  for (const y of [0.35, 0.85]) g.add(at(mesh(box(0.8, 0.025, 0.45), m.chrome), 0, y, 0));
  for (const [x, z] of [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]]) { g.add(at(mesh(cyl(0.01, 0.01, 0.85, 5), m.chrome, false), x, 0.45, z)); g.add(at(mesh(sph(0.03, 6), m.black, false), x, 0.03, z)); }
  // the tools: blades, a saw, clamps, a rib spreader, and the towel they were wiped on
  for (let i = 0; i < 6; i++) { const t = mesh(box(0.16 + rng() * 0.1, 0.008, 0.015), mats.steel, false); t.position.set(-0.3 + i * 0.1, 0.875, (rng() - 0.5) * 0.25); t.rotation.y = (rng() - 0.5) * 0.4; g.add(t); }
  const saw = g0(); saw.add(mesh(box(0.28, 0.06, 0.006), mats.steel, false)); const h = mesh(box(0.08, 0.05, 0.03), m.black, false); h.position.x = -0.18; saw.add(h); g.add(at(saw, 0.15, 0.9, 0.1, 0.3));
  const towel = mesh(box(0.3, 0.02, 0.25), phong({ color: 0x7a1a14, shininess: 30 }), false);
  g.add(at(towel, -0.15, 0.37, 0.05, 0.4));
  g.add(at(mesh(cyl(0.1, 0.08, 0.06, 10), m.chrome, false), 0.22, 0.4, 0.02)); // a kidney dish
  return g;
}
// against a wall: origin at the wall, facing +Z
export function sink(mats, rng) {
  const m = M(mats), g = g0();
  const basin = mesh(box(0.55, 0.18, 0.42), m.porcelain);
  g.add(at(basin, 0, 0.82, 0.24));
  g.add(at(mesh(box(0.45, 0.02, 0.32), phong({ color: 0x3a1010, shininess: 90 }), false), 0, 0.915, 0.25)); // what's in it
  g.add(at(mesh(cyl(0.015, 0.015, 0.2, 6), m.chrome, false), 0, 1.0, 0.06));
  const tap = mesh(cyl(0.012, 0.012, 0.16, 6), m.chrome, false); tap.rotation.x = Math.PI / 2; g.add(at(tap, 0, 1.08, 0.13));
  g.add(at(mesh(cyl(0.03, 0.03, 0.7, 6), m.porcelain), 0, 0.37, 0.18)); // the pedestal
  const mirror = mesh(box(0.45, 0.6, 0.02), phong({ color: 0x3a4044, shininess: 140, specular: 0xbbbbbb }), false);
  g.add(at(mirror, 0, 1.55, 0.02));
  if (rng() < 0.5) { const crack = mesh(box(0.004, 0.5, 0.025), m.black, false); crack.rotation.z = 0.6; g.add(at(crack, 0.05, 1.55, 0.02)); }
  return g;
}
export function filingCabinet(mats, rng, beige = false) {
  const m = M(mats), g = g0(), body = beige ? m.beigeMetal : m.greenMetal;
  g.add(at(mesh(box(0.48, 1.32, 0.6), body), 0, 0.66, 0));
  for (let i = 0; i < 4; i++) {
    const open = rng() < 0.15 ? 0.25 + rng() * 0.2 : 0;
    const dr = g0();
    dr.add(mesh(box(0.44, 0.28, 0.02), body, false));
    dr.add(at(mesh(box(0.12, 0.02, 0.03), m.chrome, false), 0, 0.06, 0.02));
    if (open) { const f = mesh(box(0.4, 0.24, open), m.files, false); f.position.z = -open / 2; dr.add(f); }
    g.add(at(dr, 0, 0.18 + i * 0.32, 0.3 + open));
  }
  return g;
}
export function wheelchair(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.45, 0.05, 0.42), m.chairFabric), 0, 0.5, 0));
  const back = mesh(box(0.45, 0.45, 0.04), m.chairFabric); back.rotation.x = -0.15; g.add(at(back, 0, 0.75, -0.22));
  for (const sx of [-1, 1]) {
    const wh = mesh(geo('wheel', () => new THREE.TorusGeometry(0.29, 0.02, 5, 16)), m.black, false); wh.rotation.y = Math.PI / 2; g.add(at(wh, sx * 0.27, 0.3, -0.05));
    g.add(at(mesh(sph(0.05, 6), m.black, false), sx * 0.2, 0.05, 0.3));
    g.add(at(mesh(box(0.02, 0.02, 0.45), m.chrome, false), sx * 0.24, 0.65, 0.02));
  }
  return g;
}
// a curtain on a ceiling rail, drawn round a bed; origin on the floor at the middle of the rail
export function curtain(mats, rng, len = 1.9) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(len, 0.03, 0.04), m.chrome, false), 0, WALL_H - 0.6, 0));
  const pg = new THREE.PlaneGeometry(len, 2.1, 24, 1);
  const pos = pg.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.06);
  pg.computeVertexNormals();
  const cu = mesh(pg, m.curtain, false);
  g.add(at(cu, 0, WALL_H - 0.6 - 1.05, 0));
  if (rng() < 0.6) { // a hand dragged down it
    const { c, g: cg } = canvas(64, 128); cg.fillStyle = `rgba(${BLOOD.dark},.8)`; for (let k = 0; k < 4; k++) cg.fillRect(20 + k * 7, 10, 4, 100 + Math.random() * 18);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const smear = mesh(new THREE.PlaneGeometry(0.3, 0.9), new THREE.MeshPhongMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide }), false);
    g.add(at(smear, (rng() - 0.5) * len * 0.6, 1.3, 0.07));
  }
  return g;
}
// a bed with somebody under the sheet (or on top of it)
export function hospitalBed(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.95, 0.12, 2.0), m.porcelain), 0, 0.55, 0));
  for (const [x, z] of [[-0.42, -0.95], [0.42, -0.95], [-0.42, 0.95], [0.42, 0.95]]) g.add(at(mesh(cyl(0.02, 0.02, 0.55, 5), m.chrome, false), x, 0.27, z));
  const head = mesh(box(0.95, 0.5, 0.04), m.chrome); g.add(at(head, 0, 0.85, -1.0));
  // trayBody lays its pelvis 0.55 m toward its own -Z; this puts the pelvis just off centre, head on the pillow end
  const body = trayBody(mats, rng);
  body.position.set(0, 0.5, 0.6);
  g.add(body);
  return g;
}
// specimen jars on a shelf: things kept in fluid that should not have been kept
export function specimenShelf(mats, rng) {
  const m = M(mats), g = g0();
  for (const y of [0.5, 1.1, 1.7]) g.add(at(mesh(box(1.4, 0.03, 0.35), m.greenMetal), 0, y, 0.18));
  for (const sx of [-1, 1]) g.add(at(mesh(box(0.03, 1.9, 0.35), m.greenMetal), sx * 0.7, 0.95, 0.18));
  for (const y of [0.5, 1.1, 1.7]) for (let i = 0; i < 4; i++) {
    if (rng() < 0.25) continue;
    const h = 0.22 + rng() * 0.12;
    g.add(at(mesh(cyl(0.08, 0.08, h, 10), m.formalin, false), -0.5 + i * 0.33, y + 0.015 + h / 2, 0.18));
    const thing = rng() < 0.5 ? mesh(sph(0.05, 8), mats.meatPale, false) : mesh(cap(0.025, 0.08), mats.gut, false);
    g.add(at(thing, -0.5 + i * 0.33, y + 0.05 + h * 0.4, 0.18));
    g.add(at(mesh(cyl(0.085, 0.085, 0.03, 10), m.black, false), -0.5 + i * 0.33, y + 0.03 + h, 0.18));
  }
  return g;
}

// ---------- offices ----------
export function officeChair(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.46, 0.08, 0.46), m.chairFabric), 0, 0.48, 0));
  const back = mesh(box(0.44, 0.55, 0.06), m.chairFabric); back.rotation.x = -0.12; g.add(at(back, 0, 0.82, -0.22));
  g.add(at(mesh(cyl(0.025, 0.025, 0.4, 6), m.black, false), 0, 0.26, 0));
  for (let i = 0; i < 5; i++) { const leg = mesh(box(0.3, 0.025, 0.03), m.black, false); leg.position.set(Math.cos(i * 1.257) * 0.14, 0.05, Math.sin(i * 1.257) * 0.14); leg.rotation.y = -i * 1.257; g.add(leg); }
  return g;
}
// a desk with a dead terminal on it; origin centre, facing +Z (the chair side)
export function desk(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(1.5, 0.05, 0.75), m.wood), 0, 0.74, 0));
  g.add(at(mesh(box(1.46, 0.6, 0.03), m.wood), 0, 0.42, -0.35));
  for (const sx of [-1, 1]) g.add(at(mesh(box(0.04, 0.72, 0.72), m.wood), sx * 0.72, 0.36, 0));
  const ped = mesh(box(0.42, 0.68, 0.66), m.beigeMetal); g.add(at(ped, 0.48, 0.36, 0));
  for (let i = 0; i < 3; i++) g.add(at(mesh(box(0.1, 0.015, 0.02), m.chrome, false), 0.48, 0.18 + i * 0.22, 0.34));
  // the terminal
  const mon = g0();
  mon.add(mesh(box(0.42, 0.36, 0.38), m.plastic));
  const scr = mesh(box(0.32, 0.25, 0.01), rng() < 0.15 ? m.screenOn : m.screen, false); scr.position.set(0, 0.02, 0.195); mon.add(scr);
  g.add(at(mon, -0.2 + (rng() - 0.5) * 0.2, 0.95, -0.12, (rng() - 0.5) * 0.4));
  g.add(at(mesh(box(0.45, 0.025, 0.15), m.plastic, false), -0.15, 0.78, 0.18, (rng() - 0.5) * 0.3));
  for (let i = 0; i < 3 + (rng() * 4 | 0); i++) { const p = mesh(box(0.21, 0.004, 0.29), m.paper, false); g.add(at(p, 0.35 + (rng() - 0.5) * 0.4, 0.768 + i * 0.004, (rng() - 0.5) * 0.4, rng() * 6)); }
  if (rng() < 0.6) g.add(at(mesh(cyl(0.04, 0.035, 0.1, 8), m.porcelain, false), 0.6, 0.82, 0.15)); // a mug
  if (rng() < 0.25) g.add(decal(mats.splat[(rng() * 4) | 0], 0.6, 0.1, 0.1, rng() * 6, 0.77)); // on the desk
  const ch = officeChair(mats, rng);
  g.add(at(ch, (rng() - 0.5) * 0.4, 0, 0.6 + rng() * 0.2, Math.PI + (rng() - 0.5) * 1.2));
  if (rng() < 0.35) ch.rotation.z = Math.PI / 2, ch.position.y = 0.25; // knocked over
  return g;
}
// a cubicle wall segment, len long, centred, 1.35 high
export function partition(mats, len) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(len, 1.35, 0.06), m.fabric), 0, 0.675, 0));
  g.add(at(mesh(box(len, 0.03, 0.08), m.chrome, false), 0, 1.36, 0));
  return g;
}
export function waterCooler(mats) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.32, 0.95, 0.32), m.plastic), 0, 0.475, 0));
  g.add(at(mesh(cyl(0.13, 0.13, 0.42, 10), phong({ color: 0x6a8a9a, transparent: true, opacity: 0.55, shininess: 120 }), false), 0, 1.16, 0));
  return g;
}
export function deadPlant(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(cyl(0.18, 0.13, 0.35, 8), m.plastic), 0, 0.175, 0));
  for (let i = 0; i < 7; i++) { const l = mesh(geo('leaf', () => new THREE.ConeGeometry(0.03, 0.5, 4)), phong({ color: 0x4a3a20 }), false); l.rotation.set((rng() - 0.5) * 1.6, rng() * 6, (rng() - 0.5) * 1.6); g.add(at(l, 0, 0.45, 0)); l.rotation.x += 0; }
  return g;
}
export function copier(mats) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.9, 0.95, 0.65), m.plastic), 0, 0.475, 0));
  g.add(at(mesh(box(0.9, 0.06, 0.65), m.black), 0, 0.98, 0));
  g.add(at(mesh(box(0.25, 0.04, 0.3), m.paper, false), 0.55, 0.7, 0));
  return g;
}
export function meetingTable(mats, rng, len = 3) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(len, 0.06, 1.1), m.wood), 0, 0.75, 0));
  for (const sx of [-1, 1]) g.add(at(mesh(box(0.08, 0.72, 0.8), m.wood), sx * (len / 2 - 0.3), 0.36, 0));
  for (let i = 0; i < Math.floor(len / 0.75); i++) for (const sz of [-1, 1]) {
    if (rng() < 0.2) continue;
    const ch = officeChair(mats, rng);
    g.add(at(ch, -len / 2 + 0.45 + i * 0.75, 0, sz * 0.8, sz > 0 ? Math.PI : 0));
  }
  return g;
}
// glowing: the only light in the break room some nights
export function vending(mats) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.9, 1.85, 0.75), m.black), 0, 0.925, 0));
  g.add(at(mesh(box(0.62, 1.3, 0.02), m.vend, false), -0.08, 1.1, 0.38));
  for (let y = 0; y < 5; y++) for (let x = 0; x < 4; x++) g.add(at(mesh(box(0.1, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: [0xd0c040, 0x4060c0, 0xc04040, 0x40a060][(x + y) % 4] }), false), -0.32 + x * 0.16, 0.62 + y * 0.24, 0.395));
  return g;
}
export function fridge(mats) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(0.7, 1.75, 0.68), m.porcelain), 0, 0.875, 0));
  g.add(at(mesh(box(0.03, 0.4, 0.03), m.chrome, false), 0.3, 1.2, 0.35));
  return g;
}
export function whiteboard(mats) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(1.6, 1.0, 0.03), m.whiteboard, false), 0, 1.5, 0.02));
  return g;
}

// ---------- the drains ----------
// a run of big pipe along a wall at head height; origin on the wall, along X
export function pipeRun(mats, len, rng) {
  const m = M(mats), g = g0();
  const p = mesh(cyl(0.2, 0.2, len, 10), m.pipe);
  p.rotation.z = Math.PI / 2;
  g.add(at(p, 0, 2.2, 0.25));
  for (let x = -len / 2 + 0.3; x < len / 2; x += 1.2) { const b = mesh(cyl(0.23, 0.23, 0.08, 10), mats.rust[1], false); b.rotation.z = Math.PI / 2; g.add(at(b, x, 2.2, 0.25)); }
  if (rng() < 0.5) { const drip1 = mesh(cyl(0.004, 0.004, 2.0, 4), m.slime, false); g.add(at(drip1, (rng() - 0.5) * len * 0.6, 1.1, 0.3)); }
  return g;
}
export function outflow(mats, rng) {
  const m = M(mats), g = g0();
  const p = mesh(cyl(0.35, 0.35, 0.6, 12), m.pipe); p.rotation.x = Math.PI / 2; g.add(at(p, 0, 0.6, 0.3));
  const hole = mesh(cyl(0.29, 0.29, 0.62, 12), new THREE.MeshBasicMaterial({ color: 0x050504 }), false); hole.rotation.x = Math.PI / 2; g.add(at(hole, 0, 0.6, 0.31));
  const stream = mesh(box(0.25, 0.6, 0.04), phong({ color: rng() < 0.4 ? 0x401008 : 0x3a4020, transparent: true, opacity: 0.8, shininess: 120 }), false);
  stream.rotation.x = 0.4; g.add(at(stream, 0, 0.25, 0.7));
  return g;
}
export function ladder(mats) {
  const g = g0();
  for (const sx of [-1, 1]) g.add(at(mesh(box(0.04, WALL_H, 0.04), mats.rust[0]), sx * 0.22, WALL_H / 2, 0.08));
  for (let y = 0.3; y < WALL_H; y += 0.3) { const rung = mesh(cyl(0.015, 0.015, 0.44, 5), mats.rust[0], false); rung.rotation.z = Math.PI / 2; g.add(at(rung, 0, y, 0.08)); }
  const shaft = mesh(cyl(0.45, 0.45, 0.02, 14), new THREE.MeshBasicMaterial({ color: 0x020202 }), false);
  g.add(at(shaft, 0, WALL_H - 0.005, 0.4));
  return g;
}
export function pump(mats, rng) {
  const m = M(mats), g = g0();
  const tank = mesh(cyl(0.6, 0.6, 1.6, 14), mats.rust[2]); g.add(at(tank, 0, 0.8, 0));
  g.add(at(mesh(box(0.8, 0.6, 0.6), m.greenMetal), 1.0, 0.3, 0));
  const fly = mesh(cyl(0.35, 0.35, 0.1, 14), m.black); fly.rotation.z = Math.PI / 2; g.add(at(fly, 1.45, 0.4, 0));
  const pipe = mesh(cyl(0.12, 0.12, 2.2, 8), m.pipe); g.add(at(pipe, 0, 2.2 + 0.2, 0));
  return g;
}
// where he sleeps, if he sleeps: rags, bones, a mattress, what's left of people
export function nest(mats, rng) {
  const m = M(mats), g = g0();
  const mat = mesh(box(1.8, 0.15, 0.9), m.rag); g.add(at(mat, 0, 0.075, 0, rng()));
  g.add(decal(mats.pool[(rng() * 3) | 0], 2.6, 0, 0, rng() * 6));
  for (let i = 0; i < 18; i++) { const b = mesh(cyl(0.02, 0.025, 0.2 + rng() * 0.3, 5), mats.bone, false); b.rotation.set(Math.PI / 2, rng() * 6, (rng() - 0.5)); g.add(at(b, (rng() - 0.5) * 2, 0.05 + rng() * 0.15, (rng() - 0.5) * 2)); }
  for (let i = 0; i < 3; i++) { const sk = mesh(sph(0.1, 8), mats.bone, false); sk.scale.set(0.85, 1, 1.1); g.add(at(sk, (rng() - 0.5) * 1.8, 0.1, (rng() - 0.5) * 1.8)); const eye = mesh(sph(0.025, 5), mats.black, false); g.add(at(eye, sk.position.x + 0.03, 0.13, sk.position.z + 0.09)); }
  for (let i = 0; i < 4; i++) g.add(at(meatChunk(mats, rng), (rng() - 0.5) * 2, 0.04, (rng() - 0.5) * 2, rng() * 6));
  g.add(at(severedArm(mats, rng), 0.6, 0.18, -0.2, rng() * 6));
  for (let i = 0; i < 5; i++) { const r = mesh(box(0.3 + rng() * 0.4, 0.04, 0.2 + rng() * 0.3), m.rag, false); g.add(at(r, (rng() - 0.5) * 2.4, 0.03, (rng() - 0.5) * 2.4, rng() * 6)); }
  return g;
}
// the water: one sheet over every wet tile, scrolled each frame so it moves
export function waterSheet(mats, tiles, TILE) {
  const m = M(mats);
  const pos = [], uv = [], idx = [];
  for (const [x, y] of tiles) {
    const b = pos.length / 3, x0 = x * TILE, z0 = y * TILE;
    pos.push(x0, 0, z0, x0 + TILE, 0, z0, x0 + TILE, 0, z0 + TILE, x0, 0, z0 + TILE);
    uv.push(x0 / 3, z0 / 3, (x0 + TILE) / 3, z0 / 3, (x0 + TILE) / 3, (z0 + TILE) / 3, x0 / 3, (z0 + TILE) / 3);
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const w = new THREE.Mesh(g, m.water);
  w.position.y = 0.12;
  w.renderOrder = 1;
  return w;
}

// ---------- the deep freeze ----------
// a bay of pallet racking, len long (along X), with boxes and plastic-wrapped meat on its shelves
export function palletRack(mats, rng, len = 3.6) {
  const m = M(mats), g = g0();
  const D = 1.0, levels = [0.15, 1.05, 1.95];
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / 2) for (const z of [-D / 2, D / 2]) g.add(at(mesh(box(0.08, 2.8, 0.08), m.rackBlue), x, 1.4, z));
  for (const y of levels) for (const z of [-D / 2, D / 2]) g.add(at(mesh(box(len, 0.1, 0.06), m.rackOrange), 0, y, z));
  for (const y of levels) for (let x = -len / 2 + 0.5; x < len / 2; x += 0.9) {
    if (rng() < 0.2) continue;
    const k = rng();
    if (k < 0.55) { const h = 0.3 + rng() * 0.4; const b = mesh(box(0.8, h, 0.85), m.boxes); g.add(at(b, x, y + 0.05 + h / 2, 0, (rng() - 0.5) * 0.15)); }
    else { // a side of something, shrink-wrapped and frozen, red showing through the plastic
      const w = mesh(cap(0.22, 0.45), m.wrap); w.rotation.z = Math.PI / 2; g.add(at(w, x, y + 0.27, 0));
      const meat = mesh(cap(0.19, 0.4), mats.meat, false); meat.rotation.z = Math.PI / 2; g.add(at(meat, x, y + 0.27, 0));
    }
  }
  // frost on the top shelf
  g.add(at(mesh(box(len, 0.02, D), m.ice, false), 0, 2.81, 0));
  return g;
}
export function forklift(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(1.1, 0.9, 1.9), m.yellow), 0, 0.65, 0));
  g.add(at(mesh(box(1.05, 0.08, 1.1), m.black), 0, 2.1, -0.1));
  for (const sx of [-1, 1]) { g.add(at(mesh(box(0.06, 1.8, 0.06), m.black), sx * 0.45, 1.2, 0.5)); g.add(at(mesh(box(0.06, 1.8, 0.06), m.black), sx * 0.45, 1.2, -0.7)); }
  for (const sx of [-1, 1]) { g.add(at(mesh(box(0.08, 2.4, 0.1), m.black), sx * 0.35, 1.25, 1.0)); g.add(at(mesh(box(0.12, 0.06, 1.1), mats.steel), sx * 0.3, 0.12, 1.55)); }
  for (const [sx, z] of [[-1, 0.6], [1, 0.6], [-1, -0.6], [1, -0.6]]) { const wh = mesh(cyl(0.28, 0.28, 0.22, 12), m.black); wh.rotation.z = Math.PI / 2; g.add(at(wh, sx * 0.56, 0.28, z)); }
  if (rng() < 0.5) { const b = makeBody(mats, rng, { dead: true }); b.root.rotation.set(-1.2, 0, 0.3); b.root.position.set(0, 1.0, -0.3); g.add(b.root); } // still at the wheel
  return g;
}
// a refrigeration unit high on a wall: fans, coils, icicles; origin on the wall facing +Z
export function coolerUnit(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(1.6, 0.55, 0.6), m.beigeMetal), 0, WALL_H - 0.45, 0.3));
  for (const x of [-0.45, 0.45]) { const f = mesh(cyl(0.22, 0.22, 0.02, 12), m.black, false); f.rotation.x = Math.PI / 2; g.add(at(f, x, WALL_H - 0.45, 0.61)); }
  for (let i = 0; i < 9; i++) { const ic = mesh(geo('icicle', () => new THREE.ConeGeometry(0.025, 0.3, 5)), m.ice, false); ic.rotation.x = Math.PI; ic.scale.y = 0.5 + rng(); g.add(at(ic, -0.75 + i * 0.19, WALL_H - 0.8 - ic.scale.y * 0.1, 0.55)); }
  return g;
}
export function crateStack(mats, rng) {
  const m = M(mats), g = g0();
  g.add(at(mesh(box(1.2, 0.14, 1.0), m.wood), 0, 0.07, 0));
  const n = 1 + (rng() * 3 | 0);
  for (let i = 0; i < n; i++) g.add(at(mesh(box(1.1, 0.5, 0.95), m.boxes), (rng() - 0.5) * 0.06, 0.39 + i * 0.5, (rng() - 0.5) * 0.06, (rng() - 0.5) * 0.1));
  return g;
}

// ---------- loot ----------
// on the floor: gun parts on a scrap of cloth, a box of bolts, or a keepsake (a small personal thing)
export function lootMesh(mats, type, meta, rng) {
  const m = M(mats), g = g0();
  const glint = new THREE.PointLight(type === 'keepsake' ? 0xffe0a0 : 0xd8e8ff, 0.6, 1.6, 2);
  glint.position.y = 0.25;
  g.add(glint);
  if (type === 'ammo') {
    g.add(at(mesh(box(0.16, 0.07, 0.1), m.cardboard), 0, 0.035, 0));
    for (let i = 0; i < 3; i++) { const b = mesh(cyl(0.008, 0.008, 0.09, 6), phong({ color: 0xc8a040, shininess: 120 }), false); b.rotation.z = Math.PI / 2; g.add(at(b, 0.02, 0.08, -0.03 + i * 0.03)); }
  } else if (type === 'part') {
    g.add(at(mesh(box(0.35, 0.01, 0.3), m.rag, false), 0, 0.005, 0, 0.3));
    if (meta.part === 'barrel') { const b = mesh(cyl(0.035, 0.04, 0.3, 10), mats.steel, false); b.rotation.z = Math.PI / 2; g.add(at(b, 0, 0.045, 0)); }
    else if (meta.part === 'spring') { const sp = mesh(geo('spring', () => new THREE.TorusKnotGeometry(0.035, 0.008, 40, 5, 1, 9)), mats.steel, false); sp.scale.set(1, 1, 2.2); sp.rotation.y = Math.PI / 2; g.add(at(sp, 0, 0.04, 0)); }
    else { const gr = mesh(box(0.05, 0.14, 0.07), phong({ color: 0x1a1612 }), false); gr.rotation.z = Math.PI / 2 - 0.3; g.add(at(gr, 0, 0.04, 0)); }
  } else { // a keepsake: the same model you turn over in the viewer, set down where it was dropped
    const k = meta.id ? keepsakeModel(meta.id) : new THREE.Group();
    const upright = ['toy-bear', 'toy-car', 'tape-dictaphone', 'misc-lighter', 'tooth-milk'].includes(meta.id);
    if (!upright) k.rotation.x = -Math.PI / 2;
    if (upright) k.rotation.y = rng() * 6; else k.rotation.z = rng() * 6;
    const hold = new THREE.Group(); hold.add(k);
    hold.scale.setScalar(1.6); // a touch bigger than life, so it reads at the end of a torch beam
    const bb = new THREE.Box3().setFromObject(hold);
    k.position.y = -bb.min.y + 0.002;
    g.add(hold);
  }
  return g;
}
