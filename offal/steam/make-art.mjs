// Steam store and library art for OFFAL, rendered with the game's own engine and textures.
// Needs Playwright and the dev server: PORT=8090 node tools/serve.mjs, then
//   node offal/steam/make-art.mjs offal/steam [name-prefix]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const out = process.argv[2], only = process.argv[3];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1000, height: 1000 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message + e.stack)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8090/offal/'); await p.waitForTimeout(800);
await p.evaluate(async () => {
  document.querySelectorAll('.screen,#view,#blood,#fade').forEach((e) => (e.style.display = 'none'));
  const THREE = await import('three');
  const { createForemanMesh } = await import('/offal/src/foreman.js');
  const { poseForeman } = await import('/offal/src/monster.js');
  const { makeMaterials } = await import('/offal/src/textures.js');
  const P = await import('/offal/src/props.js');
  const mats = makeMaterials();
  const rngOf = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const smooth = (m, rx, ry) => { const c = m.clone(); for (const k of ['map', 'bumpMap']) if (c[k]) { c[k] = c[k].clone(); c[k].repeat.set(rx, ry); c[k].magFilter = THREE.LinearFilter; c[k].minFilter = THREE.LinearMipmapLinearFilter; c[k].needsUpdate = true; } return c; };
  window.__art = async ({ w, h, fx, fz, camX, camY, camZ, lookY, fov, turn, jaw, mode, gait, twitch, seed, face, lookX }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    r.setSize(w, h, false); r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputColorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Scene(); s.background = new THREE.Color(0x050000); s.fog = new THREE.FogExp2(0x070101, 0.075);
    const rng = rngOf(seed || 7);
    // a corridor on the kill floor: tiled walls, a wet floor, carcasses on hooks both sides
    const L = 30, W = 5, H = 3.2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, L), smooth(mats.floors[1], W / 2, L / 2)); floor.rotation.x = -Math.PI / 2; floor.position.z = -L / 2 + 4; floor.receiveShadow = true; s.add(floor);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), mats.pool[0] || mats.blood); pool.rotation.x = -Math.PI / 2; pool.position.set(fx - 0.3, 0.005, fz + 0.4); s.add(pool);
    for (const sd of [-1, 1]) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), smooth(mats.walls[4 + (sd > 0 ? 3 : 0)] || mats.walls[1], L / 2, 1)); wall.rotation.y = -sd * Math.PI / 2; wall.position.set(sd * W / 2, H / 2, -L / 2 + 4); wall.receiveShadow = true; s.add(wall); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, L), smooth(mats.ceil, W / 2, L / 2)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, -L / 2 + 4); s.add(ceil);
    for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) {
      const z = 2 - i * 2.6 + rng() * 0.8; if (z > camZ - 1.6) continue; if (Math.abs(z - fz) < 1.2 && sd === Math.sign(fx || 1) && Math.abs(fx) > 0.4) continue;
      const cc = P.makeCarcass(mats, rng, rng() < 0.4); cc.position.set(sd * (1.55 + rng() * 0.3), H, z); cc.rotation.y = rng() * 6; cc.rotation.z = (rng() - 0.5) * 0.12;
      cc.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); s.add(cc);
    }
    // light: a dim red emergency lamp deep behind him, a cold work lamp overhead, and your torch
    s.add(new THREE.AmbientLight(0x2a1414, 0.6));
    const back = new THREE.PointLight(0xff2a10, 26, 18, 1.6); back.position.set(0.3, 2.6, fz - 4); s.add(back);
    const back2 = new THREE.PointLight(0xff3a1a, 22, 12, 1.6); back2.position.set(-0.6, 2.8, fz - 10); s.add(back2);
    const lamp = new THREE.SpotLight(0xc8d8e0, 16, 9, 0.8, 0.6, 1.5); lamp.position.set(fx + 0.2, H - 0.1, fz - 1.3); lamp.target.position.set(fx, 1.4, fz); s.add(lamp, lamp.target); lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
    const bulb = P.makeLamp(mats, 'bulb'); bulb.position.set(fx + 0.2, H, fz - 1.3); s.add(bulb);
    const torch = new THREE.SpotLight(0xfff0d8, 75, 16, 0.4, 0.65, 1.4); torch.position.set(camX - 0.7, camY - 0.45, camZ - 0.2); torch.target.position.set(fx, 1.6, fz); torch.castShadow = true; torch.shadow.mapSize.set(2048, 2048); s.add(torch, torch.target);
    // him
    const f = createForemanMesh(mats); f.root.position.set(fx, 0, fz); f.root.rotation.y = turn; s.add(f.root);
    poseForeman(f, { gait: gait || 0, speed: mode === 'chase' ? 4 : 0.6, mode: mode || 'walk', t: 1.3, swing: 0, jawOpen: jaw, twitch: twitch || { x: 0.15, y: 0, z: 0.3, r: 0.15 } });
    f.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const eyeGlow = new THREE.PointLight(0xff2010, 1.5, 0.8, 2); f.head.add(eyeGlow); eyeGlow.position.set(0, 0.05, 0.25);
    const cam = new THREE.PerspectiveCamera(fov, w / h, 0.05, 60); cam.position.set(camX, camY, camZ); cam.lookAt(lookX ?? fx * 0.6, lookY, fz);
    if (face) { // aim at his head, wherever the pose put it
      f.root.updateMatrixWorld(true); const hp = new THREE.Vector3(); f.head.getWorldPosition(hp);
      cam.position.set(hp.x + face.dx, hp.y + face.dy, hp.z + face.dz); cam.lookAt(hp.x + (face.aimX || 0), hp.y + (face.aimY || 0), hp.z);
      torch.position.copy(cam.position).add(new THREE.Vector3(-0.2, 0.1, 0)); torch.target.position.copy(hp);
    }
    r.render(s, cam);
    // film: grain, vignette, a little crush in the blacks
    const o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d');
    g.drawImage(c, 0, 0);
    const vg = g.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(id, 0, 0);
    r.dispose();
    return o.toDataURL('image/png');
  };
});
// a page that lays out one piece: the render as the background, the title over it as the game draws it
const html = (bg, w, h, title) => `<!doctype html><html><head><style>
html,body{margin:0;background:transparent}
.a{position:relative;width:${w}px;height:${h}px;overflow:hidden;${bg ? `background:url(${bg}) center/cover` : ''}}
.t{position:absolute;left:${title?.x ?? 0}px;top:${title?.y ?? 0}px;font-family:'Liberation Serif','Times New Roman',serif;font-weight:400;font-size:${title?.size ?? 100}px;letter-spacing:.06em;line-height:.85;color:#b3120c;filter:url(#rough);text-shadow:0 0 ${(title?.size ?? 100) * 0.04}px #000,0 0 ${(title?.size ?? 100) * 0.3}px rgba(200,0,0,.45),0 ${(title?.size ?? 100) * 0.03}px 0 #1a0000;white-space:nowrap}
.sub{position:absolute;font-family:'Liberation Mono',monospace;letter-spacing:.5em;color:#c7b48a;opacity:.8}
canvas{position:absolute;left:0;top:0}
.shade{position:absolute;inset:0;background:${title?.shade || 'none'}}
</style></head><body><svg width="0" height="0" style="position:absolute"><filter id="rough"><feTurbulence type="fractalNoise" baseFrequency="${0.04 * 210 / (title?.size ?? 210)}" numOctaves="3" seed="7"/><feDisplacementMap in="SourceGraphic" scale="${10 * (title?.size ?? 210) / 210}"/></filter></svg>
<div class="a" id="a">${title ? `<div class="shade"></div><div class="t" id="t">OFFAL</div>` : ''}${title?.sub ? `<div class="sub" style="left:${title.sub.x}px;top:${title.sub.y}px;font-size:${title.sub.size}px">${title.sub.text}</div>` : ''}</div>
<script>document.fonts.ready.then(() => { window.done = true; });</script></body></html>`;
const LEFT = (a) => `linear-gradient(90deg, rgba(0,0,0,${a}) 0, rgba(0,0,0,${a * 0.6}) 42%, transparent 66%)`;
const BOTTOM = (a) => `linear-gradient(0deg, rgba(0,0,0,${a}) 0, rgba(0,0,0,${a * 0.6}) 22%, transparent 45%)`;
const LOW = (a) => `linear-gradient(15deg, rgba(0,0,0,${a}) 0, rgba(0,0,0,${a * 0.55}) 38%, transparent 62%)`;
const HERO = { fx: 0.9, fz: 0, camX: -0.35, camY: 1.4, camZ: 2.9, lookY: 1.7, lookX: -0.72, fov: 52, turn: -0.4, jaw: 0.75, mode: 'grab', twitch: { x: 0.25, y: 0, z: 0.35, r: 0.2 } };
const SPECS = {
  // store
  'header_capsule_920x430': { w: 920, h: 430, scene: HERO, title: { x: 40, y: 262, size: 150, shade: LOW(0.85) } },
  'small_capsule_462x174': { w: 462, h: 174, scene: { ...HERO, face: { dx: -0.12, dy: 0.0, dz: 1.05, aimX: -0.8 } }, title: { x: 14, y: 46, size: 92, shade: LEFT(0.9) } },
  'main_capsule_1232x706': { w: 1232, h: 706, scene: { ...HERO, camZ: 3.2, lookX: -0.5, fov: 52 }, title: { x: 56, y: 450, size: 215, shade: LOW(0.85) } },
  'vertical_capsule_748x896': { w: 748, h: 896, scene: { fx: 0, fz: 0, camX: 0.15, camY: 1.3, camZ: 3.0, lookY: 1.55, lookX: 0, fov: 60, turn: -0.08, jaw: 0.75, mode: 'grab', twitch: { x: 0.25, y: 0, z: 0.3, r: 0.15 } }, title: { x: 118, y: 700, size: 160, shade: BOTTOM(0.9) } },
  'page_background_1438x810': { w: 1438, h: 810, scene: { ...HERO, fx: 0.4, fz: -4, fov: 60, turn: -0.2, jaw: 0.3 }, title: null, dim: true },
  // library
  'library_capsule_600x900': { w: 600, h: 900, scene: { fx: 0, fz: 0, camX: 0.15, camY: 1.3, camZ: 3.1, lookY: 1.55, lookX: 0, fov: 62, turn: -0.08, jaw: 0.75, mode: 'grab', twitch: { x: 0.25, y: 0, z: 0.3, r: 0.15 } }, title: { x: 82, y: 718, size: 135, shade: BOTTOM(0.9) } },
  'library_header_920x430': { same: 'header_capsule_920x430' },
  'library_hero_3840x1240': { w: 3840, h: 1240, scene: { ...HERO, fx: 0.75, camZ: 2.7, fov: 46, lookX: -0.1 }, title: null },
  'library_logo_1280x720': { w: 1280, h: 720, scene: null, title: { x: 150, y: 220, size: 300 } },
  'community_icon_184x184': { w: 184, h: 184, scene: { ...HERO, fx: 0, turn: 0, face: { dx: 0, dy: 0.0, dz: 0.62 }, twitch: { x: 0, y: 0, z: 0.12, r: 0 } }, title: null },
};
const art = {};
for (const [name, spec0] of Object.entries(SPECS)) {
  if (only && !name.startsWith(only)) continue;
  const spec = spec0.same ? SPECS[spec0.same] : spec0;
  const bg = spec.scene ? await p.evaluate((a) => window.__art(a), { w: spec.w, h: spec.h, ...spec.scene }) : null;
  const q = await b.newPage({ viewport: { width: spec.w, height: spec.h } });
  await q.setContent(html(bg, spec.w, spec.h, spec.title));
  await q.waitForFunction(() => window.done, null, { timeout: 30000 });
  if (spec.dim) await q.evaluate(() => { document.getElementById('a').style.filter = 'brightness(.45) blur(1px)'; });
  await q.screenshot({ path: `${out}/${name}.png`, omitBackground: !spec.scene, clip: { x: 0, y: 0, width: spec.w, height: spec.h } });
  await q.close();
  console.log('made', name);
}
console.log(errs.slice(0, 4).join('\n') || 'no errors');
await b.close();
