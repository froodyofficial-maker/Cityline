// The puzzles that stand between you and the lift, on top of the tags:
//   fuses    - no power: search body bags for fuses, slot them into the fuse box
//   keypad   - a shutter seals off a wing (with some of the dead in it); the code is scrawled on the walls
//   scale    - the counterweight is jammed: hang exactly the right weight of meat on the freight scale
//   valves   - steam has locked the brake: find the release order, turn the hissing valves in it
//   breakers - the finale: pull three kill switches to stop the line, then run for the lift
// Every puzzle gives main.js its interactions, the Q-listen arrow its targets, and the HUD its lines.
import * as THREE from 'three';
import { TILE, WALL_H } from './config.js';
import { tileCenter } from './level.js';
import { makeRng } from './rng.js';
import * as P from './props.js';
import { canvas, BLOOD, drip, wallSplat, handprint } from './textures.js';
import * as UI from './ui.js';

const SYMBOLS = [
  { name: 'CIRCLE', glyph: '●' },
  { name: 'TRIANGLE', glyph: '▲' },
  { name: 'SQUARE', glyph: '■' },
  { name: 'DIAMOND', glyph: '◆' },
  { name: 'CROSS', glyph: '✖' },
];
const ORD = ['FIRST', 'SECOND', 'THIRD', 'LAST'];

// ---------- painted textures ----------
function texOf(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}
function drawSymbol(g, kind, x, y, r, fill) {
  g.fillStyle = fill;
  g.strokeStyle = fill;
  g.beginPath();
  if (kind === 'CIRCLE') g.arc(x, y, r, 0, Math.PI * 2);
  else if (kind === 'TRIANGLE') { g.moveTo(x, y - r); g.lineTo(x + r * 0.95, y + r * 0.75); g.lineTo(x - r * 0.95, y + r * 0.75); g.closePath(); }
  else if (kind === 'SQUARE') g.rect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  else if (kind === 'DIAMOND') { g.moveTo(x, y - r); g.lineTo(x + r * 0.8, y); g.lineTo(x, y + r); g.lineTo(x - r * 0.8, y); g.closePath(); }
  else { g.lineWidth = r * 0.45; g.moveTo(x - r * 0.75, y - r * 0.75); g.lineTo(x + r * 0.75, y + r * 0.75); g.moveTo(x + r * 0.75, y - r * 0.75); g.lineTo(x - r * 0.75, y + r * 0.75); g.stroke(); return; }
  g.fill();
}
// words written in blood by somebody who was running out of time
function scrawlTex(lines, seed) {
  const { c, g } = canvas(256, 256), rng = makeRng(seed);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = lines.length > 3 ? 38 : 46;
  lines.forEach((ln, i) => {
    const y = 128 + (i - (lines.length - 1) / 2) * size * 1.05;
    g.save();
    g.translate(128 + (rng() - 0.5) * 10, y);
    g.rotate((rng() - 0.5) * 0.12);
    g.font = `bold ${size}px "Courier New", monospace`;
    g.fillStyle = `rgba(${BLOOD.fresh},0.92)`;
    g.fillText(ln, 0, 0);
    g.restore();
    for (let k = 0; k < 3; k++) drip(g, 40 + rng() * 176, y + size * 0.3, 10 + rng() * 40, 2 + rng() * 2, BLOOD.fresh, 0.8);
  });
  if (rng() < 0.7) handprint(g, 30 + rng() * 40, 200, 20, 0.3, rng, BLOOD.dark, 30);
  return texOf(c);
}
function paperTex(lines, opts = {}) {
  const { c, g } = canvas(256, 320), rng = makeRng(opts.seed || 5);
  g.fillStyle = '#cdbf9f';
  g.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,60,20,${rng() * 0.08})`; g.beginPath(); g.arc(rng() * 256, rng() * 320, rng() * 40, 0, 7); g.fill(); }
  g.fillStyle = '#2a2017';
  g.textAlign = 'center';
  g.font = 'bold 22px "Courier New", monospace';
  g.fillText(opts.title || '', 128, 44);
  g.font = '18px "Courier New", monospace';
  lines.forEach((l, i) => g.fillText(l, 128, 84 + i * 26));
  if (opts.symbols) opts.symbols.forEach((s, i) => drawSymbol(g, s, 48 + i * (160 / Math.max(1, opts.symbols.length - 1)), 220, 18, '#7a0a06'));
  wallSplat(g, 40 + rng() * 170, 270, 16, rng, BLOOD.dark);
  return texOf(c);
}
function plainTex(w, h, draw) {
  const { c, g } = canvas(w, h);
  draw(g);
  return { tex: texOf(c), c, g };
}

// a flat thing on a wall: position just off the surface, turned to face into the room
function onWall(x, y, [dx, dy], h, off = 0.02) {
  return {
    pos: new THREE.Vector3(tileCenter(x) + dx * (TILE / 2 - off), h, tileCenter(y) + dy * (TILE / 2 - off)),
    yaw: Math.atan2(-dx, -dy),
  };
}
const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);

// ---------- the puzzles ----------
class Fuses {
  constructor(ctx, n) {
    const { B, mats, rng, add, G } = ctx;
    this.kind = 'fuses';
    this.gates = true;
    this.ctx = ctx;
    this.n = n;
    this.carry = 0;
    this.inserted = 0;
    const far = (t) => G.L.dist[t[1] * G.L.W + t[0]] > ctx.maxDist * 0.3;
    const spot = B.takeWall(([x, y, , ri]) => far([x, y]) && !B.inWing(x, y)) || B.takeWall();
    const w = onWall(spot[0], spot[1], spot[2], 1.3);
    const box = new THREE.Group();
    const back = P.mesh(new THREE.BoxGeometry(0.7, 0.8, 0.12), mats.rust[1]);
    box.add(back);
    this.sockets = [];
    for (let i = 0; i < n; i++) {
      const s = P.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), false);
      s.rotation.z = Math.PI / 2;
      s.position.set(0, 0.25 - i * (0.5 / Math.max(1, n - 1)), 0.07);
      box.add(s);
      this.sockets.push(s);
    }
    this.lamp = P.mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0x601008, fog: false }), false);
    this.lamp.position.set(0.25, 0.32, 0.07);
    box.add(this.lamp);
    box.position.copy(w.pos);
    box.position.y = 1.3;
    box.rotation.y = w.yaw;
    add(box);
    this.box = w.pos.clone();
    // the fuses were hidden in the dead
    this.bags = [];
    for (let i = 0; i < n + 1; i++) { // one spare bag: one of them is empty
      const t = B.takeTile(([x, y, ri]) => G.L.rooms[ri].type === 'morgue' || rng() < 0.5) || B.takeTile();
      if (!t) break;
      const x = tileCenter(t[0]) + (rng() - 0.5) * 0.6, z = tileCenter(t[1]) + (rng() - 0.5) * 0.6;
      const bag = add(P.bodyBag(mats, rng), x, z, rng() * 6);
      this.bags.push({ obj: bag, pos: new THREE.Vector3(x, 0.15, z), searched: false, hasFuse: i < n });
    }
    rng.shuffle(this.bags);
    this.bags.forEach((b, i) => (b.hasFuse = i < n));
  }
  get solved() { return this.inserted >= this.n; }
  interactables() {
    const out = [];
    for (const b of this.bags) {
      if (b.searched) continue;
      out.push({ pos: b.pos, range: 1.6, minFacing: 0.4, hold: 2.2, label: 'HOLD — SEARCH THE BODY BAG', tick: 'squelch', noise: 8,
        use: () => {
          b.searched = true;
          b.obj.scale.y = 0.5;
          b.obj.add(P.decal(this.ctx.mats.pool[0], 1.6, 0, 0, 1));
          b.obj.add(P.entrails(this.ctx.mats, this.ctx.rng, new THREE.Vector3(0.2, 0.08, 0.1), 0.8, 9));
          this.ctx.G.audio.tear();
          if (b.hasFuse) { this.carry++; UI.message(['There’s a fuse in here, under the ribs. Wiped clean of nothing.', 'Your hand closes on glass. A fuse, still in one piece.'][this.carry % 2], 3); }
          else UI.message('Nothing in this one. Just him. What’s left of him.', 3);
        } });
    }
    if (!this.solved) {
      if (this.carry > 0) out.push({ pos: this.box, range: 1.7, minFacing: 0.3, hold: 1, label: `HOLD — SLOT THE FUSES (${this.carry})`, use: () => this.slot() });
      else out.push({ pos: this.box, range: 1.7, minFacing: 0.3, label: `FUSE BOX — ${this.inserted}/${this.n} FUSES` });
    }
    return out;
  }
  slot() {
    const G = this.ctx.G;
    for (; this.carry > 0; this.carry--) this.sockets[this.inserted++].material = new THREE.MeshBasicMaterial({ color: 0xffb040, fog: false });
    G.audio.clank(this.box, 0.8);
    if (this.solved) {
      this.lamp.material.color.setHex(0x40ff60);
      G.audio.powerOn(this.box);
      G.noise(this.box, 35, true);
      G.scare = Math.max(G.scare, 0.5);
      for (const l of G.B.lamps) if (l.state === 'dead') l.state = 'flicker';
      UI.message('Power. Every light on the floor comes on at once, and everything on the floor hears the breakers slam.', 4.5);
    } else UI.message(`${this.n - this.inserted} more.`, 2);
  }
  goals() {
    if (this.solved) return [];
    if (this.carry + this.inserted >= this.n) return [this.box];
    return [...this.bags.filter((b) => !b.searched).map((b) => b.pos), ...(this.carry ? [this.box] : [])];
  }
  line() { return this.solved ? null : `FUSES ${this.inserted + this.carry}/${this.n}`; }
  title() { return `RESTORE POWER — FUSES <b>${this.inserted}/${this.n}</b>`; }
  liftMsg() { return 'NO POWER — THE FUSE BOX IS EMPTY'; }
  save() { return { carry: this.carry, inserted: this.inserted, searched: this.bags.map((b) => b.searched) }; }
  load(s) {
    s.searched.forEach((v, i) => { const b = this.bags[i]; if (v && b) { b.searched = true; b.obj.scale.y = 0.5; } });
    this.carry = s.carry;
    for (let i = 0; i < s.inserted; i++) this.sockets[i].material = new THREE.MeshBasicMaterial({ color: 0xffb040, fog: false });
    this.inserted = s.inserted;
    if (this.solved) { this.lamp.material.color.setHex(0x40ff60); for (const l of this.ctx.G.B.lamps) if (l.state === 'dead') l.state = 'flicker'; }
  }
}

class Keypad {
  constructor(ctx) {
    const { G, B, mats, rng, add } = ctx;
    this.kind = 'keypad';
    this.gates = false;
    this.ctx = ctx;
    const d = G.L.door;
    this.door = d;
    this.code = [0, 1, 2, 3].map(() => (rng() * 10) | 0);
    this.known = [null, null, null, null];
    this.opened = false;
    this.lift = 0;
    // the shutter
    const cx = tileCenter(d.x), cz = tileCenter(d.y);
    const sh = new THREE.Group();
    const slats = P.mesh(new THREE.BoxGeometry(TILE, WALL_H, 0.14), mats.rust[2]);
    slats.position.y = WALL_H / 2;
    sh.add(slats);
    for (let i = 0; i < 14; i++) {
      const rib = P.mesh(new THREE.BoxGeometry(TILE, 0.03, 0.17), mats.darkMetal, false);
      rib.position.y = 0.1 + i * 0.21;
      sh.add(rib);
    }
    sh.position.set(cx, 0, cz);
    sh.rotation.y = d.ns ? 0 : Math.PI / 2; // spans across the corridor
    add(sh);
    this.shutter = sh;
    // keypad on the side you come from
    const [sx, sy] = d.side;
    this.pad = new THREE.Vector3(cx + sx * 0.12 + (d.ns ? 0.65 : 0), 1.35, cz + sy * 0.12 + (d.ns ? 0 : 0.65));
    const padM = P.mesh(new THREE.BoxGeometry(0.2, 0.3, 0.05), mats.darkMetal, false);
    padM.position.copy(this.pad);
    padM.rotation.y = Math.atan2(sx, sy);
    this.padLed = P.mesh(new THREE.SphereGeometry(0.015, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff2010, fog: false }), false);
    this.padLed.position.set(0.06, 0.11, 0.03);
    padM.add(this.padLed);
    add(padM);
    // where you stand to use it: in front of the pad, in the tile before the shutter (not the shutter's own)
    this.stand = new THREE.Vector3(cx + sx * 1.25 + (d.ns ? 0.5 : 0), 0, cz + sy * 1.25 + (d.ns ? 0 : 0.5));
    // four digits, written in blood in four different places on this side of the shutter
    this.notes = [];
    const usedRooms = new Set();
    for (let i = 0; i < 4; i++) {
      const spot = B.takeWall(([x, y, , ri]) => !B.inWing(x, y) && !usedRooms.has(ri)) || B.takeWall(([x, y]) => !B.inWing(x, y));
      if (!spot) continue;
      usedRooms.add(spot[3]);
      const w = onWall(spot[0], spot[1], spot[2], 1.55);
      const m = plane(1, 1, new THREE.MeshPhongMaterial({ map: scrawlTex([ORD[i], 'NUMBER', 'IS ' + this.code[i]], 900 + i + G.depth * 10), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, shininess: 80, specular: 0x441111 }));
      m.position.copy(w.pos);
      m.rotation.y = w.yaw;
      add(m);
      this.notes.push({ i, pos: w.pos, read: false });
    }
  }
  get solved() { return this.opened; }
  interactables() {
    const out = [];
    for (const n of this.notes) {
      if (n.read) continue;
      out.push({ pos: n.pos, range: 2.2, minFacing: 0.55, label: 'READ THE WRITING ON THE WALL', tap: true, use: () => {
        n.read = true;
        this.known[n.i] = this.code[n.i];
        this.ctx.G.audio.tick();
        UI.note('WRITTEN IN BLOOD', `${ORD[n.i]} NUMBER IS ${this.code[n.i]}`, 'The shutter code. Somebody wrote it here so the next one would have a chance.');
      } });
    }
    if (!this.opened) out.push({ pos: this.pad, range: 2.4, minFacing: 0.25, label: 'USE THE KEYPAD', tap: true, use: () => UI.keypad.open((code) => this.submit(code)) });
    return out;
  }
  submit(code) {
    const G = this.ctx.G;
    if (code.join('') === this.code.join('')) {
      this.opened = true;
      G.audio.shutter(this.pad);
      G.noise(this.pad, 25, true);
      this.padLed.material.color.setHex(0x30ff50);
      UI.keypad.close();
      UI.message('The shutter shrieks up into the ceiling. Whatever was sealed in there isn’t anymore.', 4);
      return true;
    }
    G.audio.buzzer(this.pad);
    G.noise(this.pad, 22, true);
    G.scare = Math.max(G.scare, 0.5);
    return false;
  }
  update(dt) {
    if (!this.opened || this.lift >= 1) return;
    this.lift = Math.min(1, this.lift + dt / 2.6);
    this.shutter.position.y = this.lift * (WALL_H - 0.15);
    if (this.lift > 0.6 && this.door.closed) {
      this.door.closed = false;
      const L = this.ctx.G.L;
      L.block[this.door.y * L.W + this.door.x] = 0;
    }
  }
  goals() {
    if (this.opened) return [];
    const unread = this.notes.filter((n) => !n.read);
    return unread.length && this.known.includes(null) ? unread.map((n) => n.pos) : [this.stand];
  }
  line() { return this.opened ? null : `SHUTTER CODE ${this.known.map((k) => (k === null ? '_' : k)).join(' ')}`; }
  title() { return 'FIND THE SHUTTER CODE'; }
  liftMsg() { return null; }
  save() { return { read: this.notes.map((n) => n.read), opened: this.opened }; }
  load(s) {
    s.read.forEach((r, i) => { const n = this.notes[i]; if (r && n) { n.read = true; this.known[n.i] = this.code[n.i]; } });
    if (s.opened) {
      this.opened = true;
      this.lift = 1;
      this.shutter.position.y = WALL_H - 0.15;
      this.padLed.material.color.setHex(0x30ff50);
      this.door.closed = false;
      const L = this.ctx.G.L;
      L.block[this.door.y * L.W + this.door.x] = 0;
    }
  }
}

class Scale {
  constructor(ctx) {
    const { G, B, mats, rng, add } = ctx;
    this.kind = 'scale';
    this.gates = true;
    this.ctx = ctx;
    // the scale stands in the lift room, next to the lift mouth
    const L = G.L, a = L.alcove;
    const spots = [[a.x - 1, a.y - 1], [a.x + 1, a.y - 1], [a.x, a.y - 2]].filter(([x, y]) => L.roomOf[y * L.W + x] === 0);
    const [sx, sy] = spots[0];
    this.pos = new THREE.Vector3(tileCenter(sx), 0, tileCenter(sy));
    const g = new THREE.Group();
    const plate = P.mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), mats.steel);
    plate.position.y = 0.06;
    const post = P.mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), mats.darkMetal);
    post.position.set(0, 0.7, -0.4);
    g.add(plate, post);
    this.dial = plainTex(256, 128, () => {});
    const face = plane(0.6, 0.3, new THREE.MeshBasicMaterial({ map: this.dial.tex, fog: false }));
    face.position.set(0, 1.45, -0.36);
    g.add(face);
    const housing = P.mesh(new THREE.BoxGeometry(0.66, 0.36, 0.06), mats.darkMetal, false);
    housing.position.set(0, 1.45, -0.4);
    g.add(housing);
    this.pile = new THREE.Group();
    this.pile.position.y = 0.14;
    g.add(this.pile);
    add(g, this.pos.x, this.pos.z, 0);
    B.colliders.push({ x0: this.pos.x - 0.45, z0: this.pos.z - 0.45, x1: this.pos.x + 0.45, z1: this.pos.z + 0.45, hunters: false });
    // weights: a hidden answer of three or four cuts, and some that are close but wrong
    const k = G.depth >= 6 ? 4 : 3;
    const pool = [];
    for (let w = 4; w <= 31; w++) pool.push(w);
    rng.shuffle(pool);
    const answer = pool.slice(0, k), decoys = pool.slice(k, k + 4);
    this.target = answer.reduce((s, w) => s + w, 0);
    this.answer = answer;
    this.cuts = [];
    for (const w of rng.shuffle([...answer, ...decoys])) {
      const t = B.takeTile(([x, y]) => !B.inWing(x, y)) || B.takeTile();
      if (!t) continue;
      const x = tileCenter(t[0]) + (rng() - 0.5) * 0.6, z = tileCenter(t[1]) + (rng() - 0.5) * 0.6;
      const hook = P.hangingChain(mats, () => 0.9); // no extra meat on it; the cut goes on below
      hook.position.set(x, WALL_H, z);
      const cut = P.meatChunk(mats, rng);
      cut.scale.multiplyScalar(1.4 + w / 20);
      cut.position.y = -(hook.children.length * 0.07) - 0.35;
      const tagTex = plainTex(128, 64, (g2) => { g2.fillStyle = '#d8ccb0'; g2.fillRect(0, 0, 128, 64); g2.fillStyle = '#5a0805'; g2.font = 'bold 38px "Courier New", monospace'; g2.textAlign = 'center'; g2.fillText(w + 'KG', 64, 46); });
      const label = plane(0.26, 0.13, new THREE.MeshBasicMaterial({ map: tagTex.tex, side: THREE.DoubleSide }));
      label.position.set(0, cut.position.y + 0.32, 0.05);
      hook.add(cut, label);
      add(hook);
      ctx.B.swingers.push(hook);
      this.cuts.push({ w, obj: hook, cut, pos: new THREE.Vector3(x, 1.5, z), where: 'hook' });
    }
    this.carry = [];
    this.on = [];
    this.done = false;
    this.paint();
  }
  get total() { return this.on.reduce((s, c) => s + c.w, 0); }
  get solved() { return this.done; }
  paint() {
    const g = this.dial.g, t = this.total;
    g.fillStyle = '#0d0a08';
    g.fillRect(0, 0, 256, 128);
    g.font = 'bold 48px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillStyle = t === this.target ? '#40ff60' : t > this.target ? '#ff2a10' : '#ffb040';
    g.fillText(`${t}/${this.target}`, 128, 66);
    g.font = '20px "Courier New", monospace';
    g.fillText(t > this.target ? 'TOO HEAVY' : t === this.target ? 'BALANCED' : 'KG', 128, 104);
    this.dial.tex.needsUpdate = true;
  }
  restack() {
    this.pile.clear();
    this.on.forEach((c, i) => { const m = P.meatChunk(this.ctx.mats, this.ctx.rng); m.scale.multiplyScalar(1.6); m.position.set((i % 2 - 0.5) * 0.3, 0.05 + Math.floor(i / 2) * 0.12, 0); this.pile.add(m); });
  }
  interactables() {
    if (this.done) return [];
    const out = [];
    for (const c of this.cuts) {
      if (c.where !== 'hook') continue;
      const full = this.carry.length >= 2;
      out.push({ pos: c.pos, range: 1.6, minFacing: 0.5, tap: !full, label: full ? `${c.w} KG — YOUR HANDS ARE FULL` : `TAKE THE ${c.w} KG CUT`, use: () => {
        c.where = 'hand';
        c.cut.visible = false;
        c.obj.children[c.obj.children.length - 1].visible = false;
        this.carry.push(c);
        this.ctx.G.audio.squelch(0.5);
      } });
    }
    const t = this.total;
    if (this.carry.length) out.push({ pos: this.pos, range: 1.7, minFacing: 0.2, tap: true, label: `PUT ${this.carry.map((c) => c.w).join(' + ')} KG ON THE SCALE`, use: () => this.put() });
    else if (this.on.length && t !== this.target) out.push({ pos: this.pos, range: 1.7, minFacing: 0.2, hold: 0.6, label: `HOLD — TAKE THE ${this.on[this.on.length - 1].w} KG CUT BACK OFF`, use: () => {
      const c = this.on.pop();
      c.where = 'hand';
      this.carry.push(c);
      this.restack();
      this.paint();
    } });
    else out.push({ pos: this.pos, range: 1.7, minFacing: 0.2, label: `THE SCALE READS ${t} — IT NEEDS ${this.target} KG` });
    return out;
  }
  put() {
    const G = this.ctx.G;
    this.on.push(...this.carry);
    this.carry.forEach((c) => (c.where = 'scale'));
    this.carry = [];
    this.restack();
    this.paint();
    G.audio.squelch(0.8);
    G.audio.clank(this.pos, 0.5);
    const t = this.total;
    if (t === this.target) {
      this.done = true;
      G.audio.powerOn(this.pos);
      G.noise(this.pos, 22, true);
      UI.message('The needle settles. Somewhere below, the counterweight drops free with a bang.', 4);
    } else UI.message(t > this.target ? `Too heavy: ${t} kg. Take something back off.` : `${t} kg. It needs ${this.target}.`, 3);
  }
  goals() {
    if (this.done) return [];
    if (this.carry.length >= 2 || (this.carry.length && this.total + this.carry.reduce((s, c) => s + c.w, 0) >= this.target)) return [this.pos];
    const hanging = this.cuts.filter((c) => c.where === 'hook').map((c) => c.pos);
    return this.carry.length || !hanging.length ? [this.pos, ...hanging] : hanging;
  }
  line() {
    if (this.done) return null;
    const hands = this.carry.length ? ` · CARRYING ${this.carry.map((c) => c.w).join('+')} KG` : '';
    return `SCALE ${this.total}/${this.target} KG${hands}`;
  }
  title() { return `BALANCE THE SCALE — EXACTLY <b>${this.target} KG</b>`; }
  liftMsg() { return `THE COUNTERWEIGHT IS JAMMED — THE SCALE MUST READ ${this.target} KG`; }
  save() { return { on: this.on.map((c) => this.cuts.indexOf(c)), carry: this.carry.map((c) => this.cuts.indexOf(c)), done: this.done }; }
  load(s) {
    const take = (c) => { c.cut.visible = false; c.obj.children[c.obj.children.length - 1].visible = false; };
    this.on = s.on.map((i) => this.cuts[i]).filter(Boolean);
    this.carry = s.carry.map((i) => this.cuts[i]).filter(Boolean);
    this.on.forEach((c) => { c.where = 'scale'; take(c); });
    this.carry.forEach((c) => { c.where = 'hand'; take(c); });
    this.done = s.done;
    this.restack();
    this.paint();
  }
}

class Valves {
  constructor(ctx) {
    const { G, B, mats, rng, add } = ctx;
    this.kind = 'valves';
    this.gates = true;
    this.ctx = ctx;
    const n = G.depth >= 8 ? 5 : 4;
    const syms = rng.shuffle(SYMBOLS.slice()).slice(0, n);
    this.valves = [];
    const usedRooms = new Set();
    for (const s of syms) {
      const spot = B.takeWall(([x, y, , ri]) => !B.inWing(x, y) && !usedRooms.has(ri)) || B.takeWall(([x, y]) => !B.inWing(x, y));
      if (!spot) continue;
      usedRooms.add(spot[3]);
      const w = onWall(spot[0], spot[1], spot[2], 1.25, 0.12);
      const g = new THREE.Group();
      const pipe = P.mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), mats.darkMetal);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.z = -0.05;
      const wheel = new THREE.Group();
      wheel.add(P.mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), new THREE.MeshPhongMaterial({ color: 0x7a1a10, shininess: 40 })));
      for (let k = 0; k < 3; k++) { const sp = P.mesh(new THREE.BoxGeometry(0.4, 0.025, 0.025), mats.darkMetal, false); sp.rotation.z = (k * Math.PI) / 3; wheel.add(sp); }
      wheel.position.z = 0.09;
      const sign = plainTex(64, 64, (g2) => { g2.fillStyle = '#cdbf9f'; g2.fillRect(0, 0, 64, 64); drawSymbol(g2, s.name, 32, 32, 20, '#7a0a06'); });
      const plaque = plane(0.22, 0.22, new THREE.MeshBasicMaterial({ map: sign.tex }));
      plaque.position.set(0, 0.42, -0.08);
      g.add(pipe, wheel, plaque);
      g.position.copy(w.pos);
      g.rotation.y = w.yaw;
      add(g);
      this.valves.push({ sym: s, wheel, pos: w.pos, turned: false, hiss: G.audio.steamLeak(w.pos) });
    }
    this.order = rng.shuffle(this.valves.map((_, i) => i));
    this.progress = 0;
    this.known = false;
    const spot = B.takeWall(([x, y]) => !B.inWing(x, y)) || B.takeWall();
    const w = onWall(spot[0], spot[1], spot[2], 1.45);
    const paper = plane(0.4, 0.5, new THREE.MeshPhongMaterial({ map: paperTex(['PRESSURE RELEASE', 'TURN IN THIS', 'ORDER ONLY:'], { title: 'MAINTENANCE', symbols: this.order.map((i) => this.valves[i].sym.name), seed: 77 }), shininess: 5 }));
    paper.position.copy(w.pos);
    paper.rotation.y = w.yaw;
    add(paper);
    this.note = w.pos;
  }
  get solved() { return this.progress >= this.valves.length; }
  glyphs() { return this.order.map((i, k) => (k < this.progress ? '✓' : this.valves[i].sym.glyph)).join(' '); }
  interactables() {
    if (this.solved) return [];
    const out = [];
    if (!this.known) out.push({ pos: this.note, range: 1.8, minFacing: 0.5, tap: true, label: 'READ THE MAINTENANCE NOTE', use: () => {
      this.known = true;
      this.ctx.G.audio.tick();
      UI.note('MAINTENANCE — PRESSURE RELEASE', this.order.map((i) => this.valves[i].sym.glyph).join('  '), 'Turn the valves in this order only. Any other order vents the whole system.');
    } });
    this.valves.forEach((v, i) => {
      if (v.turned) return;
      out.push({ pos: v.pos, range: 1.7, minFacing: 0.4, hold: 1.6, tick: 'screech', noise: 12, label: `HOLD — TURN THE ${v.sym.glyph} ${v.sym.name} VALVE`, use: () => this.turn(i) });
    });
    return out;
  }
  turn(i) {
    const G = this.ctx.G, v = this.valves[i];
    if (this.order[this.progress] === i) {
      v.turned = true;
      v.wheel.rotation.z += Math.PI * 1.5;
      v.hiss.stop();
      this.progress++;
      G.audio.clank(v.pos, 0.6);
      if (this.solved) {
        G.audio.powerOn(v.pos);
        G.noise(v.pos, 22, true);
        UI.message('The pressure goes out of the pipes in one long sigh. The brake on the lift is free.', 4);
      } else UI.message('The hissing from that one stops.', 2);
      return;
    }
    // wrong: everything vents at once
    G.audio.steamBurst(v.pos);
    G.noise(v.pos, 28, true);
    G.flash = 0.9;
    G.scare = 1;
    G.player.shake = 1;
    this.progress = 0;
    for (const o of this.valves) if (o.turned) { o.turned = false; o.wheel.rotation.z = 0; o.hiss = G.audio.steamLeak(o.pos); }
    UI.message('Wrong valve. Steam screams out of every pipe at once. It all resets — and he heard that.', 4.5);
  }
  goals() {
    if (this.solved) return [];
    if (!this.known) return [this.note];
    return [this.valves[this.order[this.progress]].pos];
  }
  line() { return this.solved ? null : this.known ? `VALVES ${this.glyphs()}` : 'VALVES: FIND THE RELEASE ORDER'; }
  title() { return 'RELEASE THE STEAM PRESSURE'; }
  liftMsg() { return 'THE BRAKE IS LOCKED BY STEAM — TURN THE VALVES IN ORDER'; }
  save() { return { known: this.known, progress: this.progress }; }
  load(s) {
    this.known = s.known;
    for (let k = 0; k < s.progress; k++) { const v = this.valves[this.order[k]]; v.turned = true; v.wheel.rotation.z = Math.PI * 1.5; v.hiss.stop(); }
    this.progress = s.progress;
  }
  dispose() { for (const v of this.valves) v.hiss.stop(); }
}

class Breakers {
  constructor(ctx) {
    const { G, B, mats, add } = ctx;
    this.kind = 'breakers';
    this.gates = true;
    this.ctx = ctx;
    const L = G.L;
    const far = L.rooms.map((r, ri) => [L.dist[r.cy * L.W + r.cx], ri]).filter(([, ri]) => ri > 0).sort((a, b) => b[0] - a[0]);
    const want = [far[0], far[Math.floor(far.length / 3)], far[Math.floor(far.length / 2)]].map((f) => f[1]);
    this.switches = [];
    for (const ri of want) {
      const spot = B.takeWall(([, , , r]) => r === ri) || B.takeWall();
      const w = onWall(spot[0], spot[1], spot[2], 1.3);
      const g = new THREE.Group();
      g.add(P.mesh(new THREE.BoxGeometry(0.6, 0.9, 0.15), mats.rust[0]));
      const lever = new THREE.Group();
      lever.position.set(0, 0, 0.1);
      const arm = P.mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), mats.darkMetal, false);
      arm.position.y = 0.2;
      const knob = P.mesh(new THREE.BoxGeometry(0.22, 0.07, 0.07), new THREE.MeshPhongMaterial({ color: 0x8a0a06 }), false);
      knob.position.y = 0.42;
      lever.add(arm, knob);
      lever.rotation.z = 0.5;
      const lamp = P.mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2010, fog: false }), false);
      lamp.position.set(0.22, 0.36, 0.08);
      const warn = plainTex(128, 64, (g2) => { g2.fillStyle = '#c8a020'; g2.fillRect(0, 0, 128, 64); g2.fillStyle = '#111'; g2.font = 'bold 18px "Courier New", monospace'; g2.textAlign = 'center'; g2.fillText('LINE', 64, 26); g2.fillText('KILL SWITCH', 64, 50); });
      const sign = plane(0.4, 0.2, new THREE.MeshBasicMaterial({ map: warn.tex }));
      sign.position.set(0, -0.32, 0.08);
      g.add(lever, lamp, sign);
      g.position.copy(w.pos);
      g.rotation.y = w.yaw;
      add(g);
      this.switches.push({ pos: w.pos, lever, lamp, pulled: false });
    }
    this.pulled = 0;
    G.audio.lineRunning(true);
  }
  get solved() { return this.pulled >= this.switches.length; }
  interactables() {
    return this.switches.filter((s) => !s.pulled).map((s) => ({ pos: s.pos, range: 1.7, minFacing: 0.4, hold: 3, tick: 'clank', noise: 14, label: 'HOLD — PULL THE KILL SWITCH', use: () => this.pull(s) }));
  }
  pull(s) {
    const G = this.ctx.G;
    s.pulled = true;
    s.lever.rotation.z = -0.6;
    s.lamp.material.color.setHex(0x30ff50);
    this.pulled++;
    G.audio.breaker(s.pos);
    G.noise(s.pos, 45, true);
    G.scare = 1;
    G.player.shake = 0.8;
    if (this.pulled === 1) {
      G.audio.siren(true);
      setTimeout(() => G.state === 'play' && UI.pa('UNAUTHORISED STOPPAGE ON THE LINE. ALL STAFF TO THE KILLING FLOOR.'), 1500);
    }
    if (this.solved) {
      G.audio.lineRunning(false);
      G.frenzy = true;
      UI.message('The line shudders and stops. In the silence you hear both of them start to run. GET TO THE LIFT.', 5);
    } else UI.message(`${this.switches.length - this.pulled} more. The alarm is screaming.`, 3);
  }
  goals() { return this.switches.filter((s) => !s.pulled).map((s) => s.pos); }
  line() { return this.solved ? null : `KILL SWITCHES ${this.pulled}/${this.switches.length}`; }
  title() { return `STOP THE LINE — KILL SWITCHES <b>${this.pulled}/${this.switches.length}</b>`; }
  liftMsg() { return 'THE LIFT WON’T MOVE WHILE THE LINE IS RUNNING'; }
  save() { return { pulled: this.switches.map((s) => s.pulled) }; }
  load(st) {
    const G = this.ctx.G;
    st.pulled.forEach((p, i) => { const s = this.switches[i]; if (p && s) { s.pulled = true; s.lever.rotation.z = -0.6; s.lamp.material.color.setHex(0x30ff50); this.pulled++; } });
    if (this.pulled > 0) G.audio.siren(true);
    if (this.solved) { G.audio.lineRunning(false); G.frenzy = true; }
  }
  dispose() { this.ctx.G.audio.lineRunning(false); this.ctx.G.audio.siren(false); }
}

// the morgue: an intake log says which drawers the missing workers are in
class Drawers {
  constructor(ctx) {
    const { G, B, rng } = ctx;
    this.kind = 'drawers';
    this.gates = true;
    this.ctx = ctx;
    const letters = ['A', 'B', 'C', 'D'];
    this.banks = [];
    const usedRooms = new Set();
    const freezer = (ri) => G.L.rooms[ri] && G.L.rooms[ri].type === 'freezer';
    for (const letter of letters) {
      const spot = B.takeWall(([x, y, , ri]) => !B.inWing(x, y) && freezer(ri) && !usedRooms.has(ri))
        || B.takeWall(([x, y, , ri]) => !B.inWing(x, y) && freezer(ri))
        || B.takeWall(([x, y]) => !B.inWing(x, y));
      if (!spot) continue;
      usedRooms.add(spot[3]);
      const tex = plainTex(256, 294, (g) => {
        g.font = 'bold 34px "Courier New", monospace';
        g.textAlign = 'center';
        g.fillStyle = '#1a2026';
        g.fillText('BANK ' + letter, 128, 30);
        g.font = 'bold 15px "Courier New", monospace';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const num = (2 - r) * 3 + c + 1, x = (c - 1) * 0.63, y = 0.42 + r * 0.66;
          const px = (x + 1) * 128, py = (2.3 - (y + 0.33)) * 128;
          g.fillStyle = '#d8dde0';
          g.fillRect(px - 18, py - 11, 36, 15);
          g.fillStyle = '#1a2026';
          g.fillText(letter + '-' + num, px, py + 1);
        }
      }).tex;
      const bank = B.placeBank(spot[0], spot[1], spot[2], tex, 1);
      bank.letter = letter;
      bank.drawers.forEach((d, i) => { const r = Math.floor(i / 3), c = i % 3; d.num = (2 - r) * 3 + c + 1; d.tried = false; });
      this.banks.push(bank);
    }
    const n = Math.min(this.banks.length * 2, G.depth >= 6 ? 4 : 3);
    const all = this.banks.flatMap((b) => b.drawers.map((d) => ({ b, d })));
    rng.shuffle(all);
    // spread the answers across banks where we can
    this.answers = [];
    for (const pick of all) {
      if (this.answers.length >= n) break;
      if (this.answers.some((a) => a.b === pick.b) && this.answers.length < this.banks.length) continue;
      this.answers.push({ ...pick, id: String(1000 + ((rng() * 8999) | 0)).padStart(4, '0'), found: false });
    }
    for (const pick of all) if (this.answers.length < n && !this.answers.some((a) => a.d === pick.d)) this.answers.push({ ...pick, id: String((rng() * 9999) | 0).padStart(4, '0'), found: false });
    this.known = false;
    const spot = B.takeWall(([x, y]) => !B.inWing(x, y)) || B.takeWall();
    const w = onWall(spot[0], spot[1], spot[2], 1.45);
    this.lines = this.answers.map((a) => `#${a.id} .... ${a.b.letter}-${a.d.num}`);
    const paper = plane(0.4, 0.5, new THREE.MeshPhongMaterial({ map: paperTex(['WORKERS ON ICE', ...this.lines], { title: 'INTAKE LOG', seed: 91 }), shininess: 5 }));
    paper.position.copy(w.pos);
    paper.rotation.y = w.yaw;
    ctx.add(paper);
    this.log = w.pos;
  }
  get found() { return this.answers.filter((a) => a.found).length; }
  get solved() { return this.found >= this.answers.length; }
  interactables() {
    if (this.solved) return [];
    const out = [];
    if (!this.known) out.push({ pos: this.log, range: 1.8, minFacing: 0.5, tap: true, label: 'READ THE INTAKE LOG', use: () => {
      this.known = true;
      this.ctx.G.audio.tick();
      UI.note('INTAKE LOG \u2014 WORKERS ON ICE', this.lines.map((l) => l.replace(/ \.+ /, ' \u2192 ')).join('   '), 'Find their drawers in the freezer banks and pull them out. Leave the others shut.');
    } });
    for (const b of this.banks) for (const d of b.drawers) {
      if (d.tried) continue;
      out.push({ pos: d.pos, range: 2, minFacing: 0.95, aim: true, hold: 0.9, tick: 'clank', noise: 6, label: `HOLD \u2014 PULL OUT DRAWER ${b.letter}-${d.num}`, use: () => this.pull(b, d) });
    }
    return out;
  }
  pull(b, d) {
    const G = this.ctx.G, a = this.answers.find((x) => x.d === d);
    d.tried = true;
    d.target = 1.35;
    G.audio.clank(d.pos, 0.7);
    G.audio.burst(G.audio.sfx, { type: 'highpass', f: 3000, dur: 0.6, vol: 0.15, a: 0.05 }); // the cold coming out
    if (a) {
      a.found = true;
      G.audio.squelch(0.5);
      UI.message(this.solved ? 'That\u2019s every name on the log. The release is signed in somebody\u2019s blood.' : `Worker #${a.id}. The toe tag matches. ${this.answers.length - this.found} more on the log.`, 3.5);
      if (this.solved) { G.audio.powerOn(d.pos); G.noise(d.pos, 22, true, 'work'); }
      return;
    }
    // the wrong drawer. whoever is in it isn't finished
    setTimeout(() => {
      if (G.state !== 'play') return;
      G.audio.jumpscare(0.45);
      G.audio.moan(d.pos);
      G.scare = 1;
      G.flash = 0.4;
      G.player.shake = 0.8;
      d.target = 0;
      setTimeout(() => G.audio.clank(d.pos, 1), 250);
      G.noise(d.pos, 18, true, 'other');
      UI.message('Wrong drawer. Not a name on the log \u2014 and it moved. It slams itself shut.', 3.5);
    }, 650);
  }
  update(dt) {
    for (const b of this.banks) for (const d of b.drawers) {
      d.open += (d.target - d.open) * Math.min(1, dt * (d.target ? 5 : 14));
      d.grp.position.z = d.open;
    }
  }
  goals() {
    if (this.solved) return [];
    if (!this.known) return [this.log];
    return this.answers.filter((a) => !a.found).map((a) => a.d.pos);
  }
  line() {
    if (this.solved) return null;
    if (!this.known) return 'DRAWERS: FIND THE INTAKE LOG';
    return 'DRAWERS ' + this.answers.map((a) => (a.found ? '\u2713' : `${a.b.letter}-${a.d.num}`)).join(' ');
  }
  title() { return `FIND THE WORKERS ON ICE \u2014 <b>${this.found}/${this.answers.length}</b>`; }
  liftMsg() { return 'THE MORGUE RELEASE ISN\u2019T SIGNED \u2014 FIND THE WORKERS IN THE INTAKE LOG'; }
  save() { return { known: this.known, found: this.answers.map((a) => a.found), tried: this.banks.map((b) => b.drawers.map((d) => d.tried)) }; }
  load(s) {
    this.known = s.known;
    s.tried.forEach((row, bi) => row.forEach((t, di) => { const d = this.banks[bi] && this.banks[bi].drawers[di]; if (d) d.tried = t; }));
    s.found.forEach((f, i) => { const a = this.answers[i]; if (f && a) { a.found = true; a.d.target = a.d.open = 1.35; a.d.grp.position.z = 1.35; } });
  }
}

const KINDS = { fuses: Fuses, keypad: Keypad, scale: Scale, valves: Valves, breakers: Breakers, drawers: Drawers };

export class Puzzles {
  constructor(G, kinds, seed) {
    const rng = makeRng(seed);
    const B = G.B;
    let maxDist = 0;
    for (const d of G.L.dist) if (d > maxDist) maxDist = d;
    const add = (o, x, z, yaw) => { if (x !== undefined) { o.position.x = x; o.position.z = z; } if (yaw !== undefined) o.rotation.y = yaw; B.group.add(o); return o; };
    const ctx = { G, B, mats: G.mats, rng, add, maxDist };
    // keypad first: it needs walls on its own side of the shutter before anything else takes them
    const order = kinds.slice().sort((a, b) => (a === 'keypad' ? -1 : b === 'keypad' ? 1 : 0));
    this.list = order.map((k) => new KINDS[k](ctx, k === 'fuses' ? (G.depth >= 5 ? 4 : 3) : undefined));
  }
  get ready() { return this.list.every((p) => !p.gates || p.solved); }
  interactables() { return this.list.flatMap((p) => p.interactables()); }
  goals() { return this.list.flatMap((p) => p.goals()); }
  lines() { return this.list.map((p) => p.line()).filter(Boolean); }
  blocker() { return this.list.find((p) => p.gates && !p.solved) || null; }
  update(dt) { for (const p of this.list) if (p.update) p.update(dt); }
  dispose() { for (const p of this.list) if (p.dispose) p.dispose(); }
  get(kind) { return this.list.find((p) => p.kind === kind); }
  save() { return this.list.map((p) => ({ kind: p.kind, s: p.save() })); }
  load(arr) { for (const { kind, s } of arr || []) { const p = this.get(kind); if (p && s) p.load(s); } }
}
