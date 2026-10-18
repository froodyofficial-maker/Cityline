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
import { makeBody, openChest, mesh, decal, severedArm, severedHead, meatChunk, makeLamp, stump, makeLift, makeCarcass, bucket, butcherTable } from './props.js';
import { pipeRun, conveyor, packTable, forklift, crateStack } from './props2.js';
import { canvas, themeMaterials } from './textures.js';
import { makeRng } from './rng.js';

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

// hanging by one ankle from `hand`: the hips a leg's length below it, head down. While the hand is too low for
// that, the body lies along the floor away from `away` instead, shoulders and head on the concrete, never through it
const LEG = 0.92, TRUNK = 0.85;
function hangFromHand(you, hand, away) {
  const hipY = Math.max(0.16, hand.y - LEG);
  const flat = Math.sqrt(Math.max(0, LEG * LEG - (hand.y - hipY) ** 2)); // how far the leg lies out sideways
  const a = away.clone().setY(0).normalize();
  you.root.position.set(hand.x + a.x * flat, hipY, hand.z + a.z * flat);
  const drop = Math.min(1, (hipY - 0.12) / TRUNK); // how far the head can hang below the hips
  const head = new THREE.Vector3(a.x * Math.sqrt(1 - drop * drop), -drop, a.z * Math.sqrt(1 - drop * drop));
  orient(you.root, head, drop > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
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

// ---------- the way out, for the ending ----------
// the dispatch bay: W wide, from the lift's wall at Z0 to the shutter's at Z1, H high; the door DW x DH
const YARD = { W: 14, Z0: -1, Z1: -26, H: 5.5, DW: 5.2, DH: 4.2 };
const HOLE = { x: 0.35, y: 1.3 }; // where the hook comes through
const FOG_OUT = new THREE.Color(0xa89a8c); // the haze over the yard at dawn

// a roller shutter that dents: a corrugated sheet whose ribs and dents are worked out from its flat rest shape.
// It faces the yard (turned round), so x here is the world's x and the dents push out toward you.
class Shutter {
  constructor(mat, w, h) {
    this.w = w;
    this.h = h;
    this.geo = new THREE.PlaneGeometry(w, h, 24, Math.round(h / 0.05));
    this.rest = this.geo.attributes.position.array.slice();
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.receiveShadow = true;
    this.dents = []; // [local x, y up from the bottom edge, depth, radius]
    this.kick = null; // the bulge of a blow, ringing out
    this.dirty = true;
  }
  dent(x, y, depth, r, kick) { this.dents.push([-x, y, depth, r]); this.kick = { x: -x, y, amp: kick, t: 0 }; this.dirty = true; }
  heightAt(x, y) { let z = 0; for (const [dx, dy, d, R] of this.dents) z += d * Math.exp(-((-x - dx) ** 2 + (y - dy) ** 2) / (R * R)); return z; }
  update(dt) {
    const k = this.kick;
    if (k) { k.t += dt; if (k.t > 0.8) this.kick = null; this.dirty = true; }
    if (!this.dirty) return;
    this.dirty = false;
    const p = this.geo.attributes.position.array, r = this.rest, h2 = this.h / 2;
    const ka = k ? k.amp * Math.exp(-k.t * 6) * Math.cos(k.t * 34) : 0;
    for (let i = 0; i < p.length; i += 3) {
      const x = r[i], y = r[i + 1] + h2;
      let z = (Math.abs(((y / 0.2) % 1) - 0.5) - 0.25) * 0.08; // the ribs
      for (const [dx, dy, d, R] of this.dents) { const q = ((x - dx) ** 2 + (y - dy) ** 2) / (R * R); if (q < 5) z += d * Math.exp(-q); }
      if (k) z += ka * Math.exp(-((x - k.x) ** 2 + (y - k.y) ** 2) / 1.4);
      p[i + 2] = z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// a reefer trailer backed on to a dock: box, chassis, wheels at the dock end, legs at the front. zc: its middle
function trailer(m, x, zc) {
  const g = new THREE.Group();
  g.position.set(x, 0, zc);
  const body = mesh(new THREE.BoxGeometry(2.55, 2.7, 11), new THREE.MeshLambertMaterial({ map: yardTex('trailer') }));
  body.position.y = 2.65;
  const chassis = mesh(new THREE.BoxGeometry(1.2, 0.3, 10.6), m.darkMetal);
  chassis.position.y = 1.1;
  const unit = mesh(new THREE.BoxGeometry(2.0, 1.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x8a8a86 }));
  unit.position.set(0, 3.0, -5.8);
  g.add(body, chassis, unit);
  const tyre = new THREE.MeshLambertMaterial({ color: 0x161616 });
  for (const z of [3.4, 4.5]) for (const sx of [-1, 1]) { const w = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 14), tyre); w.rotation.z = Math.PI / 2; w.position.set(sx * 0.95, 0.5, z); g.add(w); }
  for (const sx of [-1, 1]) { const leg = mesh(new THREE.BoxGeometry(0.12, 1.0, 0.12), m.darkMetal); leg.position.set(sx * 0.8, 0.5, -3.6); g.add(leg); }
  return g;
}

// the yard's canvases. kind picks one; rx, ry: how many times it repeats
function yardTex(kind, rx = 1, ry = 1) {
  const rng = makeRng(kind.length * 977 + rx * 31);
  const spots = (g, w, h, n, col, a, s0, s1) => { for (let i = 0; i < n; i++) { const s = s0 + rng() * (s1 - s0); g.fillStyle = `rgba(${col},${a * rng()})`; g.fillRect(rng() * w, rng() * h, s, s); } };
  const blots = (g, w, h, n, col, a, r0, r1) => { for (let i = 0; i < n; i++) { const R = r0 + rng() * (r1 - r0), x = rng() * w, y = rng() * h, gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2); } };
  const streaks = (g, w, y0, n, col, a, len) => { for (let i = 0; i < n; i++) { const x = rng() * w, l = len * (0.3 + rng()), gr = g.createLinearGradient(0, y0, 0, y0 + l); gr.addColorStop(0, `rgba(${col},${a * (0.4 + rng() * 0.6)})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x, y0, 1 + rng() * 4, l); } };
  let cv;
  if (kind === 'sky') {
    const { c, g } = canvas(1024, 512);
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#1c2640'); gr.addColorStop(0.2, '#34406a'); gr.addColorStop(0.34, '#6a6a90'); gr.addColorStop(0.43, '#c08a88');
    gr.addColorStop(0.48, '#f8b480'); gr.addColorStop(0.5, '#ffe0b0'); gr.addColorStop(0.52, '#c0a294'); gr.addColorStop(1, '#5a5450');
    g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
    // the sun's side of the sky warmer (u 0.8 is where it is: see sunDir)
    const sx = 0.8 * 1024, glow = g.createRadialGradient(sx, 236, 0, sx, 236, 330);
    glow.addColorStop(0, 'rgba(255,214,150,0.9)'); glow.addColorStop(0.3, 'rgba(250,160,100,0.35)'); glow.addColorStop(1, 'rgba(250,150,100,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 1024, 512);
    // long low clouds, lit from underneath
    g.filter = 'blur(5px)';
    for (let i = 0; i < 26; i++) {
      const y = 150 + rng() * 85, x = rng() * 1024, w = 40 + rng() * 140, hh = 2 + rng() * 5, near = Math.max(0, 1 - Math.abs(x - sx) / 420);
      g.fillStyle = `rgba(${(80 + near * 150) | 0},${(66 + near * 90) | 0},${(86 + near * 40) | 0},${0.2 + rng() * 0.3})`;
      g.beginPath(); g.ellipse(x, y, w, hh, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(255,${(150 + near * 80) | 0},120,${0.1 + near * 0.3})`;
      g.beginPath(); g.ellipse(x, y + hh * 0.6, w * 0.8, hh * 0.35, 0, 0, Math.PI * 2); g.fill();
    }
    g.filter = 'none';
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.5})`; g.fillRect(rng() * 1024, rng() * 70, 1, 1); } // the last stars
    cv = c;
  } else if (kind === 'treeline') {
    const { c, g } = canvas(2048, 192);
    g.fillStyle = '#20242c';
    g.beginPath(); g.moveTo(0, 192);
    let y = 120;
    for (let x = 0; x <= 2048; x += 4) { y = Math.max(70, Math.min(150, y + (rng() - 0.5) * 14)); g.lineTo(x, y - (rng() < 0.3 ? rng() * 14 : 0)); }
    g.lineTo(2048, 192); g.fill();
    // pylons striding off across the fields
    g.strokeStyle = '#1a1d24'; g.lineWidth = 2;
    for (const px of [380, 700, 1010]) {
      g.beginPath(); g.moveTo(px - 16, 150); g.lineTo(px, 30); g.lineTo(px + 16, 150); g.moveTo(px - 26, 50); g.lineTo(px + 26, 50); g.moveTo(px - 20, 72); g.lineTo(px + 20, 72); g.stroke();
    }
    g.lineWidth = 1; g.beginPath(); g.moveTo(0, 60); g.quadraticCurveTo(220, 80, 380, 50); g.quadraticCurveTo(540, 74, 700, 50); g.quadraticCurveTo(860, 74, 1010, 50); g.quadraticCurveTo(1200, 80, 1400, 64); g.stroke();
    cv = c;
  } else if (kind === 'asphalt') {
    const { c, g } = canvas(256, 256);
    g.fillStyle = '#5e5c5a'; g.fillRect(0, 0, 256, 256);
    spots(g, 256, 256, 2600, '20,20,20', 0.5, 1, 2); spots(g, 256, 256, 1600, '120,116,108', 0.35, 1, 2);
    blots(g, 256, 256, 6, '12,12,14', 0.5, 10, 34); // oil
    g.strokeStyle = 'rgba(14,14,14,0.7)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); let x = rng() * 256, yy = rng() * 256; g.moveTo(x, yy); for (let k = 0; k < 9; k++) { x += (rng() - 0.5) * 30; yy += (rng() - 0.5) * 30; g.lineTo(x, yy); } g.stroke(); }
    cv = c;
  } else if (kind === 'slab') {
    const { c, g } = canvas(256, 256);
    g.fillStyle = '#76726a'; g.fillRect(0, 0, 256, 256);
    spots(g, 256, 256, 2000, '40,38,34', 0.35, 1, 2); spots(g, 256, 256, 900, '160,154,144', 0.3, 1, 2);
    blots(g, 256, 256, 5, '40,36,30', 0.35, 20, 60); blots(g, 256, 256, 2, '70,10,8', 0.35, 8, 20);
    g.fillStyle = 'rgba(30,28,26,0.9)'; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256);
    cv = c;
  } else if (kind === 'facade') {
    // precast panels, 4 x 2 m, rain-streaked from every joint
    const { c, g } = canvas(256, 256);
    g.fillStyle = '#8c867c'; g.fillRect(0, 0, 256, 256);
    spots(g, 256, 256, 2400, '50,48,44', 0.3, 1, 2); spots(g, 256, 256, 1200, '170,164,152', 0.25, 1, 2);
    for (const y0 of [0, 128]) { streaks(g, 256, y0 + 3, 26, '40,38,34', 0.45, 90); streaks(g, 256, y0 + 3, 6, '90,50,30', 0.35, 60); }
    blots(g, 256, 256, 4, '60,70,50', 0.25, 10, 30);
    g.fillStyle = 'rgba(28,26,24,0.95)'; for (const y0 of [0, 128]) g.fillRect(0, y0, 256, 3); g.fillRect(0, 0, 3, 256);
    g.fillStyle = 'rgba(200,196,186,0.4)'; for (const y0 of [3, 131]) g.fillRect(3, y0, 253, 1);
    cv = c;
  } else if (kind === 'shutter') {
    // galvanised slats, scraped and rusted, the bottom one in hazard paint; KEEP CLEAR stencilled across
    const { c, g } = canvas(256, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#8e989e'); gr.addColorStop(1, '#6a706e');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    spots(g, 256, 256, 1800, '40,44,46', 0.3, 1, 2);
    const slat = 256 / 21.5;
    for (let y = 0; y < 256; y += slat) { g.fillStyle = 'rgba(20,22,24,0.55)'; g.fillRect(0, y, 256, 1.5); g.fillStyle = 'rgba(220,226,230,0.25)'; g.fillRect(0, y + 2, 256, 1); }
    streaks(g, 256, 0, 30, '110,50,20', 0.5, 160); blots(g, 256, 256, 10, '100,46,20', 0.4, 4, 16);
    const grime = g.createLinearGradient(0, 180, 0, 256); grime.addColorStop(0, 'rgba(40,30,24,0)'); grime.addColorStop(1, 'rgba(40,30,24,0.7)');
    g.fillStyle = grime; g.fillRect(0, 180, 256, 76);
    g.save(); g.beginPath(); g.rect(0, 256 - slat * 1.2, 256, slat * 1.2); g.clip(); g.fillStyle = '#c8a018'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#141210'; for (let x = -20; x < 280; x += 18) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 9, 256); g.lineTo(x + 9 + 16, 256 - slat * 1.2); g.lineTo(x + 16, 256 - slat * 1.2); g.fill(); }
    g.restore();
    g.fillStyle = 'rgba(230,226,210,0.55)'; g.font = 'bold 22px "Courier New", monospace'; g.textAlign = 'center'; g.fillText('KEEP  CLEAR', 128, 196);
    spots(g, 256, 256, 400, '150,150,150', 0.4, 1, 3); // the paint scraped off
    cv = c;
  } else if (kind === 'trailer') {
    const { c, g } = canvas(256, 64);
    g.fillStyle = '#d4d0c6'; g.fillRect(0, 0, 256, 64);
    streaks(g, 256, 0, 40, '90,84,70', 0.35, 50); spots(g, 256, 64, 300, '60,56,50', 0.3, 1, 2);
    g.fillStyle = '#8a1a14'; g.fillRect(0, 44, 256, 4);
    cv = c;
  } else if (kind === 'hazard') {
    const { c, g } = canvas(64, 64);
    g.fillStyle = '#c9a21c'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#121110';
    for (let x = -64; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 16, 64); g.lineTo(x + 80, 0); g.lineTo(x + 64, 0); g.fill(); }
    spots(g, 64, 64, 160, '60,50,40', 0.5, 1, 3);
    cv = c;
  } else if (kind === 'number') {
    const { c, g } = canvas(128, 128);
    g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#d8b020'; g.font = 'bold 104px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(String(rx), 64, 104);
    streaks(g, 128, 0, 10, '60,40,20', 0.5, 90);
    cv = c; rx = 1;
  } else if (kind === 'notice') {
    const { c, g } = canvas(192, 128);
    g.fillStyle = '#d8d2bc'; g.fillRect(0, 0, 192, 128);
    g.fillStyle = '#8a1a14'; g.fillRect(0, 0, 192, 26);
    g.fillStyle = '#f0e8d0'; g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'center'; g.fillText('NOTICE TO ALL STAFF', 96, 18);
    g.fillStyle = '#2a2622'; g.font = '11px Arial, sans-serif';
    ['Every worker MUST clock out', 'before leaving the building.', 'No card, no pay.', 'Nobody leaves', 'before the shift is over.'].forEach((l, i) => g.fillText(l, 96, 46 + i * 16));
    blots(g, 192, 128, 3, '70,6,4', 0.6, 4, 12); streaks(g, 192, 0, 12, '90,70,40', 0.3, 80);
    cv = c;
  } else if (kind === 'clockface') {
    const { c, g } = canvas(64, 64);
    g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(32 + Math.sin(a) * 24, 32 - Math.cos(a) * 24); g.lineTo(32 + Math.sin(a) * 28, 32 - Math.cos(a) * 28); g.stroke(); }
    g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + 12, 32 + 7); g.moveTo(32, 32); g.lineTo(32 - 4, 32 - 22); g.stroke(); // ten to six
    cv = c;
  } else if (kind === 'cards') {
    const { c, g } = canvas(96, 144);
    g.fillStyle = '#3a3630'; g.fillRect(0, 0, 96, 144);
    for (let r = 0; r < 6; r++) for (let k = 0; k < 4; k++) {
      if (rng() < 0.12) continue; // somebody's never coming back for theirs
      g.fillStyle = rng() < 0.15 ? '#c8b880' : '#e0d8c0'; g.fillRect(4 + k * 23, 4 + r * 23, 19, 21);
      g.fillStyle = 'rgba(40,30,20,0.6)'; g.fillRect(6 + k * 23, 8 + r * 23, 12, 2);
      if (rng() < 0.2) { g.fillStyle = 'rgba(100,8,6,0.7)'; g.fillRect(8 + k * 23, 12 + r * 23, 8, 6); }
    }
    cv = c;
  } else if (kind === 'grate') {
    const { c, g } = canvas(64, 64);
    g.fillStyle = '#1a1816'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#4a4440'; for (let i = 2; i < 64; i += 8) g.fillRect(i, 2, 4, 60);
    g.fillRect(0, 0, 64, 3); g.fillRect(0, 61, 64, 3);
    blots(g, 64, 64, 2, '80,8,6', 0.7, 6, 16);
    cv = c;
  } else if (kind === 'chainlink') {
    const { c, g } = canvas(32, 32);
    g.strokeStyle = 'rgba(150,152,150,1)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(16, 0); g.lineTo(32, 16); g.lineTo(16, 32); g.closePath(); g.stroke();
    cv = c;
  } else if (kind === 'hole') {
    // punched through from inside: torn black, the metal curled out round it
    const { c, g } = canvas(64, 64);
    const ring = (R, j, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI * 2, r = R * (1 - j + rng() * j * 2); g.lineTo(32 + Math.cos(a) * r * 1.2, 32 + Math.sin(a) * r); } g.fill(); };
    ring(26, 0.35, 'rgba(170,176,180,0.95)');
    ring(21, 0.4, 'rgba(90,60,40,0.9)');
    ring(16, 0.45, '#050303');
    cv = c;
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
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
    // beyond the door: the inside of the building, a stairwell eight storeys deep, and at the bottom the shredders.
    // The walls light themselves a little (emissive), so the shape of the place reads even out of the lamps' reach
    s.fog.density = 0.009;
    const SH = { x0: -5, x1: 5, z0: -10, z1: -20, top: 5, bot: -44 };
    const shaftMat = (map, rx, ry, tint) => { const t = map.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshLambertMaterial({ map: t, emissiveMap: t, emissive: tint, color: 0xb8aa98 }); };
    const brick = shaftMat(m.walls[3].map, 4, 18, 0x3a2e24), conc = shaftMat(m.walls[1].map, 4, 18, 0x2e2a26);
    const H = SH.top - SH.bot, cy = (SH.top + SH.bot) / 2;
    for (const [w, x, z, ry, mat] of [[10, 0, SH.z1, 0, brick], [10, SH.x0, -15, Math.PI / 2, conc], [10, SH.x1, -15, -Math.PI / 2, conc]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, H), mat); pl.position.set(x, cy, z); pl.rotation.y = ry; s.add(pl); }
    // the door wall, from the shaft side (with the doorway left open)
    for (const [x, w] of [[-3, 4], [3, 4]]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, H), conc); pl.position.set(x, cy, SH.z0 - 0.02); pl.rotation.y = Math.PI; s.add(pl); }
    const under = new THREE.Mesh(new THREE.PlaneGeometry(2, -SH.bot), conc); under.position.set(0, SH.bot / 2, SH.z0 - 0.02); under.rotation.y = Math.PI; s.add(under);
    // every storey: a landing round three sides with a railing, doorways off it, a caged lamp and a pipe run
    const slab = new THREE.MeshLambertMaterial({ color: 0x6a645a, emissive: 0x1a1814 });
    const rail = new THREE.MeshLambertMaterial({ color: 0x8a6a2a, emissive: 0x2a1e0a });
    const doorDark = new THREE.MeshBasicMaterial({ color: 0x050404 });
    const lampM = new THREE.MeshBasicMaterial({ color: 0xffd8a0, fog: false });
    for (let y = -2; y > SH.bot + 6; y -= 5) {
      const back = mesh(new THREE.BoxGeometry(10, 0.25, 1.4), slab, false); back.position.set(0, y, SH.z1 + 0.7); s.add(back);
      for (const sx of [-1, 1]) { const side = mesh(new THREE.BoxGeometry(1.4, 0.25, 8.6), slab, false); side.position.set(sx * 4.3, y, -15.7); s.add(side); }
      const r1 = mesh(new THREE.BoxGeometry(7.2, 0.05, 0.05), rail, false); r1.position.set(0, y + 1, SH.z1 + 1.4); s.add(r1);
      for (let x = -3.5; x <= 3.5; x += 1) { const post = mesh(new THREE.BoxGeometry(0.04, 1, 0.04), rail, false); post.position.set(x, y + 0.5, SH.z1 + 1.4); s.add(post); }
      for (const sx of [-1, 1]) { const r2 = mesh(new THREE.BoxGeometry(0.05, 0.05, 7.2), rail, false); r2.position.set(sx * 3.6, y + 1, -15.4); s.add(r2); }
      for (const x of [-2.6, 2.4]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), doorDark); d.position.set(x, y + 1.18, SH.z1 + 0.01); s.add(d); }
      const lmp = mesh(new THREE.BoxGeometry(0.35, 0.18, 0.12), lampM, false); lmp.position.set(-0.2, y + 2.6, SH.z1 + 0.08); s.add(lmp);
      const pipe = mesh(new THREE.CylinderGeometry(0.12, 0.12, 10, 8), rail, false); pipe.rotation.z = Math.PI / 2; pipe.position.set(0, y + 3.4, SH.z1 + 0.2); s.add(pipe);
    }
    const mid = new THREE.PointLight(0xffd8b0, 40, 30, 1.2); mid.position.set(0, -14, -16); s.add(mid);
    // the bottom: the shredders. Two drums of teeth turning into each other, in a pit of what's gone before
    const floorB = mesh(new THREE.BoxGeometry(10, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0x3a1410, emissive: 0x1a0604 }), false); floorB.position.set(0, SH.bot, -15); s.add(floorB);
    const steel = new THREE.MeshPhongMaterial({ color: 0x8a8a84, shininess: 90, specular: 0x888888, emissive: 0x141414 });
    const bloodSteel = new THREE.MeshPhongMaterial({ color: 0x6a1410, shininess: 60, specular: 0x552222, emissive: 0x1a0402 });
    this.shredders = [-1, 1].map((sz) => {
      const r = new THREE.Group();
      r.position.set(0, SH.bot + 1.6, -15 + sz * 1.15);
      const drum = mesh(new THREE.CylinderGeometry(1.0, 1.0, 8, 16), steel, false); drum.rotation.z = Math.PI / 2; r.add(drum);
      for (let k = 0; k < 7; k++) for (let a = 0; a < 10; a++) { const tooth = mesh(new THREE.BoxGeometry(0.16, 0.5, 0.22), (a + k) % 3 ? steel : bloodSteel, false); const ang = (a / 10) * Math.PI * 2 + k * 0.3; tooth.position.set(-3.4 + k * 1.13, Math.cos(ang) * 1.1, Math.sin(ang) * 1.1); tooth.rotation.x = ang; r.add(tooth); }
      s.add(r);
      return r;
    });
    for (const sx of [-1, 1]) { const hop = mesh(new THREE.BoxGeometry(0.3, 4, 5), bloodSteel, false); hop.position.set(sx * 4.2, SH.bot + 2, -15); hop.rotation.z = sx * 0.35; s.add(hop); }
    const glow = new THREE.PointLight(0xff6a30, 70, 40, 1.1); glow.position.set(0, SH.bot + 3.5, -15); s.add(glow);
    const glow2 = new THREE.PointLight(0xff2a10, 60, 25, 1.3); glow2.position.set(0, SH.bot + 0.8, -15); s.add(glow2);
    this.him.root.position.set(0, 0, 2.6);
    this.him.root.rotation.y = Math.PI;
  }
  exitUpdate() {
    const t = this.t;
    for (const [i, r] of this.shredders.entries()) r.rotation.x += (i ? -1 : 1) * 0.06; // turning into each other
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
      // up at him in the doorway as you fall; then, the last second, down at what you're falling into
      const below = V(0, -42, -15), down2 = ease((t - 7.5) / 0.5);
      this.cam.lookAt(t < 5.9 ? V(0, -30, -15) : head.clone().lerp(below, down2));
      this.cam.rotation.z += Math.sin(t * 3) * 0.3 * (1 - down2);
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
      hangFromHand(you, hand, V(1, 0, 1)); // off the floor as he lifts, lying back away from the machine till then
      // until he's high enough to go over the rim, keep him off the machine: nothing passes through the steel
      const over = clamp01((hand.y - 2.6) / 0.6);
      you.root.position.x = lerp(Math.max(you.root.position.x, 1.25), you.root.position.x, over);
      you.root.position.z = lerp(Math.max(you.root.position.z, -1.75), you.root.position.z, over);
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

  // ---------- playing the Foreman: through his eyes, the worker hooked by the ankle and fed to the grinder ----------
  processBuild() {
    this.grinderBuild();
    this.dur = 9.5;
    // his arms, seen from behind his own eyes; the rest of him isn't there to see
    this.him.root.visible = false;
    for (const [i, a] of this.him.arms.entries()) { a.sh.position.set(i ? 0.34 : -0.34, -0.42, 0.05); this.cam.add(a.sh); }
    this.him.arms[0].sh.rotation.set(0.25, 0, 0.12);
    this.him.arms[0].el.rotation.x = -0.25;
    this.follow.intensity = 22;
    this.cam.fov = 78;
    this.cam.updateProjectionMatrix();
  }
  processUpdate(dt) {
    const t = this.t, you = this.you, arm = this.him.arms[1], hand = V();
    for (const r of this.rollers) r.rotation.y += dt * (t > 4.3 ? 14 : 6) * (r.position.x > 0 ? 1 : -1);
    const bob = (k) => Math.abs(Math.sin(k)) * 0.06;
    if (t < 3.4) {
      // walking backwards to the grinder, looking down at him: on his back, hooked by the ankle, clawing at the floor
      const k = ease(t / 3.4), z = lerp(3.8, 0.4, k);
      this.cam.position.set(0.05 + Math.sin(t * 2.6) * 0.04, 2.05 - bob(t * 2.6), z);
      this.cam.lookAt(0.15 + Math.sin(t * 1.3) * 0.15, 0.25, z + 2.6);
      arm.sh.rotation.set(0.9 + Math.sin(t * 5.2) * 0.05, 0, -0.1);
      arm.el.rotation.x = -0.25;
      this.cam.updateMatrixWorld(true);
      arm.hand.getWorldPosition(hand);
      const leg = 0.92, lift = Math.asin(clamp01((hand.y - 0.13) / leg));
      you.root.position.set(hand.x, 0.13, hand.z + Math.cos(lift) * leg + Math.sin(t * 11) * 0.02);
      orient(you.root, V(0, 0, 1), V(0, 1, 0));
      // the free leg kicks (up, off the floor); the arms claw at it and grab at the air, never down through it
      you.legs.forEach((l, i) => { l.rotation.set(-lift - (i ? 0 : 0.25 + Math.abs(Math.sin(t * 7)) * 0.35), 0, i ? 0 : 0.2); l.userData.knee.rotation.x = i ? 0 : 0.4 + Math.sin(t * 7) * 0.3; });
      you.arms.forEach((a, i) => { a.rotation.set(Math.abs(Math.sin(t * 8 + i * 2)) * 0.6, 0, (i ? 1 : -1) * (2.2 + Math.sin(t * 6 + i) * 0.45)); a.userData.el.rotation.z = 0; });
      you.head.rotation.set(0.45 + Math.sin(t * 4) * 0.15, Math.sin(t * 9) * 0.3, 0); // up off the floor, looking down himself at you
      you.jaw.rotation.x = 0.4 + Math.sin(t * 13) * 0.1;
      this.follow.position.set(0.8, 2.2, z + 1.6);
      this.at(0.15, 'scream', () => this.audio.distantScream({ x: you.root.position.x, y: 0.3, z: you.root.position.z }));
      this.at(0.3, 'drag', () => this.audio.drag());
      this.at(1.8, 'drag2', () => this.audio.drag());
      this.at(2.1, 'scream2', () => this.audio.distantScream({ x: you.root.position.x, y: 0.3, z: you.root.position.z }));
      if (Math.random() < dt * 14) this.scene.add(decal(this.mats.drag || this.mats.splat[0], 0.5, you.root.position.x + (Math.random() - 0.5) * 0.15, you.root.position.z + 0.4, Math.PI / 2, 0.011));
      this.fear = 0.6;
      return;
    }
    // turn round to the hopper and lift him up over it, upside down, by the leg
    const turn = ease((t - 3.4) / 0.7), up = ease((t - 3.6) / 0.9);
    const yaw = lerp(0, Math.PI, turn) + Math.sin(t * 17) * 0.004 * (t > 4.6 ? 1 : 0);
    const look = V(0, lerp(0.25, 2.1, turn), 0);
    this.cam.position.set(0.05, 2.05 - bob(t * 3) * (1 - turn), lerp(0.4, -0.55, turn));
    look.x = this.cam.position.x + Math.sin(yaw) * 2.6 * (1 - 0.3 * turn);
    look.z = this.cam.position.z + Math.cos(yaw) * 2.6;
    if (t > 4.6) look.y = lerp(2.1, 1.3, ease((t - 4.6) / 0.6)); // and down into it
    this.cam.lookAt(look);
    this.follow.intensity = Math.max(0, 22 - (t - 3.4) * 30);
    this.key.intensity = 24;
    const drop = clamp01((t - 4.55) / 0.35);
    arm.sh.rotation.set(lerp(0.9, 2.35, up) - drop * 0.6, 0, -0.1);
    arm.el.rotation.x = lerp(-0.25, -0.05, up);
    this.cam.updateMatrixWorld(true);
    arm.hand.getWorldPosition(hand);
    if (t < 4.55) {
      // hanging from the hook by one ankle, head down, swinging, arms reaching for the floor
      hangFromHand(you, hand, V(Math.sin(t * 5) * 0.15, 0, 1));
      const up2 = clamp01((hand.y - LEG - 0.16) / TRUNK); // the free leg only folds once he's off the floor
      you.legs.forEach((l, i) => { l.rotation.set(i ? 0 : 0.6 * up2, 0, 0); l.userData.knee.rotation.x = i ? 0 : 0.9 * up2; });
      you.arms.forEach((a, i) => { a.rotation.set((0.3 + Math.sin(t * 9 + i) * 0.4) * up2, 0, (i ? 1 : -1) * 0.4); a.userData.el.rotation.z = 0; });
      this.at(3.5, 'growl', () => this.audio.growl({ x: 0, y: 2, z: -1 }, 1));
      this.at(3.9, 'scream3', () => this.audio.distantScream({ x: hand.x, y: 1.5, z: hand.z }));
    } else {
      // let go: down into the rollers
      const k = clamp01((t - 4.55) / 0.4);
      you.root.position.set(lerp(hand.x, 0, k), lerp(hand.y - LEG, 0.9, k * k), lerp(hand.z, -3, k));
      orient(you.root, V(0, -1, 0), V(0, 0, 1));
      you.root.visible = t < 4.95;
      const mouth = V(0, 2.2, -3);
      this.at(4.85, 'crunch', () => {
        this.audio.grind();
        this.shake = 1.6;
        this.flash = 0.5;
        this.blood.splash(1, true); // it comes back up at you
        this.gore.burst(mouth, 40, 5, 0.9, [severedArm(this.mats, Math.random), severedHead(this.mats, Math.random), severedArm(this.mats, Math.random)]);
        this.gore.spray(V(0, 1.9, -2.4), V(0, 0.6, 1), 120, 6, 0.5);
      });
      if (t > 4.9 && t < 8 && Math.random() < dt * 14) { this.gore.burst(mouth, 3, 4, 1); this.gore.spray(V(0, 1.9, -2.4), V(0, 0.5, 1), 20, 5, 0.4); }
      this.at(6.4, 'breath', () => this.audio.growl({ x: 0, y: 2, z: -1 }, 0.6));
      this.at(9.0, 'black', () => (this.blackout = 1));
      this.fear = 0.85;
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
  // The lift brings you up into the dispatch bay. The shutter at the far end is jammed half up on the morning.
  // Halfway across, the cage clanks behind you: he came up with you. You run. You get out under the shutter, its
  // brake gives, and it comes down between you. He hits it from the inside until the hook comes through, and then
  // he looks at you through the hole. You walk away into the yard.
  endingBuild() {
    this.dur = 36;
    const s = this.scene, m = this.mats, P = themeMaterials(m, 'processing'), rng = makeRng(1998), T = YARD;
    s.background = new THREE.Color(0x1a1612);
    s.fog = new THREE.FogExp2(0x3a2e26, 0.026);
    s.add(new THREE.AmbientLight(0x4a3c30, 0.9));
    const { W, Z0, Z1, H, DW, DH } = T, zi = Z1 + 0.2, zo = Z1 - 0.2;
    // a plane; walls tile their texture in world space (tw x th metres a repeat) so the pieces round a door line up
    const plane = (w, h, mat, x, y, z, ry = 0, rx = 0) => { const p = mesh(new THREE.PlaneGeometry(w, h), mat, false); p.position.set(x, y, z); p.rotation.set(rx, ry, 0); p.receiveShadow = true; s.add(p); return p; };
    const tiled = (mat, w, h, tw, th, x = 0, y = 0, flip = false) => {
      const c = mat.clone();
      if (mat.map) {
        c.map = mat.map.clone();
        c.map.repeat.set(w / tw, h / th);
        c.map.offset.set((flip ? -(x + w / 2) : x - w / 2) / tw, (y - h / 2) / th);
        c.map.needsUpdate = true;
        if (mat.bumpMap === mat.map) c.bumpMap = c.map;
      }
      return c;
    };
    const wall = (mat, w, h, x, y, z, ry, tw = 2, th = 3) => plane(w, h, tiled(mat, w, h, tw, th, x, y, Math.abs(ry) > 3), x, y, z, ry);

    // ---- the bay: the processing floor's tiles and walls, a long way across, low and dirty ----
    const L = Z0 - Z1, zm = (Z0 + Z1) / 2;
    plane(W, L, tiled(P.floors[1], W, L, 2, 2), 0, 0, zm, 0, -Math.PI / 2);
    plane(W, L, tiled(P.ceil, W, L, 2, 2), 0, H, zm, 0, Math.PI / 2);
    wall(P.walls[2], L, H, -W / 2, H / 2, zm, Math.PI / 2);
    wall(P.walls[1], L, H, W / 2, H / 2, zm, -Math.PI / 2);
    // the lift wall behind you, with the lift's mouth in it
    for (const sx of [-1, 1]) wall(P.walls[0], W / 2 - 1.1, H, sx * (W / 4 + 0.55), H / 2, Z0, Math.PI);
    wall(P.walls[0], 2.2, H - 3.2, 0, (H + 3.2) / 2, Z0, Math.PI);
    // the shutter wall in front, inside face
    for (const sx of [-1, 1]) wall(P.walls[3], W / 2 - DW / 2, H, sx * (W / 4 + DW / 4), H / 2, zi, 0);
    wall(P.walls[3], DW, H - DH, 0, (H + DH) / 2, zi, 0);
    // steel: the door's guides and lintel, the roller drum's housing, the hand chain
    const steel = m.darkMetal;
    for (const sx of [-1, 1]) { const gd = mesh(new THREE.BoxGeometry(0.18, DH, 0.5), steel); gd.position.set(sx * (DW / 2 - 0.05), DH / 2, Z1); s.add(gd); }
    const lintel = mesh(new THREE.BoxGeometry(DW + 0.2, 0.14, 0.5), steel); lintel.position.set(0, DH + 0.07, Z1); s.add(lintel);
    const drum = mesh(new THREE.BoxGeometry(DW + 0.6, 0.62, 0.62), m.rust[1]); drum.position.set(0, DH + 0.5, zi + 0.32); s.add(drum);
    this.handChain = new THREE.Group();
    this.handChain.position.set(DW / 2 + 0.25, DH + 0.3, zi + 0.12);
    for (const dx of [0, 0.07]) { const c = mesh(new THREE.CylinderGeometry(0.012, 0.012, 3.2, 4), m.chain, false); c.position.set(dx, -1.6, 0); this.handChain.add(c); }
    s.add(this.handChain);
    // the floor at the door: yellow and black, a drain, the ruts the pallet trucks wore
    const hz = new THREE.MeshLambertMaterial({ map: yardTex('hazard', DW * 2.5, 1) });
    plane(DW, 0.45, hz, 0, 0.006, zi + 0.4, 0, -Math.PI / 2);
    for (const sx of [-1, 1]) { const b = mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), new THREE.MeshLambertMaterial({ map: yardTex('hazard', 1, 3) })); b.position.set(sx * (DW / 2 + 0.5), 0.55, zi + 0.45); s.add(b); }
    // signs over the door: the way out, lit green; and the bay's number
    plane(0.9, 0.34, new THREE.MeshBasicMaterial({ map: signTex('EXIT', '#40ff70') }), 0, DH + 1.0, zi + 0.66);
    plane(1.6, 0.6, new THREE.MeshLambertMaterial({ map: signTex('BAY 3', '#ffb030') }), -DW / 2 - 1.4, 3.3, zi + 0.01);
    plane(1.2, 0.8, new THREE.MeshLambertMaterial({ map: yardTex('notice') }), DW / 2 + 1.6, 1.7, zi + 0.01);
    // the clock you punch out on, by the lift; the cards in their rack
    const clock = mesh(new THREE.BoxGeometry(0.42, 0.55, 0.26), new THREE.MeshPhongMaterial({ color: 0x8a8068, shininess: 20 })); clock.position.set(-2.1, 1.45, Z0 - 0.13); s.add(clock);
    const face = plane(0.26, 0.26, new THREE.MeshLambertMaterial({ map: yardTex('clockface') }), -2.1, 1.55, Z0 - 0.27, Math.PI);
    void face;
    plane(0.6, 0.9, new THREE.MeshLambertMaterial({ map: yardTex('cards') }), -2.85, 1.4, Z0 - 0.01, Math.PI);
    // up top: steel beams across, pipes along both walls, lamps on chains
    for (let z = Z0 - 2; z > Z1 + 1; z -= 4) { const b = mesh(new THREE.BoxGeometry(W, 0.35, 0.22), steel); b.position.set(0, H - 0.18, z); s.add(b); }
    for (const [x, ry] of [[-W / 2, Math.PI / 2], [W / 2, -Math.PI / 2]]) { const p = pipeRun(m, L - 1, rng); p.position.set(x, 2.3, zm); p.rotation.y = ry; s.add(p); }
    this.tubes = [];
    for (const z of [-3.5, -9.5, -15.5, -21.5]) {
      const lamp = makeLamp(m, 'tube');
      lamp.position.set(0, H - 0.75, z);
      lamp.rotation.y = Math.PI / 2;
      for (const dx of [-0.5, 0.5]) { const c = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.72, 4), m.chain, false); c.position.set(dx, 0.38, 0); lamp.add(c); }
      s.add(lamp);
      const light = new THREE.PointLight(0xffcf90, 16, 15, 1.3);
      light.position.set(0, H - 0.95, z);
      s.add(light);
      this.tubes.push({ lamp, light, base: 16 });
    }
    // the one by the middle is dying
    const dying = this.tubes[1];
    dying.lamp.userData.bulb.material = dying.lamp.userData.bulb.material.clone();
    // the rail down the left, still carrying what was on it when the line stopped
    const railX = -4.3, railH = 4.4;
    const rail = mesh(new THREE.BoxGeometry(0.08, 0.1, L - 4), steel); rail.position.set(railX, railH, zm - 0.5); s.add(rail);
    for (let z = Z0 - 2; z > Z1 + 3; z -= 2) { const h = mesh(new THREE.BoxGeometry(0.05, H - railH, 0.05), steel); h.position.set(railX, (H + railH) / 2, z); s.add(h); }
    this.swing = [];
    for (let z = Z0 - 3; z > Z1 + 4; z -= 1.55 + rng() * 0.5) {
      const c = makeCarcass(m, rng, rng() < 0.18);
      c.position.set(railX, railH - 0.05, z);
      c.rotation.y = rng() * Math.PI;
      s.add(c);
      this.swing.push({ o: c, f: 0.6 + rng() * 0.5, p: rng() * 6, a: 0.02 + rng() * 0.03 });
    }
    // the right-hand wall: the end of the packing line, a table, crates waiting for a lorry that won't come
    const belt = conveyor(m, rng, 9); belt.position.set(W / 2 - 1.1, 0, -9.5); belt.rotation.y = Math.PI / 2; s.add(belt);
    const pt = packTable(m, rng); pt.position.set(W / 2 - 1.1, 0, -16.2); pt.rotation.y = Math.PI / 2; s.add(pt);
    const bt = butcherTable(m, rng); bt.position.set(-2.4, 0, -12.5); bt.rotation.y = Math.PI / 2; s.add(bt);
    for (const [x, z] of [[-2.0, -14.2], [2.2, -5.2], [-1.9, -20.8]]) { const bk = bucket(m); bk.position.set(x, 0, z); s.add(bk); }
    const fl = forklift(m, rng); fl.position.set(-4.4, 0, -22.4); fl.rotation.y = 0.7; s.add(fl);
    for (const [x, z, r] of [[4.6, -21.6, 0.1], [5.9, -21.9, -0.06], [5.4, -23.6, 0.2], [-5.6, -18.2, 0.05], [5.6, -3.2, 0.3]]) { const c = crateStack(m, rng); c.position.set(x, 0, z); c.rotation.y = r; s.add(c); }
    // where things were dragged to the door, and what they left
    for (let z = Z0 - 2.5; z > Z1 + 2; z -= 2.6) s.add(decal(m.drag, 2.8, 0.35 + Math.sin(z) * 0.3, z, Math.PI / 2 + Math.sin(z * 1.7) * 0.15, 0.012));
    for (const [x, z, sz] of [[-3.6, -7.6, 1.8], [-4.6, -14.6, 2.2], [1.4, -18.5, 1.2], [4.2, -10.2, 1.4], [-0.8, -24.2, 1.0]]) s.add(decal(m.pool[(rng() * 3) | 0], sz, x, z, rng() * 6, 0.013));
    for (let i = 0; i < 7; i++) s.add(decal(m.splat[(rng() * m.splat.length) | 0], 0.5 + rng() * 0.6, (rng() - 0.5) * 9, Z0 - 2 - rng() * 20, rng() * 6, 0.014));
    const drain = plane(0.6, 0.6, new THREE.MeshLambertMaterial({ map: yardTex('grate') }), 1.6, 0.008, -13.6, 0, -Math.PI / 2);
    void drain;

    // ---- the lift and its shaft: you start in the cage, in the dark, coming up ----
    this.lift = makeLift(m, 0);
    s.add(this.lift);
    this.bars = this.lift.userData.bars;
    const shaftM = P.walls[0];
    wall(shaftM, 2.2, 6, -1.05, 3, 0.05, Math.PI / 2);
    wall(shaftM, 2.2, 6, 1.05, 3, 0.05, -Math.PI / 2);
    wall(shaftM, 2.1, 6, 0, 3, 1.1, Math.PI);
    // the shaft's front wall slides down past the gate on the way up, until the bay's floor comes level
    this.shaftFront = plane(2.4, 20, tiled(shaftM, 2.4, 20, 2, 3), 0, 10, -1.06);
    this.pass = new THREE.PointLight(0xffc890, 0, 5, 1.5);
    s.add(this.pass);
    this.liftLamp = new THREE.PointLight(0xffd8b0, 2.5, 4, 1.5);
    this.liftLamp.position.set(0, 2.6, 0.3);
    s.add(this.liftLamp);

    // ---- the outside wall: precast panels, the dock doors, the canopy, the lamp over the door ----
    const FW = 80, FH = 11, facade = new THREE.MeshLambertMaterial({ map: yardTex('facade') });
    for (const sx of [-1, 1]) wall(facade, FW / 2 - DW / 2, FH, sx * (FW / 4 + DW / 4), FH / 2, zo, Math.PI, 4, 4);
    wall(facade, DW, FH - DH, 0, (FH + DH) / 2, zo, Math.PI, 4, 4);
    const plinth = new THREE.MeshLambertMaterial({ color: 0x4a4744 });
    for (const sx of [-1, 1]) plane(FW / 2 - DW / 2 - 0.2, 0.7, plinth, sx * (FW / 4 + DW / 4 + 0.1), 0.35, zo - 0.01, Math.PI);
    const canopy = mesh(new THREE.BoxGeometry(DW + 2.4, 0.16, 1.8), steel); canopy.position.set(0, DH + 0.9, zo - 0.9); s.add(canopy);
    for (const sx of [-1, 1]) { const rod = mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.1, 4), steel, false); rod.position.set(sx * (DW / 2 + 0.8), DH + 1.65, zo - 0.9); rod.rotation.x = 0.95; s.add(rod); }
    for (const sx of [-1, 1]) { const bump = mesh(new THREE.BoxGeometry(0.3, 0.55, 0.28), new THREE.MeshLambertMaterial({ color: 0x141414 })); bump.position.set(sx * (DW / 2 + 0.35), 0.75, zo - 0.14); s.add(bump); }
    for (const sx of [-1, 1]) { const b = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.15, 10), new THREE.MeshLambertMaterial({ map: yardTex('hazard', 1, 3) })); b.position.set(sx * (DW / 2 + 1.0), 0.57, zo - 1.0); s.add(b); }
    plane(1.3, 1.3, new THREE.MeshLambertMaterial({ map: yardTex('number', 3) }), -DW / 2 - 1.5, 3.4, zo - 0.02, Math.PI);
    const pack = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.25), steel); pack.position.set(0, DH + 1.35, zo - 0.14); s.add(pack);
    const packLens = plane(0.4, 0.18, new THREE.MeshBasicMaterial({ color: 0xffc070 }), 0, DH + 1.27, zo - 0.27, Math.PI, 0.5);
    void packLens;
    this.wallPack = new THREE.PointLight(0xffb060, 7, 12, 1.4);
    this.wallPack.position.set(0, DH + 1.0, zo - 0.6);
    s.add(this.wallPack);
    // the next docks along, shut, one with a trailer still backed on to it
    const shutM = new THREE.MeshPhongMaterial({ map: yardTex('shutter'), shininess: 30, specular: 0x333333, side: THREE.DoubleSide });
    for (const [x, n] of [[-10, 2], [10, 4]]) {
      plane(DW - 0.4, DH - 0.1, shutM, x, (DH - 0.1) / 2, zo - 0.02, Math.PI);
      plane(1.1, 1.1, new THREE.MeshLambertMaterial({ map: yardTex('number', n) }), x - DW / 2 - 0.9, 3.4, zo - 0.02, Math.PI);
      for (const sx of [-1, 1]) { const bump = mesh(new THREE.BoxGeometry(0.3, 0.55, 0.28), plinth); bump.position.set(x + sx * (DW / 2 + 0.1), 0.75, zo - 0.14); s.add(bump); }
    }
    s.add(trailer(m, 10, zo - 6.2));

    // ---- the shutter: corrugated, on a roll. It dents. ----
    this.shut = new Shutter(shutM, DW - 0.1, DH + 0.2);
    this.shutBottom = 3.35;
    this.shut.mesh.position.set(0, this.shutBottom + this.shut.h / 2, Z1);
    this.shut.mesh.rotation.y = Math.PI; // its face to the yard
    s.add(this.shut.mesh);
    // what the hook does to it
    this.hook = new THREE.Group();
    const hookArc = mesh(new THREE.TorusGeometry(0.2, 0.032, 6, 14, Math.PI * 1.25), m.darkMetal, false);
    hookArc.rotation.y = Math.PI / 2;
    this.hook.add(hookArc);
    const tip = mesh(new THREE.ConeGeometry(0.032, 0.13, 6), m.steel, false); tip.position.set(0, 0.04, -0.2); tip.rotation.x = -Math.PI / 2 - 0.5; this.hook.add(tip);
    this.hook.visible = false;
    s.add(this.hook);
    this.hole = plane(0.5, 0.42, new THREE.MeshBasicMaterial({ map: yardTex('hole'), transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, Math.PI);
    this.hole.visible = false;

    // ---- the yard: asphalt, the dock lane, lamp posts still on, the fence, trees, the morning ----
    const asphalt = new THREE.MeshLambertMaterial({ map: yardTex('asphalt') });
    plane(160, 140, tiled(asphalt, 160, 140, 4, 4), 0, -0.004, zo - 70, 0, -Math.PI / 2);
    const apron = new THREE.MeshLambertMaterial({ map: yardTex('slab') });
    plane(FW, 7, tiled(apron, FW, 7, 4, 4), 0, -0.002, zo - 3.5, 0, -Math.PI / 2);
    const paint = new THREE.MeshLambertMaterial({ color: 0xc8a020 });
    for (const sx of [-1, 1]) plane(0.14, 22, paint, sx * 3.1, 0.004, zo - 7 - 11, 0, -Math.PI / 2);
    for (let i = 0; i < 6; i++) plane(0.12, 5, new THREE.MeshLambertMaterial({ color: 0xb8b6ae }), -24 + i * 3, 0.004, zo - 22, 0, -Math.PI / 2);
    // a skip, pallets, a car somebody never came back out for
    const skip = mesh(new THREE.BoxGeometry(3.6, 1.5, 1.8), new THREE.MeshLambertMaterial({ color: 0x2e4a34 })); skip.position.set(-8, 0.75, -31.5); skip.rotation.y = 0.08; s.add(skip);
    const lid = mesh(new THREE.BoxGeometry(3.7, 0.06, 1.0), new THREE.MeshLambertMaterial({ color: 0x24382a })); lid.position.set(-8, 1.75, -31.1); lid.rotation.x = -0.9; s.add(lid);
    for (const [x, z, r] of [[7.2, -32.5, 0.2], [8.6, -33.6, -0.3]]) { const c = crateStack(m, rng); c.position.set(x, 0, z); c.rotation.y = r; s.add(c); }
    const car = new THREE.Group(), paintC = new THREE.MeshLambertMaterial({ color: 0x5a2420 }), glass = new THREE.MeshPhongMaterial({ color: 0x1a2028, shininess: 90, specular: 0x8899aa });
    const cb = mesh(new THREE.BoxGeometry(1.75, 0.7, 4.2), paintC); cb.position.y = 0.65; const cab = mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), glass); cab.position.set(0, 1.27, -0.2); car.add(cb, cab);
    for (const [x, z] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) { const w = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 12), new THREE.MeshLambertMaterial({ color: 0x141414 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.32, z); car.add(w); }
    car.position.set(-12.5, 0, -44); car.rotation.y = 0.35; s.add(car);
    const sodium = new THREE.MeshBasicMaterial({ color: 0xffb060 });
    this.posts = [];
    for (const [x, z] of [[-8, -38], [8.5, -49], [-8, -62]]) {
      const pole = mesh(new THREE.CylinderGeometry(0.08, 0.12, 8, 8), steel); pole.position.set(x, 4, z); s.add(pole);
      const arm = mesh(new THREE.BoxGeometry(1.4, 0.08, 0.1), steel); arm.position.set(x - Math.sign(x) * 0.65, 7.95, z); s.add(arm);
      const head = mesh(new THREE.BoxGeometry(0.6, 0.14, 0.3), steel); head.position.set(x - Math.sign(x) * 1.3, 7.9, z); s.add(head);
      const lens = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.22), sodium, false); lens.position.set(x - Math.sign(x) * 1.3, 7.82, z); s.add(lens);
      this.posts.push(lens);
    }
    const fenceZ = -74, chain = new THREE.MeshLambertMaterial({ map: yardTex('chainlink', 1, 1), transparent: true, alphaTest: 0.2, side: THREE.DoubleSide, depthWrite: false });
    for (const [x0, x1] of [[-60, -5], [5, 60]]) {
      const w = x1 - x0, f = plane(w, 2.6, chain, (x0 + x1) / 2, 1.3, fenceZ);
      f.material = chain.clone(); f.material.map = chain.map.clone(); f.material.map.repeat.set(w / 0.6, 2.6 / 0.6); f.material.map.needsUpdate = true;
      for (let x = x0; x <= x1; x += 3) { const p = mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 5), steel, false); p.position.set(x, 1.45, fenceZ); s.add(p); }
      for (const y of [2.75, 2.88]) { const wire = mesh(new THREE.BoxGeometry(w, 0.015, 0.015), steel, false); wire.position.set((x0 + x1) / 2, y, fenceZ); s.add(wire); }
    }
    const leaf = plane(5, 2.6, chain, -5 - 0.6, 1.3, fenceZ - 2.4, 1.35); // the gate, left open
    void leaf;
    const trees = new THREE.MeshBasicMaterial({ map: yardTex('treeline'), transparent: true, alphaTest: 0.1 });
    plane(520, 46, trees, 0, 12, -170);
    for (const [x, z, w, h] of [[-46, -120, 14, 9], [-34, -128, 8, 16], [38, -116, 20, 7], [55, -130, 9, 12]]) { const b = mesh(new THREE.BoxGeometry(w, h, 8), new THREE.MeshLambertMaterial({ color: 0x3a3c44 })); b.position.set(x, h / 2, z); s.add(b); }
    const chimney = mesh(new THREE.CylinderGeometry(0.8, 1.1, 30, 10), new THREE.MeshLambertMaterial({ color: 0x40383a })); chimney.position.set(-30, 15, -150); s.add(chimney);
    // the sky: night going out of it at the top, the sun just over the trees
    const sky = mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({ map: yardTex('sky'), side: THREE.BackSide, fog: false, depthWrite: false }), false);
    sky.position.set(0, 0, Z1);
    sky.renderOrder = -1;
    s.add(sky);
    const sunDir = V(-0.32, 0.12, -1).normalize();
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xffe0b0, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sunDisc.position.copy(sunDir).multiplyScalar(220).add(V(0, 0, Z1));
    this.sunDisc.scale.setScalar(70);
    s.add(this.sunDisc);
    const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xfff4dc, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    disc.position.copy(this.sunDisc.position);
    disc.scale.setScalar(13);
    s.add(disc);
    this.sun = new THREE.DirectionalLight(0xffc89a, 0);
    this.sun.position.copy(sunDir).multiplyScalar(60).add(V(0, 0, Z1));
    this.sun.target.position.set(0, 0, Z1);
    s.add(this.sun, this.sun.target);
    this.dayFill = new THREE.HemisphereLight(0xa8b8d8, 0x3a3228, 0);
    s.add(this.dayFill);
    // the morning coming in under the shutter: a spot across the floor, a shaft of it in the dust
    this.doorSpot = new THREE.SpotLight(0xffe0bc, 0, 30, 0.75, 0.7, 1);
    this.doorSpot.position.set(0, 2.2, Z1 - 3);
    this.doorSpot.target.position.set(0, 0, Z1 + 10);
    s.add(this.doorSpot, this.doorSpot.target);
    const shaftGeo = new THREE.BoxGeometry(1, 1, 1);
    const sp = shaftGeo.attributes.position, cols = [];
    for (let i = 0; i < sp.count; i++) {
      const k = sp.getZ(i) + 0.5, v = sp.getY(i) + 0.5; // k: 0 at the door, 1 deep in the bay
      sp.setXYZ(i, sp.getX(i) * lerp(DW - 0.3, DW + 1.6, k), lerp(lerp(0.05, this.shutBottom - 0.1, v), lerp(0, 0.5, v), k), Z1 + 0.25 + k * 11);
      cols.push(1 - k, 1 - k, 1 - k);
    }
    shaftGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    this.beam = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ color: 0xffe2c0, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    s.add(this.beam);
    // looking out from the dark, the doorway burns
    this.glare = plane(DW - 0.2, 3.4, new THREE.MeshBasicMaterial({ color: 0xffd8b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0, 1.7, Z1 - 0.35);
    const N = 260, dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { dp[i * 3] = (rng() - 0.5) * DW; dp[i * 3 + 1] = rng() * 3.2; dp[i * 3 + 2] = Z1 + 0.4 + rng() * 10; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.motes = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffe8c8, size: 0.035, map: softTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.motes);
    // dust and rust knocked off the shutter
    const puffTex = softTex();
    this.puffs = [];
    for (let i = 0; i < 46; i++) {
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0x9a9088, transparent: true, opacity: 0, depthWrite: false }));
      p.visible = false;
      s.add(p);
      this.puffs.push({ s: p, v: V(0, 0, 0), life: 1 });
    }

    // him: in the lift behind you, when you look back
    this.him.root.position.set(0, 0, 0.35);
    this.him.root.rotation.y = Math.PI;
    this.him.root.visible = false;
    this.audio.liftMotor(true);
  }
  // kick dust off the shutter: n puffs from a line across it at height y
  puff(n, y, out = 1, spread = YARD.DW) {
    for (let i = 0; i < n; i++) {
      const p = this.puffs.find((q) => q.life >= 1);
      if (!p) return;
      p.life = 0;
      p.s.visible = true;
      p.s.position.set((Math.random() - 0.5) * spread, y, YARD.Z1 - 0.15 * out);
      p.v.set((Math.random() - 0.5) * 0.8, (Math.random() - 0.2) * 0.6, -(0.4 + Math.random() * 1.4) * out);
      p.size = 0.3 + Math.random() * 0.5;
      p.rate = 0.4 + Math.random() * 0.4;
    }
  }
  // he hits the shutter from inside: it bulges out at (x, y), keeps some of the dent, and everything rattles
  bang(x, y, depth, loud = 1) {
    this.shut.dent(x, y, depth, 0.22 + depth, 0.2 * loud);
    this.audio.thud(V(x, y, YARD.Z1), 1.2 * loud);
    this.audio.clank(V(x, y, YARD.Z1), 0.9 * loud);
    setTimeout(() => this.audio.clank(V(x, 3, YARD.Z1), 0.3), 120); // the rest of it rattling in its guides
    this.shake = Math.max(this.shake, 0.3 * loud);
    this.puff(10, this.shut.mesh.position.y + this.shut.h / 2 - 0.1, 1);
    this.puff(4, 0.05, 1);
    for (const sw of this.swing) sw.a += 0.01 * loud;
  }
  endingUpdate(dt) {
    const t = this.t, cam = this.cam, Z1 = YARD.Z1, ZOUT = -27; // ZOUT: where the run has you at 21.1, just out
    // the camera: where you are, and a yaw/pitch to look along (yaw 0 is out toward the door, PI back at the lift)
    const look = (yaw, pitch = 0) => cam.lookAt(cam.position.x - Math.sin(yaw) * 10, cam.position.y + pitch * 10, cam.position.z - Math.cos(yaw) * 10);
    const stride = (z, amp, rate, sway = 1) => cam.position.set(Math.sin(t * rate) * amp * sway, 1.62 + Math.abs(Math.sin(t * rate)) * amp * 1.3, z);
    const lookAt = (p, k = 1, yaw = 0) => { // blend from a yaw toward looking at p
      const dx = p.x - cam.position.x, dz = p.z - cam.position.z, py = Math.atan2(-dx, -dz), pp = Math.atan2(p.y - cam.position.y, Math.hypot(dx, dz));
      let dy = py - yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      look(yaw + dy * k, Math.tan(pp * k));
    };

    // the bay's own life: carcasses turning on the rail, the dying tube, dust in the light
    for (const sw of this.swing) { sw.o.rotation.z = Math.sin(t * sw.f + sw.p) * sw.a; sw.o.rotation.x = Math.cos(t * sw.f * 0.7 + sw.p) * sw.a * 0.6; sw.a = Math.max(0.02, sw.a - dt * 0.004); }
    const d = this.tubes[1], on = Math.sin(t * 13) + Math.sin(t * 4.1 + 1) + Math.sin(t * 29) > -0.4;
    d.light.intensity = on ? d.base : 0.3;
    d.lamp.userData.bulb.material.color.setHex(on ? 0xffffff : 0x333333);
    const mp = this.motes.geometry.attributes.position;
    for (let i = 0; i < mp.count; i++) { mp.setY(i, (mp.getY(i) + dt * (0.03 + 0.02 * Math.sin(i))) % 3.2); mp.setX(i, mp.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.05); }
    mp.needsUpdate = true;
    for (const p of this.puffs) {
      if (p.life >= 1) continue;
      p.life = Math.min(1, p.life + dt * p.rate);
      p.v.multiplyScalar(1 - dt * 1.6);
      p.v.y -= dt * 0.05;
      p.s.position.addScaledVector(p.v, dt);
      p.s.scale.setScalar(p.size * (1 + p.life * 2.5));
      p.s.material.opacity = Math.sin(p.life * Math.PI) * 0.5;
      if (p.life >= 1) p.s.visible = false;
    }
    this.shut.update(dt);
    this.handChain.rotation.x = Math.sin(t * 1.3) * 0.02 + (this.chainKick || 0) * Math.sin(t * 9);
    this.chainKick = Math.max(0, (this.chainKick || 0) - dt * 0.25);

    // the morning: brighter as you get to it, and you get out into it
    const outside = clamp01((-cam.position.z + Z1 - 0.2) / 1.5);
    const dawn = clamp01((t - 6.6) / 2.5);
    this.sun.intensity = dawn * (1.2 + outside * 1.6);
    this.dayFill.intensity = dawn * (0.5 + outside * 3.2);
    this.doorSpot.intensity = dawn * 60 * (this.shutBottom / 3.35);
    this.beam.material.opacity = dawn * 0.075 * (this.shutBottom / 3.35) * (1 - outside);
    this.motes.material.opacity = dawn * 0.8 * (this.shutBottom / 3.35);
    this.scene.fog.color.setHex(0x3a2e26).lerp(FOG_OUT, outside);
    this.scene.fog.density = lerp(0.026, 0.0075, outside);
    this.glare.material.opacity = dawn * 0.32 * (this.shutBottom / 3.35) * clamp01((cam.position.z - Z1 - 2) / 6);
    this.scene.background.copy(this.scene.fog.color);
    this.wallPack.intensity = 7 * (1 - clamp01((t - 31) / 0.1) * 0.9);
    if (t > 31) for (const l of this.posts) l.material.color.setHex(0x553a20); // the timer: the yard lights go off on the morning

    // ---- him ----
    const him = this.him.root, H0 = 0.35, RUN0 = 17.4, SPEED = 5.7, STOP = Z1 + 1.3; // STOP: his reach is the shutter's
    if (t >= 14) {
      him.visible = true;
      let z = H0, mode = 'walk', speed = 0, jaw = 0.12, tw = { x: 0, y: 0, z: 0, r: 0 };
      if (t < 16.4) { tw = { x: -0.25, y: 0, z: 0.25, r: 0.1 }; } // in the cage, head on one side, looking at your back
      else if (t < RUN0) { const k = (t - 16.4) / (RUN0 - 16.4); z = H0 - k * 1.2; speed = 1.4; jaw = 0.2 + ease((t - 16.6) / 0.4) * 0.8; tw = { x: -0.3, y: 0, z: 0.25 * (1 - k), r: 0 }; } // out of it, and the roar
      else { const tt = t - RUN0; z = H0 - 1.2 - (tt < 0.7 ? tt * tt * SPEED / 1.4 : SPEED * 0.35 + (tt - 0.7) * SPEED); mode = 'chase'; speed = 5.5; jaw = 0.8; }
      if (z <= STOP) { z = STOP; this.hitDoor ??= t; }
      if (this.hitDoor !== undefined) { mode = 'attack'; speed = 0; jaw = 1; }
      this.gait = (this.gait || 0) + (him.position.z - z) * 2.6; // the stride follows the ground covered
      him.position.z = z;
      if (this.slammed || this.shutBottom < 0.7) him.visible = false; // behind the shutter now
      const sw = this.hitDoor !== undefined ? clamp01(Math.sin((t - this.hitDoor) * 3.2) * 1.2) : 0;
      poseForeman(this.him, { gait: this.gait, speed, mode, t, swing: sw, jawOpen: jaw, twitch: tw });
      if (t > 16.4 && t < 22) for (let i = 0; i < 12; i++) this.at(RUN0 + 0.08 + i * 0.37, 'hs' + i, () => this.audio.thud(this.headPos(), 0.5)); // his feet on the concrete
    } else this.pose({ mode: 'walk' });

    // ---- you ----
    if (t < 6) {
      // the ride up: the cage shaking, the shaft wall sliding down past the gate, a floor's light at a time
      stride(0.45, 0, 0);
      cam.position.x += Math.sin(t * 31) * 0.01; cam.position.y += Math.sin(t * 23) * 0.012;
      look(0, -0.03);
      const k = clamp01(t / 6);
      this.shaftFront.position.y = 2.6 * Math.pow(1 - k, 1.6) * 7 - 10; // its top edge: the bay's floor, coming level
      const floorK = (t * 1.6) % 1;
      this.pass.position.set(0, 4 - floorK * 6, -1.25);
      this.pass.intensity = t < 5 ? 6 * Math.sin(floorK * Math.PI) : 0;
      this.at(0.2, 'motor', () => this.audio.liftMotor(true));
      for (let i = 0; i < 9; i++) this.at(i * 0.62, 'f' + i, () => this.audio.click({ x: 0, y: 2, z: 0 }));
      this.fear = 0.25;
    } else if (t < 9.5) {
      // it stops; the gate goes up on the bay, and the morning at the far end of it
      this.shaftFront.position.y = -10;
      this.at(6, 'stop', () => { this.audio.liftMotor(false); this.audio.clank({ x: 0, y: 1, z: -1 }, 1); this.shake = 0.25; });
      this.at(6.6, 'gate', () => this.audio.gateSlide({ x: 0, y: 1, z: -1 }));
      const k = ease((t - 6.6) / 2.2);
      this.bars.position.y = k * 2.7;
      this.pass.intensity = 0;
      stride(0.45, 0, 0);
      look(0, -0.02 + k * 0.02);
      this.fear = 0.15;
    } else if (t < 15) {
      // out across the bay toward it. Halfway, the shutter slips a little on its chain.
      const k = (t - 9.5) / 5.5;
      stride(lerp(0.2, -10.5, k), 0.03, 4.4);
      look(Math.sin(t * 0.6) * 0.12, -0.01 + (t > 12.4 && t < 13.8 ? Math.sin((t - 12.4) / 1.4 * Math.PI) * 0.08 : 0)); // eyes up to the shutter when it slips
      this.at(12.4, 'slip', () => { this.audio.chainRattle({ x: 2.9, y: 4, z: Z1 }); this.audio.clank({ x: 0, y: 4, z: Z1 }, 0.8); this.chainKick = 0.15; this.puff(6, 4.1, -0.6); });
      if (t > 12.4) this.shutBottom = lerp(3.35, 2.95, ease((t - 12.4) / 0.25)); // it drops a hand's width and catches
      this.shut.mesh.position.y = this.shutBottom + this.shut.h / 2;
      this.at(14.1, 'cage', () => { this.audio.gateRattle({ x: 0, y: 1.5, z: 0 }); });
      this.liftLamp.intensity = t > 14.1 ? 2.5 * (Math.sin(t * 23) > 0 ? 1 : 0.1) : 2.5;
      this.fear = t > 14.1 ? 0.3 : 0;
    } else if (t < 16.2) {
      // you stop. You turn round.
      const k = ease((t - 15) / 1.1);
      stride(-10.5, 0, 0);
      const hp = this.headPos();
      lookAt(hp, k * 0.85, k * Math.PI);
      this.at(15.6, 'click', () => this.audio.click(this.headPos()));
      this.fear = 0.35;
      this.liftLamp.intensity = 1.6;
    } else if (t < 17.9) {
      // he comes out of the cage at you
      stride(-10.5, 0, 0);
      const k = ease((t - 16.2) / 1.2);
      lookAt(this.headPos(), 0.9 + k * 0.1, Math.PI);
      cam.fov = lerp(70, 30, k);
      cam.updateProjectionMatrix();
      this.at(16.6, 'roar', () => { this.audio.roar(this.headPos()); this.shake = 0.15; });
      this.fear = 0.4 + k * 0.1;
    } else if (t < 21.1) {
      // run. Look back once.
      const tt = t - 17.9, z = -10.5 - (tt < 0.5 ? tt * tt * 5.5 : 1.375 + (tt - 0.5) * 5.6);
      stride(z, 0.04, 9.5);
      const turn = ease(tt / 0.45), back = t > 19.5 && t < 20.4 ? Math.sin((t - 19.5) / 0.9 * Math.PI) : 0;
      cam.fov = lerp(30, 74, turn) - back * 26; // and the look back narrows on him
      cam.updateProjectionMatrix();
      lookAt(this.headPos(), back * 0.95, lerp(Math.PI, 0, turn));
      for (let i = 0; i < 9; i++) this.at(18.2 + i * 0.33, 'st' + i, () => this.audio.step('run'));
      for (let i = 0; i < 8; i++) this.at(18.0 + i * 0.4, 'hb' + i, () => this.audio.heartbeat(1, true));
      this.at(18.6, 'gasp', () => this.audio.gasp());
      this.at(20.3, 'gasp2', () => this.audio.gasp());
      this.at(19.7, 'roar2', () => this.audio.roar(this.headPos()));
      this.fear = 0.5;
    } else if (t < 22.6) {
      // out under it, into the cold. Turn round, backing off, and it comes down.
      const tt = t - 21.1, z = ZOUT - (5.6 / 1.6) * (1 - Math.exp(-tt * 1.6));
      stride(z, 0.05 * (1 - clamp01(tt)), 9.5);
      const k = ease(tt / 0.5);
      look(k * Math.PI, -0.03 + k * 0.03);
      cam.fov = lerp(74, 70, k);
      cam.updateProjectionMatrix();
      this.at(21.38, 'snap', () => { this.audio.ropeSnap(); this.audio.chainRattle({ x: 2.9, y: 4, z: Z1 }); this.chainKick = 0.5; });
      if (t > 21.38 && !this.slammed) {
        const ft = t - 21.38;
        this.shutBottom = Math.max(0, 2.95 - 14 * ft * ft); // the brake gone: it drops
        this.shut.mesh.position.y = this.shutBottom + this.shut.h / 2;
        if (this.shutBottom === 0) {
          this.slammed = true;
          this.audio.thud({ x: 0, y: 0.2, z: Z1 }, 1.4);
          this.audio.clank({ x: 0, y: 0.3, z: Z1 }, 1.2);
          this.audio.shutter({ x: 0, y: 2, z: Z1 });
          this.shake = 0.5;
          this.puff(18, 0.08, 1);
          this.puff(10, this.shut.h - 0.1, 1);
        }
      }
      if (this.hitDoor !== undefined) this.at(this.hitDoor + 0.02, 'bang1', () => this.bang(0.15, 1.6, 0.2, 1.3));
      this.fear = lerp(0.5, 0.4, k);
    } else if (t < 29.2) {
      // he hits it. Again. The hook comes through, and pulls back. Then nothing: a dark hole, and him breathing behind it.
      const k = (t - 22.6) / 6.6;
      const tt = t - 21.1, z = ZOUT - (5.6 / 1.6) * (1 - Math.exp(-tt * 1.6)) - k * 0.6;
      cam.position.set(Math.sin(t * 0.9) * 0.02, 1.62 + Math.sin(t * 1.3) * 0.01, z);
      this.at(22.62, 'bang1b', () => { if (!this.fired.has('bang1')) this.bang(0.15, 1.6, 0.2, 1.3); });
      this.at(23.5, 'bang2', () => { this.bang(-0.7, 2.1, 0.16); this.audio.roar({ x: 0, y: 2, z: Z1 + 0.6 }); });
      this.at(24.2, 'bang3', () => this.bang(0.6, 1.1, 0.13));
      this.at(24.9, 'bang4', () => {
        this.bang(HOLE.x, HOLE.y, 0.22, 1.4);
        this.hook.visible = true;
        this.hole.visible = true;
        this.audio.boltHit({ x: HOLE.x, y: HOLE.y, z: Z1 });
      });
      // the hole is where the dent peaked; the hook works in it, then pulls back through with a scream of metal
      const hz = Z1 - this.shut.heightAt(HOLE.x, HOLE.y);
      this.hole.position.set(HOLE.x, HOLE.y, hz - 0.012);
      let push = 0;
      if (t > 24.9) push = t < 26.4 ? 0.2 + Math.sin((t - 24.9) * 9) * 0.03 * (t < 26 ? 1 : 0) : Math.max(-0.3, 0.2 - (t - 26.4) * 1.2);
      this.hook.position.set(HOLE.x + 0.02, HOLE.y + (t > 26 ? -(t - 26) * 0.12 : 0), hz - push + 0.12);
      this.hook.rotation.x = Math.sin(t * 5) * 0.1;
      this.at(26.0, 'scrape', () => { this.audio.creak({ x: HOLE.x, y: HOLE.y, z: Z1 }); this.audio.burst(this.audio.sfx, { type: 'bandpass', f: 2400, q: 6, dur: 0.9, vol: 0.25, sweep: [2800, 1700] }); });
      if (push < -0.25) this.hook.visible = false;
      this.at(27.3, 'growl', () => this.audio.growl({ x: HOLE.x, y: HOLE.y, z: Z1 + 0.3 }, 0.8));
      this.at(28.3, 'eclick', () => this.audio.click({ x: HOLE.x, y: HOLE.y, z: Z1 + 0.3 }));
      // where you look: the whole door, then into the hole
      const hk = ease((t - 24.9) / 1.5), ek = ease((t - 27.1) / 1.6);
      const aim = V(lerp(0, HOLE.x, hk), lerp(1.7, HOLE.y, hk), Z1);
      lookAt(aim, 1, Math.PI);
      cam.fov = lerp(70, lerp(58, 46, ek), hk);
      cam.updateProjectionMatrix();
      this.fear = 0.4 - k * 0.1;
    } else {
      // you turn your back on him and walk away into the yard
      const k = ease((t - 29.2) / 1.4);
      const z0 = ZOUT - (5.6 / 1.6) * (1 - Math.exp(-(29.2 - 21.1) * 1.6)) - 0.6;
      cam.fov = lerp(46, 70, ease((t - 29.2) / 0.9));
      cam.updateProjectionMatrix();
      stride(z0 - Math.max(0, t - 29.9) * 1.25 * Math.min(1, (t - 29.9) * 1.5 + 0.2), 0.025 * clamp01(t - 29.9), 4.4);
      look(lerp(Math.PI, Math.PI * 2 + 0.25, k), lerp(0, 0.04, k));
      this.at(29.6, 'dawn', () => this.audio.dawn());
      this.at(31.6, 'last', () => this.bang(-0.3, 1.4, 0.05, 0.6)); // one more, behind you. You don't look.
      this.flash = Math.max(this.flash, clamp01((t - 32.6) / 3.2)); // into the white
      this.fear = Math.max(0, 0.3 - (t - 29.2) * 0.15);
    }
    if (t >= 6 && t < 9.5) this.shaftFront.position.y = -10;
    const fwd = V(0, 0, -1).applyQuaternion(cam.quaternion);
    this.audio.listen(cam.position, fwd);
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
  // where to stand, and how far to raise arm `j`, for that hand to close on `target`: a few rounds of
  // "raise or lower the arm by how far off the hand is, then step so the hand is over it"
  rackReach(j, target) {
    const f = this.him, root = f.root;
    // always from the far side of the table, square on to it (facing the camera), never in the table
    root.position.set(target.x, 0, -0.95);
    root.rotation.y = 0;
    let rx = -1.2;
    const hand = V();
    for (let k = 0; k < 12; k++) {
      this.pose({ mode: 'walk', jaw: 0.4 });
      f.torso.rotation.x = 0.55;
      f.arms[j].sh.rotation.set(rx, 0, 0);
      f.arms[j].el.rotation.x = -0.15;
      this.handPos(j, hand);
      rx = Math.max(-2.6, Math.min(0, rx + (hand.y - target.y) * 0.9));
      root.position.x += target.x - hand.x;
      root.position.z = Math.min(-0.62, root.position.z + (target.z - hand.z));
    }
    return { x: root.position.x, z: root.position.z, ry: 0, rx };
  }
  rackUpdate(dt) {
    const t = this.t, you = this.you, f = this.him;
    // the crank turns until he lets go of it: slow, then faster
    const crank = t < 1.5 ? 0.8 : 1.6 + (t - 1.5) * 0.6;
    if (t < 3.9) this.drum.rotation.z -= dt * crank;
    const pull = clamp01((t - 0.8) / 3.1);
    // stretched: every limb a little longer, the body taut, the head thrown back screaming
    you.arms.forEach((a, i) => { if (!this.torn[i]) a.scale.y = 1 + pull * 0.32; });
    you.legs.forEach((l, i) => { l.scale.y = 1 + pull * 0.22; });
    you.torso.scale.y = 1 + pull * 0.08;
    you.head.rotation.x = -0.4 - pull * 0.4 + Math.sin(t * 13) * 0.08 * (1 - clamp01((t - 6.5) / 0.5));
    you.jaw.rotation.x = 0.3 + pull * 0.6;
    you.root.position.x = 0.15 + Math.sin(t * 17) * 0.015 * pull * (t < 6.5 ? 1 : 0); // straining
    // the chains run from each wrist and ankle to the drum or the post; an arm torn off leaves its chain slack
    const anchors = [V(-1.55, 1.05, 0.12), V(-1.55, 1.05, -0.12), V(1.5, 1.0, 0.12), V(1.5, 1.0, -0.12)];
    const e = V();
    this.chains.forEach((c, i) => {
      const a = anchors[i];
      if (this.torn[i]) { c.position.set(a.x + 0.05, a.y - 0.25, a.z); c.quaternion.identity(); c.scale.y = 0.5; return; }
      this.rackEnd(i, e);
      c.position.copy(a).add(e).multiplyScalar(0.5);
      const d = e.clone().sub(a);
      c.scale.y = d.length();
      c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    });
    // him: at the wheel on the far side; then round to the head of the table, and the arms come off in his hands
    const WHEEL = { x: -1.95, z: -0.7, ry: Math.atan2(0.33, 0.7) };
    const RIPS = (this.rips ||= [{ i: 0, j: 0, reach: 4.0, rip: 4.75, toss: 5.35 }, { i: 1, j: 1, reach: 5.45, rip: 6.05, toss: 6.6 }]);
    let posed = false;
    if (t < 3.9) {
      f.root.position.set(WHEEL.x, 0, WHEEL.z);
      f.root.rotation.y = WHEEL.ry;
      this.pose({ mode: 'walk', jaw: 0.25 + pull * 0.3, twitch: this.twitch(0.12) });
      const ph = -this.drum.rotation.z;
      f.torso.rotation.x = 0.6 + pull * 0.25;
      f.arms[0].sh.rotation.set(-1.2 + Math.sin(ph) * 0.45, 0, 0.3);
      f.arms[1].sh.rotation.set(-1.2 + Math.sin(ph + 0.6) * 0.45, 0, -0.1);
      f.arms.forEach((a) => (a.el.rotation.x = -0.5 + Math.cos(ph) * 0.3));
      posed = true;
    }
    for (const r of RIPS) {
      if (t < r.reach || posed) continue;
      // the first time: work out where he has to stand to take hold of that wrist
      if (!r.at) { const from = { x: f.root.position.x, z: f.root.position.z, ry: f.root.rotation.y }; r.at = this.rackReach(r.j, this.rackEnd(r.i)); r.from = from; }
      const next = RIPS[RIPS.indexOf(r) + 1];
      if (next && t >= next.reach) continue;
      const k = ease((t - r.reach) / (r.rip - r.reach - 0.1));
      f.root.position.set(lerp(r.from.x, r.at.x, k), 0, lerp(r.from.z, r.at.z, k));
      f.root.rotation.y = lerp(r.from.ry, r.at.ry, k);
      this.pose({ mode: 'walk', gait: t * 6, speed: (1 - k) * 1.6, jaw: 0.5, twitch: this.twitch(0.1) });
      f.torso.rotation.x = 0.55;
      const other = f.arms[1 - r.j];
      other.sh.rotation.set(-0.4, 0, (r.j ? 1 : -1) * 0.2);
      // reaching in; then the wrench back and up with it; then it goes over his shoulder
      const yank = ease((t - r.rip) / 0.35), throwK = ease((t - r.toss + 0.25) / 0.25);
      const arm = f.arms[r.j];
      arm.sh.rotation.set(lerp(-0.4, r.at.rx, k) + (r.at.rx < -1.5 ? 0.6 : 0.3) * yank - 1.4 * yank * (1 - throwK) - 0.9 * throwK, 0, (r.j ? -1 : 1) * 0.15 * yank);
      arm.el.rotation.x = -0.15 - 0.6 * yank;
      f.torso.rotation.x = 0.55 - 0.3 * yank + 0.25 * throwK;
      posed = true;
      this.at(r.reach + 0.1, 'step' + r.i, () => this.audio.thud({ x: f.root.position.x, y: 0, z: f.root.position.z }, 0.6));
      this.at(r.rip, 'rip' + r.i, () => {
        const limb = you.arms[r.i], p = this.rackEnd(r.i);
        const sh = limb.getWorldPosition(V());
        this.torn[r.i] = true;
        arm.hand.attach(limb); // it comes away in his hand
        const st = stump(this.mats, 0.05);
        st.position.copy(you.torso.worldToLocal(sh.clone()));
        you.torso.add(st);
        this.audio.crack();
        this.audio.squelch(1.6);
        this.audio.tear();
        this.audio.scream();
        this.shake = 1.2;
        this.flash = 0.25;
        this.gore.spray(sh, V(0, 0.9, -0.4), 120, 4, 0.5);
        this.gore.spray(sh, V(0, 1, 0), 60, 3, 0.8);
        this.gore.burst(sh, 10, 3, 0.7);
        this.scene.add(decal(this.mats.splat[(Math.random() * 4) | 0], 1.2, p.x, p.z, Math.random() * 6, 0.012));
      });
      this.at(r.toss, 'toss' + r.i, () => {
        const limb = you.arms[r.i];
        this.scene.attach(limb);
        (this.thrown ||= []).push({ o: limb, v: V(0.6, 2.2, 1.6 - r.i * 0.6), spin: V(6, 2, 4) });
        this.audio.whoosh(limb.getWorldPosition(V()));
      });
    }
    // the arms he's thrown: over the table, and down on the concrete with a slap
    for (const th of this.thrown || []) {
      if (th.rest) continue;
      th.v.y -= 9.8 * dt;
      th.o.position.addScaledVector(th.v, dt);
      th.o.rotation.x += th.spin.x * dt; th.o.rotation.y += th.spin.y * dt; th.o.rotation.z += th.spin.z * dt;
      if (th.o.position.y < 0.08 && th.v.y < 0) { th.o.position.y = 0.08; th.rest = true; th.o.rotation.x = Math.PI / 2; this.audio.squelch(0.7); this.scene.add(decal(this.mats.splat[(Math.random() * 4) | 0], 0.9, th.o.position.x, th.o.position.z, Math.random() * 6, 0.012)); }
    }
    // the stumps keep pumping
    if (t > 4.75 && t < 8 && Math.random() < dt * 10) { const i = Math.random() < 0.5 ? 0 : 1; if (this.torn[i]) this.gore.spray(you.torso.getWorldPosition(V()).add(V(-0.25, 0.05, 0)), V(0, 0.6, 0), 10, 2, 0.6); }
    this.at(1.2, 'creak1', () => this.audio.creak({ x: -1.6, y: 1, z: 0 }));
    this.at(2.3, 'scream', () => this.audio.scream());
    this.at(2.8, 'creak2', () => this.audio.chainRattle({ x: 0, y: 1, z: 0 }));
    this.at(3.6, 'creak3', () => this.audio.creak({ x: 0, y: 1, z: 0 }));
    // camera: from the foot of the table, slowly coming in; then across the table at him; then onto his face
    if (t < 4) {
      const k = t / 4;
      this.cam.position.set(lerp(2.4, 1.6, k), lerp(2.1, 1.9, k), lerp(2.1, 1.6, k));
      this.cam.lookAt(-0.3, 1.0, 0);
    } else if (t < 6.9) {
      const k = (t - 4) / 2.9;
      this.cam.position.set(lerp(1.5, 0.9, k), lerp(1.75, 1.85, k), lerp(1.9, 1.75, k));
      this.cam.lookAt(lerp(-0.6, -0.9, k), 1.25, -0.3);
    } else {
      // he stops, and turns to look at you: the camera comes in to his face, and stops short of it
      const hold = f.root.rotation.y;
      const look = ease((t - 6.9) / 0.3);
      if (!this.faceFrom) this.faceFrom = { cam: this.cam.position.clone(), ry: hold };
      f.root.rotation.y = lerp(this.faceFrom.ry, Math.atan2(this.faceFrom.cam.x - f.root.position.x, this.faceFrom.cam.z - f.root.position.z), look);
      this.pose({ mode: 'walk', jaw: 0.95, twitch: this.twitch(0.15) });
      f.torso.rotation.x = 0.4;
      this.at(6.9, 'stare', () => { this.audio.jumpscare(0.7); this.flash = 0.4; });
      const hp = this.headPos();
      const away = this.faceFrom.cam.clone().sub(hp).normalize();
      const stop = hp.clone().addScaledVector(away, 0.55); // no closer than this: his face fills the frame
      this.cam.position.lerpVectors(this.faceFrom.cam, stop, ease((t - 7.0) / 1.3));
      this.cam.lookAt(hp);
    }
    this.fear = 0.55 + pull * 0.45;
    this.at(8.9, 'black', () => (this.blackout = 1));
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
