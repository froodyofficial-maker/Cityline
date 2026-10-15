// Death cutscenes. After the grab, one of these plays at random (never the same one twice running):
//   rope    - strung up over a fire pit; he watches you, you look down at the flames, he cuts the rope
//   exit    - an EXIT door at last; he's just standing behind you; the door opens onto a sheer drop; he pushes
//   grinder - (third person) dragged by the ankle and fed into the meat grinder
//   fan     - (third person) held up by the throat into the blades of a ceiling fan
//   eaten   - (third person) he takes you apart on the floor and eats you, and then he looks at you
//   rack    - (third person) chained to a winch table; he cranks until your arms and legs come away
// Each one builds its own little stage, runs off a timeline, and throws gore around with a small physics pass.
import * as THREE from 'three';
import { createForemanMesh, poseForeman } from './monster.js';
import { makeBody, openChest, mesh, decal, severedArm, severedHead, meatChunk, makeLamp, stump, makeLift } from './props.js';
import { canvas } from './textures.js';

export const CUTSCENES = ['rope', 'exit', 'grinder', 'fan', 'eaten', 'rack'];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the worker: you, from the outside ----------
function makeWorker(mats) {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const b = makeBody(mats, rng, { cloth: mats.coverall, skin: mats.skin, dead: false });
  b.jaw.rotation.x = 0.35; // screaming, or trying to
  return b;
}

// point an object's local +Y along `y` with local +Z as close to `z` as possible
function orient(obj, y, z) {
  const Y = y.clone().normalize(), X = new THREE.Vector3().crossVectors(Y, z).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
}

// ---------- gore ----------
class Gore {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.chunks = [];
    this.decals = 0;
    const N = 500;
    this.dp = new Float32Array(N * 3).fill(-999);
    this.dv = new Float32Array(N * 3);
    this.dl = new Float32Array(N);
    this.di = 0;
    this.points = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.dp, 3)),
      new THREE.PointsMaterial({ color: 0x8a0000, size: 0.035, sizeAttenuation: true }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  // a spray of blood droplets
  spray(at, dir, n, speed, spread = 0.6) {
    for (let k = 0; k < n; k++) {
      const i = this.di++ % this.dl.length;
      this.dp.set([at.x, at.y, at.z], i * 3);
      const v = dir.clone().normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8)).add(V((Math.random() - 0.5) * spread * speed, (Math.random() - 0.5) * spread * speed, (Math.random() - 0.5) * spread * speed));
      this.dv.set([v.x, v.y, v.z], i * 3);
      this.dl[i] = 1.5 + Math.random();
    }
  }
  // meat, bone and bits of you
  burst(at, n, speed, up = 0.6, extra = []) {
    const kinds = [() => meatChunk(this.mats, Math.random), () => meatChunk(this.mats, Math.random), () => mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12 + Math.random() * 0.2, 5), this.mats.bone, false)];
    const make = (o) => {
      o.position.copy(at);
      this.scene.add(o);
      const a = Math.random() * Math.PI * 2;
      this.chunks.push({ o, v: V(Math.cos(a) * speed * Math.random(), up * speed * (0.5 + Math.random()), Math.sin(a) * speed * Math.random()), w: V(Math.random() * 12, Math.random() * 12, Math.random() * 12), rest: false });
    };
    for (let k = 0; k < n; k++) make(kinds[(Math.random() * kinds.length) | 0]());
    extra.forEach(make);
    this.spray(at, V(0, 1, 0), n * 6, speed * 1.2, 1.2);
  }
  update(dt) {
    for (const c of this.chunks) {
      if (c.rest) continue;
      c.v.y -= 9.8 * dt;
      c.o.position.addScaledVector(c.v, dt);
      c.o.rotation.x += c.w.x * dt; c.o.rotation.y += c.w.y * dt; c.o.rotation.z += c.w.z * dt;
      if (c.o.position.y < 0.05 && c.v.y < 0) {
        c.o.position.y = 0.05;
        if (this.decals < 30 && Math.abs(c.v.y) > 2) { this.decals++; this.scene.add(decal(this.mats.splat[(Math.random() * 4) | 0], 0.5 + Math.random() * 0.8, c.o.position.x, c.o.position.z, Math.random() * 6, 0.01 + this.decals * 0.0004)); }
        c.v.y *= -0.25; c.v.x *= 0.5; c.v.z *= 0.5; c.w.multiplyScalar(0.5);
        if (Math.abs(c.v.y) < 0.4) c.rest = true;
      }
    }
    const p = this.dp, v = this.dv;
    for (let i = 0; i < this.dl.length; i++) {
      if (this.dl[i] <= 0) continue;
      this.dl[i] -= dt;
      v[i * 3 + 1] -= 9.8 * dt;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (p[i * 3 + 1] < 0.02) { p[i * 3 + 1] = 0.02; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; }
      if (this.dl[i] <= 0) p[i * 3 + 1] = -999;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------- sets ----------
function room(scene, mats, w, d, wallIdx = 4) {
  const T = 2;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(T, T), mats.floors[1]);
  for (let x = -w / 2 + 1; x < w / 2; x += T) for (let z = -d / 2 + 1; z < d / 2; z += T) {
    const f = floor.clone();
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, 0, z);
    f.receiveShadow = true;
    scene.add(f);
  }
  const wall = new THREE.PlaneGeometry(T, 3);
  const strip = (x0, z0, dx, dz, n, rotY) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(wall, mats.walls[(wallIdx + i) % mats.walls.length]);
      m.position.set(x0 + dx * (i + 0.5) * T, 1.5, z0 + dz * (i + 0.5) * T);
      m.rotation.y = rotY;
      m.receiveShadow = true;
      scene.add(m);
    }
  };
  strip(-w / 2, -d / 2, 1, 0, w / T, 0);
  strip(w / 2, d / 2, -1, 0, w / T, Math.PI);
  strip(-w / 2, d / 2, 0, -1, d / T, Math.PI / 2);
  strip(w / 2, -d / 2, 0, 1, d / T, -Math.PI / 2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.ceil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3;
  scene.add(ceil);
}

// ---------- fire ----------
// Flames are camera-facing quads running a noise shader: tongues that rise, split and lick, white-yellow at
// the root, through orange to a dull red at the tips. Under them a bed of coals with glowing cracks that
// breathe, charred logs, sparks spiralling up and dark smoke rolling off the top.
const flameFrag = `
uniform float time, seed, heat, fade;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }
void main(){
  float y = vUv.y, x = (vUv.x - 0.5) * 2.0;
  float t = time * 2.2 + seed * 7.0;
  // turbulence: sideways licks that grow toward the top
  float n = fbm(vec2(x * 1.6 + seed, y * 2.6 - t));
  float m = fbm(vec2(x * 3.5 - seed, y * 5.0 - t * 1.6));
  float xs = x + (n - 0.5) * 1.1 * y + (m - 0.5) * 0.25;
  float width = mix(0.7, 0.1, pow(y, 0.75));
  float body = 1.0 - smoothstep(width * 0.55, width, abs(xs));
  // the top breaks up into separate tongues
  float top = smoothstep(0.95, 0.35, y + (n - 0.45) * 0.75 + (m - 0.5) * 0.3);
  float rx = abs(xs) / max(width, 0.05);
  float base = smoothstep(0.0, 0.16, y - rx * rx * 0.14 + (n - 0.5) * 0.05); // round at the root, not cut flat
  float f = body * top * base * smoothstep(1.0, 0.7, y) * (1.0 - smoothstep(0.7, 0.98, abs(x)));
  float hot = clamp(f * (1.05 - y) * heat * 0.9 + (m - 0.5) * 0.2, 0.0, 1.0);
  vec3 c = mix(vec3(0.45, 0.03, 0.0), vec3(1.0, 0.32, 0.02), smoothstep(0.08, 0.45, hot));
  c = mix(c, vec3(1.0, 0.72, 0.25), smoothstep(0.45, 0.75, hot));
  c = mix(c, vec3(1.0, 0.95, 0.8), smoothstep(0.78, 1.0, hot));
  float a = f * smoothstep(0.02, 0.25, hot);
  a *= fade;
  gl_FragColor = vec4(c * a * 0.75, a);
}`;
const crownFrag = `
uniform float time, seed;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return v; }
void main(){
  vec2 c = (vUv - 0.5) * 2.0;
  float r = length(c);
  // domain-warped noise drifting outward from the middle: no seams, no rays
  vec2 q = vec2(fbm(c * 2.0 + vec2(seed, time * 0.5)), fbm(c * 2.0 - vec2(time * 0.4, seed)));
  float n = fbm(c * 3.0 + q * 1.8 - normalize(c + 0.0001) * time * 0.6);
  float m = fbm(c * 5.0 + q * 2.5 + vec2(seed, -time * 1.6));
  float f = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.7) * smoothstep(0.35, 0.75, n * 0.7 + m * 0.5);
  float hot = clamp(f * (1.2 - r * 0.6), 0.0, 1.0);
  vec3 col = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.35, 0.03), smoothstep(0.1, 0.5, hot));
  col = mix(col, vec3(1.0, 0.75, 0.3), smoothstep(0.55, 0.9, hot));
  gl_FragColor = vec4(col * f * 0.7, f * 0.85);
}`;
function coalsTex() {
  const S = 256, { c, g } = canvas(S, S);
  g.fillStyle = '#050201';
  g.fillRect(0, 0, S, S);
  // glow under everything, showing through the gaps
  const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,150,50,1)');
  gr.addColorStop(0.5, 'rgba(200,55,8,0.95)');
  gr.addColorStop(1, 'rgba(50,6,0,0.7)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
  // packed chunks of charcoal: small, angular, dark, with the glow coming through the seams between them
  for (let i = 0; i < 1700; i++) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * S * 0.49, x = S / 2 + Math.cos(a) * d, y = S / 2 + Math.sin(a) * d, r = 3 + Math.random() * 6;
    const hotLump = Math.random() < 0.1, ash = Math.random() < 0.3, v = 10 + Math.random() * 25 | 0;
    g.fillStyle = hotLump ? `rgba(${170 + Math.random() * 80 | 0},${40 + Math.random() * 60 | 0},8,0.9)` : ash ? `rgba(${v + 30},${v + 22},${v + 18},0.9)` : `rgba(${v},${v * 0.45 | 0},${v * 0.3 | 0},0.93)`;
    g.beginPath();
    const k = 5 + (Math.random() * 3 | 0), r0 = Math.random() * 6;
    for (let j = 0; j < k; j++) { const aa = r0 + (j / k) * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.5); g[j ? 'lineTo' : 'moveTo'](x + Math.cos(aa) * rr, y + Math.sin(aa) * rr); }
    g.closePath();
    g.fill();
  }
  // white ash
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(150,140,130,${Math.random() * 0.25})`; g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// charcoal: black, split into scales, with the burning showing through the splits
function logPaint(glow) {
  const { c, g } = canvas(64, 128);
  g.fillStyle = glow ? '#000' : '#141010';
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 6 + Math.random() * 6) for (let x = 0; x < 64; x += 8 + Math.random() * 10) {
    if (glow) { if (Math.random() < 0.45) { g.fillStyle = `rgb(${160 + Math.random() * 90 | 0},${30 + Math.random() * 50 | 0},4)`; g.fillRect(x, y, 6 + Math.random() * 6, 1.5); } }
    else { const v = 12 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v * 0.8 | 0},${v * 0.7 | 0})`; g.fillRect(x + 1, y + 1, 7 + Math.random() * 6, 4 + Math.random() * 4); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const logTex = () => logPaint(false), logGlowTex = () => logPaint(true);
function softTex() {
  const { c, g } = canvas(64, 64);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _m = new THREE.Matrix4();
export class Fire {
  constructor(scene, mats, radius = 1.5) {
    this.scene = scene;
    this.r = radius;
    this.t = 0;
    // the coal bed
    this.coalMat = new THREE.MeshBasicMaterial({ map: coalsTex(), color: 0xffffff });
    const coals = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.03, 28), this.coalMat);
    coals.rotation.x = -Math.PI / 2;
    coals.position.y = 0.1;
    scene.add(coals);
    // charred logs across it, glowing where they're burning through
    const logMat = new THREE.MeshLambertMaterial({ color: 0x777777, map: logTex(), emissive: 0xffffff, emissiveMap: logGlowTex() });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + Math.random() * 0.03, 0.065, radius * (0.9 + Math.random() * 0.7), 7), logMat);
      log.rotation.order = 'YXZ';
      log.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.3, (i / 4) * Math.PI + Math.random() * 0.5, 0); // crossed every which way
      log.position.set((Math.random() - 0.5) * radius * 0.6, 0.16 + Math.random() * 0.06, (Math.random() - 0.5) * radius * 0.6);
      scene.add(log);
    }
    this.logMat = logMat;
    // the flames
    this.flames = [];
    const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    for (let i = 0; i < 40; i++) {
      const u = { time: { value: 0 }, seed: { value: Math.random() * 10 }, heat: { value: 0.9 + Math.random() * 0.4 }, fade: { value: 1 } };
      const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: flameFrag,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const q = new THREE.Mesh(geo, mat);
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * radius * 0.85;
      const big = 1 - d / radius;
      q.position.set(Math.cos(a) * d, 0.11, Math.sin(a) * d);
      q.userData = { u, h: 0.45 + big * 0.75 + Math.random() * 0.35, w: 0.25 + big * 0.35 + Math.random() * 0.2, ph: Math.random() * 6 };
      q.renderOrder = 2;
      scene.add(q);
      this.flames.push(q);
    }
    // looking down into it: flat sheets of churning flame just over the coals
    this.crowns = [0, 1, 2, 3].map((i) => {
      const u = { time: { value: 0 }, seed: { value: i * 3.7 } };
      const mat = new THREE.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: crownFrag });
      const c = new THREE.Mesh(new THREE.CircleGeometry(radius * (0.98 - i * 0.16), 32), mat);
      c.rotation.x = -Math.PI / 2;
      c.rotation.z = i * 1.3;
      c.position.y = 0.14 + i * 0.16;
      c.renderOrder = 1;
      scene.add(c);
      return u;
    });
    // sparks
    const N = 160;
    this.sp = new Float32Array(N * 3);
    this.sv = new Float32Array(N * 3);
    this.sl = new Float32Array(N);
    for (let i = 0; i < N; i++) this.spawnSpark(i, Math.random() * 2);
    this.sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.sp, 3)),
      new THREE.PointsMaterial({ color: 0xffb050, size: 0.012, map: softTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    // smoke
    const st = softTex();
    this.smoke = [];
    for (let i = 0; i < 18; i++) {
      const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, color: 0x0c0806, transparent: true, depthWrite: false, opacity: 0 }));
      sm.userData = { life: Math.random(), x: 0, z: 0, rot: Math.random() * 6 };
      scene.add(sm);
      this.smoke.push(sm);
    }
    // the light: several sources flickering on smooth noise, not a strobe
    this.lights = [0, 1, 2].map((i) => {
      const l = new THREE.PointLight(i ? 0xff5a18 : 0xff8a30, 14, 16, 1.4);
      l.position.set(Math.cos(i * 2.1) * 0.5, 0.7 + i * 0.45, Math.sin(i * 2.1) * 0.5 - (i === 2 ? 0.8 : 0)); // the last one reaches up the far side, onto him
      scene.add(l);
      return l;
    });
  }
  spawnSpark(i, life = 0) {
    const a = Math.random() * Math.PI * 2, d = Math.random() * this.r * 0.8;
    this.sp.set([Math.cos(a) * d, 0.2 + Math.random() * 0.4, Math.sin(a) * d], i * 3);
    this.sv.set([(Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 2.2, (Math.random() - 0.5) * 0.4], i * 3);
    this.sl[i] = life || 0.6 + Math.random() * 1.8;
  }
  update(dt, cam) {
    const t = (this.t += dt);
    const flick = (k) => 0.75 + 0.12 * Math.sin(t * 7.3 + k) + 0.08 * Math.sin(t * 13.1 + k * 2) + 0.05 * Math.sin(t * 23.7 + k * 3);
    this.lights.forEach((l, i) => (l.intensity = (i ? 26 : 60) * flick(i * 2)));
    this.coalMat.color.setScalar(0.85 + 0.15 * flick(5));
    this.logMat.emissive.setScalar(0.7 + 0.3 * flick(7));
    for (const u of this.crowns) u.time.value = t;
    for (const q of this.flames) {
      const d = q.userData;
      d.u.time.value = t;
      // stand up and turn to face the camera: from overhead they foreshorten, as real flames do
      _z.subVectors(cam.position, q.position);
      // seen from straight above a tongue is edge-on: let it go and the sheets below carry the view
      d.u.fade.value = 1 - Math.min(1, Math.max(0, (Math.abs(_z.y) / _z.length() - 0.55) / 0.3));
      _z.setY(0);
      if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1);
      _z.normalize();
      _y.set(0, 1, 0);
      _x.crossVectors(_y, _z);
      q.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
      const s = 0.85 + 0.25 * Math.sin(t * 3.1 + d.ph) + 0.1 * Math.sin(t * 8.3 + d.ph * 2);
      q.scale.set(d.w * (0.9 + 0.1 * Math.sin(t * 5 + d.ph)), d.h * s, 1);
    }
    const p = this.sp, v = this.sv;
    for (let i = 0; i < this.sl.length; i++) {
      this.sl[i] -= dt;
      if (this.sl[i] <= 0) { this.spawnSpark(i); continue; }
      // rise, swirl, slow
      v[i * 3] += Math.sin(t * 3 + i) * dt * 1.5;
      v[i * 3 + 2] += Math.cos(t * 2.6 + i * 1.3) * dt * 1.5;
      v[i * 3 + 1] *= 1 - dt * 0.4;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
    }
    this.sparks.geometry.attributes.position.needsUpdate = true;
    for (const sm of this.smoke) {
      const d = sm.userData;
      d.life += dt * 0.22;
      if (d.life > 1) { d.life = 0; d.x = (Math.random() - 0.5) * this.r; d.z = (Math.random() - 0.5) * this.r; }
      const k = d.life;
      sm.position.set(d.x + Math.sin(t * 0.7 + d.rot) * 0.3 * k, 1.6 + k * 2.2, d.z);
      sm.scale.setScalar(0.8 + k * 2.4);
      sm.material.opacity = Math.sin(k * Math.PI) * 0.55;
      sm.material.rotation = d.rot + t * 0.2;
    }
  }
}

function signTex(text, color) {
  const { c, g } = canvas(256, 96);
  g.fillStyle = '#0a0a0a';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = color;
  g.font = 'bold 70px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText(text, 128, 72);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- the director of your death ----------
export class Cutscene {
  constructor(kind, { mats, audio, blood, aspect }) {
    this.kind = kind;
    this.mats = mats;
    this.audio = audio;
    this.blood = blood;
    this.t = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0);
    this.scene.fog = new THREE.FogExp2(0x000000, 0.08);
    this.scene.add(new THREE.AmbientLight(0x3a2a26, 1.4));
    this.cam = new THREE.PerspectiveCamera(70, aspect, 0.05, 300);
    this.scene.add(this.cam);
    this.him = createForemanMesh(mats);
    this.scene.add(this.him.root);
    this.gore = new Gore(this.scene, mats);
    this.fired = new Set();
    this.blackout = 0;
    this.fear = 0.6;
    this.flash = 0;
    this.shake = 0;
    if (kind !== 'rope' && kind !== 'exit') blood.clear(); // the camera isn't you in these
    this[kind + 'Build']();
  }
  // first person: you're still holding the torch
  torch(i = 120) {
    const t = new THREE.SpotLight(0xffe4c4, i, 30, 0.6, 0.6, 1.5);
    t.position.set(0.2, -0.2, 0);
    t.target.position.set(0, -0.1, -3);
    this.cam.add(t, t.target);
    return t;
  }
  // run a callback once, the first frame the timeline passes `at`
  at(t, key, fn) { if (this.t >= t && !this.fired.has(key)) { this.fired.add(key); fn(); } }
  pose(o = {}) {
    poseForeman(this.him, { gait: o.gait || 0, speed: o.speed || 0, mode: o.mode || 'walk', t: this.t, swing: o.swing || 0, jawOpen: o.jaw ?? 0.2, twitch: o.twitch || { x: 0, y: 0, z: 0, r: 0 } });
  }
  twitch(big = 0.3) { return { x: (Math.random() - 0.5) * big, y: (Math.random() - 0.5) * big, z: (Math.random() - 0.5) * big * 1.5, r: (Math.random() - 0.5) * big * 2 }; }
  headPos(out = new THREE.Vector3()) { this.him.root.updateMatrixWorld(true); return this.him.head.getWorldPosition(out); }
  handPos(i, out = new THREE.Vector3()) { this.him.root.updateMatrixWorld(true); return this.him.arms[i].hand.getWorldPosition(out); }

  update(dt) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 3);
    this.shake = Math.max(0, this.shake - dt * 2);
    this[this.kind + 'Update'](dt);
    this.gore.update(dt);
    if (this.shake > 0) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake * 0.06;
      this.cam.position.y += (Math.random() - 0.5) * this.shake * 0.06;
    }
    return this.t >= this.dur;
  }

  dispose() {
    this.audio.cutLoops();
    this.scene.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  }

  // ---------- 1: the rope ----------
  ropeBuild() {
    this.dur = 7;
    const s = this.scene, m = this.mats;
    room(s, m, 10, 10, 2);
    // the pit
    const pit = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.4, 16, 1, true), m.darkMetal);
    pit.material = pit.material.clone();
    pit.material.side = THREE.DoubleSide;
    pit.position.y = 0.2;
    s.add(pit);
    this.fire = new Fire(s, m, 1.55);
    s.add(new THREE.AmbientLight(0x401808, 0.6));
    // he stands on the edge, eye level with you
    this.him.root.position.set(0, 0.5, -2.4);
    const ledge = mesh(new THREE.BoxGeometry(2, 0.5, 1.4), m.darkMetal);
    ledge.position.set(0, 0.25, -2.6);
    s.add(ledge);
    this.rope = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5), m.apron, false);
    s.add(this.rope);
    this.hang = V(0, 2.25, 0);
    this.audio.fire(true);
    this.audio.creak({ x: 0, y: 3, z: 0 });
  }
  ropeUpdate(dt) {
    const t = this.t, s = this.scene;
    this.fire.update(dt, this.cam);
    // swinging on the rope
    const sway = Math.sin(t * 1.3) * 0.08;
    let y = 2.25;
    let lookAt;
    const head = this.headPos();
    if (t < 4.9) {
      // 0-2.2: him. 2.2-3.6: down at the fire. 3.6-4.9: back up to him; he lifts the cleaver to the rope
      const down = ease((t - 2.2) / 0.8) * (1 - ease((t - 3.6) / 0.6));
      lookAt = head.clone().lerp(V(0, 0, 0.3), down);
      const cut = clamp01((t - 3.9) / 0.6);
      this.pose({ mode: t > 3.8 ? 'attack' : 'walk', swing: t < 4.6 ? 0 : clamp01((t - 4.6) / 0.15), jaw: 0.3 + cut * 0.5, twitch: t < 2.2 ? this.twitch(0.25) : { x: -0.4, y: 0, z: 0.5, r: 0.6 } });
      this.at(4.75, 'snap', () => { this.audio.ropeSnap(); this.flash = 0.4; this.shake = 1; });
    } else {
      // falling into it
      const ft = t - 4.75;
      y = 2.25 - 0.5 * 9.8 * ft * ft;
      lookAt = V(0, 0, 0.1);
      this.at(4.9, 'scream', () => this.audio.scream());
      this.at(5.3, 'in', () => { this.audio.sizzle(); this.flash = 1; this.blackout = 1; });
      this.pose({ mode: 'walk', jaw: 0.8 });
    }
    this.cam.position.set(sway, Math.max(0.5, y), 0.3);
    this.cam.lookAt(lookAt);
    this.cam.rotation.z += sway * 0.5;
    this.rope.visible = t < 4.75;
    this.rope.position.set(sway, 3.2, 0.3);
    this.rope.scale.y = 1.6;
    this.fear = t > 2.2 ? 0.8 : 0.5;
    if (t > 5.4) this.blackout = 1;
    void s;
  }

  // ---------- 2: the exit ----------
  exitBuild() {
    this.dur = 9;
    const s = this.scene, m = this.mats;
    s.fog.density = 0.014;
    this.torch(90);
    // corridor along -z, ending at a door at z = -10
    const T = 2, wall = new THREE.PlaneGeometry(T, 3);
    for (let z = 0; z > -10; z -= T) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(T, T), m.floors[0]);
      f.rotation.x = -Math.PI / 2;
      f.position.set(0, 0, z - 1);
      s.add(f);
      const c = new THREE.Mesh(new THREE.PlaneGeometry(T, T), m.ceil);
      c.rotation.x = Math.PI / 2;
      c.position.set(0, 3, z - 1);
      s.add(c);
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(wall, m.walls[3 + ((z / 2) & 3)]);
        w.position.set(sx, 1.5, z - 1);
        w.rotation.y = -sx * Math.PI / 2;
        s.add(w);
      }
    }
    const back = new THREE.Mesh(wall, m.walls[1]);
    back.position.set(0, 1.5, 1);
    back.rotation.y = Math.PI;
    s.add(back);
    // door frame wall with the doorway cut
    for (const [x, w] of [[-0.85, 0.3], [0.85, 0.3]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), m.walls[2]); p.position.set(x, 1.5, -10); s.add(p); }
    const lintel = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), m.walls[2]);
    lintel.position.set(0, 2.6, -10);
    s.add(lintel);
    this.door = new THREE.Group();
    this.door.position.set(-0.7, 0, -10);
    const leaf = mesh(new THREE.BoxGeometry(1.4, 2.2, 0.06), m.rust[1]);
    leaf.position.set(0.7, 1.1, 0);
    this.door.add(leaf);
    s.add(this.door);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: signTex('EXIT', '#ff3020'), fog: false }));
    sign.position.set(0, 2.6, -9.98);
    s.add(sign);
    const signLight = new THREE.PointLight(0xff3020, 3, 6, 2);
    signLight.position.set(0, 2.4, -9.5);
    s.add(signLight);
    const lamp = makeLamp(m, 'bulb');
    lamp.position.set(0, 3, -3);
    s.add(lamp);
    this.lampLight = new THREE.PointLight(0xffe0c0, 10, 12, 1.6);
    this.lampLight.position.set(0, 2.2, -3);
    s.add(this.lampLight);
    // light from the corridor behind him, so from below he's a shape in the doorway
    const backLight = new THREE.PointLight(0xfff0e0, 14, 8, 1.5);
    backLight.position.set(0, 2.4, -8.2);
    s.add(backLight);
    // beyond the door: nothing under you for a very long way
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(10, 160, 10), new THREE.MeshLambertMaterial({ map: m.ceil.map, side: THREE.BackSide }));
    shaft.position.set(0, -77, -15.01);
    s.add(shaft);
    for (let y = -6; y > -150; y -= 9) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd090, fog: false }));
      l.position.set(-4.9, y, -15 + ((y / 9) % 2 ? 3 : -3));
      s.add(l);
    }
    const deep = new THREE.PointLight(0xffa060, 80, 120, 1);
    deep.position.set(0, -60, -15);
    s.add(deep);
    this.him.root.position.set(0, 0, 2.6);
    this.him.root.rotation.y = Math.PI;
  }
  exitUpdate() {
    const t = this.t;
    const head = this.headPos();
    if (t < 2) {
      // walking to the door. it's right there.
      const z = lerp(-1, -7.5, ease(t / 2));
      this.cam.position.set(0, 1.62 + Math.sin(t * 9) * 0.03, z);
      this.cam.lookAt(0, 1.7, -10);
      this.him.root.position.set(0, 0, z + 3.2);
      this.pose({ mode: 'walk', gait: t * 5, speed: 1.4 });
      this.at(0.4, 'steps', () => { for (let i = 0; i < 4; i++) setTimeout(() => this.audio.step('walk', false), i * 420); });
    } else if (t < 4.2) {
      // look behind you
      const turn = ease((t - 2) / 0.6) * (1 - ease((t - 3.5) / 0.6));
      this.cam.position.set(0, 1.62, -7.5);
      const target = V(0, 1.7, -10).lerp(head, turn);
      this.cam.lookAt(target);
      this.him.root.position.set(0, 0, -5.4);
      this.pose({ jaw: 0.15, twitch: { x: 0.3, y: 0, z: Math.sin(t * 2) * 0.4, r: 0.5 } });
      this.at(2.45, 'see', () => { this.audio.stinger(); this.flash = 0.2; });
    } else if (t < 5.6) {
      // the door opens on nothing
      this.door.rotation.y = -ease((t - 4.2) / 0.6) * 1.9;
      this.at(4.2, 'door', () => { this.audio.creak({ x: 0, y: 1.5, z: -10 }); this.audio.windRush(1.2, 0.25); });
      const z = lerp(-7.5, -9.6, ease((t - 4.4) / 0.6));
      this.cam.position.set(0, 1.62, z);
      const down = ease((t - 4.7) / 0.7);
      this.cam.lookAt(0, lerp(1.6, -40, down), lerp(-12, -14, down));
      // vertigo: the floor drops away
      this.cam.fov = lerp(70, 45, ease((t - 4.8) / 0.8));
      this.cam.updateProjectionMatrix();
      this.him.root.position.set(0, 0, lerp(-5.4, -8.4, ease((t - 4.4) / 1)));
      this.pose({ mode: 'chase', gait: t * 6, speed: 2 });
    } else {
      // the shove, and the fall, watching him in the doorway
      this.at(5.6, 'shove', () => { this.audio.thud({ x: 0, y: 1, z: -9 }, 1); this.audio.gasp(); this.shake = 1.2; });
      const ft = Math.max(0, t - 5.75);
      const y = 1.62 - 0.5 * 9.8 * ft * ft;
      this.cam.fov = 70;
      this.cam.updateProjectionMatrix();
      this.cam.position.set(Math.sin(t) * 0.5, y, -12.5 - Math.min(1.5, ft * 2));
      this.him.root.position.set(0, 0, -9.7);
      this.pose({ mode: 'grab', jaw: 0.4, twitch: { x: 0.6, y: 0, z: 0, r: 0 } });
      head.y += 0.1;
      this.cam.lookAt(t < 5.9 ? V(0, -30, -15) : head);
      this.cam.rotation.z += Math.sin(t * 3) * 0.3;
      this.at(5.8, 'wind', () => { this.audio.windRush(3.2, 1); this.audio.scream(); });
      this.at(8.6, 'land', () => { this.audio.crack(); this.audio.squelch(2); this.blackout = 1; });
      this.fear = 0.9;
    }
  }

  // ---------- 3: the grinder (third person) ----------
  grinderBuild() {
    this.dur = 8.5;
    const s = this.scene, m = this.mats;
    room(s, m, 12, 12, 6);
    s.fog.density = 0.03;
    const g = new THREE.Group();
    g.position.set(0, 0, -3);
    const base = mesh(new THREE.BoxGeometry(1.8, 1.3, 1.8), m.darkMetal);
    base.position.y = 0.65;
    const hopperMat = m.steel.clone();
    hopperMat.side = THREE.DoubleSide;
    const hopper = mesh(new THREE.CylinderGeometry(1.35, 0.55, 1.1, 4, 1, true), hopperMat);
    hopper.rotation.y = Math.PI / 4;
    hopper.position.y = 1.85;
    g.add(base, hopper);
    this.rollers = [-1, 1].map((sx) => {
      const r = new THREE.Group();
      r.position.set(sx * 0.2, 1.35, 0);
      r.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.9, 10), m.darkMetal));
      for (let i = 0; i < 18; i++) { const tooth = mesh(new THREE.ConeGeometry(0.04, 0.12, 4), m.steel, false); const a = (i % 6) / 6 * Math.PI * 2; tooth.position.set(Math.cos(a) * 0.2, (Math.floor(i / 6) - 1) * 0.3, Math.sin(a) * 0.2); tooth.rotation.z = -Math.PI / 2 + a; r.add(tooth); }
      r.rotation.x = Math.PI / 2;
      g.add(r);
      return r;
    });
    const chute = mesh(new THREE.BoxGeometry(0.6, 0.1, 1.2), m.steel);
    chute.position.set(0, 0.55, 1.2);
    chute.rotation.x = 0.5;
    g.add(chute);
    s.add(g);
    s.add(decal(m.pool[0], 3, 0, -1.6, 0.4));
    this.grinder = g;
    const lamp = makeLamp(m, 'bulb');
    lamp.position.set(0.5, 3, -2);
    s.add(lamp);
    const l = new THREE.PointLight(0xffd0a0, 22, 14, 1.4);
    l.position.set(0.5, 2.3, -2);
    l.castShadow = true;
    s.add(l);
    const rim = new THREE.PointLight(0xff3020, 10, 10, 1.5);
    rim.position.set(-2, 1.5, -4);
    s.add(rim);
    const fill = new THREE.PointLight(0xc8d0ff, 6, 12, 1.5);
    fill.position.set(3, 2, 2);
    s.add(fill);
    this.you = makeWorker(m);
    s.add(this.you.root);
    // a work light that travels with the two of you down the room
    this.follow = new THREE.PointLight(0xffc8a0, 16, 7, 1.4);
    s.add(this.follow);
    this.key = new THREE.PointLight(0xffd8b8, 0, 9, 1.2); // on him at the hopper
    this.key.position.set(2.6, 2.3, -1.9);
    s.add(this.key);
    this.audio.grinder(true);
  }
  grinderUpdate(dt) {
    const t = this.t, you = this.you, him = this.him.root;
    for (const r of this.rollers) r.rotation.y += dt * (t > 4 ? 14 : 6) * (r.position.x > 0 ? 1 : -1);
    const hand = V();
    if (t < 3) {
      // dragging you by the ankle, feet first, your arms trailing over your head. The camera walks alongside.
      const z = lerp(3.2, -1.3, ease(t / 3));
      him.position.set(0.3, 0, z);
      him.rotation.y = Math.PI;
      this.pose({ mode: 'walk', gait: t * 5.5, speed: 1.4, jaw: 0.3 });
      this.him.arms[1].sh.rotation.set(0.55, 0, -0.15);
      this.him.arms[1].el.rotation.x = -0.2;
      this.handPos(1, hand);
      const leg = 0.92, lift = Math.asin(clamp01((hand.y - 0.13) / leg));
      you.root.position.set(hand.x, 0.13, hand.z + Math.cos(lift) * leg + Math.sin(t * 11) * 0.02);
      orient(you.root, V(0, 0, 1), V(0, 1, 0)); // on your back, head trailing
      you.legs.forEach((l, i) => { l.rotation.set(-lift + (i ? 0 : 0.25), 0, (i ? 0 : 0.18)); l.userData.knee.rotation.x = i ? 0 : 0.5; });
      you.arms.forEach((a, i) => { a.rotation.set(0, 0, (i ? 1 : -1) * (2.7 + Math.sin(t * 6 + i) * 0.1)); a.userData.el.rotation.z = 0; });
      you.head.rotation.set(0.3, Math.sin(t * 9) * 0.35, 0);
      const mid = V(0.3, 0.75, z + 0.75);
      this.cam.position.set(2.7, 1.05, mid.z + 1.1);
      this.cam.lookAt(mid);
      this.follow.position.set(1.2, 2.2, z + 0.8);
      this.at(0.2, 'drag', () => this.audio.drag());
      this.at(1.4, 'drag2', () => this.audio.drag());
      if (Math.random() < dt * 14) this.scene.add(decal(this.mats.drag || this.mats.splat[0], 0.5, you.root.position.x + (Math.random() - 0.5) * 0.15, you.root.position.z + 0.4, Math.PI / 2, 0.011));
      return;
    }
    you.legs.forEach((l) => { l.rotation.set(0, 0, 0); l.userData.knee.rotation.x = 0; });
    this.follow.intensity = Math.max(0, this.follow.intensity - dt * 30);
    // then: off to the side, him in profile at the lip of the hopper, the whole machine in shot
    const ct = (t - 3) / 5.5;
    this.cam.position.set(lerp(4.6, 4.2, ct), lerp(1.6, 1.9, ct), lerp(-3.4, -3.6, ct));
    this.cam.lookAt(0.9, 1.7, -2.0);
    this.key.intensity = 24;
    // a step back from the rim while he hoists you, then a step in to drop you over it
    const step = ease((t - 3.9) / 0.4);
    him.position.set(lerp(1.95, 1.34, step), 0, lerp(-0.85, -1.52, step));
    him.rotation.y = -2.41; // facing the mouth of it
    if (t < 4.2) {
      // up, by one leg, over the mouth of it
      const k = ease((t - 3) / 1);
      this.pose({ mode: 'walk', jaw: 0.5 });
      this.him.arms[1].sh.rotation.set(lerp(-0.2, -2.9, k), 0, -0.2);
      this.handPos(1, hand);
      you.root.position.set(hand.x, hand.y - 1.1, hand.z);
      orient(you.root, V(0, -1, 0), V(0, 0, 1));
      this.at(3.2, 'growl', () => this.audio.growl({ x: 0.9, y: 2, z: -2 }, 1));
    } else {
      // in
      const k = clamp01((t - 4.2) / 0.5);
      you.root.position.set(lerp(you.root.position.x, 0, k), lerp(2.6, 1.0, k), -3);
      orient(you.root, V(0, -1, 0), V(0, 0, 1));
      you.root.visible = t < 4.75;
      this.pose({ mode: 'walk', jaw: 0.8, twitch: this.twitch(0.2) });
      const mouth = V(0, 2.3, -3);
      this.at(4.45, 'crunch', () => {
        this.audio.grind();
        this.shake = 1.5;
        this.flash = 0.5;
        this.gore.burst(mouth, 40, 5, 0.9, [severedArm(this.mats, Math.random), severedHead(this.mats, Math.random), severedArm(this.mats, Math.random)]);
        this.gore.spray(V(0, 0.8, -1.8), V(0, 0.3, 1), 120, 6, 0.5);
      });
      if (t > 4.5 && t < 7 && Math.random() < dt * 14) { this.gore.burst(mouth, 3, 4, 1); this.gore.spray(V(0, 0.7, -1.7), V(0, 0.2, 1), 25, 5, 0.4); }
      this.at(7.6, 'black', () => (this.blackout = 1));
      this.fear = 0.9;
    }
  }

  // ---------- 4: the fan (third person) ----------
  fanBuild() {
    this.dur = 7.6;
    const s = this.scene, m = this.mats;
    room(s, m, 10, 10, 9);
    s.fog.density = 0.04;
    this.fanPos = V(0, 2.85, -0.4);
    this.fan = new THREE.Group();
    this.fan.position.copy(this.fanPos);
    this.fan.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 10), m.darkMetal));
    this.bladeMat = m.steel.clone();
    for (let i = 0; i < 4; i++) {
      const b = mesh(new THREE.BoxGeometry(1.5, 0.025, 0.32), this.bladeMat);
      b.position.x = 0.85;
      const arm = new THREE.Group();
      arm.rotation.y = (i * Math.PI) / 2;
      arm.add(b);
      this.fan.add(arm);
    }
    const rod = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 5), m.darkMetal, false);
    rod.position.y = 0.1;
    this.fan.add(rod);
    s.add(this.fan);
    s.add(decal(m.pool[2], 2.2, 0, -0.4, 0.7));
    // a light above the blades: their shadows sweep the room
    this.light = new THREE.PointLight(0xfff0d0, 14, 14, 1.4);
    this.light.position.set(0, 2.97, -0.4);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    s.add(this.light);
    const key = new THREE.PointLight(0xffd0b0, 16, 9, 1.3); // from the camera's side, on the two of you
    key.position.set(2.2, 1.7, -1.2);
    s.add(key);
    const rim = new THREE.PointLight(0xff3020, 8, 8, 1.5);
    rim.position.set(-2, 1.2, -2.5);
    s.add(rim);
    this.you = makeWorker(m);
    this.you.root.rotation.y = 1.2; // half turned to us
    s.add(this.you.root);
    this.him.root.position.set(0, 0, 0.35);
    this.him.root.rotation.y = Math.PI;
    this.fallV = 0;
    this.audio.fanLoop(true);
  }
  fanUpdate(dt) {
    const t = this.t, f = this.him, you = this.you;
    this.fan.rotation.y += dt * 14;
    // the camera: low in the corner of the room, looking up at it, creeping closer
    this.cam.position.set(lerp(3.3, 2.5, t / 7), lerp(1.0, 1.2, t / 7), lerp(-0.9, -0.6, t / 7));
    this.cam.lookAt(0, lerp(1.75, 2.0, clamp01(t / 3)), -0.15);
    // held just under the blades, then one hard shove up into them
    const lift = Math.min(ease((t - 0.7) / 2.2), 0.52) + (t > 3.0 ? 0.48 * ease((t - 3.0) / 0.12) : 0);
    if (t < 4.3) {
      // by the throat, then up over its head, into the blades
      this.pose({ mode: 'grab', jaw: 0.5 + lift * 0.4, twitch: this.twitch(0.25) });
      for (const a of f.arms) { a.sh.rotation.x = lerp(-1.5, -2.95, lift); a.el.rotation.x = lerp(-0.4, -0.05, lift); }
      f.neck.rotation.x = lerp(-0.2, -0.9, lift); // watching you go up
      // keep its hands right under the hub
      const h0 = this.handPos(0), h1 = this.handPos(1), hm = h0.add(h1).multiplyScalar(0.5);
      f.root.position.x += this.fanPos.x - hm.x;
      f.root.position.z += this.fanPos.z - hm.z;
      const top = this.handPos(0).add(this.handPos(1)).multiplyScalar(0.5);
      you.root.position.set(top.x, top.y - 0.6, top.z);
      // kicking, clawing at its arms
      you.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 13 + i * 2.5) * 0.55; l.userData.knee.rotation.x = 0.4 + Math.sin(t * 11 + i) * 0.4; });
      you.arms.forEach((a, i) => { a.rotation.set(-1.2 + Math.sin(t * 9 + i * 3) * 0.6, 0, (i ? 1 : -1) * (0.4 + Math.sin(t * 7 + i) * 0.3)); });
      you.head.rotation.set(-0.5 + Math.sin(t * 10) * 0.2, Math.sin(t * 8) * 0.4, 0);
      this.at(0.9, 'up', () => this.audio.growl({ x: 0, y: 2, z: 0 }, 1));
      this.fear = 0.5 + lift * 0.5;
    }
    const hub = V(this.fanPos.x, this.fanPos.y - 0.1, this.fanPos.z);
    const fling = () => { const a = Math.random() * 6.28; return V(Math.cos(a), -0.15 + Math.random() * 0.3, Math.sin(a)); };
    this.at(3.1, 'head', () => {
      // the head goes first
      this.audio.fanHit();
      this.flash = 0.6;
      this.shake = 2;
      you.head.visible = false;
      const st = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), this.mats.meat, false);
      st.position.y = 0.05;
      you.neck.add(st);
      this.bladeMat.color.setHex(0x8a2a22);
      this.gore.burst(hub, 30, 7, 0.05, [severedHead(this.mats, Math.random)]);
      for (let i = 0; i < 6; i++) this.gore.spray(hub, fling(), 60, 9, 0.4);
    });
    this.at(3.6, 'arms', () => {
      this.audio.fanHit();
      this.audio.crack();
      this.shake = 2;
      you.arms.forEach((a) => (a.visible = false));
      openChest(you, this.mats);
      this.gore.burst(hub, 30, 7, 0.05, [severedArm(this.mats, Math.random), severedArm(this.mats, Math.random)]);
      for (let i = 0; i < 6; i++) this.gore.spray(hub, fling(), 60, 9, 0.4);
    });
    if (t > 3.1 && t < 4.3 && Math.random() < dt * 20) this.gore.spray(hub, fling(), 25, 9, 0.5);
    if (t > 3.1 && t < 6 && Math.random() < dt * 6) this.gore.spray(V((Math.random() - 0.5) * 1.6, 2.75, -0.4 + (Math.random() - 0.5) * 1.6), V(0, -1, 0), 6, 1, 0.2); // it rains off the blades
    if (t >= 4.3) {
      // it lets go of what's left
      this.at(4.3, 'drop', () => this.audio.squelch(1.5));
      this.fallV -= 9.8 * dt;
      you.root.position.y = Math.max(0.16, you.root.position.y + this.fallV * dt);
      if (you.root.position.y <= 0.16) {
        this.at(4.8, 'land', () => { this.audio.squelch(1.2); this.shake = 0.8; this.gore.spray(you.root.position.clone(), V(0, 1, 0), 60, 3, 1); });
        you.root.rotation.x = Math.max(-1.45, you.root.rotation.x - dt * 6);
      }
      // and then it looks at you
      const look = ease((t - 5.0) / 0.3);
      this.pose({ mode: 'walk', jaw: 0.4 + look * 0.5, twitch: t > 5.0 ? this.twitch(0.15) : { x: -0.6, y: 0, z: 0, r: 0 } });
      for (const a of f.arms) a.sh.rotation.x = lerp(-1.2, -0.6, ease((t - 4.3) / 0.6));
      f.root.rotation.y = lerp(Math.PI, Math.atan2(this.cam.position.x - f.root.position.x, this.cam.position.z - f.root.position.z), look);
      this.at(5.0, 'stare', () => { this.audio.jumpscare(0.7); this.flash = 0.4; });
      if (t > 5.1) { const hp = this.headPos(); this.cam.position.lerp(hp, ease((t - 5.1) / 1.4) * 0.55); this.cam.lookAt(hp); this.fear = 1; }
    }
    this.at(6.8, 'black', () => (this.blackout = 1));
  }

  // ---------- the ending: clocking out ----------
  // The lift climbs the last floors; the gate goes up on dawn in the loading bay; you walk out; you stop and
  // look back, and he's standing in the lift, in the dark, watching you go. He doesn't follow. You walk into the light.
  endingBuild() {
    this.dur = 31;
    const s = this.scene, m = this.mats;
    s.background = new THREE.Color(0x1a1c20);
    s.fog = new THREE.FogExp2(0x3a3e44, 0.03);
    // the loading bay: concrete, a long way across, a roller door half up at the far end on to the morning
    const conc = new THREE.MeshLambertMaterial({ color: 0x55534e });
    const floor = mesh(new THREE.PlaneGeometry(16, 26), m.floors[0], false);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -11);
    floor.receiveShadow = true;
    s.add(floor);
    const wallM = m.walls[1];
    for (const [x, z, ry, w] of [[-8, -11, Math.PI / 2, 26], [8, -11, -Math.PI / 2, 26], [0, 2, Math.PI, 16]]) { const wl = mesh(new THREE.PlaneGeometry(w, 6), wallM, false); wl.position.set(x, 3, z); wl.rotation.y = ry; s.add(wl); }
    const ceil = mesh(new THREE.PlaneGeometry(16, 26), conc, false);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 6, -11);
    s.add(ceil);
    // the far wall, with the roller door in it
    for (const [x, w] of [[-5.25, 5.5], [5.25, 5.5]]) { const wl = mesh(new THREE.PlaneGeometry(w, 6), wallM, false); wl.position.set(x, 3, -24); s.add(wl); }
    const over = mesh(new THREE.PlaneGeometry(5, 1.6), wallM, false); over.position.set(0, 5.2, -24); s.add(over);
    const door = mesh(new THREE.BoxGeometry(5, 0.7, 0.12), m.rust[1]); door.position.set(0, 4.05, -24); s.add(door); // rolled most of the way up
    // outside: the morning, too bright to see into
    this.sky = new THREE.MeshBasicMaterial({ color: 0xeef2f6, fog: false });
    const sky = mesh(new THREE.PlaneGeometry(30, 14), this.sky, false); sky.position.set(0, 2, -30); s.add(sky);
    const ground = mesh(new THREE.PlaneGeometry(30, 12), new THREE.MeshBasicMaterial({ color: 0xb8bcb4, fog: false }), false); ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.01, -30); s.add(ground);
    this.sun = new THREE.DirectionalLight(0xfff0dc, 0);
    this.sun.position.set(2, 6, -34);
    this.sun.target.position.set(0, 0, -6);
    s.add(this.sun, this.sun.target);
    this.dayFill = new THREE.HemisphereLight(0xb8c4d0, 0x302a24, 0);
    s.add(this.dayFill);
    // the morning coming in at the door, a long pale wash across the floor
    this.doorLight = new THREE.PointLight(0xe8eef4, 0, 34, 1.1);
    this.doorLight.position.set(0, 2.6, -22.5);
    s.add(this.doorLight);
    this.doorSpot = new THREE.SpotLight(0xfff4e4, 0, 40, 0.5, 0.6, 1);
    this.doorSpot.position.set(0, 3, -26);
    this.doorSpot.target.position.set(0, 0, -4);
    s.add(this.doorSpot, this.doorSpot.target);
    // stuff in the bay: pallets, a dead forklift's worth of crates, drag marks to the door
    for (let i = 0; i < 6; i++) { const c = mesh(new THREE.BoxGeometry(1.2, 0.5 + Math.random() * 0.8, 1), new THREE.MeshLambertMaterial({ color: 0x6a5238 })); c.position.set((Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3), 0.4, -6 - Math.random() * 14); s.add(c); }
    s.add(decal(m.drag, 3, 0.4, -12, Math.PI / 2, 0.012));
    s.add(decal(m.drag, 3, 0.4, -16, Math.PI / 2, 0.012));
    // the lift: you start inside it, in the dark, at the back of the bay
    this.lift = makeLift(m, 0);
    this.lift.position.set(0, 0, 0);
    this.lift.rotation.y = Math.PI;
    s.add(this.lift);
    this.bars = this.lift.userData.bars;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6, 2.4), new THREE.MeshBasicMaterial({ color: 0x020202, side: THREE.BackSide }));
    shaft.position.set(0, 3, 0.3);
    s.add(shaft);
    const mouth = mesh(new THREE.PlaneGeometry(16, 6), m.walls[1], false); // the wall either side of the lift mouth
    void mouth;
    // light running past the gate as the floors go by
    this.pass = new THREE.PointLight(0xffc890, 0, 5, 1.5);
    s.add(this.pass);
    this.liftLamp = new THREE.PointLight(0xffd8b0, 2.5, 4, 1.5);
    this.liftLamp.position.set(0, 2.6, 0.3);
    s.add(this.liftLamp);
    // him: in the lift behind you when you look back
    this.him.root.position.set(0, 0, 0.35);
    this.him.root.rotation.y = Math.PI;
    this.him.root.visible = false;
    this.eyeLight = new THREE.PointLight(0xff2a10, 0, 1.2, 2);
    s.add(this.eyeLight);
    this.audio.liftMotor(true);
  }
  endingUpdate(dt) {
    const t = this.t, cam = this.cam;
    const walk = (z0, z1, k) => { const z = lerp(z0, z1, k); cam.position.set(Math.sin(t * 4.4) * 0.03, 1.62 + Math.abs(Math.sin(t * 4.4)) * 0.035, z); };
    if (t < 6) {
      // the ride up: the cage shaking, light sliding past the gate, a floor at a time
      this.pose({ mode: 'walk' });
      cam.position.set(Math.sin(t * 31) * 0.01, 1.62 + Math.sin(t * 23) * 0.012, 0.6);
      cam.lookAt(0, 1.5, -3);
      const floorK = (t * 1.6) % 1;
      this.pass.position.set(0, 4 - floorK * 6, -1.1);
      this.pass.intensity = 6 * Math.sin(floorK * Math.PI);
      this.at(0.2, 'motor', () => this.audio.liftMotor(true));
      for (let i = 0; i < 9; i++) this.at(i * 0.62, 'f' + i, () => this.audio.click({ x: 0, y: 2, z: 0 }));
      this.sun.intensity = 0;
      this.fear = 0.25;
    } else if (t < 9.5) {
      // it stops; the gate goes up on grey light
      this.at(6, 'stop', () => { this.audio.liftMotor(false); this.audio.clank({ x: 0, y: 1, z: -1 }, 1); this.shake = 0.6; });
      this.at(6.6, 'gate', () => this.audio.gateSlide({ x: 0, y: 1, z: -1 }));
      const k = ease((t - 6.6) / 2.2);
      this.bars.position.y = k * 2.6;
      this.pass.intensity = 0;
      this.sun.intensity = k * 2.2;
      this.dayFill.intensity = k * 1.2;
      this.doorLight.intensity = k * 60;
      this.doorSpot.intensity = k * 120;
      cam.position.set(0, 1.62, 0.6);
      cam.lookAt(0, 1.5 + k * 0.1, -6);
      this.fear = 0.15;
      this.at(8.6, 'dawn', () => this.audio.dawn());
    } else if (t < 17.5) {
      // out across the bay toward the light
      const k = (t - 9.5) / 8;
      walk(-0.2, -12, ease(k));
      cam.lookAt(Math.sin(t * 0.7) * 0.4, 1.5, -30);
      this.sun.intensity = 2.2 + k * 0.6;
      this.dayFill.intensity = 1.2 + k * 0.3;
      this.doorLight.intensity = 60 + k * 30;
      this.doorSpot.intensity = 120 + k * 60;
      this.fear = 0;
      this.him.root.visible = true; // he's there now, behind you; you haven't looked
      this.pose({ mode: 'walk', jaw: 0.05 });
    } else if (t < 19.5) {
      // you stop. You turn round.
      const k = ease((t - 17.5) / 1.8);
      cam.position.set(0, 1.62, -12);
      const yaw = lerp(0, Math.PI, k);
      cam.lookAt(Math.sin(yaw) * 10, 1.5, -12 - Math.cos(yaw) * 10);
      this.at(18.4, 'turn', () => this.audio.creak({ x: 0, y: 1, z: 0 }));
      this.pose({ mode: 'walk', jaw: 0.05 });
    } else if (t < 27) {
      // he's standing in the lift. In the dark. He doesn't come out. He just watches you.
      const k = (t - 19.5) / 7.5;
      cam.position.set(0, 1.62, -12 + k * 1.2);
      const hp = this.headPos();
      cam.lookAt(hp.x, hp.y - 0.15 + (1 - k) * 0.1, hp.z);
      cam.fov = lerp(70, 30, ease(k)); // the slow push in on his face
      cam.updateProjectionMatrix();
      this.pose({ mode: 'walk', jaw: 0.1 + k * 0.15, twitch: { x: 0, y: 0, z: k * 0.35, r: Math.sin(t * 0.8) * 0.15 } });
      this.him.neck.rotation.x = -0.2;
      this.eyeLight.position.copy(hp).add(V(0, 0, -0.3));
      this.eyeLight.intensity = 0.6;
      this.liftLamp.intensity = 0.6 * (Math.sin(t * 17) + Math.sin(t * 5.3) > -1.3 ? 1 : 0.05); // the cage light failing; he stands in the dark
      this.at(21, 'breath', () => this.audio.growl(this.headPos(), 0.4));
      this.at(25.5, 'click', () => this.audio.click(this.headPos()));
      this.fear = 0.35 + k * 0.3;
    } else {
      // and you turn your back on him and walk out into it
      const k = ease((t - 27) / 1.2);
      cam.fov = lerp(30, 70, k);
      cam.updateProjectionMatrix();
      const yaw = lerp(Math.PI, Math.PI * 2, k);
      cam.position.set(0, 1.62, -10.8 - Math.max(0, t - 28) * 1.3);
      cam.lookAt(Math.sin(yaw) * 10, 1.5, cam.position.z - Math.cos(yaw) * 10);
      this.flash = Math.max(this.flash, clamp01((t - 28.6) / 2.2)); // into the white
      this.fear = 0;
    }
  }

  // ---------- 6: the rack (third person) ----------
  rackBuild() {
    this.dur = 9.5;
    const s = this.scene, m = this.mats;
    room(s, m, 10, 10, 10);
    s.fog.density = 0.05;
    // the table: a heavy wooden slab on steel legs, blood soaked into the grain
    const wood = new THREE.MeshPhongMaterial({ color: 0x3a2414, shininess: 20 });
    const slab = mesh(new THREE.BoxGeometry(2.6, 0.14, 0.8), wood);
    slab.position.set(0, 0.85, 0);
    s.add(slab);
    for (const [x, z] of [[-1.15, -0.32], [1.15, -0.32], [-1.15, 0.32], [1.15, 0.32]]) { const l = mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), m.darkMetal); l.position.set(x, 0.4, z); s.add(l); }
    s.add(decal(m.pool[0], 2.4, 0, 0.2, 0.4));
    // the winch at the head end: a drum on a frame, and the wheel he turns
    const frame = mesh(new THREE.BoxGeometry(0.2, 1.4, 1.0), m.darkMetal);
    frame.position.set(-1.75, 0.7, 0);
    s.add(frame);
    this.drum = new THREE.Group();
    this.drum.position.set(-1.62, 1.05, 0);
    const dr = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), m.rust[2]);
    dr.rotation.x = Math.PI / 2;
    this.drum.add(dr);
    for (let i = 0; i < 6; i++) { const peg = mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), wood, false); peg.rotation.z = (i * Math.PI) / 3; peg.position.z = 0.4; this.drum.add(peg); }
    s.add(this.drum);
    // the post at the foot end
    const post = mesh(new THREE.BoxGeometry(0.2, 1.3, 0.6), m.darkMetal);
    post.position.set(1.6, 0.65, 0);
    s.add(post);
    // you, on your back, arms over your head
    this.you = makeWorker(m);
    this.you.root.position.set(0.15, 1.05, 0);
    orient(this.you.root, V(-1, 0, 0), V(0, 1, 0));
    this.you.arms.forEach((a, i) => a.rotation.set(0, 0, (i ? 1 : -1) * 2.95));
    this.you.legs.forEach((l, i) => l.rotation.set(0, 0, (i ? -1 : 1) * 0.12));
    s.add(this.you.root);
    // chains: wrists to the drum, ankles to the post
    this.chains = [0, 1, 2, 3].map(() => { const c = mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 5), m.chain, false); s.add(c); return c; });
    this.torn = [false, false, false, false]; // right arm, left arm, right leg, left leg
    // him, at the wheel
    this.him.root.position.set(-1.9, 0, 0.75);
    this.him.root.rotation.y = Math.PI * 0.7;
    const lamp = makeLamp(m, 'bulb');
    lamp.position.set(0, 3, 0);
    s.add(lamp);
    const l = new THREE.PointLight(0xffd2a8, 30, 9, 1.2);
    l.position.set(0.2, 2.3, 0.3);
    l.castShadow = true;
    s.add(l);
    const over = new THREE.SpotLight(0xfff0dc, 40, 6, 0.6, 0.5, 1.2); // straight down on the table
    over.position.set(0, 2.6, 0.2);
    over.target.position.set(0, 0.9, 0);
    s.add(over, over.target);
    const rim = new THREE.PointLight(0xff3020, 9, 8, 1.5);
    rim.position.set(-2.5, 1.4, -2);
    s.add(rim);
    const fill = new THREE.PointLight(0xc8d0ff, 5, 10, 1.5);
    fill.position.set(2.5, 1.8, 2.5);
    s.add(fill);
  }
  // the world position of a hand or a foot
  rackEnd(i, out = new THREE.Vector3()) {
    this.you.root.updateMatrixWorld(true);
    if (i < 2) return this.you.arms[i].userData.hand.getWorldPosition(out);
    return this.you.legs[i - 2].userData.boot.getWorldPosition(out);
  }
  rackUpdate(dt) {
    const t = this.t, you = this.you, f = this.him;
    // the crank: slow, then faster, then he leans into it
    const crank = t < 1.5 ? 0.8 : t < 4 ? 1.6 + (t - 1.5) * 0.6 : 3.5;
    if (t < 6.8) this.drum.rotation.z -= dt * crank;
    const pull = clamp01((t - 0.8) / 3.4); // how far you've been stretched before things start to give
    // stretched: every limb a little longer, the body taut, the head thrown back screaming
    you.arms.forEach((a, i) => { if (!this.torn[i]) a.scale.y = 1 + pull * 0.32; });
    you.legs.forEach((l, i) => { if (!this.torn[2 + i]) l.scale.y = 1 + pull * 0.22; });
    you.torso.scale.y = 1 + pull * 0.08;
    you.head.rotation.x = -0.4 - pull * 0.4 + Math.sin(t * 13) * 0.08 * (1 - clamp01((t - 6.3) / 0.5));
    you.jaw.rotation.x = 0.3 + pull * 0.6;
    if (t < 6.4) you.root.position.x = 0.15 + Math.sin(t * 17) * 0.015 * pull; // straining
    // him turning the wheel, both hands on the pegs
    this.pose({ mode: 'walk', jaw: 0.25 + pull * 0.3, twitch: this.twitch(0.12) });
    const ph = -this.drum.rotation.z;
    f.torso.rotation.x = 0.6 + pull * 0.25;
    f.arms[0].sh.rotation.set(-1.2 + Math.sin(ph) * 0.45, 0, 0.3);
    f.arms[1].sh.rotation.set(-1.2 + Math.sin(ph + 0.6) * 0.45, 0, -0.1);
    f.arms.forEach((a) => (a.el.rotation.x = -0.5 + Math.cos(ph) * 0.3));
    // the chains run from each wrist and ankle to the drum or the post
    const anchors = [V(-1.55, 1.05, 0.12), V(-1.55, 1.05, -0.12), V(1.5, 1.0, 0.12), V(1.5, 1.0, -0.12)];
    const e = V();
    this.chains.forEach((c, i) => {
      const a = anchors[i];
      if (this.torn[i]) { // slack: hanging off the anchor
        c.position.set(a.x + (i < 2 ? 0.05 : -0.05), a.y - 0.25, a.z);
        c.quaternion.identity();
        c.scale.y = 0.5;
        return;
      }
      this.rackEnd(i, e);
      c.position.copy(a).add(e).multiplyScalar(0.5);
      const d = e.clone().sub(a);
      c.scale.y = d.length();
      c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    });
    // and then they give, one after another
    const tear = (i, at, key) => this.at(at, key, () => {
      const p = this.rackEnd(i);
      this.torn[i] = true;
      const limb = i < 2 ? you.arms[i] : you.legs[i - 2];
      limb.visible = false;
      const st = stump(this.mats, i < 2 ? 0.05 : 0.07);
      st.position.copy(limb.position);
      st.rotation.z = i < 2 ? 0 : Math.PI;
      (i < 2 ? you.torso : you.root).add(st);
      this.audio.crack();
      this.audio.squelch(1.6);
      this.audio.tear();
      this.shake = 1.2;
      this.flash = 0.25;
      const piece = i < 2 ? severedArm(this.mats, Math.random) : severedArm(this.mats, Math.random);
      if (i >= 2) piece.scale.set(1.3, 1.3, 1.3);
      const toward = (i < 2 ? V(-1, 0.5, 0) : V(1, 0.5, 0));
      this.gore.burst(p, 10, 3, 0.7, [piece]);
      this.gore.spray(p, toward.clone().negate().add(V(0, 0.8, 0)), 120, 4, 0.5);
      this.gore.spray(p, V(0, 1, 0), 60, 3, 0.8);
      this.scene.add(decal(this.mats.splat[(Math.random() * 4) | 0], 1.2, p.x + (Math.random() - 0.5) * 0.5, p.z + (Math.random() - 0.5) * 0.5, Math.random() * 6, 0.012));
    });
    this.at(1.2, 'creak1', () => this.audio.creak({ x: -1.6, y: 1, z: 0 }));
    this.at(2.3, 'scream', () => this.audio.scream());
    this.at(2.8, 'creak2', () => this.audio.chainRattle({ x: 0, y: 1, z: 0 }));
    this.at(3.6, 'creak3', () => this.audio.creak({ x: 0, y: 1, z: 0 }));
    tear(0, 4.2, 't0');
    tear(3, 5.0, 't3');
    tear(1, 5.7, 't1');
    tear(2, 6.2, 't2');
    if (t > 6.2) { // what's left drops onto the slab, and keeps bleeding
      you.root.position.y = Math.max(0.98, you.root.position.y - dt * 0.6);
      if (Math.random() < dt * 8) this.gore.spray(you.root.getWorldPosition(V()), V(0, -0.4, 0.4), 6, 1, 0.6);
    }
    if (t > 4.2 && t < 7 && Math.random() < dt * 10) {
      const i = (Math.random() * 4) | 0;
      if (this.torn[i]) this.gore.spray(this.rackEnd(i), V(0, 0.6, 0), 10, 2, 0.6);
    }
    // camera: from the foot of the table, slowly coming in; then low and close; then onto his face
    if (t < 4) {
      const k = t / 4;
      this.cam.position.set(lerp(2.4, 1.6, k), lerp(2.1, 1.9, k), lerp(2.1, 1.5, k));
      this.cam.lookAt(-0.3, 1.0, 0);
    } else if (t < 6.8) {
      const k = (t - 4) / 2.8;
      this.cam.position.set(lerp(1.5, 0.9, k), lerp(1.45, 1.6, k), lerp(1.9, 1.7, k));
      this.cam.lookAt(-0.3, 1.0, 0);
    } else {
      // he stops, and turns to look at you
      const look = ease((t - 6.8) / 0.3);
      f.root.rotation.y = lerp(Math.PI * 0.7, Math.atan2(this.cam.position.x - f.root.position.x, this.cam.position.z - f.root.position.z), look);
      f.torso.rotation.x = lerp(0.85, 0.4, look);
      f.jaw.rotation.x = 0.95;
      this.at(6.8, 'stare', () => { this.audio.jumpscare(0.7); this.flash = 0.4; });
      const hp = this.headPos();
      this.cam.position.lerp(hp, ease((t - 6.9) / 1.4) * 0.5);
      this.cam.lookAt(hp);
    }
    this.fear = 0.55 + pull * 0.45;
    this.at(8.6, 'black', () => (this.blackout = 1));
  }

  // ---------- 5: eaten (third person) ----------
  eatenBuild() {
    this.dur = 9;
    const s = this.scene, m = this.mats;
    room(s, m, 10, 10, 7);
    s.fog.density = 0.06;
    s.add(decal(m.pool[1], 2.6, 0, 0, 1));
    this.you = makeWorker(m);
    this.you.root.position.set(0, 0.16, 0);
    orient(this.you.root, V(1, 0, 0), V(0, 1, 0));
    this.you.arms[0].rotation.z = -1.2;
    this.you.arms[1].rotation.z = 1.2;
    s.add(this.you.root);
    this.him.root.position.set(0.3, 0, -0.75);
    const lamp = makeLamp(m, 'bulb');
    lamp.position.set(0.2, 3, 0);
    s.add(lamp);
    const l = new THREE.PointLight(0xffc8a0, 18, 10, 1.4);
    l.position.set(0.2, 2.2, 0);
    l.castShadow = true;
    s.add(l);
    const rim = new THREE.PointLight(0xff3020, 8, 8, 1.5);
    rim.position.set(-1.5, 1, -1.8);
    s.add(rim);
    this.held = null;
  }
  eatenUpdate(dt) {
    const t = this.t, f = this.him;
    // the camera circles slowly, low, like it's trying not to be seen
    const a = 0.9 + t * 0.12;
    this.cam.position.set(Math.cos(a) * 2.6, 0.9 + t * 0.03, Math.sin(a) * 2.6);
    this.cam.lookAt(0.2, 0.55, -0.2);
    // kneeling over you
    this.pose({ mode: 'walk', jaw: 0.3, twitch: this.twitch(0.15) });
    f.hips.position.y = 0.62;
    f.legs.forEach((lg) => { lg.thigh.rotation.x = -1.25; lg.knee.rotation.x = 2.1; });
    f.torso.rotation.x = 1.0;
    const chopArm = f.arms[0], holdArm = f.arms[1];
    const chop = (t0) => clamp01((t - t0) / 0.18);
    holdArm.sh.rotation.set(-0.6, 0, -0.2);
    if (t < 3.6) {
      const k = t < 2.5 ? chop(1.4) : chop(2.5);
      const raise = t < 1.4 ? ease(t / 1.2) : t < 2.5 ? 1 - k + (t > 2 ? ease((t - 1.8) / 0.6) : 0) : 1 - k;
      chopArm.sh.rotation.set(lerp(-0.4, -2.6, clamp01(raise)), 0, 0.2);
      this.at(1.55, 'chop1', () => {
        this.audio.crack(); this.audio.squelch(1.5);
        this.you.arms[1].visible = false;
        const arm = severedArm(this.mats, Math.random);
        arm.position.set(0.2, 0.2, 0.3);
        this.scene.add(arm);
        this.held = arm;
        this.gore.spray(V(0.15, 0.25, 0.2), V(0.3, 1, 0.4), 80, 3, 0.6);
        this.shake = 0.6;
      });
      this.at(2.65, 'chop2', () => {
        this.audio.crack(); this.audio.squelch(1.5);
        this.you.legs[0].visible = false;
        openChest(this.you, this.mats);
        this.gore.burst(V(-0.4, 0.2, 0.05), 8, 2, 0.8, [severedArm(this.mats, Math.random)]);
        this.gore.spray(V(-0.35, 0.2, 0), V(-0.2, 1, 0), 80, 3, 0.6);
        this.shake = 0.6;
      });
    } else {
      // and then he eats
      const lift = ease((t - 3.6) / 0.8);
      chopArm.sh.rotation.set(-0.5, 0, 0.3);
      holdArm.sh.rotation.set(lerp(-0.6, -2.3, lift), 0, lerp(-0.2, 0.35, lift));
      holdArm.el.rotation.x = lerp(-0.2, -1.6, lift);
      const hand = this.handPos(1);
      if (this.held) { this.held.position.copy(hand); this.held.rotation.set(t, 0.6, 1.2); }
      const chewing = t > 4.4 && t < 6.6;
      f.jaw.rotation.x = chewing ? 0.2 + Math.abs(Math.sin(t * 9)) * 0.7 : 0.4;
      if (chewing && Math.random() < dt * 5) { this.audio.chew(); this.gore.spray(this.headPos(), V(0, -1, 0.3), 12, 1.2, 0.5); }
      // and then it looks right at you
      if (t > 6.6) {
        const look = ease((t - 6.6) / 0.25);
        f.torso.rotation.x = lerp(1.0, 0.45, look);
        f.neck.rotation.x = lerp(-0.5, -0.1, look);
        f.root.rotation.y = lerp(0, Math.atan2(this.cam.position.x - f.root.position.x, this.cam.position.z - f.root.position.z), look);
        f.jaw.rotation.x = 0.9;
        this.at(6.6, 'stare', () => { this.audio.jumpscare(0.8); this.flash = 0.5; });
        this.cam.position.lerp(this.headPos(), ease((t - 6.7) / 1.4) * 0.6);
        this.cam.lookAt(this.headPos());
        this.fear = 1;
      }
    }
    this.at(8.3, 'black', () => (this.blackout = 1));
  }
}
