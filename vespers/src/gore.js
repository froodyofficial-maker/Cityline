// Bodies, carcasses, organs and other horrors, assembled from primitives.
import * as THREE from 'three';
import { R } from './state.js';
import * as TX from './textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
let M = null;
export function goreMats() {
  if (M) return M;
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  M = {
    muscle: phong({ map: TX.muscleTex(), shininess: 70, specular: 0x552222 }),
    meat: phong({ map: TX.meatTex(), shininess: 60, specular: 0x442222 }),
    skin: new THREE.MeshLambertMaterial({ map: TX.skinTex() }),
    skinGrey: new THREE.MeshLambertMaterial({ map: TX.skinTex([140, 138, 130]) }),
    skinStitched: new THREE.MeshLambertMaterial({ map: TX.skinTex([185, 160, 145], true) }),
    bone: new THREE.MeshLambertMaterial({ map: TX.boneTex() }),
    organ: phong({ color: 0x5a0c14, shininess: 90, specular: 0x663333 }),
    liver: phong({ color: 0x3a0814, shininess: 80, specular: 0x553333 }),
    gut: phong({ color: 0x9a4a52, shininess: 90, specular: 0x664444 }),
    cavity: new THREE.MeshLambertMaterial({ color: 0x2a0303, side: THREE.DoubleSide }),
    blood: phong({ color: 0x3a0000, shininess: 120, specular: 0x772222 }),
    bloodLiquid: phong({ color: 0x4a0202, shininess: 140, specular: 0x993333, emissive: 0x140000 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    teeth: new THREE.MeshLambertMaterial({ color: 0xc8bc9a }),
    hair: new THREE.MeshLambertMaterial({ color: 0x15100c }),
    eye: new THREE.MeshPhongMaterial({ color: 0xd8d2c0, shininess: 100 }),
    metal: new THREE.MeshLambertMaterial({ map: TX.metalTex(0.5) }),
    steel: new THREE.MeshPhongMaterial({ map: TX.metalTex(0.15), shininess: 80, specular: 0x888888 }),
    sheet: new THREE.MeshLambertMaterial({ map: TX.sheetTex() }),
    cloth: new THREE.MeshLambertMaterial({ color: 0x2e3436 }),
    pelt: new THREE.MeshLambertMaterial({ map: TX.peltTex(), alphaTest: 0.5, side: THREE.DoubleSide }),
  };
  return M;
}

const _up = V(0, 1, 0);
export function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; if (parent) parent.add(m); return m;
}
// cylinder between two points
export function limb(parent, a, b, r1, r2, mat, seg = 6) {
  const d = b.clone().sub(a), len = d.length();
  const m = mesh(new THREE.CylinderGeometry(r2, r1, len, seg), mat, parent);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  return m;
}
export function ball(parent, p, r, mat, sx = 1, sy = 1, sz = 1, seg = 8) {
  const m = mesh(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), mat, parent); m.position.copy(p); m.scale.set(sx, sy, sz); return m;
}
// bloody stump with a bone poking out, at point p facing dir
export function stump(parent, p, dir, r) {
  const m = goreMats();
  const g = new THREE.Group(); g.position.copy(p); g.quaternion.setFromUnitVectors(_up, dir.clone().normalize()); parent.add(g);
  mesh(new THREE.CylinderGeometry(r * 1.05, r, 0.02, 7), m.blood, g, 0, 0.01, 0);
  mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.35, 0.07, 5), m.bone, g, r * 0.1, 0.04, 0);
  for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(r * 0.25, 0.06 + R() * 0.06, 4), m.muscle, g, (R() - 0.5) * r, 0.03, (R() - 0.5) * r);
  return g;
}

// ------------------------------------------------------------------
// A human body from joint positions. opts:
//   flayed, skinned (bool), openChest, missing: ['lArm','rLeg',...], forearmOnly etc, face: 'skin'|'flayed'|'skull'
// ------------------------------------------------------------------
export function body(j, opts = {}) {
  const m = goreMats(), g = new THREE.Group();
  const flesh = opts.flayed ? m.muscle : (opts.grey ? m.skinGrey : m.skin);
  const limbMat = opts.flayedLimbs ? m.muscle : flesh;
  const miss = new Set(opts.missing || []);
  // torso, built in its own frame: y = spine, z = front
  const up = j.neck.clone().sub(j.pelvis), len = up.length(); up.normalize();
  const front = (opts.front || V(0, 0, 1)).clone(); front.addScaledVector(up, -front.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(up, front).normalize();
  const torso = new THREE.Group(); torso.position.copy(j.pelvis);
  torso.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, front));
  g.add(torso);
  const gap = opts.openChest ? 1.9 : 0;
  const tg = new THREE.CylinderGeometry(0.16, 0.135, len, 12, 1, false, gap / 2, Math.PI * 2 - gap); tg.translate(0, len / 2, 0); tg.scale(1, 1, 0.62);
  const tm = mesh(tg, opts.openChest ? m.meat : flesh, torso); if (opts.openChest) tm.material = m.meat.clone(), tm.material.side = THREE.DoubleSide;
  if (opts.openChest) {
    // cavity, organs, and the ribs pried open like a book
    mesh(new THREE.CylinderGeometry(0.13, 0.11, len * 0.9, 8, 1, true), m.cavity, torso, 0, len * 0.48, -0.01).scale.z = 0.5;
    ball(torso, V(0.03, len * 0.72, 0.02), 0.07, m.organ, 1, 1.2, 0.7);          // heart/lungs mass
    ball(torso, V(-0.05, len * 0.62, 0.02), 0.06, m.organ, 1.1, 1.4, 0.6);
    ball(torso, V(0.05, len * 0.45, 0.03), 0.075, m.liver, 1.3, 0.7, 0.6);      // liver
    intestines(torso, V(0, len * 0.22, 0.03), 0.09, 26, 0.022);
    for (let i = 0; i < 6; i++) {
      const y = len * (0.55 + i * 0.07), rr = 0.14 - Math.abs(i - 2) * 0.006;
      for (const s of [-1, 1]) {
        const rib = mesh(new THREE.TorusGeometry(rr, 0.011, 3, 8, Math.PI * 0.55), m.bone, torso, 0, y, 0);
        rib.rotation.set(Math.PI / 2, 0, s > 0 ? -0.1 : Math.PI * 0.45 + 0.1);
        rib.scale.set(1, 0.62, 1);
        // pry outward
        const p = new THREE.Group(); p.position.set(s * rr * 0.6, 0, rr * 0.25); torso.add(p); p.attach(rib); p.rotation.y = s * (0.9 + R() * 0.4);
      }
    }
    // sternum lying loose
    mesh(new THREE.BoxGeometry(0.035, len * 0.4, 0.015), m.bone, torso, 0.18, len * 0.7, 0.12).rotation.z = 0.6;
  } else if (opts.flayed) {
    for (let i = 0; i < 5; i++) { const rib = mesh(new THREE.TorusGeometry(0.15, 0.012, 3, 8, Math.PI * 0.9), m.bone, torso, 0, len * (0.55 + i * 0.08), 0.0); rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.05); rib.scale.set(1, 0.65, 1); }
  }
  if (opts.gutsOut) intestinesHang(torso, V(0, len * 0.25, 0.08), opts.gutsOut);
  // pelvis
  ball(g, j.pelvis, 0.15, flesh, 1, 0.7, 0.75);
  // neck + head
  if (!miss.has('head')) {
    limb(g, j.neck, j.head.clone().lerp(j.neck, 0.45), 0.05, 0.045, limbMat);
    g.userData.head = head(g, j.head, j.neck, front, opts.face || (opts.flayed ? 'flayed' : 'skin'), opts.jaw ?? 0.3);
  } else stump(g, j.neck, j.neck.clone().sub(j.pelvis), 0.06);
  // arms + legs
  const parts = [['lArm', j.lSh, j.lEl, j.lHa, 0.05, 0.04], ['rArm', j.rSh, j.rEl, j.rHa, 0.05, 0.04], ['lLeg', j.lHip, j.lKn, j.lFt, 0.075, 0.055], ['rLeg', j.rHip, j.rKn, j.rFt, 0.075, 0.055]];
  for (const [name, a, b, c, r1, r2] of parts) {
    if (!a) continue;
    if (miss.has(name)) { stump(g, a.clone().lerp(b, 0.15), b.clone().sub(a), r1); continue; }
    limb(g, a, b, r1, r1 * 0.85, limbMat); ball(g, b, r1 * 0.85, limbMat);
    if (miss.has(name + 'Lower')) { stump(g, b, b.clone().sub(a), r2); continue; }
    limb(g, b, c, r2, r2 * 0.8, limbMat);
    if (name.endsWith('Arm')) ball(g, c, 0.045, limbMat, 0.8, 1.3, 0.5);
    else mesh(new THREE.BoxGeometry(0.09, 0.06, 0.22), limbMat, g, c.x, c.y, c.z).lookAt(c.clone().add(front));
  }
  return g;
}
export function head(parent, p, neck, front, face = 'skin', jaw = 0.3) {
  const m = goreMats(), h = new THREE.Group(); h.position.copy(p); parent.add(h);
  const up = p.clone().sub(neck).normalize();
  const f = front.clone().addScaledVector(up, -front.dot(up)).normalize(), r = new THREE.Vector3().crossVectors(up, f);
  h.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, up, f));
  const mat = face === 'skin' ? m.skin : face === 'grey' ? m.skinGrey : face === 'skull' ? m.bone : m.muscle;
  ball(h, V(0, 0.02, 0), 0.11, mat, 0.9, 1.1, 1.0, 10);
  if (face === 'skin' || face === 'grey') ball(h, V(0, 0.06, -0.015), 0.112, m.hair, 0.93, 0.95, 1.0).scale.y = 0.85;
  // sockets / eyes
  for (const s of [-1, 1]) {
    ball(h, V(s * 0.037, 0.035, 0.085), 0.026, m.black, 1, 0.9, 0.6);
    if (face === 'flayed' || face === 'skull') ball(h, V(s * 0.037, 0.035, 0.09), 0.017, m.eye).scale.z = 0.6; // lidless eyes
  }
  // nose cavity for flayed
  if (face !== 'skin' && face !== 'grey') ball(h, V(0, -0.005, 0.1), 0.012, m.black, 1, 1.6, 0.6);
  // mouth / jaw hanging open
  const jw = new THREE.Group(); jw.position.set(0, -0.04, 0.02); h.add(jw); jw.rotation.x = jaw;
  mesh(new THREE.BoxGeometry(0.11, 0.035, 0.1), mat, jw, 0, -0.03, 0.03);
  if (face !== 'skin' && face !== 'grey') for (let i = 0; i < 6; i++) { mesh(new THREE.BoxGeometry(0.012, 0.016, 0.01), m.teeth, jw, -0.035 + i * 0.014, -0.006, 0.075); mesh(new THREE.BoxGeometry(0.012, 0.016, 0.01), m.teeth, h, -0.035 + i * 0.014, -0.045, 0.092); }
  ball(h, V(0, -0.055, 0.07), 0.035, m.black, 1.2, 0.8 + jaw, 0.4);
  return h;
}
export function intestines(parent, center, radius, n, tube = 0.025, mat) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = i * 1.7, r = radius * (0.4 + 0.6 * R()); pts.push(V(center.x + Math.cos(a) * r, center.y + (R() - 0.5) * radius * 0.8, center.z + Math.sin(a) * r * 0.6)); }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 4, tube, 5, false);
  return mesh(geo, mat || goreMats().gut, parent);
}
// guts slopping out and hanging down
export function intestinesHang(parent, from, len = 0.8) {
  const pts = [from.clone()]; let p = from.clone();
  for (let i = 0; i < 9; i++) { p = p.clone().add(V((R() - 0.5) * 0.12, -len / 9, 0.04 + (R() - 0.5) * 0.06)); pts.push(p); }
  return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.028, 5, false), goreMats().gut, parent);
}
// pile of guts on the floor
export function entrailsPile(parent, x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  const pts = []; for (let i = 0; i < 30; i++) { const a = i * 0.9, r = (0.08 + R() * 0.25) * s; pts.push(V(Math.cos(a) * r, 0.03 + R() * 0.08 * s, Math.sin(a) * r)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.035 * s, 5, false), goreMats().gut, g);
  ball(g, V(0.1 * s, 0.04, -0.1 * s), 0.07 * s, goreMats().liver, 1.4, 0.5, 1);
  ball(g, V(-0.15 * s, 0.04, 0.05 * s), 0.05 * s, goreMats().organ, 1, 0.6, 1.3);
  return g;
}
export function severedHead(parent, x, y, z, rotY = 0, face = 'grey') {
  const m = goreMats(), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
  head(g, V(0, 0.12, 0), V(0, -0.1, 0.02), V(0, 0, 1), face, 0.45);
  mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.04, 7), m.blood, g, 0, 0.02, 0);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 4), m.bone, g, 0, 0.03, -0.01);
  return g;
}
export function severedLimb(parent, x, z, rotY = 0, leg = false) {
  const m = goreMats(), g = new THREE.Group(); g.position.set(x, 0.05, z); g.rotation.y = rotY; parent.add(g);
  const L = leg ? 0.8 : 0.6, r = leg ? 0.06 : 0.045;
  limb(g, V(-L / 2, 0, 0), V(L / 2, 0, 0), r, r * 0.8, m.skinGrey);
  stump(g, V(-L / 2, 0, 0), V(-1, 0, 0), r);
  if (leg) mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), m.skinGrey, g, L / 2 + 0.03, 0.03, 0.05);
  else ball(g, V(L / 2 + 0.05, 0, 0), 0.045, m.skinGrey, 1.4, 0.5, 1);
  return g;
}
export function bonePile(parent, x, z, n = 14) {
  const m = goreMats(), g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g);
  for (let i = 0; i < n; i++) {
    const b = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4 + R() * 0.2, 5), m.bone, g, (R() - 0.5) * 0.7, 0.04 + R() * 0.15, (R() - 0.5) * 0.7);
    b.rotation.set(Math.PI / 2 + (R() - 0.5) * 0.6, R() * 3, (R() - 0.5) * 0.6);
    ball(b, V(0, 0.22, 0), 0.03, m.bone); ball(b, V(0, -0.22, 0), 0.03, m.bone);
  }
  for (let i = 0; i < 3; i++) skull(g, (R() - 0.5) * 0.5, 0.12 + R() * 0.12, (R() - 0.5) * 0.5, R() * 6);
  return g;
}
export function skull(parent, x, y, z, ry = 0) {
  const m = goreMats(), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set((R() - 0.5) * 0.6, ry, (R() - 0.5) * 0.6); parent.add(g);
  ball(g, V(0, 0, 0), 0.1, m.bone, 0.85, 0.95, 1.05);
  for (const s of [-1, 1]) ball(g, V(s * 0.035, 0, 0.08), 0.027, m.black, 1, 1, 0.6);
  mesh(new THREE.BoxGeometry(0.08, 0.04, 0.07), m.bone, g, 0, -0.08, 0.04);
  return g;
}

// ------------------------------------------------------------------
// hanging bodies. pivot at the hook (y=0), body hangs below. returns {group, pivot, head}
// ------------------------------------------------------------------
export function hangingBody(kind = 'back', opts = {}) {
  const m = goreMats(), pivot = new THREE.Group();
  const chainLen = opts.chain ?? 0.6;
  for (let i = 0; i < chainLen / 0.08; i++) { const l = mesh(new THREE.TorusGeometry(0.025, 0.007, 3, 6), m.metal, pivot, 0, -i * 0.08, 0); l.rotation.y = i % 2 ? Math.PI / 2 : 0; }
  const hook = mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8, Math.PI * 1.4), m.steel, pivot, 0, -chainLen - 0.05, 0); hook.rotation.z = -0.8;
  const top = -chainLen - 0.1;
  let b;
  if (kind === 'back') {
    // hooked through the upper back. head lolls, arms dangle, toes point down.
    const y = top - 0.05;
    const j = {
      neck: V(0, y - 0.12, 0.08), head: V(0, y - 0.1, 0.24), pelvis: V(0, y - 0.72, 0.03),
      lSh: V(-0.2, y - 0.16, 0.05), lEl: V(-0.22, y - 0.45, 0.07), lHa: V(-0.22, y - 0.72, 0.1),
      rSh: V(0.2, y - 0.16, 0.05), rEl: V(0.23, y - 0.46, 0.06), rHa: V(0.21, y - 0.73, 0.09),
      lHip: V(-0.1, y - 0.78, 0.03), lKn: V(-0.11, y - 1.2, 0.07), lFt: V(-0.11, y - 1.62, 0.02),
      rHip: V(0.1, y - 0.78, 0.03), rKn: V(0.12, y - 1.2, 0.08), rFt: V(0.12, y - 1.62, 0.02),
    };
    b = body(j, { flayed: opts.flayed ?? true, flayedLimbs: opts.flayed ?? true, missing: opts.missing, openChest: opts.openChest, gutsOut: opts.gutsOut, face: opts.face, jaw: 0.5, front: V(0, -0.3, 1) });
  } else if (kind === 'ankles') {
    // hung upside down by the ankles, arms hanging past the head
    const y = top;
    const j = {
      lFt: V(-0.06, y - 0.05, 0), rFt: V(0.06, y - 0.05, 0), lKn: V(-0.12, y - 0.48, 0.04), rKn: V(0.13, y - 0.47, 0.03),
      lHip: V(-0.1, y - 0.9, 0), rHip: V(0.1, y - 0.9, 0), pelvis: V(0, y - 0.95, 0), neck: V(0, y - 1.55, 0.02), head: V(0, y - 1.72, 0.04),
      lSh: V(-0.2, y - 1.5, 0), lEl: V(-0.24, y - 1.78, 0.02), lHa: V(-0.24, y - 2.02, 0.03),
      rSh: V(0.2, y - 1.5, 0), rEl: V(0.25, y - 1.79, 0.03), rHa: V(0.23, y - 2.04, 0.02),
    };
    b = body(j, { flayed: opts.flayed ?? false, grey: true, missing: opts.missing, openChest: opts.openChest, face: opts.face || 'grey', jaw: 0.6, front: V(0, 0, 1) });
  } else {
    // 'torso': a side of person. no head, no arms, split open, like the beef it's hung beside.
    const y = top - 0.05;
    const j = { neck: V(0, y - 0.05, 0), head: V(0, y + 0.1, 0), pelvis: V(0, y - 0.65, 0), lHip: V(-0.1, y - 0.7, 0), lKn: V(-0.1, y - 1.1, 0.02), lFt: V(-0.1, y - 1.5, 0), rHip: V(0.1, y - 0.7, 0), rKn: V(0.1, y - 1.1, 0), rFt: V(0.1, y - 1.5, 0) };
    b = body(j, { flayed: true, openChest: true, missing: ['head', 'lLegLower', ...(R() < 0.5 ? ['rLeg'] : [])], gutsOut: R() < 0.5 ? 0.6 : 0, front: V(0, 0, 1) });
  }
  pivot.add(b);
  return { pivot, body: b, lowest: kind === 'ankles' ? top - 2.05 : top - 1.6 };
}

// a body lying on a table, chest open, one arm off the edge
export function tableCorpse(opts = {}) {
  const y = 0.98, j = {
    pelvis: V(0, y, 0.3), neck: V(0, y + 0.02, -0.38), head: V(0, y + 0.06, -0.58),
    lSh: V(-0.21, y, -0.33), lEl: V(-0.26, y, -0.05), lHa: V(-0.27, y, 0.2),
    rSh: V(0.21, y, -0.33), rEl: V(0.42, y - 0.18, -0.25), rHa: V(0.45, y - 0.45, -0.15),
    lHip: V(-0.1, y, 0.36), lKn: V(-0.12, y, 0.8), lFt: V(-0.13, y + 0.08, 1.2),
    rHip: V(0.1, y, 0.36), rKn: V(0.13, y, 0.8), rFt: V(0.15, y + 0.08, 1.2),
  };
  return body(j, { openChest: opts.open ?? true, grey: true, missing: opts.missing, face: opts.face || 'grey', jaw: 0.7, front: V(0, 1, 0) });
}
// slumped sitting against a wall (local -z is the wall)
export function slumpedCorpse(opts = {}) {
  const j = {
    pelvis: V(0, 0.15, -0.15), neck: V(0, 0.68, -0.25), head: V(0.05, 0.72, -0.06),
    lSh: V(-0.2, 0.63, -0.25), lEl: V(-0.3, 0.38, -0.15), lHa: V(-0.33, 0.1, 0.05),
    rSh: V(0.2, 0.63, -0.25), rEl: V(0.28, 0.36, -0.1), rHa: V(0.2, 0.2, 0.15),
    lHip: V(-0.1, 0.12, -0.1), lKn: V(-0.2, 0.38, 0.3), lFt: V(-0.22, 0.04, 0.62),
    rHip: V(0.1, 0.12, -0.1), rKn: V(0.18, 0.12, 0.5), rFt: V(0.22, 0.04, 0.95),
  };
  return body(j, { grey: true, face: opts.face || 'grey', jaw: 0.6, missing: opts.missing, gutsOut: opts.gutsOut, openChest: opts.openChest, front: V(0, 0, 1) });
}
// sitting in a chair. facing +z.
export function seatedCorpse(opts = {}) {
  const j = {
    pelvis: V(0, 0.5, 0), neck: V(0, 1.05, -0.12), head: V(0, 1.12, -0.32),
    lSh: V(-0.2, 1.0, -0.1), lEl: V(-0.28, 0.72, -0.05), lHa: V(-0.3, 0.45, 0.0),
    rSh: V(0.2, 1.0, -0.1), rEl: V(0.25, 0.78, 0.15), rHa: V(0.2, 0.75, 0.42),
    lHip: V(-0.1, 0.5, 0.05), lKn: V(-0.12, 0.5, 0.48), lFt: V(-0.12, 0.05, 0.52),
    rHip: V(0.1, 0.5, 0.05), rKn: V(0.13, 0.5, 0.48), rFt: V(0.14, 0.05, 0.55),
  };
  return body(j, { grey: true, face: opts.face || 'flayed', jaw: 1.0, front: V(0, 0.4, 1) });
}
// a body folded into a locker, ready to fall out. pivot = bottom front edge.
export function foldedCorpse() {
  const j = {
    pelvis: V(0, 0.45, -0.1), neck: V(0, 1.1, -0.05), head: V(0, 1.18, 0.12),
    lSh: V(-0.2, 1.02, -0.05), lEl: V(-0.25, 0.75, 0.08), lHa: V(-0.18, 0.55, 0.18),
    rSh: V(0.2, 1.02, -0.05), rEl: V(0.25, 0.75, 0.1), rHa: V(0.12, 0.62, 0.2),
    lHip: V(-0.1, 0.42, -0.08), lKn: V(-0.12, 0.75, 0.15), lFt: V(-0.12, 0.08, 0.08),
    rHip: V(0.1, 0.42, -0.08), rKn: V(0.12, 0.78, 0.14), rFt: V(0.13, 0.08, 0.1),
  };
  return body(j, { grey: true, face: 'grey', jaw: 0.8, openChest: true, front: V(0, 0, 1) });
}
// legless torso that drags itself on its arms. returns {group, armsL, armsR, headG}
export function crawler() {
  const m = goreMats(), g = new THREE.Group();
  const tor = new THREE.Group(); g.add(tor);
  const t = mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.6, 9), m.skinGrey, tor, 0, 0.18, 0); t.rotation.x = Math.PI / 2 - 0.25; t.scale.set(1, 1, 0.65);
  stump(tor, V(0, 0.12, -0.3), V(0, -0.1, -1), 0.13);
  intestinesHang(tor, V(0, 0.1, -0.3), 0.3);
  const trail = []; for (let i = 0; i < 8; i++) trail.push(V((R() - 0.5) * 0.15, 0.03, -0.3 - i * 0.15));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trail), 30, 0.03, 5), m.gut, tor);
  const headG = head(tor, V(0, 0.36, 0.38), V(0, 0.28, 0.25), V(0, -0.3, 1), 'grey', 0.9);
  const arm = s => { const sh = new THREE.Group(); sh.position.set(s * 0.19, 0.28, 0.25); tor.add(sh); limb(sh, V(0, 0, 0), V(0, -0.1, 0.32), 0.045, 0.04, m.skinGrey); limb(sh, V(0, -0.1, 0.32), V(0, -0.27, 0.5), 0.04, 0.035, m.skinGrey); ball(sh, V(0, -0.28, 0.52), 0.045, m.skinGrey, 1.2, 0.5, 1.4); return sh; };
  return { group: g, armL: arm(-1), armR: arm(1), torso: tor, headG };
}

// Merge every mesh under `root` into one mesh per material (positions baked relative to root).
// Anything under a node with userData.noBake is left alone (e.g. a locker door that swings).
export function bake(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map(), victims = [];
  const walk = (o) => {
    if (o.userData.noBake) return;
    if (o.isMesh && o.geometry.attributes.uv && o.geometry.attributes.normal) {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g); victims.push(o);
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  if (victims.length < 2) return root;
  for (const v of victims) v.parent.remove(v);
  for (const [mat, gs] of buckets) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2);
    let o = 0; for (const g of gs) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; root.add(m);
  }
  return root;
}
