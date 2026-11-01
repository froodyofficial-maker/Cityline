// MARROW: entry point, input, main loop.
import * as THREE from 'three';
import { G, runTimers, W3, clamp } from './state.js';
import { buildLevel } from './level.js';
import { createPlayer, keys, addMouse } from './player.js';
import { createMonster, animateModel } from './monster.js';
import { createEvents } from './events.js';
import { createPost } from './post.js';
import * as AU from './audio.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('vespers.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('vespers.' + k, JSON.stringify(v)); } catch (e) { } } };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
$('view').appendChild(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000000); scene.fog = new THREE.FogExp2(0x000000, 0.052);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 70); scene.add(camera);
scene.add(new THREE.AmbientLight(0x2a3238, 2.4));
scene.add(new THREE.HemisphereLight(0x1a2228, 0x140806, 1.0));
G.scene = scene; G.camera = camera; G.renderer = renderer;

const L = buildLevel(scene);
const P = createPlayer(camera, L);
const M = createMonster(scene, L);
const E = createEvents(L, M, P);
const post = createPost(renderer); G.post = post;
G.brightness = store.get('bright', 1); P.sens = store.get('sens', 1);
post.setScale(store.get('scale', 3));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.resize(); });

// ---------- settings widgets ----------
function bindRange(id, key, apply) { document.querySelectorAll(`input[data-set="${key}"]`).forEach(el => { el.value = store.get(key, +el.value); el.addEventListener('input', () => { store.set(key, +el.value); apply(+el.value); document.querySelectorAll(`input[data-set="${key}"]`).forEach(o => { if (o !== el) o.value = el.value; }); }); }); }
bindRange('bright', 'bright', v => { G.brightness = v; });
bindRange('sens', 'sens', v => { P.sens = v; });
document.querySelectorAll('[data-scale]').forEach(b => {
  const sync = () => document.querySelectorAll('[data-scale]').forEach(o => o.classList.toggle('sel', +o.dataset.scale === store.get('scale', 3)));
  b.addEventListener('click', () => { store.set('scale', +b.dataset.scale); post.setScale(+b.dataset.scale); sync(); }); sync();
});
// calibration symbol: should be barely visible
{ const c = $('calib'), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#0b0b0b'; x.font = 'bold 54px serif'; x.textAlign = 'center'; x.fillText('☠', c.width / 2, c.height / 2 + 18);
  const upd = () => { c.style.filter = `brightness(${0.4 + G.brightness * 2.4}) contrast(1.1)`; }; upd(); document.querySelectorAll('input[data-set="bright"]').forEach(el => el.addEventListener('input', upd)); }

// ---------- input ----------
const lock = () => { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } };
const locked = () => document.pointerLockElement === renderer.domElement;
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true;
  if (G.state === 'play') {
    if (e.code === 'KeyF') P.setFlash(!P.flashOn);
    if (e.code === 'KeyE') P.interact();
    if (e.code === 'Tab') UI.peekObjective();
  } else if (G.state === 'note') {
    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') E.closeNote();
  } else if (G.state === 'dead' && (e.code === 'Space' || e.code === 'Enter')) wake();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousemove', (e) => { if (locked()) addMouse(e.movementX, e.movementY); });
renderer.domElement.addEventListener('mousedown', (e) => {
  if (G.state === 'play' && !locked()) { lock(); return; }
  if (G.state === 'note') E.closeNote();
});
document.addEventListener('pointerlockchange', () => {
  if (!locked() && (G.state === 'play' || G.state === 'note')) { if (G.state === 'note') E.closeNote(); G.state = 'paused'; UI.show('pause'); AU.suspend(); for (const k in keys) keys[k] = false; }
  else if (locked() && G.state === 'paused') { G.state = 'play'; UI.hide('pause'); AU.resume(); }
});
$('resume').addEventListener('click', () => { lock(); setTimeout(() => { if (G.state === 'paused' && !locked()) { G.state = 'play'; UI.hide('pause'); AU.resume(); } }, 300); });
$('start').addEventListener('click', () => {
  AU.initAudio(); UI.hide('title'); UI.show('hud'); G.state = 'play'; G.time = 0; lock(); E.begin();
});
function wake() { E.respawn(); lock(); }
$('death').addEventListener('click', wake);
$('end').addEventListener('click', () => location.reload());

// ---------- title camera: drifting through cold storage ----------
let titleT = 0;
function titleCam(dt) {
  titleT += dt;
  // creep slowly between the rows of hanging bodies
  camera.position.set(W3(20.5, 0).x + Math.sin(titleT * 0.05) * 3, 1.55 + Math.sin(titleT * 0.7) * 0.02, W3(0, 7.2 - (titleT * 0.04) % 3.5).z);
  camera.rotation.set(0.05 + Math.sin(titleT * 0.13) * 0.05, Math.sin(titleT * 0.09) * 0.35, 0, 'YXZ');
  P.spot.intensity = 80 * (Math.random() < 0.015 ? 0.2 : 1);
}

// ---------- loop ----------
let last = performance.now();
const fwd = new THREE.Vector3();
function runUpdaters(dt) {
  for (const u of L.updaters) u(dt);
  const list = G.updaters; G.updaters = [];
  const keep = list.filter(f => !f(dt));
  G.updaters = keep.concat(G.updaters);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.dt = dt;
  if (G.state === 'title') { titleCam(dt); G.time += dt; for (const u of L.updaters) u(dt); G.black = Math.max(0, G.black - dt * 0.5); G.fear = 0.15; }
  else if (G.state === 'play') {
    G.time += dt; G.playTime += dt;
    runTimers(); P.update(dt); M.update(dt); E.update(dt); runUpdaters(dt);
    UI.hud(P);
  } else if (G.state === 'dying') { G.time += dt; E.updateDeath(dt); runUpdaters(dt); }
  else if (G.state === 'ending') { G.time += dt; E.updateEnding(dt); runUpdaters(dt); }
  camera.getWorldDirection(fwd);
  AU.setListener(camera.position, fwd);
  AU.updateAudio(dt, M.active && M.state === 'chase' && G.state === 'play');
  post.render(scene, camera);
}
requestAnimationFrame(frame);
$('loading')?.remove();
window.__vespers = { G, L, P, M, E, animateModel };
