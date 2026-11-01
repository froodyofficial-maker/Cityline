// HOLLOW PARK: boot, 3D loading screen, main menu, settings, input, main loop.
import * as THREE from 'three';
import { G, runTimers, W3, clamp, R } from './state.js';
import { buildWorld } from './world.js';
import { createPlayer, keys, addMouse } from './player.js';
import { createMonster, animateModel, newAnim } from './monster.js';
import { buildCreature } from './organic.js';
import { createEvents } from './events.js';
import { createPost, QUALITY } from './post.js';
import * as AU from './audio.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
const store = { get(k, d) { try { const v = localStorage.getItem('hollowpark.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('hollowpark.' + k, JSON.stringify(v)); } catch (e) { } } };

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(1.25, devicePixelRatio || 1)); renderer.setSize(innerWidth, innerHeight, false);
$('view').appendChild(renderer.domElement);
G.renderer = renderer;
G.brightness = store.get('bright', 1); G.state = 'loading';

// =====================================================================
// the loading screen: one park lamp in the fog, a swing, and him
// =====================================================================
const LS = (() => {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070b); scene.fog = new THREE.FogExp2(0x05070b, 0.06);
  const cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0x223048, 0x080604, 0.6));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ color: 0x1a2416, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 40), new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.35 })); path.rotation.x = -Math.PI / 2; path.position.set(0, 0.005, 0); path.receiveShadow = true; scene.add(path);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3c3e, roughness: 0.5, metalness: 0.8 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 12), metal); pole.position.set(1.6, 2.1, 0); pole.castShadow = true; scene.add(pole);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffb070 }); const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), bulbMat); bulb.position.set(1.6, 4.25, 0); scene.add(bulb);
  const lamp = new THREE.SpotLight(0xffa860, 320, 24, 0.95, 0.55, 2); lamp.position.set(1.6, 4.2, 0); lamp.target.position.set(0.6, 0, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); scene.add(lamp); scene.add(lamp.target);
  const red = new THREE.MeshStandardMaterial({ color: 0x7a1a14, roughness: 0.5, metalness: 0.3 });
  const frame = new THREE.Group(); frame.position.set(-1.8, 0, -1.2); frame.rotation.y = 0.4; scene.add(frame);
  for (const s of [-1, 1]) for (const k of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.7, 0.08), red); l.position.set(s * 1.0, 1.3, k * 0.5); l.rotation.x = k * 0.22; l.castShadow = true; frame.add(l); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 0.1), red); top.position.y = 2.62; top.castShadow = true; frame.add(top);
  const swing = new THREE.Group(); swing.position.set(0, 2.58, 0); frame.add(swing);
  for (const s of [-0.22, 0.22]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.95, 4), metal); c.position.set(s, -0.97, 0); swing.add(c); }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111 })); seat.position.y = -1.95; seat.castShadow = true; swing.add(seat);
  const him = buildCreature(); const anim = newAnim(); him.root.position.set(3.2, 0, -3.0); him.root.rotation.y = -0.9; scene.add(him.root); anim.tilt = 1.0; anim.jawOpen = 0.04;
  // leaves drifting through the light
  const N = 160, lp = new Float32Array(N * 3); for (let i = 0; i < N; i++) { lp[i * 3] = (R() - 0.5) * 14; lp[i * 3 + 1] = R() * 6; lp[i * 3 + 2] = (R() - 0.5) * 14; }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ color: 0x8a6a3a, size: 0.06 })));
  let t = 0, flick = 0, on = true;
  return {
    scene, cam,
    update(dt) {
      t += dt;
      cam.position.set(-6 + Math.sin(t * 0.05) * 0.8, 1.7 + Math.sin(t * 0.3) * 0.05, 6.5 - t * 0.04 % 1.5); cam.lookAt(1.2, 1.5, -1.5);
      swing.rotation.x = Math.sin(t * 1.5) * 0.35;
      flick -= dt; if (flick < 0) { on = !on; flick = on ? 0.6 + R() * 3 : 0.05 + R() * 0.25; if (!on) { him.root.visible = R() < 0.6; him.root.position.x = 2.6 + R() * 1.6; } }
      lamp.intensity = on ? 320 : 6; bulbMat.color.setHex(on ? 0xffb070 : 0x221408);
      for (let i = 0; i < N; i++) { lp[i * 3 + 1] -= dt * 0.3; lp[i * 3] += Math.sin(t + i) * dt * 0.2; if (lp[i * 3 + 1] < 0) lp[i * 3 + 1] = 6; } lg.attributes.position.needsUpdate = true;
      animateModel(him, anim, dt);
    },
  };
})();
const loading = { label: 'Starting', frac: 0, shown: 0 };
function progress(label, frac) { loading.label = label; loading.frac = Math.max(loading.frac, frac); }

// =====================================================================
// the world
// =====================================================================
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.FogExp2(0x080b12, 0.034);
const camera = new THREE.PerspectiveCamera(store.get('fov', 72), innerWidth / innerHeight, 0.05, 600); scene.add(camera);
G.scene = scene; G.camera = camera;
// the night sky: gradient, stars, a low moon, thin cloud
const MOON_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize();
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uMoon: { value: MOON_DIR }, uTime: { value: 0 } },
  vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
  fragmentShader: `uniform vec3 uMoon; uniform float uTime; varying vec3 vDir;
    float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
    float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
    void main(){
      vec3 d = normalize(vDir); float y = max(d.y, 0.0);
      vec3 col = mix(vec3(0.045,0.055,0.08), vec3(0.008,0.01,0.02), pow(y, 0.5));
      vec3 sp = floor(d*420.0); float s = h(sp); col += vec3(0.8,0.85,1.0) * step(0.9975, s) * smoothstep(0.0, 0.25, y) * (0.5+0.5*sin(uTime*2.0+s*90.0));
      float m = dot(d, uMoon); col += vec3(0.85,0.88,0.95) * smoothstep(0.9993, 0.9996, m); col += vec3(0.25,0.3,0.42) * pow(max(m,0.0), 60.0) * 0.6 + vec3(0.1,0.12,0.2)*pow(max(m,0.0), 6.0)*0.25;
      float c = n3(d*6.0 + vec3(uTime*0.01,0,0)) * 0.6 + n3(d*13.0) * 0.4; col = mix(col, vec3(0.05,0.055,0.07), smoothstep(0.55, 0.85, c) * 0.8 * smoothstep(0.0,0.2,y));
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
sky.frustumCulled = false; scene.add(sky);
scene.add(new THREE.HemisphereLight(0x2a3a58, 0x0a0806, 0.5));
scene.add(new THREE.AmbientLight(0x1a2030, 0.35));
const moon = new THREE.DirectionalLight(0x9fb4e0, 0.55); moon.castShadow = true; moon.shadow.bias = -0.0006; moon.shadow.normalBias = 0.03;
Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 }); scene.add(moon); scene.add(moon.target);
G.onQuality = (q) => { moon.castShadow = q.moonShadow; moon.shadow.mapSize.set(q.shadow, q.shadow); moon.shadow.map?.dispose(); moon.shadow.map = null; if (G.player) { G.player.spot.shadow.mapSize.set(Math.min(2048, q.shadow), Math.min(2048, q.shadow)); G.player.spot.shadow.map?.dispose(); G.player.spot.shadow.map = null; } };

let L, P, M, E, post;
async function boot() {
  await new Promise(r => setTimeout(r, 50));
  L = await buildWorld(scene, progress);
  progress('Waking him up', 0.9); await new Promise(r => setTimeout(r, 0));
  P = createPlayer(camera, L); M = createMonster(scene, L); E = createEvents(L, M, P);
  P.sens = store.get('sens', 1);
  post = createPost(renderer, scene, camera); G.post = post; post.setQuality(store.get('quality', autoQuality()));
  progress('Compiling shaders', 0.94); await new Promise(r => setTimeout(r, 0));
  camera.position.copy(W3(30, 10.5, 1.6));
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  progress('Ready', 1);
  window.__hollow = { G, L, P, M, E, animateModel };
}
function autoQuality() { const mobile = /Mobi|Android/i.test(navigator.userAgent); if (mobile) return 'low'; const c = navigator.hardwareConcurrency || 4; return c <= 4 ? 'medium' : 'high'; }
boot().then(() => { loading.done = true; $('loadHint').textContent = 'PRESS ANY KEY'; $('loadHint').classList.add('ready'); }).catch(e => { console.error(e); $('loadLabel').textContent = 'Something went wrong: ' + e.message; });

// =====================================================================
// menus and settings
// =====================================================================
function toMenu() {
  if (G.state !== 'loading' || !loading.done) return;
  AU.initAudio(); AU.setVolume(store.get('vol', 1)); G.state = 'title'; G.black = 1; UI.hide('loading'); UI.show('menu');
}
addEventListener('keydown', () => toMenu()); addEventListener('mousedown', () => toMenu());
function sync() {
  document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('sel', b.dataset.q === (post ? post.quality : store.get('quality', 'high'))));
  document.querySelectorAll('input[data-set]').forEach(el => { el.value = store.get(el.dataset.set, +el.defaultValue); });
}
document.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { store.set('quality', b.dataset.q); post?.setQuality(b.dataset.q); sync(); }));
document.querySelectorAll('input[data-set]').forEach(el => el.addEventListener('input', () => {
  const k = el.dataset.set, v = +el.value; store.set(k, v);
  if (k === 'bright') G.brightness = v; if (k === 'sens' && P) P.sens = v; if (k === 'fov') { camera.fov = v; camera.updateProjectionMatrix(); } if (k === 'vol') AU.setVolume?.(v);
  document.querySelectorAll(`input[data-set="${k}"]`).forEach(o => { if (o !== el) o.value = el.value; });
}));
sync();
document.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); const p = $(b.dataset.open); if (p) p.classList.remove('hidden'); }));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.panel').classList.add('hidden')));

const lock = () => { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } };
const locked = () => document.pointerLockElement === renderer.domElement;
$('newgame').addEventListener('click', () => {
  AU.initAudio(); UI.hide('menu'); document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); UI.show('hud');
  G.state = 'play'; G.time = 0; P.flashOn = false; lock(); E.begin();
});
$('resume').addEventListener('click', () => { lock(); setTimeout(() => { if (G.state === 'paused' && !locked()) { G.state = 'play'; UI.hide('pause'); AU.resume(); } }, 300); });
$('quit').addEventListener('click', () => location.reload());
$('death').addEventListener('click', () => { E.respawn(); lock(); });
$('end').addEventListener('click', () => location.reload());

addEventListener('keydown', (e) => {
  if (e.code === 'Tab') e.preventDefault();
  keys[e.code] = true; if (e.repeat) return;
  if (G.state === 'play') { if (e.code === 'KeyF') P.setFlash(!P.flashOn); if (e.code === 'KeyE') P.interact(); if (e.code === 'Tab') UI.peekObjective(); }
  else if (G.state === 'note') { if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') E.closeNote(); }
  else if (G.state === 'dead' && (e.code === 'Space' || e.code === 'Enter')) { E.respawn(); lock(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('mousemove', (e) => { if (locked()) addMouse(e.movementX, e.movementY); });
renderer.domElement.addEventListener('mousedown', () => { if (G.state === 'play' && !locked()) lock(); else if (G.state === 'note') E.closeNote(); });
document.addEventListener('pointerlockchange', () => {
  if (!locked() && (G.state === 'play' || G.state === 'note')) { if (G.state === 'note') E.closeNote(); G.state = 'paused'; UI.show('pause'); AU.suspend(); for (const k in keys) keys[k] = false; sync(); }
  else if (locked() && G.state === 'paused') { G.state = 'play'; UI.hide('pause'); document.querySelectorAll('.panel').forEach(p => p.classList.add('hidden')); AU.resume(); }
});
addEventListener('resize', () => { for (const c of [camera, LS.cam]) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); } if (post) post.resize(); else renderer.setSize(innerWidth, innerHeight, false); });

// the menu background: drifting down the path from the gate toward the playground
let titleT = 0;
function titleCam(dt) {
  titleT += dt; const u = (titleT * 0.012) % 1;
  const a = W3(24, 10.5), b = W3(36, 10.5), p = a.clone().lerp(b, u);
  camera.position.set(p.x, 1.6 + Math.sin(titleT * 0.6) * 0.03, p.z + Math.sin(titleT * 0.1) * 0.6);
  camera.rotation.set(0.02, -Math.PI / 2 - 0.25 + Math.sin(titleT * 0.07) * 0.3, 0, 'YXZ');
  P.spot.intensity = 0; G.fear = 0.15; G.black = Math.max(0, G.black - dt * 0.6);
}

// =====================================================================
// loop
// =====================================================================
let last = performance.now(), slow = 0, fast = 0;
const fwd = new THREE.Vector3();
function runUpdaters(dt) { for (const u of L.updaters) u(dt); const list = G.updaters; G.updaters = []; const keep = list.filter(f => !f(dt)); G.updaters = keep.concat(G.updaters); }
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now; G.dt = dt;
  if (G.state === 'loading') {
    LS.update(dt); renderer.setRenderTarget(null); renderer.render(LS.scene, LS.cam);
    loading.shown += (loading.frac - loading.shown) * Math.min(1, dt * 6);
    $('loadFill').style.width = (loading.shown * 100).toFixed(1) + '%'; $('loadLabel').textContent = loading.label; $('loadPct').textContent = Math.round(loading.shown * 100) + '%';
    return;
  }
  if (G.state === 'title') { titleCam(dt); G.time += dt; for (const u of L.updaters) u(dt); }
  else if (G.state === 'play') { G.time += dt; G.playTime += dt; runTimers(); P.update(dt); M.update(dt); E.update(dt); runUpdaters(dt); UI.hud(P); }
  else if (G.state === 'dying') { G.time += dt; E.updateDeath(dt); runUpdaters(dt); }
  else if (G.state === 'ending') { G.time += dt; E.updateEnding(dt); runUpdaters(dt); }
  // the moon's shadow follows you around
  moon.target.position.copy(camera.position); moon.position.copy(camera.position).addScaledVector(MOON_DIR, 70);
  sky.position.copy(camera.position); sky.material.uniforms.uTime.value = G.time;
  camera.getWorldDirection(fwd); AU.setListener(camera.position, fwd); AU.updateAudio(dt, M.active && M.state === 'chase' && G.state === 'play');
  // adaptive resolution: hold the frame rate
  if (dt > 1 / 38) { slow += dt; fast = 0; } else if (dt < 1 / 57) { fast += dt; slow = 0; }
  if (slow > 2 && (G.dynScale || 1) > 0.6) { G.dynScale = (G.dynScale || 1) - 0.1; slow = 0; post.resize(); }
  if (fast > 4 && (G.dynScale || 1) < 1) { G.dynScale = Math.min(1, (G.dynScale || 1) + 0.1); fast = 0; post.resize(); }
  post.render(dt);
}
requestAnimationFrame(frame);
