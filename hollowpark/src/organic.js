// Smooth organic geometry (tapered, bulging tubes along curves; sculpted heads) and the creature built from it.
import * as THREE from 'three';
import { R } from './state.js';
import * as PB from './pbr.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// A tube along pts whose radius follows `radii`, with organic bulges. Front (N) is `ref` projected off the tangent.
// opts: radial, segs, depth (scale along N), width (scale along B), noise, rmod(t, angle) -> multiplier, ref
export function organicTube(pts, radii, o = {}) {
  const radial = o.radial || 14, segs = o.segs || 18, depth = o.depth ?? 1, width = o.width ?? 1, noise = o.noise ?? 0.03, seed = o.seed ?? R() * 10;
  const curve = new THREE.CatmullRomCurve3(pts), ref = (o.ref || V(0, 0, 1)).clone();
  const rAt = (t) => { const f = t * (radii.length - 1), i = Math.min(radii.length - 2, Math.floor(f)), k = f - i, s = k * k * (3 - 2 * k); return radii[i] * (1 - s) + radii[i + 1] * s; };
  const pos = [], uv = [], idx = [];
  const T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3();
  const frame = (t) => {
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    N.copy(ref).addScaledVector(T, -ref.dot(T)); if (N.lengthSq() < 1e-6) N.set(1, 0, 0).addScaledVector(T, -T.x); N.normalize(); B.crossVectors(T, N).normalize();
  };
  for (let i = 0; i <= segs; i++) {
    const t = i / segs; frame(t); const r = rAt(t);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      let k = 1 + noise * (Math.sin(a * 3 + t * 11 + seed) + Math.sin(a * 5 - t * 17 + seed * 2)) * 0.5;
      if (o.rmod) k *= o.rmod(t, a);
      const c = Math.cos(a) * r * k * depth, s = Math.sin(a) * r * k * width;
      pos.push(P.x + N.x * c + B.x * s, P.y + N.y * c + B.y * s, P.z + N.z * c + B.z * s);
      uv.push(j / radial, t * (o.vRepeat ?? 1));
    }
  }
  const row = radial + 1;
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * row + j, b = a + row; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  // rounded caps
  const cap = (t, dir) => {
    frame(t); const r = rAt(t), base = pos.length / 3;
    pos.push(P.x + T.x * r * 0.7 * dir, P.y + T.y * r * 0.7 * dir, P.z + T.z * r * 0.7 * dir); uv.push(0.5, t);
    const ring = t === 0 ? 0 : segs * row;
    for (let j = 0; j < radial; j++) dir > 0 ? idx.push(ring + j, ring + j + 1, base) : idx.push(ring + j + 1, ring + j, base);
  };
  if (o.capStart !== false) cap(0, -1); if (o.capEnd !== false) cap(1, 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}

// the split in its chest: a gash with ribs showing (alpha cut)
function woundTex() {
  const n = 256, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d');
  x.beginPath(); x.moveTo(n * 0.5, 4); x.bezierCurveTo(n * 0.95, n * 0.3, n * 0.9, n * 0.75, n * 0.5, n - 4); x.bezierCurveTo(n * 0.1, n * 0.75, n * 0.05, n * 0.3, n * 0.5, 4); x.closePath();
  x.save(); x.clip();
  const g = x.createRadialGradient(n / 2, n / 2, 10, n / 2, n / 2, n * 0.5); g.addColorStop(0, '#0a0000'); g.addColorStop(0.45, '#3a0404'); g.addColorStop(1, '#8a1a14'); x.fillStyle = g; x.fillRect(0, 0, n, n);
  for (let i = 0; i < 7; i++) { const y = 40 + i * 28; x.strokeStyle = '#d8ccb0'; x.lineWidth = 9 - i * 0.6; x.beginPath(); x.moveTo(n * 0.12, y); x.quadraticCurveTo(n * 0.5, y - 24, n * 0.88, y); x.stroke(); x.strokeStyle = 'rgba(80,0,0,0.6)'; x.lineWidth = 2; x.stroke(); }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${150 + R() * 60 | 0},${10 + R() * 30 | 0},${10 + R() * 20 | 0},0.6)`; x.beginPath(); x.ellipse(R() * n, R() * n, 4 + R() * 12, 2 + R() * 6, R() * 3, 0, 6.28); x.fill(); }
  x.restore();
  x.strokeStyle = '#4a0606'; x.lineWidth = 6; x.beginPath(); x.moveTo(n * 0.5, 4); x.bezierCurveTo(n * 0.95, n * 0.3, n * 0.9, n * 0.75, n * 0.5, n - 4); x.bezierCurveTo(n * 0.1, n * 0.75, n * 0.05, n * 0.3, n * 0.5, 4); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

let MATS = null;
export function creatureMats() {
  if (MATS) return MATS;
  const skin = PB.stdMat(PB.paleSkin(), { ns: 1.0 }); skin.color.setHex(0x7c817a);
  MATS = {
    skin,
    wound: new THREE.MeshStandardMaterial({ map: woundTex(), alphaTest: 0.5, roughness: 0.35, side: THREE.DoubleSide, color: 0x9a8888 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xd8ceb0, roughness: 0.35 }),
    gums: new THREE.MeshStandardMaterial({ color: 0x5a0e10, roughness: 0.25 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x050000 }),
    nail: new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.4 }),
  };
  return MATS;
}
const M = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };

// a head with no eyes and a mouth that goes from ear to ear. returns { head, jaw }
function grinningHead(parent, mats) {
  const head = new THREE.Group(); parent.add(head);
  const mouthTheta = Math.PI * 0.6;
  const headMat = mats.skin.clone(); headMat.vertexColors = true;
  const sculpt = (g, lower) => {
    const p = g.attributes.position, v = new THREE.Vector3(), cols = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const d = v.clone().normalize();
      let k = 1, c = 1;
      for (const s of [-1, 1]) c -= Math.exp(-d.distanceToSquared(V(s * 0.36, 0.3, 0.88).normalize()) / 0.02) * 0.85; // dark, skinned-over sockets
      if (d.z > 0.1 && Math.abs(d.y + 0.31) < 0.09) { c *= 0.35 + Math.abs(d.y + 0.31) * 5; k -= 0.04; }             // where the lips were cut away
      c -= Math.exp(-d.distanceToSquared(V(0, 0.08, 1)) / 0.003) * 0.6;                                               // nose slits
      cols.push(c, c * 0.95, c * 0.95);
      for (const s of [-1, 1]) { const e = V(s * 0.36, 0.3, 0.88).normalize(); k -= Math.exp(-d.distanceToSquared(e) / 0.018) * 0.16; } // skinned-over eye sockets
      k -= Math.exp(-d.distanceToSquared(V(0, 0.05, 1)) / 0.01) * 0.05;   // flat noseless face
      if (d.z < -0.2 && d.y > -0.2) k += 0.08 * (-d.z);                  // long skull
      for (const s of [-1, 1]) k += Math.exp(-d.distanceToSquared(V(s * 0.6, 0.0, 0.7).normalize()) / 0.02) * 0.07; // cheekbones
      v.multiplyScalar(k); v.y *= lower ? 1.0 : 1.45; v.x *= 0.82; v.z *= lower ? 1.05 : 1.0;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals(); return g;
  };
  M(sculpt(new THREE.SphereGeometry(0.13, 40, 28, 0, Math.PI * 2, 0, mouthTheta)), headMat, head);
  M(new THREE.SphereGeometry(0.1, 12, 10), mats.dark, head, 0, -0.03, 0.01).scale.set(0.8, 0.9, 0.9);
  const jaw = new THREE.Group(); jaw.position.set(0, -0.035, -0.06); head.add(jaw);
  const jg = sculpt(new THREE.SphereGeometry(0.13, 40, 14, 0, Math.PI * 2, mouthTheta, Math.PI * 0.32), true); jg.translate(0, 0.035, 0.06);
  M(jg, headMat, jaw);
  // the smile: a gash that curves up toward the ears, packed with human teeth
  const mouthY = -0.13 * Math.cos(Math.PI - mouthTheta) * 1.45, Rm = 0.126;
  const pts = []; for (let i = 0; i <= 28; i++) { const a = -1.85 + 3.7 * i / 28, e = Math.pow(Math.abs(a) / 1.85, 2.2); pts.push(V(Math.sin(a) * Rm * 0.84, mouthY + 0.004 + 0.07 * e, Math.cos(a) * Rm)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  M(new THREE.TubeGeometry(curve, 60, 0.02, 8, false), mats.gums, head).scale.set(1, 1, 1);
  const tooth = new THREE.BoxGeometry(0.014, 0.026, 0.01);
  for (let i = 0; i < 44; i++) {
    const t = 0.02 + i / 43 * 0.96, p = curve.getPointAt(t), n = V(p.x, 0, p.z).normalize(), yaw = Math.atan2(n.x, n.z), big = 1 - Math.abs(t - 0.5) * 0.9;
    const up = M(tooth, mats.teeth, head, p.x + n.x * 0.012, p.y + 0.009, p.z + n.z * 0.012); up.rotation.y = yaw; up.scale.set(1, (0.8 + R() * 0.4) * big + 0.3, 1);
    const lo = M(tooth, mats.teeth, jaw, p.x + n.x * 0.012 - jaw.position.x, p.y - 0.012 - jaw.position.y, p.z + n.z * 0.012 - jaw.position.z); lo.rotation.y = yaw; lo.scale.set(0.9, (0.7 + R() * 0.4) * big + 0.3, 1);
  }
  return { head, jaw };
}

// ---------------------------------------------------------------------------
// The creature. Same rig the animation code drives: hips, legs[], spine, neck, head, jaw, arms[].
// ---------------------------------------------------------------------------
export function buildCreature() {
  const mats = creatureMats(), sk = mats.skin;
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 1.4; root.add(hips);
  M(organicTube([V(0, -0.1, 0), V(0, 0.02, 0.01), V(0, 0.14, 0)], [0.12, 0.15, 0.1], { depth: 0.7, noise: 0.05 }), sk, hips);
  const legs = [-1, 1].map(s => {
    const hip = new THREE.Group(); hip.position.set(s * 0.1, -0.03, 0); hips.add(hip);
    M(organicTube([V(0, 0.04, 0), V(0, -0.34, 0.04), V(0, -0.7, 0.05)], [0.08, 0.072, 0.05, 0.042], { noise: 0.06 }), sk, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.7, 0.05); hip.add(knee);
    M(new THREE.SphereGeometry(0.048, 14, 10), sk, knee, 0, 0, 0.025);
    M(organicTube([V(0, 0, 0), V(0, -0.33, -0.035), V(0, -0.64, -0.06)], [0.045, 0.05, 0.032, 0.028], { noise: 0.05 }), sk, knee);
    const foot = M(organicTube([V(0, -0.64, -0.08), V(0, -0.67, 0.05), V(0, -0.69, 0.2)], [0.034, 0.03, 0.02], { width: 1.3, depth: 0.7 }), sk, knee);
    for (let i = 0; i < 4; i++) { const tx = (i - 1.5) * 0.017; M(organicTube([V(tx, -0.69, 0.19), V(tx * 1.3, -0.695, 0.26), V(tx * 1.5, -0.7, 0.31)], [0.009, 0.007, 0.004], { radial: 6, segs: 4 }), sk, knee); M(new THREE.ConeGeometry(0.005, 0.03, 4), mats.nail, knee, tx * 1.5, -0.7, 0.325).rotation.x = Math.PI / 2; }
    return { hip, knee, foot };
  });
  const spine = new THREE.Group(); hips.add(spine); spine.rotation.x = 0.5;
  // emaciated torso: ribs pressing through, spine ridge, a waist you could close a hand around
  const ribs = (t, a) => {
    let k = 1;
    if (t > 0.38 && t < 0.82 && Math.cos(a) > -0.3) k += 0.07 * Math.max(0, Math.sin(t * 62)) * (0.6 + 0.4 * Math.cos(a));
    if (Math.cos(a) < -0.93) k += 0.08;                   // spine
    if (t > 0.78 && Math.abs(Math.sin(a)) > 0.8) k += 0.06; // shoulder blades / clavicles
    return k;
  };
  M(organicTube([V(0, 0.02, 0), V(0, 0.3, 0.02), V(0, 0.6, 0.0), V(0, 0.9, -0.04)], [0.1, 0.07, 0.15, 0.19, 0.11], { depth: 0.62, segs: 32, radial: 24, noise: 0.02, rmod: ribs }), sk, spine);
  { // the split chest
    const wg = new THREE.CylinderGeometry(0.155, 0.13, 0.36, 12, 1, true, -0.55, 1.1); wg.scale(1, 1, 0.66);
    M(wg, mats.wound, spine, 0, 0.56, 0.012).rotation.x = -0.05;
  }
  const neck = new THREE.Group(); neck.position.set(0, 0.88, -0.02); spine.add(neck);
  M(organicTube([V(0, -0.02, 0), V(0, 0.16, 0.05), V(0, 0.3, 0.11)], [0.055, 0.042, 0.05], { noise: 0.08 }), sk, neck);
  const hj = grinningHead(neck, mats); const head = hj.head; head.position.set(0, 0.36, 0.15); head.scale.setScalar(1.25);
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.21, 0.8, -0.02); spine.add(sh);
    M(new THREE.SphereGeometry(0.058, 14, 10), sk, sh);
    M(organicTube([V(0, 0.02, 0), V(0, -0.42, 0.02), V(0, -0.84, 0)], [0.05, 0.046, 0.032, 0.03], { noise: 0.07 }), sk, sh);
    const el = new THREE.Group(); el.position.set(0, -0.84, 0); sh.add(el);
    M(new THREE.SphereGeometry(0.036, 12, 8), sk, el, 0, 0, -0.012);
    M(organicTube([V(0, 0, 0), V(0, -0.42, 0.02), V(0, -0.84, 0)], [0.035, 0.034, 0.024, 0.021], { noise: 0.06 }), sk, el);
    const hand = new THREE.Group(); hand.position.set(0, -0.85, 0); el.add(hand);
    M(organicTube([V(0, 0.02, 0), V(0, -0.06, 0.01), V(0, -0.12, 0.01)], [0.026, 0.034, 0.03], { width: 1.35, depth: 0.55 }), sk, hand);
    for (let f = 0; f < 5; f++) {
      const thumb = f === 4, fx = thumb ? s * -0.035 : (f - 1.5) * 0.017, len = thumb ? 0.16 : 0.34 - Math.abs(f - 1.5) * 0.04;
      const pts = thumb ? [V(fx, -0.05, 0.02), V(fx * 1.6, -0.1, 0.05), V(fx * 1.8, -0.17, 0.07)] : [V(fx, -0.12, 0.01), V(fx * 1.1, -0.12 - len * 0.45, 0.03), V(fx * 1.2, -0.12 - len * 0.8, 0.07), V(fx * 1.2, -0.12 - len, 0.12)];
      M(organicTube(pts, [0.011, 0.01, 0.008, 0.005], { radial: 7, segs: 10, noise: 0.12 }), sk, hand);
      const tip = pts[pts.length - 1], nail = M(new THREE.ConeGeometry(0.006, 0.05, 5), mats.nail, hand, tip.x, tip.y - 0.01, tip.z + 0.02); nail.rotation.x = Math.PI + 0.9;
    }
    return { sh, el, hand };
  });
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { root, hips, legs, spine, neck, head, jaw: hj.jaw, arms, eyes: [] };
}
