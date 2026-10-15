// Death cutscenes. After the grab, one of these plays at random (never the same one twice running):
//   rope    - strung up over a fire pit; he watches you, you look down at the flames, he cuts the rope
//   exit    - an EXIT door at last; he's just standing behind you; the door opens onto a sheer drop; he pushes
//   grinder - (third person) dragged by the ankle and fed into the meat grinder
//   fan     - lifted up into the blades of a ceiling fan
//   eaten   - (third person) he takes you apart on the floor and eats you, and then he looks at you
// Each one builds its own little stage, runs off a timeline, and throws gore around with a small physics pass.
import * as THREE from 'three';
import { createForemanMesh, poseForeman } from './monster.js';
import { makeBody, openChest, mesh, decal, severedArm, severedHead, meatChunk, makeLamp } from './props.js';
import { canvas } from './textures.js';

export const CUTSCENES = ['rope', 'exit', 'grinder', 'fan', 'eaten'];

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- the worker: you, from the outside ----------
function makeWorker(mats) {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const b = makeBody(mats, rng, { cloth: mats.coverall, skin: mats.skin });
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

function flameTex() {
  const { c, g } = canvas(64, 64);
  const gr = g.createRadialGradient(32, 36, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(255,240,180,1)');
  gr.addColorStop(0.3, 'rgba(255,150,40,0.9)');
  gr.addColorStop(0.7, 'rgba(200,40,0,0.4)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
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
    const coals = new THREE.Mesh(new THREE.CircleGeometry(1.55, 16), new THREE.MeshBasicMaterial({ color: 0xff5010 }));
    coals.rotation.x = -Math.PI / 2;
    coals.position.y = 0.1;
    s.add(coals);
    const ft = flameTex();
    this.flames = [];
    for (let i = 0; i < 46; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, color: 0xffffff }));
      s.add(sp);
      this.flames.push({ sp, life: Math.random(), x: 0, z: 0 });
    }
    this.fireLight = new THREE.PointLight(0xff6020, 40, 16, 1.4);
    this.fireLight.position.set(0, 0.8, 0);
    s.add(this.fireLight);
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
    for (const f of this.flames) {
      f.life += dt * (1 + Math.random());
      if (f.life > 1) { f.life = 0; f.x = (Math.random() - 0.5) * 2.4; f.z = (Math.random() - 0.5) * 2.4; }
      const k = f.life;
      f.sp.position.set(f.x * (1 - k * 0.6), 0.15 + k * 1.6, f.z * (1 - k * 0.6));
      f.sp.scale.setScalar((1 - k) * 0.9 + 0.2);
    }
    this.fireLight.intensity = 26 + Math.random() * 14;
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
    this.audio.grinder(true);
  }
  grinderUpdate(dt) {
    const t = this.t, you = this.you, him = this.him.root;
    for (const r of this.rollers) r.rotation.y += dt * (t > 4 ? 14 : 6) * (r.position.x > 0 ? 1 : -1);
    const hand = V();
    // camera: low, off to the side, the whole thing in shot
    this.cam.position.set(lerp(3.4, 2.8, t / 8), lerp(1.3, 1.8, t / 8), lerp(2.2, 1.0, t / 8));
    this.cam.lookAt(0, 1.1, -1.8);
    if (t < 3) {
      // dragging you by the ankle
      const z = lerp(4, -1.4, ease(t / 3));
      him.position.set(0.3, 0, z);
      him.rotation.y = Math.PI;
      this.pose({ mode: 'walk', gait: t * 5, speed: 1.2 });
      this.him.arms[1].sh.rotation.set(-0.2, 0, -0.3);
      this.handPos(1, hand);
      you.root.position.set(hand.x, 0.18, hand.z + 1.25);
      orient(you.root, V(0, 0, -1), V(0, 1, 0));
      you.arms.forEach((a, i) => a.rotation.set(0, 0, (i ? 1 : -1) * 2.6));
      this.at(0.2, 'drag', () => this.audio.drag());
      if (Math.random() < dt * 8) this.scene.add(decal(this.mats.splat[(Math.random() * 4) | 0], 0.6, hand.x + (Math.random() - 0.5) * 0.2, hand.z + 1.2, Math.random() * 6, 0.011));
    } else if (t < 4.2) {
      // up, by one leg, over the mouth of it
      const k = ease((t - 3) / 1);
      him.position.set(0.3, 0, -1.4);
      this.pose({ mode: 'walk', jaw: 0.5 });
      this.him.arms[1].sh.rotation.set(lerp(-0.2, -2.9, k), 0, -0.2);
      this.handPos(1, hand);
      you.root.position.set(hand.x, hand.y - 1.1, hand.z);
      orient(you.root, V(0, -1, 0), V(0, 0, 1));
      this.at(3.2, 'growl', () => this.audio.growl({ x: 0, y: 2, z: -1.4 }, 1));
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
      this.at(4.6, 'lens', () => this.blood.splash(0.9));
      this.at(5.5, 'lens2', () => this.blood.splash(0.6));
      this.at(7.6, 'black', () => (this.blackout = 1));
      this.fear = 0.9;
    }
  }

  // ---------- 4: the fan ----------
  fanBuild() {
    this.dur = 7;
    const s = this.scene, m = this.mats;
    room(s, m, 10, 10, 9);
    this.fan = new THREE.Group();
    this.fan.position.set(0, 2.85, -0.4);
    this.fan.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 10), m.darkMetal));
    for (let i = 0; i < 4; i++) {
      const b = mesh(new THREE.BoxGeometry(1.5, 0.025, 0.32), m.steel);
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
    // a light above the blades: their shadows sweep the room
    this.light = new THREE.PointLight(0xfff0d0, 14, 14, 1.4);
    this.light.position.set(0, 2.97, -0.4);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(512, 512);
    s.add(this.light);
    // and a work light below it, so you see the blades coming
    const under = new THREE.PointLight(0xff8060, 8, 8, 1.5);
    under.position.set(1.5, 1.2, 1.5);
    s.add(under);
    this.torch(70);
    const face = new THREE.PointLight(0xff5a40, 3, 3, 2); // on its face while it holds you up
    face.position.set(0, 0, -0.3);
    this.cam.add(face);
    this.him.root.position.set(0, 0, -0.95);
    this.audio.fanLoop(true);
  }
  fanUpdate(dt) {
    const t = this.t;
    this.fan.rotation.y += dt * 14;
    const head = this.headPos();
    if (t < 3.3) {
      // up, up, up toward it
      const lift = ease((t - 0.8) / 2);
      this.pose({ mode: 'grab', jaw: 0.6, twitch: this.twitch(0.3) });
      for (const a of this.him.arms) a.sh.rotation.x = lerp(-1.6, -3.0, lift);
      this.cam.position.set(0, lerp(1.95, 2.55, lift), -0.4 + lift * 0.05);
      const look = lerp(0, 1, ease((t - 1) / 0.8));
      this.cam.lookAt(V(head.x, head.y, head.z).lerp(V(0, 3, -0.6), look));
      this.at(1.2, 'up', () => this.audio.growl({ x: 0, y: 2, z: -1 }, 1));
      this.fear = 0.5 + lift * 0.5;
    } else {
      this.at(3.3, 'blades', () => {
        this.audio.fanHit();
        this.blood.splash(1);
        this.blood.splash(1);
        this.flash = 1;
        this.shake = 2;
        this.gore.burst(V(0, 2.7, -0.4), 50, 7, 0.1, [severedArm(this.mats, Math.random), severedArm(this.mats, Math.random)]);
        this.gore.spray(V(0, 2.75, -0.4), V(1, 0, 0), 300, 9, 2);
      });
      // and then you're on the floor, looking up at it throwing you around the room
      const k = ease((t - 3.4) / 0.5);
      this.cam.position.set(0.6, lerp(2.6, 0.25, k), 0.6);
      this.cam.lookAt(0, 2.8, -0.4);
      this.cam.rotation.z += 0.6;
      if (t < 5 && Math.random() < dt * 10) this.gore.spray(V(0, 2.75, -0.4), V(Math.random() - 0.5, -0.2, Math.random() - 0.5), 30, 8, 1.5);
      this.pose({ mode: 'walk', jaw: 0.3, twitch: { x: -0.6, y: 0, z: 0.4, r: 0.5 } });
      this.at(6.2, 'black', () => (this.blackout = 1));
    }
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
