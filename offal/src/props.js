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

// bowel: a fat, wet, segmented rope that spills out of `start`, runs to the floor and heaps up in coils
// beside it (around `pile`, if given). The tube bulges every few centimetres so it reads as gut, not hose.
export function entrails(mats, rng, start, spread = 0.6, n = 9, pile = null) {
  const pts = [start.clone()];
  const c = pile ? pile.clone() : start.clone().add(new THREE.Vector3((rng() - 0.5) * spread * 0.5, 0, (rng() - 0.5) * spread * 0.5));
  const r0 = 0.035 + rng() * 0.01;
  if (start.y > 0.12) pts.push(new THREE.Vector3((start.x + c.x) / 2, Math.max(r0, start.y * 0.35), (start.z + c.z) / 2));
  let a = rng() * 6;
  const loops = 6 + n;
  for (let k = 0; k < loops; k++) {
    a += 1.2 + rng() * 0.9;
    const rad = spread * (0.1 + rng() * 0.16);
    c.x += (rng() - 0.5) * spread * 0.08;
    c.z += (rng() - 0.5) * spread * 0.08;
    pts.push(new THREE.Vector3(c.x + Math.cos(a) * rad, r0 + (k % 3) * r0 * 0.9 * rng(), c.z + Math.sin(a) * rad));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const seg = loops * 14, rs = 8, g = new THREE.TubeGeometry(curve, seg, r0, rs, false);
  // the segments: squeeze every ring toward the centre line on a short period
  const pos = g.attributes.position, P = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    curve.getPointAt(i / seg, C);
    const bulge = 0.72 + 0.4 * Math.abs(Math.sin(i * 0.9));
    for (let j = 0; j <= rs; j++) {
      const v = i * (rs + 1) + j;
      P.fromBufferAttribute(pos, v).sub(C).multiplyScalar(bulge).add(C);
      pos.setXYZ(v, P.x, P.y, P.z);
    }
  }
  g.computeVertexNormals();
  const grp = new THREE.Group();
  grp.add(mesh(g, mats.gut));
  return grp;
}

// the rest of what's inside a person: liver, stomach, a kidney, sometimes the heart
export function organs(mats, rng, n = 3) {
  mats.liver ||= new THREE.MeshPhongMaterial({ color: 0x3a0705, shininess: 140, specular: 0x884444 });
  mats.stomach ||= new THREE.MeshPhongMaterial({ color: 0xa65a50, map: mats.gut.map, shininess: 110, specular: 0x775555 });
  mats.heart ||= new THREE.MeshPhongMaterial({ color: 0x5a0a0a, map: mats.meat.map, shininess: 120, specular: 0x774444 });
  const g = new THREE.Group();
  const kinds = [
    () => { const o = new THREE.Group(); const l1 = mesh(sph(0.1, 12), mats.liver); l1.scale.set(1.3, 0.38, 0.85); const l2 = mesh(sph(0.07, 10), mats.liver); l2.scale.set(1.1, 0.4, 0.9); l2.position.set(0.12, -0.005, 0.03); o.add(l1, l2); return o; },
    () => { const o = mesh(sph(0.08, 12), mats.stomach); o.scale.set(1.35, 0.55, 0.8); return o; },
    () => { const o = mesh(sph(0.035, 10), mats.heart); o.scale.set(0.75, 0.6, 1.4); return o; },
    () => { const o = mesh(sph(0.055, 10), mats.heart); o.scale.set(0.9, 0.75, 1.1); const a = mesh(cyl(0.014, 0.012, 0.05, 6), mats.heart, false); a.position.set(0.01, 0.045, 0); a.rotation.z = 0.4; o.add(a); return o; },
  ];
  for (let i = 0; i < n; i++) {
    const o = kinds[i % kinds.length]();
    o.position.set((rng() - 0.5) * 0.3, 0.035, (rng() - 0.5) * 0.3);
    o.rotation.y = rng() * 6;
    g.add(o);
  }
  return g;
}

export function decal(mat, size, x, z, rot = 0, y = 0.012) {
  const m = new THREE.Mesh(geo(`d${size}`, () => new THREE.PlaneGeometry(size, size)), mat);
  m.rotation.set(-Math.PI / 2, 0, rot);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

// ---------- a person ----------
// One jointed human body, used for everything: the dead on the floor, the ones on hooks, the ones in drawers,
// and you, in the cutscenes. Built standing, facing +Z, origin at the pelvis; every joint is a group to pose.
export function makeBody(mats, rng, { cloth = null, skin = null, naked = false, bald = false, dead = true } = {}) {
  // the dead go grey and mottled; the bleach in the picture turns live-looking skin chalk white
  mats.skinDead ||= [mats.skin, mats.skinGrey].map((m) => new THREE.MeshPhongMaterial({ map: m.map, color: 0x8c8a7e, shininess: 25, specular: 0x1a1a1a }));
  skin ||= dead ? mats.skinDead[(rng() * 2) | 0] : rng() < 0.5 ? mats.skin : mats.skinGrey;
  cloth = naked ? skin : cloth || (rng() < 0.5 ? mats.coverall : mats.coverall2);
  const root = new THREE.Group();
  const pelvis = mesh(cap(0.105, 0.17), cloth);
  pelvis.rotation.z = Math.PI / 2;
  pelvis.scale.set(1, 1, 0.78);
  root.add(pelvis);
  const torso = new THREE.Group();
  torso.position.y = 0.07;
  root.add(torso);
  const belly = mesh(cyl(0.15, 0.135, 0.24, 10), cloth);
  belly.position.y = 0.12;
  belly.scale.z = 0.72;
  const chest = mesh(cyl(0.185, 0.152, 0.27, 10), cloth);
  chest.position.y = 0.37;
  chest.scale.z = 0.66;
  torso.add(belly, chest);
  for (const sx of [-1, 1]) { const sh = mesh(sph(0.07, 8), cloth); sh.position.set(sx * 0.175, 0.46, 0); sh.scale.set(1, 0.85, 0.9); torso.add(sh); }
  const neck = new THREE.Group();
  neck.position.y = 0.5;
  torso.add(neck);
  const neckM = mesh(cyl(0.045, 0.05, 0.11, 7), skin);
  neckM.position.y = 0.05;
  neck.add(neckM);
  const head = new THREE.Group();
  head.position.y = 0.11;
  neck.add(head);
  const skull = mesh(sph(0.1, 12), skin);
  skull.scale.set(0.86, 1.05, 1.0);
  skull.position.y = 0.1;
  head.add(skull);
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.06, 0.01);
  const jawM = mesh(sph(0.075, 10), skin);
  jawM.scale.set(0.85, 0.62, 1.0);
  jawM.position.set(0, -0.025, 0.025);
  jaw.add(jawM);
  head.add(jaw);
  const nose = mesh(geo('nose', () => new THREE.ConeGeometry(0.018, 0.045, 5)), skin, false);
  nose.position.set(0, 0.095, 0.1);
  nose.rotation.x = Math.PI / 2 - 0.3;
  head.add(nose);
  mats.sclera ||= new THREE.MeshPhongMaterial({ color: 0x8f8a7c, shininess: 80, specular: 0x333333 });
  mats.bruise ||= new THREE.MeshPhongMaterial({ color: 0x2a1512, shininess: 20, specular: 0x111111 });
  mats.mouthIn ||= new THREE.MeshPhongMaterial({ color: 0x1c0605, shininess: 60, specular: 0x331111 });
  for (const sx of [-1, 1]) {
    const ear = mesh(sph(0.026, 6), skin, false);
    ear.scale.set(0.4, 1, 0.7);
    ear.position.set(sx * 0.088, 0.095, -0.005);
    head.add(ear);
    // sunken, half open, looking at nothing
    const socket = mesh(sph(0.024, 8), mats.bruise, false);
    socket.scale.set(1.1, 0.8, 0.5);
    socket.position.set(sx * 0.035, 0.112, 0.08);
    const eye = mesh(sph(0.015, 8), mats.sclera, false);
    eye.position.set(sx * 0.035, 0.109, 0.084);
    const lid = mesh(sph(0.018, 8), skin, false);
    lid.scale.set(1.15, 0.62, 0.75);
    lid.position.set(sx * 0.035, 0.119, 0.087);
    head.add(socket, eye, lid);
  }
  // the mouth hangs open: a dark hole you see when the jaw drops, a few teeth at the top of it
  const hole = mesh(sph(0.026, 8), mats.mouthIn, false);
  hole.scale.set(0.95, 1.25, 0.55);
  hole.position.set(0, 0.04, 0.074);
  head.add(hole);
  const teeth = mesh(box(0.036, 0.011, 0.008), mats.tooth, false);
  teeth.position.set(0, 0.06, 0.088);
  head.add(teeth);
  const lip = mesh(box(0.05, 0.012, 0.014), skin, false);
  lip.position.set(0, 0.069, 0.09);
  head.add(lip);
  const trickle = mesh(box(0.008, 0.07, 0.004), mats.blood, false); // from the corner of the mouth
  trickle.position.set(0.022, 0.015, 0.082);
  trickle.rotation.z = 0.25;
  head.add(trickle);
  if (dead) {
    // the side of the head where it hit the floor, or something hit it
    const wound = mesh(geo('wound', () => new THREE.SphereGeometry(0.103, 10, 8, 0, 1.6, 0.2, 1.3)), mats.blood, false);
    wound.position.y = 0.1;
    wound.rotation.y = rng() * 6;
    head.add(wound);
  }
  if (!bald) {
    const hair = mesh(sph(0.104, 10), mats.darkMetal, false);
    hair.scale.set(0.9, 0.72, 1.04);
    hair.position.set(0, 0.14, -0.012);
    head.add(hair);
  }
  const arms = [-1, 1].map((sx) => {
    const sh = limb(cloth, 0.24, 0.046);
    sh.position.set(sx * 0.2, 0.44, 0);
    const el = limb(rng() < 0.5 ? skin : cloth, 0.22, 0.038);
    el.position.y = -0.29;
    sh.add(el);
    const hand = new THREE.Group();
    hand.position.y = -0.27;
    const palm = mesh(box(0.065, 0.085, 0.026), skin, false);
    palm.position.y = -0.045;
    const thumb = mesh(cap(0.011, 0.04), skin, false);
    thumb.position.set(sx * -0.035, -0.035, 0.012);
    thumb.rotation.z = sx * 0.5;
    hand.add(palm, thumb);
    el.add(hand);
    torso.add(sh);
    sh.userData = { el, hand };
    return sh;
  });
  const legs = [-1, 1].map((sx) => {
    const hip = limb(cloth, 0.35, 0.066);
    hip.position.set(sx * 0.09, -0.04, 0);
    const knee = limb(cloth, 0.35, 0.053);
    knee.position.y = -0.42;
    hip.add(knee);
    const boot = mesh(box(0.1, 0.09, 0.25), mats.bag, false);
    boot.position.set(0, -0.44, 0.055);
    knee.add(boot);
    root.add(hip);
    hip.userData = { knee, boot };
    return hip;
  });
  return { root, pelvis, torso, chest, belly, neck, head, jaw, arms, legs, skin, cloth };
}

// opened from the throat to the belt: a red cavity and the cage of ribs over it
export function openChest(b, mats) {
  const cav = mesh(sph(0.13, 10), mats.meat);
  cav.scale.set(1.05, 1.75, 0.38);
  cav.position.set(0, 0.27, 0.085);
  b.torso.add(cav);
  mats.lung ||= new THREE.MeshPhongMaterial({ color: 0x9a5a5a, map: mats.gut.map, shininess: 60, specular: 0x553333 });
  for (const [x, y, r, m] of [[-0.06, 0.36, 0.06, mats.lung], [0.065, 0.35, 0.055, mats.lung], [0.0, 0.26, 0.045, mats.gut], [0.03, 0.17, 0.05, mats.gut], [-0.05, 0.19, 0.045, mats.gut]]) {
    const lump = mesh(sph(r, 9), m, false);
    lump.scale.set(1, 1.2, 0.6);
    lump.position.set(x, y, 0.11);
    b.torso.add(lump);
  }
  for (let i = 0; i < 4; i++) {
    const rib = mesh(geo('chrib', () => new THREE.TorusGeometry(0.11, 0.011, 4, 10, Math.PI)), mats.bone, false);
    rib.rotation.x = Math.PI / 2;
    rib.scale.set(1.1, 1, 0.55);
    rib.position.set(0, 0.29 + i * 0.055, 0.075);
    b.torso.add(rib);
  }
  const sternum = mesh(box(0.025, 0.2, 0.012), mats.bone, false);
  sternum.position.set(0.11, 0.33, 0.13);
  sternum.rotation.z = 0.5;
  b.torso.add(sternum);
  return cav;
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
    const b = makeBody(mats, rng, { naked: true, bald: true });
    b.root.rotation.z = Math.PI; // upside down
    b.root.position.y = -0.95;
    b.legs.forEach((l, i) => { l.rotation.z = (i ? -1 : 1) * 0.28; });
    b.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * 0.15; a.userData.el.rotation.x = -0.1; });
    b.head.visible = false;
    const neck = stump(mats, 0.055);
    neck.position.y = 0.06;
    b.neck.add(neck);
    openChest(b, mats);
    body.add(b.root);
    const stream = mesh(cyl(0.006, 0.01, 1, 4), mats.blood, false);
    stream.scale.y = Math.max(0.2, WALL_H - chainLen - 2.05);
    stream.position.y = -1.95 - stream.scale.y / 2;
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
  const b = makeBody(mats, rng);
  const cavity = openChest(b, mats);
  // sprawled on its back where it fell: arms flung out, head lolled to one side, jaw hanging
  const lay = new THREE.Group();
  lay.rotation.x = -Math.PI / 2;
  lay.position.y = 0.125;
  lay.add(b.root);
  g.add(lay);
  b.arms.forEach((a, i) => {
    const sx = i ? 1 : -1;
    a.rotation.z = sx * (0.5 + rng() * 1.2);
    a.userData.el.rotation.z = sx * rng() * 0.9;
  });
  b.legs.forEach((l, i) => { l.rotation.z = (i ? -1 : 1) * (0.08 + rng() * 0.3); });
  if (rng() < 0.35) { const l = b.legs[(rng() * 2) | 0]; l.rotation.x = -0.75; l.userData.knee.rotation.x = 1.35; } // one knee up
  b.head.rotation.y = (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.6);
  b.jaw.rotation.x = 0.25 + rng() * 0.35;
  const parts = [];
  if (rng() < 0.25) { // something taken
    const a = b.arms[(rng() * 2) | 0];
    a.userData.el.visible = false;
    const st = stump(mats, 0.04);
    st.position.y = -0.29;
    st.rotation.x = Math.PI;
    a.add(st);
    parts.push('forearm');
  }
  // what came out of the belly, onto the floor beside it
  const side = rng() < 0.5 ? -1 : 1;
  const guts = entrails(mats, rng, new THREE.Vector3(0.05 * side, 0.2, -0.2), 1.1, 6, new THREE.Vector3(0.42 * side, 0, -0.12));
  g.add(guts);
  const org = organs(mats, rng, 1 + ((rng() * 3) | 0));
  org.position.set(0.5 * side, 0, -0.5);
  g.add(org);
  const pool = decal(mats.pool[(rng() * 3) | 0], 2.4, 0.05, -0.35, rng() * 6);
  g.add(pool);
  // the brass tag, deep in the opened chest
  const tag = mesh(box(0.07, 0.004, 0.045), mats.brass, false);
  tag.position.set(0.03, 0.25, -0.38);
  tag.rotation.set(0.6, 0.3, 0.4);
  g.add(tag);
  const N = 24, fp = new Float32Array(N * 3);
  const flies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fp, 3)),
    mats.fly ||= new THREE.PointsMaterial({ color: 0x1a140c, size: 0.007, sizeAttenuation: true }));
  flies.userData.seeds = Array.from({ length: N }, () => [rng() * 6, rng() * 6, 0.5 + rng(), rng() * 6]);
  flies.position.z = -0.35;
  g.add(flies);
  return { group: g, tag, cavity, pool, flies, parts, body: b };
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
  if (rng() < 0.45) { // under a sheet
    const t = mesh(cap(0.17, 1.3), mats.sheet);
    t.rotation.x = Math.PI / 2;
    t.scale.set(1.25, 1, 0.55);
    t.position.set(0, 0.13, -0.5);
    const feet = mesh(box(0.2, 0.15, 0.08), mats.skinGrey);
    feet.position.set(0, 0.16, 0.36);
    g.add(t, feet);
  } else {
    const b = makeBody(mats, rng, { naked: true, bald: rng() < 0.5 });
    b.legs.forEach((l) => { l.userData.boot.visible = false; });
    const lay = new THREE.Group();
    lay.rotation.x = -Math.PI / 2;
    lay.position.set(0, 0.12, -0.55);
    lay.add(b.root);
    b.arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * 0.12));
    b.jaw.rotation.x = 0.3;
    const cut = mesh(box(0.04, 0.42, 0.01), mats.meat, false); // the Y incision
    cut.position.set(0, 0.28, 0.12);
    b.torso.add(cut);
    g.add(lay);
  }
  const toe = mesh(box(0.05, 0.07, 0.003), mats.sheet, false);
  toe.position.set(0.09, 0.12, 0.42);
  g.add(toe);
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
