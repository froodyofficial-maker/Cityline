// OFFAL: night shift at the Hollow Pines Meatworks.
// The loop: drop into a floor, find the dead, cut their tags out, solve whatever else is keeping the lift
// shut, get back to it alive, go deeper. Story mode is ten floors with a checkpoint on each and an ending
// at the bottom; Overtime is the endless version where dying sends you back to B1.
import * as THREE from 'three';
import { makeMaterials } from './textures.js';
import { makeLayout, buildLevel, lineOfSight, toTile, findPath } from './level.js';
import { Puzzles } from './puzzles.js';
import { Hunter, createForemanMesh, poseForeman } from './monster.js';
import { Player, keys, tapped, endFrame } from './player.js';
import { AudioEngine } from './audio.js';
import { Post } from './post.js';
import { Director } from './director.js';
import { Guide } from './guide.js';
import { Cutscene, CUTSCENES } from './cutscenes.js';
import * as UI from './ui.js';
import * as P from './props.js';
import { floorInfo, difficulty, WALL_H, STORY_FLOORS, DIFFS } from './config.js';
import { animateFlies } from './props.js';

// ---------- save ----------
const SAVE_KEY = 'offal-save-v1';
const save = (() => {
  const fresh = { v: 1, runs: [], best: 0, deaths: 0, totalTags: 0, shifts: 0,
    story: { active: false, floor: 1, seed: 0, deaths: 0, time: 0, tags: 0, done: 0, bestTime: 0 }, settings: { sens: 1, vol: 0.8, gamma: 1, pix: 300, shake: true, fov: 75, invert: false, bob: true, beam: 0.55, power: 160, hints: true, fullscreen: true } };
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && s.v === 1) return { ...fresh, ...s, story: { ...fresh.story, ...s.story }, settings: { ...fresh.settings, ...s.settings } };
  } catch {}
  return fresh;
})();
const writeSave = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };

// ---------- renderer ----------
const canvas = UI.$('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const post = new Post(renderer);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 60);
const scene = new THREE.Scene();
scene.add(camera);
scene.fog = new THREE.FogExp2(0x000000, 0.09);
scene.background = new THREE.Color(0x000000);
scene.add(new THREE.AmbientLight(0x2a1c1a, 0.4));
const mats = makeMaterials();
const audio = new AudioEngine();
const player = new Player(camera);
const blood = new UI.ScreenBlood(UI.$('blood'));

// a small pool of real lights handed to whichever ceiling lamps are nearest
const lampLights = [];
for (let i = 0; i < 6; i++) { const l = new THREE.PointLight(0xffffff, 0, 9, 2); scene.add(l); lampLights.push(l); }

// ---------- game state (also the "world" the AI and director see) ----------
const G = {
  state: 'warn', scene, audio, player, ui: UI, mats,
  depth: 1, L: null, B: null, D: null, info: null, hunters: [], flies: [],
  runTime: 0, runTags: 0, floorTime: 0,
  fear: 0, scare: 0, damage: 0, flash: 0, blackout: 0, torchKill: 0, lampKill: 0, slowT: 0,
  hb: 0, holdT: 0, cutT: 0, lift: { phase: 'arrive', t: 0 }, liftSealed: true, shakeScale: 1,
  // kind: walk / crouch / run / cut / locker / work / other. The difficulty decides how far each carries (0 = silent)
  noise(pos, radius, loud, kind = 'other') {
    const n = (DIFFS[G.diff] || DIFFS.normal).noise, m = n[kind] ?? n.other ?? 1;
    if (m <= 0) return;
    for (const h of G.hunters) h.hear({ pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, 0, pos.z), radius: radius * m, loud });
  },
  say(text, secs) { UI.message(text, secs); },
  gasp() {
    audio.gasp();
    UI.message('You can’t hold it. The air comes out of you in a sob.', 2.5);
    for (const h of G.hunters) if (h.pos.distanceTo(player.pos) < 8 && player.hidden) { h.lockerTarget = player.hidden; h.setState('locker'); }
  },
  onSpotted() { G.scare = 1; },
  onHit(h) { hurt(h); },
  onGrab(h, lk) { startDeath(h, 'locker', lk); },
};
const director = new Director(G, mats);
const guide = new Guide(G);

function applySettings() {
  const s = save.settings;
  player.sens = s.sens;
  player.invertY = s.invert;
  player.torchPower = s.power;
  player.torch.angle = s.beam;
  player.torch.penumbra = 0.55 + (s.beam - 0.3) * 0.3;
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  audio.setVolume(s.vol);
  post.u.bright.value = s.gamma;
  post.height = +s.pix;
  G.shakeScale = s.shake ? 1 : 0.15;
  G.bobScale = s.bob ? 1 : 0;
  G.hints = s.hints;
  resize();
  const show = { sens: s.sens.toFixed(2) + '\u00D7', fov: s.fov + '\u00B0', gamma: Math.round(s.gamma * 100) + '%', vol: Math.round(s.vol * 100) + '%', beam: Math.round(s.beam * 114.6) + '\u00B0', power: Math.round(s.power / 1.6) + '%' };
  for (const k in show) UI.$(k + 'V').textContent = show[k];
}
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  menu.cam.aspect = w / h;
  menu.cam.updateProjectionMatrix();
  post.resize(w, h);
}
addEventListener('resize', resize);

// ---------- menu backdrop: a swinging lamp, meat on hooks, and sometimes him ----------
const menu = (() => {
  const s = new THREE.Scene();
  s.fog = new THREE.FogExp2(0x000000, 0.13);
  s.background = new THREE.Color(0);
  s.add(new THREE.AmbientLight(0x2a1a18, 0.25));
  const pg = new THREE.PlaneGeometry(2, 2);
  for (let x = -5; x <= 5; x++) for (let z = -5; z <= 2; z++) {
    const f = new THREE.Mesh(pg, mats.floors[(x * 7 + z * 3) % 5 === 0 ? 1 : 0]);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x * 2, 0, z * 2);
    f.receiveShadow = true;
    s.add(f);
  }
  const wg = new THREE.PlaneGeometry(2, WALL_H);
  for (let x = -5; x <= 5; x++) {
    const w = new THREE.Mesh(wg, mats.walls[3 * ((x + 7) % 4) + 0]);
    w.position.set(x * 2, WALL_H / 2, -6);
    w.receiveShadow = true;
    s.add(w);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(24, 16), mats.ceil);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = WALL_H;
  s.add(ceil);
  const rng = Math.random;
  const meat = [[0.2, -1.2, true], [-1.7, -2.6, true], [1.9, -2.3, false], [-0.6, -4.2, false], [3.2, -4, true]].map(([x, z, h]) => {
    const c = P.makeCarcass(mats, rng, h);
    c.position.set(x, WALL_H, z);
    c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(c);
    return c;
  });
  const lampPivot = new THREE.Group();
  lampPivot.position.set(1.0, WALL_H, -0.2);
  const lamp = P.makeLamp(mats, 'bulb');
  lamp.position.set(0, 0, 0);
  lampPivot.add(lamp);
  const light = new THREE.PointLight(0xffd8b0, 6, 12, 1.6);
  light.position.y = -0.75;
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  light.shadow.bias = -0.003;
  lampPivot.add(light);
  s.add(lampPivot);
  const him = createForemanMesh(mats);
  him.root.position.set(1.1, 0, -3.4);
  him.root.rotation.y = -0.25;
  him.root.visible = false;
  s.add(him.root);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.05, 40);
  return { scene: s, cam, meat, lampPivot, light, him, lamp, t: 0, reveal: 6 + Math.random() * 5, showing: 0 };
})();

function updateMenu(dt) {
  const m = menu;
  m.t += dt;
  m.lampPivot.rotation.z = Math.sin(m.t * 0.8) * 0.3;
  m.lampPivot.rotation.x = Math.sin(m.t * 0.53) * 0.12;
  m.meat.forEach((c, i) => { c.rotation.y = Math.sin(m.t * 0.3 + i) * 0.4; c.rotation.z = Math.sin(m.t * 0.7 + i * 2) * 0.03; });
  let on = Math.sin(m.t * 17) + Math.sin(m.t * 5.3) > -1.5 ? 1 : 0.05;
  m.reveal -= dt;
  if (m.reveal < 0 && m.showing <= 0) { m.showing = 1.4; m.reveal = 8 + Math.random() * 7; }
  if (m.showing > 0) {
    // he's standing there only while the light can't decide
    m.showing -= dt;
    on = Math.random() < 0.5 ? 1 : 0.02;
    m.him.root.visible = on > 0.5 && m.showing < 1.2;
    poseForeman(m.him, { gait: 0, speed: 0, mode: 'walk', t: m.t, jawOpen: 0.3, twitch: { x: 0.2, y: 0, z: Math.sin(m.t * 20) * 0.4, r: 0.6 } });
    if (m.showing <= 0) m.him.root.visible = false;
  }
  m.light.intensity = 6 * on;
  m.lamp.userData.bulb.material = on > 0.5 ? mats.lampOn : mats.lampOff;
  m.cam.position.set(Math.sin(m.t * 0.07) * 0.6 + 0.5, 1.55 + Math.sin(m.t * 0.13) * 0.05, 3.1);
  m.cam.lookAt(0.2, 1.45, -1.8);
  post.u.fear.value = m.showing > 0 ? 0.6 : 0.12;
  post.u.tear.value = m.showing > 0 ? 0.7 : 0;
  post.u.damage.value = 0;
  post.u.health.value = 1;
  post.u.hidden.value = 0;
  post.u.blackout.value = 0;
  post.u.flash.value = 0;
  post.u.tint.value.set(1, 1, 1);
}

// ---------- floors ----------
function disposeLevel() {
  if (!G.B) return;
  scene.remove(G.B.group);
  G.B.group.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  for (const h of G.hunters) { scene.remove(h.obj); h.dispose(); }
  for (const f of G.flies) f && f.stop();
  if (G.puzzles) G.puzzles.dispose();
  G.hunters = [];
  G.flies = [];
  G.puzzles = null;
  if (UI.keypad.isOpen) UI.keypad.close();
}

function loadFloor(depth, seed) {
  disposeLevel();
  const D = difficulty(depth, G.mode, Math.random, G.diff);
  const L = makeLayout(depth, seed, D);
  G.floorSeed = seed;
  const B = buildLevel(L, mats);
  Object.assign(G, { L, B, D, depth, info: floorInfo(depth, G.mode), floorTime: 0, lampKill: 0, torchKill: 0, frenzy: false, frenzyT: 0 });
  G.puzzles = new Puzzles(G, D.puzzles, seed + 17);
  scene.add(B.group);
  if (D.theme === 'morgue' && G.info.theme !== 'morgue') Object.assign(G.info, { lamp: 0xbfd8ff, fog: 0x01030a, theme: 'morgue' }); // overtime's random cold floors
  scene.fog.color.setHex(G.info.fog);
  scene.background.setHex(G.info.fog);
  post.u.tint.value.set(...(D.theme === 'morgue' ? [0.72, 0.9, 1.22] : [1, 1, 1])); // the morgue is cold
  scene.fog.density = 0.085 + D.fogBoost + Math.min(depth, 10) * 0.003;
  for (const l of lampLights) l.color.setHex(G.info.lamp);
  G.hunters = B.hunterSpawns.map((p, i) => { const h = new Hunter(G, mats, p, i); scene.add(h.obj); return h; });
  G.flies = B.corpses.map((c) => audio.flies(c.pos));
  // the gate across the lift mouth, as a collider that can be switched off
  const lp = B.lift.pos;
  B.gate = { x0: lp.x - 1, x1: lp.x + 1, z0: lp.z - 1.06, z1: lp.z - 0.9, hunters: true, off: false };
  B.colliders.push(B.gate);
  B.lift.bars.position.y = 0;
  player.spawn(B.spawn);
  player.hidden = null;
  player.inLift = true;
  G.lift = { phase: 'arrive', t: 0 };
  G.liftSealed = true;
  director.reset();
  guide.reset();
  audio.setDepth(depth);
}

function inAlcove() {
  const a = G.L.alcove;
  return toTile(player.pos.x) === a.x && toTile(player.pos.z) === a.y;
}

// ---------- run flow ----------
// mode: 'story' (continue from the saved floor, or fresh) or 'overtime' (endless, from B1)
// opts.resume: a snapshot to pick up exactly where you left off. opts.floor: overtime's starting floor
function startRun(mode = 'story', fresh = false, diff = null, opts = {}) {
  audio.init();
  applySettings();
  player.reset();
  blood.clear();
  G.mode = mode;
  const st = save.story;
  if (mode === 'story' && (fresh || !st.active)) Object.assign(st, { active: true, floor: 1, seed: 0, deaths: 0, time: 0, tags: 0, diff: diff || 'normal' });
  G.diff = mode === 'story' ? st.diff || 'normal' : diff || G.diff || 'normal';
  if (diff) save.settings.lastDiff = diff;
  if (mode === 'story' && (fresh || st.floor === 1)) guide.newRun();
  if (mode === 'overtime') guide.newRun();
  save.shifts++;
  G.shift = save.shifts;
  G.runTime = mode === 'story' ? st.time : 0;
  G.runTags = mode === 'story' ? st.tags : 0;
  G.fear = G.scare = G.damage = G.flash = G.blackout = 0;
  writeSave();
  const snap = opts.resume || null;
  if (snap) { G.diff = snap.diff; G.runTime = snap.runTime; G.runTags = snap.runTags; }
  else save.snap = null;
  G.trans = { t: 0.8, loaded: false, next: snap ? snap.depth : mode === 'story' ? st.floor : opts.floor || 1, snap };
  G.state = 'transition';
  UI.$('fade').classList.add('on');
  UI.only();
  lockPointer();
}

// raw mouse input where the browser supports it: no OS acceleration, and none of Chrome's lock jitter
function lockPointer() {
  const plain = () => { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} };
  try {
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(plain); else if (!r) plain();
  } catch { plain(); }
}

function updateTransition(dt) {
  const tr = G.trans;
  tr.t += dt;
  if (tr.t >= 0.8 && !tr.loaded) {
    tr.loaded = true;
    audio.liftMotor(true);
    // story: the floor keeps its seed until you clear it, so a retry is the same floor you learned
    let seed = tr.snap ? tr.snap.seed : (Math.random() * 2 ** 30) | 0;
    if (G.mode === 'story') {
      if (tr.snap) save.story.seed = seed;
      const st = save.story;
      if (st.floor !== tr.next || !st.seed) { st.floor = tr.next; st.seed = seed; }
      seed = st.seed;
      st.time = Math.round(G.runTime);
      st.tags = G.runTags;
      writeSave();
    }
    loadFloor(tr.next, seed);
    player.tags = 0;
    if (tr.snap) restoreSnapshot(tr.snap);
    const info = G.info;
    UI.$('cardB').textContent = info.label;
    UI.$('cardName').textContent = info.name;
    UI.$('cardQuote').textContent = '';
    UI.only('card');
    setTimeout(() => UI.typewrite(UI.$('cardQuote'), info.quote, 30, () => Math.random() < 0.5 && audio.tick()), 900);
  }
  if (tr.loaded) {
    player.shake = Math.max(player.shake, 0.25);
    player.applyCamera(dt, G);
    audio.listen(camera.position, player.forward());
  }
  if (tr.t > 6) {
    UI.only('hud');
    UI.$('fade').classList.remove('on');
    audio.liftMotor(false);
    audio.clank(G.B.lift.pos, 1);
    if (tr.snap && tr.snap.lift.phase === 'open') {
      // back exactly where you were: the gate already up
      G.lift = { phase: 'open', t: 0 };
      G.B.lift.bars.position.y = WALL_H - 0.25;
      G.B.gate.off = true;
      G.liftSealed = false;
      setTimeout(() => G.state === 'play' && UI.message('You pick up exactly where you left off. He did too.', 3.5), 600);
    } else {
      G.lift = { phase: 'opening', t: 0 };
      audio.gateSlide(G.B.lift.pos);
    }
    G.state = 'play';
    G.saveT = 5;
    audio.setMode('roam');
    if (G.depth > 1 && G.D.tags) setTimeout(() => G.state === 'play' && UI.message(`The lift wants ${G.D.tags} tags this time. Hold Q to listen for the way.`, 4.5), 2500);
  }
}

function nextFloor() {
  if (G.mode === 'story') { save.story.floor = G.depth + 1; save.story.seed = 0; }
  save.snap = null; // the new floor's start is the checkpoint now
  writeSave();
  G.trans = { t: 0, loaded: false, next: G.depth + 1 };
  G.state = 'transition';
  UI.$('fade').classList.add('on');
  UI.prompt(null);
}

// ---------- hurting and dying ----------
// one hit is all it takes
function hurt(h) {
  if (G.state !== 'play') return;
  player.hp = 0;
  startDeath(h, 'hook');
  return;
}

function startDeath(h, kind, locker) {
  if (G.state === 'dying' || G.state === 'dead') return;
  G.state = 'dying';
  // which death: any of the five, but never the same one twice in a row
  const pool = CUTSCENES.filter((c) => c !== save.lastCut);
  const sceneKind = window.__forceCut || pool[(Math.random() * pool.length) | 0];
  save.lastCut = sceneKind;
  G.death = { t: 0, h, kind, scene: sceneKind, eye: camera.position.clone(), floorPos: player.pos.clone() };
  audio.jumpscare(1);
  audio.setChase(0);
  audio.setBreath(0, 1);
  audio.setListen(false);
  G.listening = false;
  guide.reset();
  UI.prompt(null);
  UI.only();
  UI.$('slits').classList.remove('on');
  h.setState('grab');
  for (const o of G.hunters) if (o !== h) o.obj.visible = false;
  // put it right in your face
  // it starts back where it was (a few steps off at most) and closes the gap in a blink
  let dir, from;
  if (kind === 'locker') {
    dir = locker.facing.clone();
    from = 2.4;
    locker.target = 1;
    locker.obj.userData.door.visible = true;
  } else {
    dir = new THREE.Vector3(h.pos.x - player.pos.x, 0, h.pos.z - player.pos.z);
    from = Math.min(3.2, Math.max(1.6, dir.length() + 0.6));
    if (dir.lengthSq() < 0.01) dir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    dir.normalize();
  }
  G.death.from = from;
  G.death.dir = dir;
  h.yaw = Math.atan2(-dir.x, -dir.z);
  audio.setMuffle(false);
}

const _head = new THREE.Vector3();
const faceLight = new THREE.PointLight(0xff5a40, 0, 3, 2);
scene.add(faceLight);
const LUNGE = 0.13, GRAB = 1.5;
function updateDeath(dt) {
  const d = G.death, h = d.h, t = (d.t += dt);
  const grab = t < GRAB, hit = t >= LUNGE;
  const base = d.kind === 'locker' ? 1.25 : 1.3;
  if (grab) {
    // the lunge: from where it stood to a hand's width from your face, in an eighth of a second
    const k = Math.min(1, t / LUNGE), lunge = 1 - (1 - k) ** 3;
    const dist = d.from + (base - 0.38 - d.from) * lunge;
    h.pos.copy(d.kind === 'locker' ? player.hidden.pos : d.floorPos).addScaledVector(d.dir, dist);
  }
  // once it has you, its head shakes like something's trying to get out of it
  const rattle = hit ? (t < 0.7 ? 1 : 0.55) : 0.15;
  const jitter = { x: (Math.random() - 0.5) * 1.1 * rattle, y: (Math.random() - 0.5) * 0.9 * rattle, z: (Math.random() - 0.5) * 1.2 * rattle, r: (Math.random() - 0.5) * 1.6 * rattle };
  let swing = 0;
  if (!grab) swing = t < 2.0 ? 0 : Math.min(1, (t - 2.0) / 0.13);
  // the jaw keeps going past where a jaw should stop
  const jaw = grab ? (hit ? Math.min(1.75, 0.6 + (t - LUNGE) * 4.5) + Math.random() * 0.12 : 0.6) : 0.7;
  poseForeman(h.body, { gait: 0, speed: 0, mode: grab ? 'grab' : 'attack', t, swing, jawOpen: jaw, twitch: grab ? jitter : { x: 0.3, y: 0, z: 0.4, r: 0.5 } });
  h.obj.position.copy(h.pos);
  h.obj.rotation.y = h.yaw;
  h.obj.updateMatrixWorld(true);
  h.body.head.getWorldPosition(_head);
  if (!grab && camera.fov !== save.settings.fov) {
    camera.fov = save.settings.fov;
    camera.updateProjectionMatrix();
  }
  if (grab) {
    // it lifts you off the floor by the throat, up to its face
    camera.position.copy(d.eye);
    const after = Math.max(0, t - LUNGE);
    camera.position.y += 0.45 * Math.min(1, after / 0.1);
    camera.lookAt(_head);
    // the hit: the view punches in on its face, then breathes
    const fov0 = save.settings.fov;
    camera.fov = hit ? fov0 * (after < 0.05 ? 0.5 : 0.62 + 0.06 * Math.sin(after * 31)) : fov0;
    camera.updateProjectionMatrix();
    const shake = hit ? Math.max(0.25, 1 - after * 1.2) : 0.05;
    camera.rotation.z += (Math.random() - 0.5) * 0.35 * shake;
    camera.position.x += (Math.random() - 0.5) * 0.09 * shake;
    camera.position.y += (Math.random() - 0.5) * 0.09 * shake;
    // white, red, black, white: the strobe of being taken
    // set outright every frame so nothing smears: single hard frames over a clean, close face
    const ph = Math.floor(after * 24) % 4;
    const strobe = hit && after < 0.45;
    G.flash = !hit ? 0 : after < 0.03 || (strobe && ph === 0) ? 0.85 : 0;
    G.damage = strobe && ph === 2 ? 1.1 : hit && !strobe && Math.random() < dt * 5 ? 0.9 : 0;
    G.blackout = strobe && ph === 3 && after > 0.1 ? 0.9 : 0;
    faceLight.position.lerpVectors(camera.position, _head, 0.5);
    faceLight.color.setHex(Math.random() < 0.5 ? 0xff2a14 : 0xffe0c8);
    faceLight.intensity = hit ? 4 + Math.random() * 4 : 1.5;
    player.torch.intensity = Math.random() < 0.3 ? 0 : 20 + Math.random() * 35; // shaking in your hand
    G.fear = 1;
    G.scare = 1;
  } else {
    // hard cut from its face to how you die
    if (!G.cutscene) {
      faceLight.intensity = 0;
      camera.fov = save.settings.fov;
      camera.updateProjectionMatrix();
      G.flash = 1;
      G.cutscene = new Cutscene(d.scene, { mats, audio, blood, aspect: camera.aspect });
      audio.setMode('ending');
    }
    const cs = G.cutscene;
    const done = cs.update(dt);
    G.fear = cs.fear;
    G.flash = Math.max(G.flash, cs.flash);
    G.blackout = cs.blackout;
    const skippable = cs.t > 1.2;
    UI.$('skip').classList.toggle('on', skippable && cs.blackout < 1);
    if (done || (skippable && (tapped('Space') || tapped('Enter')))) {
      UI.$('skip').classList.remove('on');
      cs.dispose();
      G.cutscene = null;
      showDeath();
    }
  }
}

const DEATH_TITLES = ['PROCESSED', 'TENDERIZED', 'HUNG TO BLEED', 'DEBONED', 'RENDERED DOWN', 'PUT ON THE LINE', 'OPENED UP'];
function showDeath() {
  const d = G.death;
  G.state = 'dead';
  try { document.exitPointerLock(); } catch {}
  audio.setMuffle(false);
  // the menu drone comes back under the death screen, the way it always was
  audio.setMode('menu');
  audio.setDepth(0);
  const floor = G.depth, story = G.mode === 'story';
  const record = !story && floor > save.best;
  save.deaths++;
  // where dying sends you: easy/normal this floor, hard one floor back, extreme the very top
  const back = { easy: floor, normal: floor, hard: Math.max(1, floor - 1), extreme: 1 }[G.diff] || floor;
  G.retryFloor = back;
  save.snap = null;
  if (story) {
    // easy/normal: same floor, same layout. the time you spent dying still counts
    save.story.deaths++;
    save.story.time = Math.round(G.runTime);
    if (back !== floor) { save.story.floor = back; save.story.seed = 0; }
    // back to B1 is not a checkpoint: the shift is over, and the next one starts from scratch
    if (back === 1) Object.assign(save.story, { active: false, floor: 1, seed: 0, tags: 0 });
  } else {
    save.best = Math.max(save.best, floor);
    save.totalTags += G.runTags;
    save.runs.push({ n: G.shift, floor, tags: G.runTags, time: Math.round(G.runTime) });
    if (save.runs.length > 30) save.runs.splice(0, save.runs.length - 30);
  }
  writeSave();
  const where = `${G.info.label} — ${G.info.name}`;
  const cause = d.kind === 'locker' ? `Dragged out of a locker on ${where}.` : d.kind === 'lift' ? `He got into the lift with you on ${where}.` : `Hooked and opened on ${where}.`;
  const fmt = (s) => `${(s / 60) | 0}:${String((s | 0) % 60).padStart(2, '0')}`;
  UI.$('deathTitle').textContent = DEATH_TITLES[(Math.random() * DEATH_TITLES.length) | 0];
  UI.$('deathCause').textContent = cause;
  UI.$('deathStats').innerHTML = story ? `
    <span>FLOOR</span><b>${G.info.label} OF B${STORY_FLOORS}</b>
    <span>DEATHS THIS SHIFT</span><b>${save.story.deaths}</b>
    <span>TIME ON SHIFT</span><b>${fmt(G.runTime)}</b>
    <span>CHECKPOINT</span><b>${back === 1 ? 'NONE \u2014 A NEW SHIFT' : 'START OF B' + back}</b>` : `
    <span>DEEPEST FLOOR</span><b class="${record ? 'rec' : ''}">B${floor}${record ? ' \u2014 NEW RECORD' : ''}</b>
    <span>TAGS CUT</span><b>${G.runTags}</b>
    <span>TIME ON SHIFT</span><b>${fmt(G.runTime)}</b>
    <span>SHIFT</span><b>#${G.shift}</b>
    <span>WORKERS PROCESSED</span><b>${save.deaths}</b>`;
  UI.$('btnRetry').textContent = story && back === 1 ? 'Start a new shift' : back === floor ? `Try ${G.info.label} again` : back === 1 ? 'Back to B1' : `Back to B${back}`;
  UI.$('deathStats').insertAdjacentHTML('beforeend', `<span>DIFFICULTY</span><b>${(DIFFS[G.diff] || DIFFS.normal).label}</b>`);
  UI.only('death');
  blood.clear();
  disposeLevel();
  G.B = null;
}

// ---------- the end ----------
function startEnding() {
  G.state = 'ending';
  try { document.exitPointerLock(); } catch {}
  const st = save.story;
  const time = Math.round(G.runTime);
  st.done = (st.done || 0) + 1;
  st.bestTime = st.bestTime ? Math.min(st.bestTime, time) : time;
  st.active = false;
  save.snap = null;
  const deaths = st.deaths;
  writeSave();
  UI.prompt(null);
  UI.$('fade').classList.add('on');
  audio.siren(false);
  const fmt = (s) => `${(s / 3600) | 0}h ${String(((s / 60) | 0) % 60).padStart(2, '0')}m`;
  const lines = [
    'B9 \u2026 B7 \u2026 B4 \u2026 B2 \u2026 B1 \u2026',
    'The motor screams the whole way up. Nothing follows you.',
    'The gate opens onto grey light.',
    '06:00. Somewhere outside, birds.',
    'The car park is empty except for your car. You don\u2019t look back at the building.',
    'In your pocket, your time card has been stamped.',
  ];
  const host = UI.$('endLines');
  host.innerHTML = '';
  UI.$('endStamp').classList.remove('on');
  UI.$('endStats').classList.remove('on');
  UI.$('endNav').classList.remove('on');
  setTimeout(() => { if (G.state !== 'ending') return; disposeLevel(); G.B = null; audio.liftMotor(false); UI.only('ending'); audio.dawn(); }, 2500);
  lines.forEach((l, i) => setTimeout(() => {
    if (G.state !== 'ending') return;
    const p = document.createElement('p');
    host.appendChild(p);
    UI.typewrite(p, l, 32, () => Math.random() < 0.4 && audio.tick());
  }, 3500 + i * 4200));
  const tEnd = 3500 + lines.length * 4200;
  setTimeout(() => { if (G.state === 'ending') { UI.$('endStamp').classList.add('on'); audio.clank({ x: 0, z: 0 }, 1); } }, tEnd);
  setTimeout(() => {
    if (G.state !== 'ending') return;
    UI.$('endStats').innerHTML = `<span>TIME ON SHIFT</span><b>${fmt(time)}</b><span>TIMES PROCESSED</span><b>${deaths}</b><span>TAGS CUT</span><b>${G.runTags}</b><span>NEXT SHIFT</span><b class="rec">TONIGHT, 22:00</b>`;
    UI.$('endStats').classList.add('on');
    UI.$('endNav').classList.add('on');
  }, tEnd + 2500);
}

function refreshMenu() {
  const st = save.story;
  UI.$('btnStory').textContent = st.active ? `Continue \u2014 B${st.floor} \u00B7 ${floorInfo(st.floor).name} (${(DIFFS[st.diff] || DIFFS.normal).label.toLowerCase()})` : st.done ? 'Clock in again' : 'Clock in';
  UI.$('btnNew').hidden = !st.active;
  const ot = save.snap && save.snap.mode === 'overtime' ? save.snap : null;
  UI.$('btnOvertimeContinue').hidden = !ot;
  if (ot) UI.$('btnOvertimeContinue').textContent = `Continue overtime \u2014 B${ot.depth}`;
  UI.timecard(save);
}

// ---------- saving the exact moment ----------
// Everything that isn't rebuilt from the floor's seed: where you are and what you've done, what each
// puzzle is up to, where they are, the clocks. Written every few seconds, on pause, and as the window goes.
function snapshot() {
  if (!G.B || !['play', 'paused'].includes(G.state) || ['closing', 'sealed'].includes(G.lift.phase)) return null;
  const B = G.B;
  return {
    v: 1, mode: G.mode, diff: G.diff, depth: G.depth, seed: G.floorSeed, at: Date.now(),
    runTime: G.runTime, runTags: G.runTags, floorTime: G.floorTime,
    p: { x: player.pos.x, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, tags: player.tags, battery: player.battery, stamina: player.stamina,
      adrenaline: player.adrenaline, light: player.lightOn, crouch: player.crouch, locker: player.hidden ? B.lockers.indexOf(player.hidden) : -1 },
    lift: { inserted: B.lift.inserted, phase: G.lift.phase === 'opening' ? 'open' : G.lift.phase },
    corpses: B.corpses.map((c) => (c.harvested ? -1 : c.progress)),
    pickups: B.pickups.map((p) => (p.taken ? 1 : 0)),
    hunters: G.hunters.map((h) => [h.pos.x, h.pos.z, h.yaw]),
    puzzles: G.puzzles.save(),
    shown: [...guide.shown],
  };
}
function saveSnapshot() {
  const s = snapshot();
  if (!s) return;
  save.snap = s;
  writeSave();
}
function restoreSnapshot(s) {
  const B = G.B;
  G.runTime = s.runTime;
  G.runTags = s.runTags;
  G.floorTime = s.floorTime;
  s.corpses.forEach((v, i) => {
    const c = B.corpses[i];
    if (!c) return;
    if (v === -1) {
      c.harvested = true;
      c.tag.visible = false;
      c.cavity.scale.multiplyScalar(1.35);
      c.pool.scale.setScalar(1.4);
      c.flies.visible = false;
      if (G.flies[i]) { G.flies[i].stop(); G.flies[i] = null; }
    } else c.progress = v;
  });
  s.pickups.forEach((t, i) => { const p = B.pickups[i]; if (p && t) { p.taken = true; p.obj.visible = false; } });
  B.lift.inserted = s.lift.inserted;
  B.lift.lights.forEach((l, i) => { if (i < B.lift.inserted) l.material.color.setHex(0xff3a10); });
  G.puzzles.load(s.puzzles);
  Object.assign(player, { yaw: s.p.yaw, pitch: s.p.pitch, tags: s.p.tags, battery: s.p.battery, stamina: s.p.stamina, adrenaline: s.p.adrenaline, lightOn: s.p.light, crouch: s.p.crouch });
  player.pos.set(s.p.x, 0, s.p.z);
  const lk = B.lockers[s.p.locker];
  if (lk) player.pos.set(lk.pos.x + lk.facing.x * 0.75, 0, lk.pos.z + lk.facing.z * 0.75); // you were hiding: you're right outside it
  s.hunters.forEach(([x, z, yaw], i) => { const h = G.hunters[i]; if (h) { h.pos.set(x, 0, z); h.yaw = yaw; h.obj.position.copy(h.pos); } });
  guide.shown = new Set(s.shown);
  player.inLift = inAlcove();
}
addEventListener('pagehide', saveSnapshot);
addEventListener('beforeunload', saveSnapshot);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveSnapshot(); });

function toMenu() {
  G.state = 'menu';
  refreshMenu();
  audio.setMode('menu');
  audio.setDepth(0); // the menu drone at its own pitch, however deep you got
  audio.siren(false);
  audio.lineRunning(false);
  UI.only('menu');
  audio.setChase(0);
  audio.setBreath(0, 1);
  audio.setMuffle(false);
  audio.liftMotor(false);
  UI.$('fade').classList.remove('on');
  UI.$('slits').classList.remove('on');
  blood.clear();
  if (G.B) { disposeLevel(); G.B = null; }
}

// ---------- interaction ----------
const CUT_LINES = [
  'The tag is behind the sternum. It comes out warm.',
  'He swallowed it. You go in after it.',
  'Something gives with a wet snap. The tag is yours.',
  'You find it lodged in the throat, still on its chain.',
  'You pull it out of the stomach lining. Don’t think about it.',
  'The eyes are open the whole time. You can feel them.',
];

function findInteract() {
  const B = G.B, D = G.D;
  if (player.hidden) return { type: 'unhide' };
  if (inAlcove() && G.lift.phase === 'open') {
    if (player.tags > 0) return { type: 'feed' };
    if (B.lift.inserted >= D.tags && G.puzzles.ready) return { type: 'lever' };
    return { type: 'liftInfo' };
  }
  // whatever you're looking at most directly wins
  let best = null, bs = -1e9;
  const consider = (it, pos, d, range, minFacing, bonus = 0) => {
    if (d > range) return;
    const f = it.p && it.p.aim ? player.facingDot(pos) : d < 0.6 && it.type !== 'locker' ? 1 : player.flatFacing(pos);
    if (f < minFacing) return;
    const score = f * 2 - d * 0.4 + bonus;
    if (score > bs) { bs = score; best = it; }
  };
  for (const c of B.corpses) if (!c.harvested) consider({ type: 'corpse', c }, c.pos, Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z), 1.8, 0.4, 0.6);
  for (const p of B.pickups) if (!p.taken) consider({ type: p.type, p }, p.pos, Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z), 1.5, 0.6);
  for (const lk of B.lockers) {
    const fx = lk.pos.x + lk.facing.x * 0.6, fz = lk.pos.z + lk.facing.z * 0.6;
    consider({ type: 'locker', lk }, lk.pos, Math.hypot(fx - player.pos.x, fz - player.pos.z), 0.95, 0.4);
  }
  for (const p of G.puzzles.interactables()) consider({ type: 'puzzle', p }, p.pos, Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z), p.range, p.minFacing, 0.3);
  return best;
}

function handleInteract(dt) {
  // the E that closes the keypad mustn't also reopen it
  if (UI.keypad.isOpen) G.kpCool = 0.3; else G.kpCool = (G.kpCool || 0) - dt;
  if (UI.keypad.isOpen || G.kpCool > 0) { UI.prompt(null); G.holdT = 0; return; }
  const it = findInteract(), B = G.B, D = G.D;
  const holdE = keys.has('KeyE'), tapE = tapped('KeyE');
  if (!it) { UI.prompt(null); G.holdT = 0; G.holdId = null; return; }
  // holding E on one thing and drifting onto another must not carry the progress over
  const id = (it.type === 'puzzle' ? it.p.pos : it.c || it.p || it.lk) || it.type; // puzzle entries are rebuilt each frame; their positions aren't
  if (id !== G.holdId) { G.holdId = id; G.holdT = 0; }
  const hold = (secs, label, done) => {
    if (holdE) G.holdT += dt / secs; else G.holdT = Math.max(0, G.holdT - dt * 2);
    UI.prompt(label, Math.min(1, G.holdT));
    if (G.holdT >= 1) { G.holdT = 0; done(); }
  };
  switch (it.type) {
    case 'corpse': {
      const c = it.c;
      if (holdE) {
        c.progress += dt / 2.6;
        G.cutT -= dt;
        if (G.cutT < 0) {
          G.cutT = 0.32 + Math.random() * 0.25;
          audio.squelch(0.9);
          blood.splash(0.25, true);
          player.shake = Math.max(player.shake, 0.22);
          G.noise(c.pos, 9.5, false, 'cut');
        }
        player.vel.multiplyScalar(0.8);
      }
      UI.prompt('<kbd>E</kbd>&nbsp; HOLD — CUT OUT THE TAG', Math.min(1, c.progress));
      if (c.progress >= 1) harvest(c);
      break;
    }
    case 'battery':
      UI.prompt('<kbd>E</kbd>&nbsp; TAKE THE BATTERY');
      if (tapE) {
        it.p.taken = true;
        it.p.obj.visible = false;
        player.battery = Math.min(100, player.battery + 45);
        audio.pickup();
        UI.message('A battery. Still has some life in it.', 2);
      }
      break;
    case 'adrenaline':
      UI.prompt('<kbd>E</kbd>&nbsp; TAKE THE SYRINGE');
      if (tapE) {
        it.p.taken = true;
        it.p.obj.visible = false;
        player.adrenaline++;
        audio.pickup();
        UI.message('A syringe of something red. Press R when you need to run and keep running.', 3);
      }
      break;
    case 'puzzle': {
      const p = it.p;
      if (p.hold) {
        if (holdE && p.tick) {
          G.cutT -= dt;
          if (G.cutT < 0) {
            G.cutT = 0.35 + Math.random() * 0.2;
            if (p.tick === 'squelch') { audio.squelch(0.7); blood.splash(0.15, true); }
            else if (p.tick === 'screech') audio.creak(p.pos);
            else audio.clank(p.pos, 0.4);
            if (p.noise) G.noise(p.pos, p.noise, false, 'work');
          }
        }
        hold(p.hold, '<kbd>E</kbd>&nbsp; ' + p.label, p.use);
      } else if (p.use && p.tap !== false) {
        UI.prompt('<kbd>E</kbd>&nbsp; ' + p.label);
        if (tapE) p.use();
      } else UI.prompt(p.label);
      break;
    }
    case 'locker':
      UI.prompt('<kbd>E</kbd>&nbsp; HIDE');
      if (tapE) hide(it.lk);
      break;
    case 'unhide':
      UI.prompt('<kbd>E</kbd>&nbsp; GET OUT');
      if (tapE) unhide();
      break;
    case 'feed':
      hold(1, '<kbd>E</kbd>&nbsp; HOLD — FEED THE TAGS TO THE LIFT', () => {
        B.lift.inserted += player.tags;
        player.tags = 0;
        B.lift.lights.forEach((l, i) => { if (i < B.lift.inserted) l.material.color.setHex(0xff3a10); });
        audio.clank(B.lift.pos, 0.8);
        audio.squelch(0.6);
        UI.message(B.lift.inserted >= D.tags ? 'The slot swallows them with a wet, hungry sound. The lever unlocks.' : `The slot swallows them. It wants ${D.tags - B.lift.inserted} more.`, 3.5);
      });
      break;
    case 'lever':
      hold(0.8, G.D.finale ? '<kbd>E</kbd>&nbsp; HOLD \u2014 PULL THE LEVER. GO UP.' : '<kbd>E</kbd>&nbsp; HOLD \u2014 PULL THE LEVER', () => {
        G.lift = { phase: 'closing', t: 0 };
        B.lift.lever.rotation.z = -0.6;
        B.gate.off = false;
        audio.gateSlide(B.lift.pos);
        G.noise(B.lift.pos, 26, true); // everything on the floor hears that
        UI.message('The gate starts to come down. Slowly. Too slowly.', 3);
      });
      break;
    case 'liftInfo': {
      const left = D.tags - B.lift.inserted, blocker = G.puzzles.blocker();
      UI.prompt(left > 0 ? `THE LIFT WANTS ${left} MORE TAG${left === 1 ? '' : 'S'}` : blocker ? blocker.liftMsg() : '');
      break;
    }
  }
}

function harvest(c) {
  c.harvested = true;
  c.tag.visible = false;
  c.cavity.scale.multiplyScalar(1.35);
  c.pool.scale.setScalar(1.4);
  c.flies.visible = false;
  const i = G.B.corpses.indexOf(c);
  if (G.flies[i]) { G.flies[i].stop(); G.flies[i] = null; }
  audio.tear();
  audio.crack();
  blood.splash(0.7, true);
  player.shake = 0.5;
  player.tags++;
  G.runTags++;
  G.noise(c.pos, 12, true, 'cut');
  if (G.runTags === 1) director.queue('face', 6 + Math.random() * 5);
  const got = G.B.lift.inserted + player.tags;
  if (got >= G.D.tags) {
    // the last one: and now he knows exactly where you are
    UI.message('That’s all of them. Get back to the lift.', 4);
    setTimeout(() => {
      if (G.state !== 'play') return;
      audio.chime();
      setTimeout(() => G.state === 'play' && UI.pa('THE LINE IS SHORT ONE WORKER. FOREMAN TO THE FLOOR.'), 1300);
      for (const h of G.hunters) if (h.state !== 'chase') h.hear({ pos: player.pos.clone(), radius: 999, loud: false });
    }, 2500);
  } else UI.message(CUT_LINES[(Math.random() * CUT_LINES.length) | 0], 3.5);
}

function hide(lk) {
  player.hidden = lk;
  player.hiddenSeenBy = new Set(G.hunters.filter((h) => h.seesPlayer || (h.state === 'chase' && h.pos.distanceTo(player.pos) < 4)));
  player.yaw = lk.camYaw;
  player.pitch = 0;
  player.breath = 100;
  lk.obj.userData.door.visible = false;
  UI.$('slits').classList.add('on');
  audio.setMuffle(true);
  audio.lockerClose(lk.pos);
  G.noise(lk.pos, 2.5, false, 'locker');
}
function unhide() {
  const lk = player.hidden;
  player.hidden = null;
  player.pos.set(lk.pos.x + lk.facing.x * 0.75, 0, lk.pos.z + lk.facing.z * 0.75);
  lk.obj.userData.door.visible = true;
  lk.open = 1;
  lk.target = 0;
  UI.$('slits').classList.remove('on');
  audio.setMuffle(false);
  audio.lockerOpen(lk.pos);
  G.noise(lk.pos, 5, false, 'locker');
}

// ---------- the lift ----------
function updateLift(dt) {
  const B = G.B, lf = G.lift, lift = B.lift, top = WALL_H - 0.25;
  lf.t += dt;
  player.inLift = inAlcove();
  switch (lf.phase) {
    case 'opening':
      lift.bars.position.y = Math.min(1, lf.t / 2.4) * top;
      if (lf.t > 1.6) { B.gate.off = true; G.liftSealed = false; }
      if (lf.t > 2.4) lf.phase = 'open';
      break;
    case 'closing': {
      lift.bars.position.y = (1 - Math.min(1, lf.t / 3)) * top;
      // anything that gets in before the gate is down is in here with you
      for (const h of G.hunters) {
        if (Math.hypot(h.pos.x - lift.pos.x, h.pos.z - lift.pos.z) < 1.15) { startDeath(h, 'lift'); return; }
        if (h.pos.z < lift.pos.z - 0.9 && h.pos.distanceTo(lift.pos) < 2.3 && lf.t < 2.4) {
          h.pos.z = Math.max(h.pos.z, lift.pos.z - 0.5); // squeezed under the gate
        }
      }
      if (!inAlcove()) player.pos.set(lift.pos.x, 0, lift.pos.z + 0.2);
      if (lf.t >= 3) { lf.phase = 'sealed'; lf.t = 0; G.liftSealed = true; audio.clank(lift.pos, 1); }
      break;
    }
    case 'sealed':
      if (lf.t > 0.8 && !lf.motor) { lf.motor = true; audio.liftMotor(true); UI.message(G.D.finale ? 'It\u2019s moving. It\u2019s going UP.' : 'It\u2019s moving. You\u2019re going down.', 3); }
      if (lf.t > 0.8) player.shake = Math.max(player.shake, 0.3);
      if (lf.t > 2.2) { if (G.D.finale && G.mode === 'story') startEnding(); else nextFloor(); }
      break;
  }
}

// ---------- per-frame world ----------
const _fwd = new THREE.Vector3();
function updateLamps(t) {
  const B = G.B, pp = player.pos;
  const live = [];
  for (const l of B.lamps) {
    let on = 1;
    if (l.state === 'dead') on = 0;
    else if (l.state === 'flicker') {
      const n = Math.sin(t * 13 + l.phase) + Math.sin(t * 7.3 + l.phase * 2) + Math.sin(t * 31 + l.phase * 3);
      on = n > -1.1 ? 1 : 0.04;
    } else if (l.state === 'lift') on = G.lift.phase === 'sealed' ? (Math.random() < 0.7 ? 1 : 0.1) : 0.92 + Math.sin(t * 40) * 0.05;
    if (G.lampKill > 0 && l.state !== 'lift' && Math.abs(l.pos.x - pp.x) + Math.abs(l.pos.z - pp.z) < 28) on = Math.random() < 0.08 ? 1 : 0;
    l.on = on;
    if (l.obj) l.obj.userData.bulb.material = on > 0.5 ? mats.lampOn : mats.lampOff;
    if (on > 0.01) live.push(l);
  }
  live.sort((a, b) => a.pos.distanceToSquared(pp) - b.pos.distanceToSquared(pp));
  player.lit = false;
  lampLights.forEach((light, i) => {
    const l = live[i];
    if (!l) { light.intensity = 0; return; }
    light.position.copy(l.pos);
    light.intensity = l.on * (l.state === 'lift' ? 6 : 13);
    if (l.on > 0.5 && Math.hypot(l.pos.x - pp.x, l.pos.z - pp.z) < 3) player.lit = true;
  });
}

function updateSwingers(dt, t) {
  for (const o of G.B.swingers) {
    const s = o.userData.swing;
    // anything big walking past sets them moving
    for (const h of G.hunters) {
      const d = Math.hypot(h.pos.x - o.position.x, h.pos.z - o.position.z);
      if (d < 0.8 && h.speed > 0.5) { s.v += dt * 3 * Math.sign(Math.sin(h.yaw)); if (Math.random() < dt * 0.8) audio.creak({ x: o.position.x, y: 2.4, z: o.position.z }); }
    }
    const dp = Math.hypot(player.pos.x - o.position.x, player.pos.z - o.position.z);
    if (dp < 0.7) s.v += dt * 2;
    s.v += (-s.a * 4 - s.v * 0.4) * dt + Math.sin(t * 0.7 + s.phase) * 0.004;
    s.a += s.v * dt;
    o.rotation.z = s.a;
    o.rotation.x = s.a * 0.4 * Math.sin(s.phase);
  }
}

function updateLockers(dt) {
  for (const lk of G.B.lockers) {
    lk.open += (lk.target - lk.open) * Math.min(1, dt * (lk.target ? 10 : 6));
    lk.obj.userData.hinge.rotation.y = -lk.open * 1.8;
  }
}

function updateGame(dt, t) {
  const B = G.B;
  G.runTime += dt;
  G.floorTime += dt;
  G.saveT -= dt;
  if (G.saveT < 0) { G.saveT = 4; saveSnapshot(); }
  G.lampKill -= dt;
  G.torchKill -= dt;
  G.slowT -= dt;
  G.frozen = UI.keypad.isOpen;
  const listen = keys.has('KeyQ') && !player.hidden && !G.frozen;
  if (listen !== !!G.listening) { G.listening = listen; audio.setListen(listen); }
  player.update(dt, G);
  for (const h of G.hunters) h.update(dt, t);
  if (G.state !== 'play') return; // a hunter may have just killed you
  updateLift(dt);
  if (G.state !== 'play') return;
  handleInteract(dt);
  G.puzzles.update(dt);
  guide.update(dt);
  director.update(dt);
  updateLamps(t);
  updateSwingers(dt, t);
  updateLockers(dt);
  for (const c of B.corpses) if (!c.harvested && c.pos.distanceToSquared(player.pos) < 200) animateFlies(c.flies, t);

  // fear: how close it is, whether it can see you, whether it's running
  let near = 99, chase = false, nearH = null;
  for (const h of G.hunters) {
    const d = h.pos.distanceTo(player.pos);
    if (d < near) { near = d; nearH = h; }
    if (h.state === 'chase') chase = true;
  }
  let f = Math.max(0, Math.min(1, 1 - (near - 2) / 16));
  if (nearH && !lineOfSight(G.L, nearH.pos.x, nearH.pos.z, player.pos.x, player.pos.z)) f *= 0.55;
  if (chase) f = Math.max(f, 0.75);
  G.scare = Math.max(0, G.scare - dt * 0.35);
  G.fear += (Math.max(f, G.scare) - G.fear) * Math.min(1, dt * 2.5);
  audio.setChase(chase ? 1 : 0);
  // the line has stopped: they know exactly where you are, all the time
  if (G.frenzy) {
    G.frenzyT -= dt;
    if (G.frenzyT < 0) {
      G.frenzyT = 0.7;
      for (const h of G.hunters) if (!['chase', 'attack', 'recover', 'grab', 'locker'].includes(h.state)) h.hear({ pos: player.pos.clone(), radius: 999, loud: true });
    }
  }

  // hiding: it can hear you breathe
  if (player.hidden) {
    const close = G.hunters.filter((h) => h.pos.distanceTo(player.pos) < 7 && h.state !== 'grab');
    player.breathUrgent = close.length > 0;
    audio.setMuffle(true);
    for (const h of close) {
      if (!player.holding && h.pos.distanceTo(player.pos) < 4.5 && h.state !== 'locker' && Math.random() < dt * 0.45 * (DIFFS[G.diff] || DIFFS.normal).hear) {
        h.lockerTarget = player.hidden;
        h.setState('locker');
        audio.sniff(h.pos);
      }
    }
    audio.setBreath(player.holding ? 0 : 0.5 + G.fear * 0.5, 0.7);
  }

  // heartbeat
  G.hb -= dt;
  if (G.hb < 0 && (chase || G.fear > 0.12)) {
    // chased: nothing but your heart, loud and fast
    if (chase) { audio.heartbeat(1, true); G.hb = 60 / (150 + Math.max(0, 8 - near) * 4); }
    else { audio.heartbeat((0.12 + G.fear * 0.6) * (player.hidden ? 1.5 : 1)); G.hb = 60 / (62 + G.fear * 90); }
  }

  audio.ambienceTick(dt, player.pos);
  audio.listen(camera.position, player.forward(_fwd));
  UI.stamina(player.stamina, player.exhausted, player.boostT > 0);
  UI.hud({
    floor: `${G.info.label} · ${G.info.name}`, have: player.tags, fed: B.lift.inserted, need: G.D.tags, battery: player.battery,
    breath: player.breath, hidden: !!player.hidden, breathUrgent: player.breathUrgent, adrenaline: player.adrenaline,
  });
}

// ---------- input ----------
addEventListener('mousemove', (e) => {
  // drag to look if the browser won't give us pointer lock
  if (G.state === 'play' && (document.pointerLockElement === canvas || e.buttons)) player.look(e.movementX, e.movementY);
});
canvas.addEventListener('click', () => { if (G.state === 'play' && document.pointerLockElement !== canvas) lockPointer(); });
addEventListener('blur', () => { if (G.state === 'play') pause(); }); // alt-tabbed away: the shift waits
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && G.state === 'play') pause();
});
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && G.state === 'paused' && !UI.$('settings').classList.contains('on')) resume();
  if (e.code === 'KeyP' && G.state === 'play') pause();
});

// Ctrl+W, Ctrl+R and friends close or reload the window. In fullscreen we can claim the keyboard so they
// can't; otherwise the browser at least asks before throwing a shift away.
addEventListener('beforeunload', (e) => { if (['play', 'paused', 'transition', 'dying'].includes(G.state)) { e.preventDefault(); e.returnValue = ''; } });
document.addEventListener('fullscreenchange', () => {
  // only the letter keys: Ctrl+W/R/T/N/Q can't close the window, but Alt+Tab, the Windows key and Esc stay yours
  const LOCK = ['KeyW', 'KeyR', 'KeyT', 'KeyN', 'KeyQ', 'KeyF', 'KeyS', 'KeyP', 'KeyH', 'KeyD', 'KeyG', 'KeyA', 'KeyE', 'KeyC'];
  try { if (document.fullscreenElement && navigator.keyboard) navigator.keyboard.lock(LOCK); else if (navigator.keyboard) navigator.keyboard.unlock(); } catch {}
});
// fullscreen: F11, the menu and pause buttons, or the setting (which also puts you there on your first click)
function setFullscreen(on) {
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch {}
}
function syncFullscreenUI() {
  const on = !!document.fullscreenElement;
  document.querySelectorAll('[data-act=fullscreen]').forEach((b) => (b.textContent = on ? 'Exit fullscreen' : 'Fullscreen'));
  UI.$('fullscreen').checked = on;
}
document.addEventListener('fullscreenchange', () => {
  syncFullscreenUI();
  setTimeout(resize, 50);
});
addEventListener('keydown', (e) => {
  if (e.code === 'F11') { e.preventDefault(); setFullscreen(!document.fullscreenElement); }
  // browser shortcuts we can still swallow outside fullscreen (find, save, print, history)
  if ((e.ctrlKey || e.metaKey) && ['KeyF', 'KeyS', 'KeyP', 'KeyH', 'KeyD', 'KeyG'].includes(e.code) && G.state === 'play') e.preventDefault();
});

function pause() {
  G.state = 'paused';
  saveSnapshot();
  G.listening = false;
  audio.setListen(false);
  UI.only('pause', 'hud');
  audio.setChase(0);
  audio.setBreath(0, 1);
  if (audio.ctx) audio.ctx.suspend();
}
function resume() {
  UI.only('hud');
  if (player.hidden) UI.$('slits').classList.add('on');
  G.state = 'play';
  if (audio.ctx) audio.ctx.resume();
  lockPointer();
}

let settingsFrom = 'menu';
let diffIntent = { mode: 'story', fresh: true };
function pickDifficulty(mode, fresh) {
  diffIntent = { mode, fresh };
  UI.$('diffTitle').textContent = mode === 'story' ? 'HOW HARD IS THIS SHIFT?' : 'OVERTIME: HOW HARD?';
  for (const el of document.querySelectorAll('[data-diff]')) el.classList.toggle('last', el.dataset.diff === (save.settings.lastDiff || 'normal'));
  UI.only('difficulty');
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  audio.tick();
  const act = b.dataset.act;
  if (act === 'story') {
    if (save.story.active) startRun('story', false, null, { resume: save.snap && save.snap.mode === 'story' && save.snap.depth === save.story.floor ? save.snap : null });
    else pickDifficulty('story', true);
  }
  else if (act === 'newstory') pickDifficulty('story', true);
  else if (act === 'overtime') pickDifficulty('overtime', false);
  else if (act === 'diff') startRun(diffIntent.mode, diffIntent.fresh, b.dataset.diff);
  else if (act === 'retry') {
    if (G.mode === 'story' && !save.story.active) startRun('story', true, G.diff); // a brand new shift, same difficulty
    else startRun(G.mode, false, G.mode === 'overtime' ? G.diff : null, { floor: G.retryFloor });
  }
  else if (act === 'overtimeContinue' && save.snap) startRun('overtime', false, save.snap.diff, { resume: save.snap });
  else if (act === 'howto') UI.only('howto');
  else if (act === 'settings') { settingsFrom = G.state === 'paused' ? 'pause' : 'menu'; fillSettings(); UI.only('settings', ...(settingsFrom === 'pause' ? ['hud'] : [])); }
  else if (act === 'back') { if (settingsFrom === 'pause' && G.state === 'paused') UI.only('pause', 'hud'); else if (G.state === 'menu' || G.state === 'warn') UI.only('menu'); else toMenu(); settingsFrom = 'menu'; }
  else if (act === 'resume') resume();
  else if (act === 'fullscreen') setFullscreen(!document.fullscreenElement);
  else if (act === 'quit') { if (audio.ctx) audio.ctx.resume(); toMenu(); }
  else if (act === 'menu') toMenu();
});
document.addEventListener('mouseover', (e) => { if (e.target.closest && e.target.closest('.menu-nav button') && audio.ctx) audio.tick(); });

function fillSettings() {
  const s = save.settings;
  UI.$('sens').value = s.sens;
  UI.$('vol').value = s.vol;
  UI.$('gamma').value = s.gamma;
  UI.$('pix').value = String(s.pix);
  UI.$('shake').checked = s.shake;
  for (const id of ['fov', 'beam', 'power']) UI.$(id).value = s[id];
  for (const id of ['invert', 'bob', 'hints']) UI.$(id).checked = s[id];
  syncFullscreenUI();
}
UI.$('fullscreen').addEventListener('input', () => {
  save.settings.fullscreen = UI.$('fullscreen').checked;
  writeSave();
  setFullscreen(save.settings.fullscreen);
});
const CHECKS = ['shake', 'invert', 'bob', 'hints'];
for (const id of ['sens', 'vol', 'gamma', 'pix', 'fov', 'beam', 'power', ...CHECKS]) {
  UI.$(id).addEventListener('input', () => {
    const s = save.settings, el = UI.$(id);
    s[id] = CHECKS.includes(id) ? el.checked : +el.value;
    applySettings();
    writeSave();
  });
}

// ---------- boot ----------
UI.buildDrips();
refreshMenu();
if (matchMedia('(pointer: coarse)').matches) UI.$('mobileNote').textContent = '· keyboard and mouse required';
UI.typewrite(UI.$('warnText'), 'This game contains graphic gore, mutilated bodies, sudden loud noises and flashing images.\n\nPlay it in the dark. Wear headphones.\n\nIf you need to stop, press ESC. The plant will wait for you.', 45);
UI.$('warn').addEventListener('click', () => {
  if (save.settings.fullscreen) setFullscreen(true);
  audio.init();
  applySettings();
  audio.setDepth(0);
  audio.chime();
  audio.setMode('menu');
  G.state = 'menu';
  UI.only('menu');
});
applySettings();

let last = performance.now(), T = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  T += dt;
  post.u.time.value = T;
  switch (G.state) {
    case 'warn':
    case 'menu':
      updateMenu(dt);
      post.render(menu.scene, menu.cam);
      break;
    case 'play':
      updateGame(dt, T);
      break;
    case 'transition':
      updateTransition(dt);
      break;
    case 'dying':
      updateDeath(dt);
      break;
  }
  if (G.state === 'play' || G.state === 'paused' || G.state === 'transition' || G.state === 'dying') {
    G.damage = Math.max(0, G.damage - dt * 1.2);
    G.flash = Math.max(0, G.flash - dt * 3);
    const u = post.u;
    u.fear.value = G.fear;
    u.damage.value = G.damage;
    u.health.value = Math.max(0, player.hp) / 100;
    u.tear.value = Math.max(0, G.fear - 0.55) * 2 + G.scare * 0.6;
    u.flash.value = G.flash;
    u.hidden.value = player.hidden ? 1 : 0;
    u.blackout.value = G.state === 'dying' ? G.blackout : 0;
    u.warm.value = G.cutscene && G.cutscene.fire ? 1 : 0;
    u.health.value = G.state === 'dying' ? 1 : u.health.value;
    if (G.cutscene) post.render(G.cutscene.scene, G.cutscene.cam);
    else if (G.B) post.render(scene, camera);
  }
  blood.update(dt);
  endFrame();
}
requestAnimationFrame(frame);

// debug handle for automated checks
window.__offal = {
  G, player, save, audio, startRun, camera, startDeath, harvest, hide, director, post, keys, findPath, updateTransition, updateDeath, findInteract, handleInteract, nextFloor, startEnding, UI,
  step(dt, n) { for (let i = 0; i < n && G.state === 'play'; i++) { T += dt; updateGame(dt, T); endFrame(); } return G.state; },
};
