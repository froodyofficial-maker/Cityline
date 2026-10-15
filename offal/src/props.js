// Procedural props: carcasses, corpses, body parts, butcher tables, lockers, lamps and the freight lift.
import * as THREE from 'three';
import { WALL_H } from './config.js';

const cache = {};
// geometry shared between floors; the level teardown leaves these alone
const geo = (key, make) => cache[key] || (cache[key] = Object.assign(make(), { userData: { shared: true } }));

export function mesh(g, m, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
}
const box = (w, h, d) => geo(`b${w}_${h}_${d}`, () => new THREE.BoxGeometry(w, h, d));
const sph = (r, s = 10) => geo(`s${r}_${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s * 0.7 | 0)));
const cyl = (r0, r1, h, s = 8) => geo(`c${r0}_${r1}_${h}_${s}`, () => new THREE.CylinderGeometry(r0, r1, h, s));
const cap = (r, len) => geo(`k${r}_${len}`, () => new THREE.CapsuleGeometry(r, len, 3, 8));

// a limb hanging from its joint: the group's origin is the joint, the limb runs down -Y
export function limb(mat, len, r) {
  const g = new THREE.Group();
  const m = mesh(cap(r, len), mat);
  m.position.y = -len / 2;
  g.add(m);
  return g;
}

// the wet red cap on anything that was cut off
function stump(mats, r) {
  const g = new THREE.Group();
  const flesh = mesh(cyl(r * 1.02, r * 1.02, 0.02, 10), mats.meat, false);
  const bone = mesh(cyl(r * 0.35, r * 0.35, 0.05, 6), mats.bone, false);
  bone.position.y = 0.02;
  g.add(flesh, bone);
  return g;
}

export function entrails(mats, rng, start, spread = 0.6, n = 9) {
  const pts = [start.clone()];
  let p = start.clone();
  for (let i = 0; i < n; i++) {
    p = p.clone().add(new THREE.Vector3((rng() - 0.5) * spread * 0.6, -Math.min(p.y, 0.05) * 0.5 - 0.01, (rng() - 0.5) * spread * 0.6));
    p.y = Math.max(0.035, p.y);
    pts.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return mesh(new THREE.TubeGeometry(curve, n * 6, 0.028 + rng() * 0.012, 6, false), mats.gut);
}

export function decal(mat, size, x, z, rot = 0, y = 0.012) {
  const m = new THREE.Mesh(geo(`d${size}`, () => new THREE.PlaneGeometry(size, size)), mat);
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// ---------- hanging carcasses ----------
export function makeCarcass(mats, rng, human) {
  const root = new THREE.Group(); // origin at the ceiling rail; swings about it
  const chainLen = 0.5 + rng() * 0.4;
  for (let y = 0; y < chainLen; y += 0.07) {
    const link = mesh(geo('link', () => new THREE.TorusGeometry(0.03, 0.008, 4, 8)), mats.chain, false);
    link.position.y = -y;
    link.rotation.y = (y * 14.3) % 2 < 1 ? 0 : Math.PI / 2;
    root.add(link);
  }
  const hook = mesh(geo('hook', () => new THREE.TorusGeometry(0.09, 0.014, 5, 12, Math.PI * 1.4)), mats.darkMetal, false);
  hook.position.y = -chainLen - 0.08;
  hook.rotation.z = Math.PI * 0.8;
  root.add(hook);
  const body = new THREE.Group();
  body.position.y = -chainLen - 0.16;
  root.add(body);
  if (human) {
    // strung up by the ankles, opened down the front, no head
    const skin = rng() < 0.5 ? mats.skin : mats.skinGrey;
    for (const s of [-1, 1]) {
      const leg = mesh(cap(0.075, 0.75), skin);
      leg.position.set(s * 0.13, -0.42, 0);
      leg.rotation.z = s * 0.25;
      body.add(leg);
    }
    const torso = mesh(cap(0.17, 0.5), skin);
    torso.scale.set(1.15, 1, 0.75);
    torso.position.y = -1.05;
    body.add(torso);
    const cut = mesh(sph(0.15), mats.meat);
    cut.scale.set(0.75, 2.4, 0.5);
    cut.position.set(0, -1.05, 0.08);
    body.add(cut);
    for (let i = 0; i < 5; i++) {
      const rib = mesh(geo('rib', () => new THREE.TorusGeometry(0.13, 0.012, 4, 10, Math.PI)), mats.bone, false);
      rib.position.set(0, -1.12 + i * 0.07, 0.03);
      rib.rotation.set(-Math.PI / 2 + 0.2, 0, 0);
      body.add(rib);
    }
    for (const s of [-1, 1]) {
      const arm = limb(skin, 0.55, 0.05);
      arm.position.set(s * 0.21, -1.3, 0);
      arm.rotation.z = s * 0.08;
      body.add(arm);
    }
    const neck = stump(mats, 0.06);
    neck.position.y = -1.42;
    neck.rotation.x = Math.PI;
    body.add(neck);
    // it is still running down onto the floor
    const stream = mesh(cyl(0.006, 0.01, 1, 4), mats.blood, false);
    stream.scale.y = WALL_H - chainLen - 1.6;
    stream.position.y = -1.45 - stream.scale.y / 2;
    body.add(stream);
  } else {
    // a split side: fat outside, meat and ribs in the cavity
    const prof = [[0.02, 0], [0.13, 0.1], [0.22, 0.32], [0.25, 0.65], [0.21, 0.95], [0.11, 1.12], [0.02, 1.18]].map(([r, y]) => new THREE.Vector2(r, y));
    const lg = geo('lathe', () => new THREE.LatheGeometry(prof, 10, 0, Math.PI));
    const outer = mesh(lg, mats.fat);
    mats.meatInside ||= new THREE.MeshPhongMaterial({ map: mats.meat.map, side: THREE.BackSide, shininess: 70, specular: 0x552222 });
    const inner = mesh(lg, mats.meatInside);
    inner.castShadow = false;
    for (const m of [outer, inner]) { m.position.y = -1.2; m.scale.z = 0.8; body.add(m); }
    for (let i = 0; i < 7; i++) {
      const rib = mesh(geo('prib', () => new THREE.TorusGeometry(0.2, 0.011, 4, 10, Math.PI)), mats.bone, false);
      rib.position.set(0, -0.95 + i * 0.09, 0);
      rib.rotation.x = Math.PI / 2;
      rib.scale.set(1, 0.7, 1);
      body.add(rib);
    }
    for (const s of [-1, 1]) {
      const leg = mesh(cap(0.05, 0.35), mats.fat);
      leg.position.set(s * 0.06, -0.15, 0.05);
      leg.rotation.z = s * 0.4;
      body.add(leg);
    }
  }
  root.userData.swing = { a: (rng() - 0.5) * 0.15, v: 0, phase: rng() * 6 };
  return root;
}

// ---------- the dead workers you cut tags out of ----------
export function makeCorpse(mats, rng) {
  const g = new THREE.Group();
  const cloth = rng() < 0.5 ? mats.coverall : mats.coverall2;
  const skin = rng() < 0.5 ? mats.skin : mats.skinGrey;
  const torso = mesh(cap(0.17, 0.42), cloth);
  torso.rotation.z = Math.PI / 2;
  torso.scale.set(0.75, 1, 1.25);
  torso.position.set(0, 0.13, 0);
  g.add(torso);
  // opened chest
  const cavity = mesh(sph(0.15), mats.meat);
  cavity.scale.set(1.5, 0.4, 0.95);
  cavity.position.set(0.05, 0.22, 0);
  g.add(cavity);
  for (let i = 0; i < 4; i++) {
    const rib = mesh(geo('crib', () => new THREE.TorusGeometry(0.15, 0.01, 4, 8, Math.PI)), mats.bone, false);
    rib.position.set(-0.08 + i * 0.07, 0.17, 0);
    rib.rotation.y = Math.PI / 2;
    rib.scale.y = 0.55;
    g.add(rib);
  }
  const head = new THREE.Group();
  head.position.set(0.52, 0.11, (rng() - 0.5) * 0.08);
  head.rotation.set((rng() - 0.5) * 1.2, (rng() - 0.5) * 0.8, 0);
  const skull = mesh(sph(0.11, 10), skin);
  skull.scale.set(1.1, 0.95, 0.9);
  head.add(skull);
  for (const s of [-1, 1]) {
    const eye = mesh(sph(0.022, 6), mats.black, false);
    eye.position.set(0.035, 0.07, s * 0.04);
    head.add(eye);
  }
  const mouth = mesh(sph(0.03, 6), mats.black, false);
  mouth.scale.set(0.6, 0.4, 1.2);
  mouth.position.set(0.09, 0.07, 0);
  head.add(mouth);
  g.add(head);
  // limbs, sometimes not all of them
  const parts = [];
  for (const s of [-1, 1]) {
    if (rng() < 0.2) {
      const st = stump(mats, 0.055);
      st.position.set(0.3, 0.12, s * 0.24);
      st.rotation.x = s * Math.PI / 2;
      g.add(st);
      parts.push(['arm', s]);
    } else {
      const arm = limb(rng() < 0.6 ? cloth : skin, 0.5, 0.05);
      arm.position.set(0.3, 0.06, s * 0.22);
      arm.rotation.set(-s * Math.PI / 2, (rng() - 0.5) * 1.6, 0, 'YXZ'); // laid flat, then fanned out
      g.add(arm);
    }
    const leg = limb(cloth, 0.75, 0.07);
    leg.position.set(-0.32, 0.08, s * 0.1);
    leg.rotation.set(0, s * (0.1 + rng() * 0.35), -Math.PI / 2, 'YXZ');
    g.add(leg);
  }
  const guts = entrails(mats, rng, new THREE.Vector3(0.05, 0.22, 0.1), 0.9, 10);
  g.add(guts);
  const pool = decal(mats.pool[(rng() * 3) | 0], 2.2, 0, 0, rng() * 6);
  g.add(pool);
  // the brass tag, poking out of the opened chest
  const tag = mesh(box(0.07, 0.004, 0.045), mats.brass, false);
  tag.position.set(0.06, 0.28, 0.02);
  tag.rotation.set(0.6, 0.3, 0.4);
  g.add(tag);
  // flies
  const N = 24, fp = new Float32Array(N * 3);
  const flies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fp, 3)),
    mats.fly ||= new THREE.PointsMaterial({ color: 0x1a140c, size: 0.007, sizeAttenuation: true }));
  flies.userData.seeds = Array.from({ length: N }, () => [rng() * 6, rng() * 6, 0.5 + rng(), rng() * 6]);
  g.add(flies);
  return { group: g, tag, cavity, pool, flies, parts };
}

export function animateFlies(flies, t) {
  const p = flies.geometry.attributes.position, s = flies.userData.seeds;
  for (let i = 0; i < s.length; i++) {
    const [a, b, sp, c] = s[i];
    p.setXYZ(i, Math.sin(t * sp * 3 + a) * 0.45 + Math.sin(t * 9 + c) * 0.06, 0.35 + Math.sin(t * sp * 2 + b) * 0.28, Math.cos(t * sp * 2.5 + c) * 0.45 + Math.cos(t * 11 + a) * 0.05);
  }
  p.needsUpdate = true;
}

// ---------- loose body parts ----------
export function severedArm(mats, rng) {
  const g = new THREE.Group();
  const skin = rng() < 0.5 ? mats.skin : mats.skinGrey;
  const a = mesh(cap(0.05, 0.5), skin);
  a.rotation.z = Math.PI / 2;
  g.add(a);
  const st = stump(mats, 0.05);
  st.position.x = 0.3;
  st.rotation.z = -Math.PI / 2;
  g.add(st);
  const hand = mesh(box(0.1, 0.03, 0.08), skin);
  hand.position.x = -0.33;
  g.add(hand);
  g.position.y = 0.05;
  return g;
}

export function severedHead(mats, rng) {
  const g = new THREE.Group();
  const skin = rng() < 0.5 ? mats.skin : mats.skinGrey;
  const s = mesh(sph(0.11, 12), skin);
  s.scale.set(0.9, 1.1, 0.95);
  g.add(s);
  const hair = mesh(sph(0.115, 10), mats.darkMetal);
  hair.scale.set(0.95, 0.75, 1);
  hair.position.y = 0.04;
  hair.position.z = -0.01;
  g.add(hair);
  for (const x of [-1, 1]) {
    const e = mesh(sph(0.022, 6), mats.black, false);
    e.position.set(x * 0.04, 0.02, 0.09);
    g.add(e);
  }
  const m = mesh(sph(0.035, 6), mats.black, false);
  m.scale.set(1, 1.3, 0.6);
  m.position.set(0, -0.06, 0.085);
  g.add(m);
  const st = stump(mats, 0.06);
  st.position.y = -0.11;
  st.rotation.x = Math.PI;
  g.add(st);
  g.position.y = 0.11;
  return g;
}

export function meatChunk(mats, rng) {
  const m = mesh(geo('chunk', () => new THREE.IcosahedronGeometry(0.1, 0)), rng() < 0.5 ? mats.meat : mats.gut);
  m.scale.set(0.6 + rng(), 0.4 + rng() * 0.4, 0.6 + rng());
  m.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  m.position.y = 0.04;
  return m;
}

export function cleaver(mats) {
  const g = new THREE.Group();
  const blade = mesh(box(0.28, 0.005, 0.13), mats.steel);
  const handle = mesh(cyl(0.015, 0.015, 0.14, 6), mats.darkMetal);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(-0.2, 0, -0.04);
  g.add(blade, handle);
  return g;
}

export function bucket(mats) {
  const g = new THREE.Group();
  const b = mesh(cyl(0.16, 0.13, 0.32, 10), mats.steel);
  b.position.y = 0.16;
  const fill = mesh(cyl(0.15, 0.15, 0.01, 10), mats.blood, false);
  fill.position.y = 0.3;
  g.add(b, fill);
  return g;
}

// ---------- furniture ----------
export function butcherTable(mats, rng) {
  const g = new THREE.Group();
  const top = mesh(box(1.8, 0.06, 0.8), mats.steel);
  top.position.y = 0.9;
  g.add(top);
  for (const x of [-0.82, 0.82]) for (const z of [-0.34, 0.34]) {
    const l = mesh(cyl(0.025, 0.025, 0.9, 6), mats.darkMetal);
    l.position.set(x, 0.45, z);
    g.add(l);
  }
  const shelf = mesh(box(1.7, 0.03, 0.7), mats.darkMetal);
  shelf.position.y = 0.25;
  g.add(shelf);
  // what's on it
  const n = 2 + ((rng() * 3) | 0);
  for (let i = 0; i < n; i++) {
    const k = rng();
    let p;
    if (k < 0.25) p = severedArm(mats, rng);
    else if (k < 0.45) p = severedHead(mats, rng);
    else if (k < 0.7) p = entrails(mats, rng, new THREE.Vector3(0, 0.05, 0), 0.6, 8);
    else if (k < 0.85) p = cleaver(mats);
    else p = meatChunk(mats, rng);
    p.position.x += -0.6 + (i / Math.max(1, n - 1)) * 1.2;
    p.position.z += (rng() - 0.5) * 0.4;
    p.position.y += 0.93;
    p.rotation.y = rng() * 6;
    g.add(p);
  }
  for (let i = 0; i < 4; i++) { // runoff
    const s = mesh(cyl(0.004, 0.006, 0.9, 4), mats.blood, false);
    s.position.set((rng() - 0.5) * 1.6, 0.45, 0.4);
    g.add(s);
  }
  g.add(decal(mats.pool[(rng() * 3) | 0], 1.8, 0, 0.5, rng() * 6));
  return g;
}

export function gurney(mats, rng) {
  const g = new THREE.Group();
  const frame = mesh(box(1.9, 0.04, 0.65), mats.steel);
  frame.position.y = 0.75;
  g.add(frame);
  for (const x of [-0.85, 0.85]) for (const z of [-0.28, 0.28]) {
    const l = mesh(cyl(0.02, 0.02, 0.75, 5), mats.darkMetal);
    l.position.set(x, 0.375, z);
    g.add(l);
  }
  // a shape under the sheet
  const body = new THREE.Group();
  body.position.y = 0.85;
  const t = mesh(cap(0.18, 0.6), mats.sheet);
  t.rotation.z = Math.PI / 2;
  t.scale.set(0.6, 1, 1.2);
  const h = mesh(sph(0.13), mats.sheet);
  h.position.x = 0.62;
  const l = mesh(cap(0.12, 0.7), mats.sheet);
  l.rotation.z = Math.PI / 2;
  l.scale.set(0.6, 1, 1.4);
  l.position.x = -0.65;
  body.add(t, h, l);
  g.add(body);
  if (rng() < 0.6) { // an arm slipped out from under the sheet
    const arm = limb(mats.skinGrey, 0.5, 0.045);
    arm.position.set(0.25, 0.8, 0.3);
    arm.rotation.x = -0.2;
    g.add(arm);
  }
  g.add(decal(mats.splat[(rng() * 4) | 0], 1.2, 0.3, 0.35, rng() * 6));
  return g;
}

export function bodyBag(mats, rng) {
  const g = new THREE.Group();
  const b = mesh(cap(0.22, 1.2), mats.bag);
  b.rotation.z = Math.PI / 2;
  b.scale.set(0.5, 1, 1);
  b.position.y = 0.11;
  g.add(b);
  if (rng() < 0.5) {
    const ooze = decal(mats.pool[(rng() * 3) | 0], 1.4, 0.2, 0, rng() * 6);
    g.add(ooze);
  }
  return g;
}

export function makeLocker(mats, rng) {
  const g = new THREE.Group(); // origin on the floor at the front centre; faces +Z
  const mat = mats.rust[(rng() * 3) | 0];
  const body = mesh(box(0.62, 1.95, 0.5), mat);
  body.position.set(0, 0.975, -0.27);
  g.add(body);
  const hinge = new THREE.Group();
  hinge.position.set(-0.3, 0, -0.01);
  const door = mesh(box(0.6, 1.9, 0.025), mat);
  door.position.set(0.3, 0.975, 0);
  hinge.add(door);
  g.add(hinge);
  g.userData.hinge = hinge;
  g.userData.door = door;
  return g;
}

export function makeLamp(mats, kind) {
  const g = new THREE.Group();
  if (kind === 'tube') {
    const h = mesh(box(1.3, 0.06, 0.2), mats.darkMetal, false);
    const t = mesh(box(1.2, 0.04, 0.08), mats.lampOn, false);
    t.position.y = -0.04;
    g.add(h, t);
    g.position.y = WALL_H - 0.04;
    g.userData.bulb = t;
  } else {
    const wire = mesh(cyl(0.006, 0.006, 0.6, 4), mats.black, false);
    wire.position.y = -0.3;
    const shade = mesh(geo('shade', () => new THREE.ConeGeometry(0.2, 0.15, 10, 1, true)), mats.darkMetal, false);
    shade.position.y = -0.62;
    shade.material.side = THREE.DoubleSide;
    const b = mesh(sph(0.05, 8), mats.lampOn, false);
    b.position.y = -0.7;
    g.add(wire, shade, b);
    g.position.y = WALL_H;
    g.userData.bulb = b;
  }
  return g;
}

export function ceilingRail(mats, len) {
  const r = mesh(box(len, 0.06, 0.05), mats.darkMetal, false);
  r.position.y = WALL_H - 0.03;
  return r;
}

export function hangingChain(mats, rng) {
  const g = new THREE.Group();
  const len = 0.8 + rng() * 1.2;
  for (let y = 0; y < len; y += 0.07) {
    const link = mesh(geo('link', () => new THREE.TorusGeometry(0.03, 0.008, 4, 8)), mats.chain, false);
    link.position.y = -y;
    link.rotation.y = (y * 14.3) % 2 < 1 ? 0 : Math.PI / 2;
    g.add(link);
  }
  const hook = mesh(geo('hook', () => new THREE.TorusGeometry(0.09, 0.014, 5, 12, Math.PI * 1.4)), mats.darkMetal, false);
  hook.position.y = -len - 0.08;
  hook.rotation.z = Math.PI * 0.8;
  g.add(hook);
  if (rng() < 0.5) { // something is still on the hook
    const m = meatChunk(mats, rng);
    m.position.y = -len - 0.2;
    g.add(m);
  }
  g.position.y = WALL_H;
  g.userData.swing = { a: 0, v: 0, phase: rng() * 6 };
  return g;
}

// ---------- the freight lift ----------
// built in the alcove's local frame: origin at the alcove centre, the room opening at -Z
export function makeLift(mats, slots) {
  const g = new THREE.Group();
  const plate = mesh(box(1.9, 0.06, 1.9), mats.darkMetal);
  plate.position.y = 0.03;
  g.add(plate);
  const bars = new THREE.Group();
  for (let i = 0; i < 13; i++) {
    const b = mesh(cyl(0.012, 0.012, WALL_H - 0.2, 4), mats.chain, false);
    b.position.set(-0.95 + i * 0.158, (WALL_H - 0.2) / 2, 0);
    bars.add(b);
  }
  for (const y of [0.1, 1.2, WALL_H - 0.3]) {
    const r = mesh(box(1.95, 0.04, 0.03), mats.chain, false);
    r.position.y = y;
    bars.add(r);
  }
  bars.position.z = -0.98;
  g.add(bars);
  // caged bulb: the only light you can count on
  const bulb = mesh(sph(0.06, 8), mats.lampOn, false);
  bulb.position.set(0, WALL_H - 0.25, 0.2);
  g.add(bulb);
  const cage = mesh(sph(0.1, 6), new THREE.MeshBasicMaterial({ color: 0x111111, wireframe: true }), false);
  cage.position.copy(bulb.position);
  g.add(cage);
  // tag panel on the right-hand wall
  const panel = new THREE.Group();
  panel.position.set(0.94, 1.3, 0.1);
  panel.rotation.y = -Math.PI / 2;
  const back = mesh(box(0.5, 0.7, 0.06), mats.rust[0]);
  panel.add(back);
  const lights = [];
  for (let i = 0; i < slots; i++) {
    const l = mesh(sph(0.025, 6), new THREE.MeshBasicMaterial({ color: 0x220806 }), false);
    l.position.set(-0.18 + (i % 3) * 0.18, 0.2 - Math.floor(i / 3) * 0.12, 0.04);
    panel.add(l);
    lights.push(l);
  }
  const slot = mesh(box(0.12, 0.02, 0.02), mats.black, false);
  slot.position.set(0, -0.08, 0.035);
  panel.add(slot);
  const lever = new THREE.Group();
  lever.position.set(0, -0.22, 0.04);
  const arm = mesh(cyl(0.015, 0.015, 0.2, 5), mats.darkMetal, false);
  arm.position.y = 0.1;
  const knob = mesh(sph(0.03, 6), new THREE.MeshPhongMaterial({ color: 0x6a0a06 }), false);
  knob.position.y = 0.2;
  lever.add(arm, knob);
  lever.rotation.z = 0.6;
  panel.add(lever);
  g.add(panel);
  g.userData = { bars, lights, lever, panel, bulb };
  return g;
}

// ---------- the morgue ----------
// a body on a drawer tray, feet toward you, the way they always come out
function trayBody(mats, rng) {
  const g = new THREE.Group();
  const skin = mats.skinGrey;
  const covered = rng() < 0.5;
  const torso = mesh(cap(0.16, 0.5), covered ? mats.sheet : skin);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1.2, 1, 0.6);
  torso.position.set(0, 0.12, -0.75);
  const head = mesh(sph(0.1, 10), covered ? mats.sheet : skin);
  head.position.set(0, 0.12, -1.35);
  const legs = mesh(cap(0.12, 0.7), covered ? mats.sheet : skin);
  legs.rotation.x = Math.PI / 2;
  legs.scale.set(1.5, 1, 0.55);
  legs.position.set(0, 0.1, -0.05);
  g.add(torso, head, legs);
  for (const s of [-1, 1]) { // bare feet sticking out, always
    const foot = mesh(box(0.08, 0.14, 0.05), skin);
    foot.position.set(s * 0.07, 0.15, 0.36);
    g.add(foot);
  }
  const toe = mesh(box(0.05, 0.07, 0.003), mats.sheet, false);
  toe.position.set(0.09, 0.1, 0.4);
  g.add(toe);
  if (!covered) { const cut = mesh(box(0.05, 0.01, 0.4), mats.meat, false); cut.position.set(0, 0.2, -0.8); g.add(cut); } // the Y incision
  return g;
}

// a 3x3 bank of body drawers on a wall; origin on the wall at the bottom middle, facing +Z.
// labels: optional canvas texture for the plates. returns { group, drawers: [{ grp, local: Vector3, open }] }
export function drawerBank(mats, rng, labelTex, bodies = 0.6) {
  const group = new THREE.Group();
  const frame = mesh(box(2, 2.3, 0.26), mats.steel);
  frame.position.set(0, 1.15, 0.13);
  group.add(frame);
  if (labelTex) {
    const plate = new THREE.Mesh(geo('dbplate', () => new THREE.PlaneGeometry(2, 2.3)), new THREE.MeshBasicMaterial({ map: labelTex, transparent: true }));
    plate.position.set(0, 1.15, 0.262);
    group.add(plate);
  }
  const drawers = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const grp = new THREE.Group();
    const x = (c - 1) * 0.63, y = 0.42 + r * 0.66;
    grp.position.set(x, y, 0);
    const front = mesh(box(0.56, 0.5, 0.05), mats.steel);
    front.position.z = 0.27;
    const handle = mesh(box(0.22, 0.03, 0.04), mats.darkMetal, false);
    handle.position.set(0, -0.12, 0.31);
    const tray = mesh(box(0.5, 0.03, 1.8), mats.steel, false);
    tray.position.set(0, -0.2, -0.62);
    grp.add(front, handle, tray);
    if (rng() < bodies) { const b = trayBody(mats, rng); b.position.y = -0.2; grp.add(b); }
    group.add(grp);
    drawers.push({ grp, local: new THREE.Vector3(x, y, 0.3), open: 0, target: 0 });
  }
  return { group, drawers };
}

// the slab in the middle of the room
export function autopsyTable(mats, rng) {
  const g = new THREE.Group();
  const top = mesh(box(2, 0.06, 0.8), mats.steel);
  top.position.y = 0.92;
  const lip = mesh(box(2, 0.05, 0.05), mats.steel, false);
  lip.position.set(0, 0.97, 0.38);
  const lip2 = lip.clone();
  lip2.position.z = -0.38;
  const ped = mesh(cyl(0.12, 0.2, 0.9, 8), mats.steel);
  ped.position.y = 0.45;
  g.add(top, lip, lip2, ped);
  const body = trayBody(mats, rng);
  body.rotation.y = Math.PI / 2;
  body.position.set(-0.4, 0.95, 0);
  g.add(body);
  if (rng() < 0.6) { const guts = entrails(mats, rng, new THREE.Vector3(0.2, 1.05, 0.1), 0.5, 7); g.add(guts); }
  g.add(decal(mats.pool[(rng() * 3) | 0], 1.4, 0, 0, rng() * 6));
  return g;
}
