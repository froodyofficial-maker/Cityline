// DOM side of the game: screens, HUD, typed text, the time card, and blood on the lens.
import { BLOOD } from './textures.js';

// blood that hit the lens: an irregular wet body, satellite drops flung one way, a glint of light on top
function lensSplat(g, x, y, s, fresh = Math.random() < 0.5) {
  const dir = Math.random() * Math.PI * 2;
  const base = fresh ? [120, 4, 3] : [70, 2, 2];
  const col = (a, k = 1) => `rgba(${base[0] * k | 0},${base[1]},${base[2]},${a})`;
  for (let i = 0; i < 7; i++) {
    const ox = (Math.random() - 0.5) * s * 0.5 + Math.cos(dir) * s * 0.15 * i / 7, oy = (Math.random() - 0.5) * s * 0.5 + Math.sin(dir) * s * 0.15 * i / 7;
    g.fillStyle = col(0.55 + Math.random() * 0.35, 0.8 + Math.random() * 0.4);
    g.beginPath();
    g.ellipse(x + ox, y + oy, s * (0.15 + Math.random() * 0.35), s * (0.1 + Math.random() * 0.25), Math.random() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 26; i++) { // flung droplets, stretched along their flight
    const a = dir + (Math.random() - 0.5) * 1.3, d = s * (0.45 + Math.random() * 1.8), r = s * (0.012 + Math.random() * 0.05);
    g.fillStyle = col(0.6 + Math.random() * 0.35);
    g.beginPath();
    g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (1.4 + d / s), r, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,190,180,0.12)';
  g.beginPath();
  g.ellipse(x - s * 0.1, y - s * 0.12, s * 0.12, s * 0.05, -0.6, 0, Math.PI * 2);
  g.fill();
}

export const $ = (id) => document.getElementById(id);

export function show(id, on = true) { $(id).classList.toggle('on', on); }
export function only(...ids) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', ids.includes(s.id));
}

const typing = new WeakMap();
export function typewrite(el, text, cps = 38, onTick) {
  clearInterval(typing.get(el));
  el.textContent = '';
  let i = 0;
  const id = setInterval(() => {
    el.textContent = text.slice(0, ++i);
    if (onTick && text[i - 1] !== ' ') onTick();
    if (i >= text.length) clearInterval(id);
  }, 1000 / cps);
  typing.set(el, id);
}

export function buildDrips() {
  const host = $('drips');
  host.innerHTML = '';
  const xs = [4, 9, 17, 26, 33, 41, 52, 58, 66, 74, 83, 90];
  for (const x of xs) {
    const d = document.createElement('span');
    d.className = 'drip';
    d.style.left = x + Math.random() * 3 + '%';
    d.style.width = 3 + Math.random() * 6 + 'px';
    d.style.setProperty('--h', 20 + Math.random() * 110 + 'px');
    d.style.setProperty('--d', 4 + Math.random() * 7 + 's');
    d.style.setProperty('--delay', -Math.random() * 8 + 's');
    host.appendChild(d);
  }
}

let msgTimer = 0;
export function message(text, secs = 3.5) {
  const m = $('msg');
  m.textContent = text;
  m.classList.add('on');
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => m.classList.remove('on'), secs * 1000);
}
let paTimer = 0;
export function pa(text) {
  const m = $('pa');
  typewrite(m, text, 24);
  m.classList.add('on');
  clearTimeout(paTimer);
  paTimer = setTimeout(() => m.classList.remove('on'), 6500);
}

let lastPrompt = null;
export function prompt(text, progress = 0) {
  const p = $('prompt');
  if (!text) { if (lastPrompt !== null) { p.classList.remove('on'); lastPrompt = null; } return; }
  if (text !== lastPrompt) { $('promptText').innerHTML = text; p.classList.add('on'); lastPrompt = text; }
  $('ring').style.strokeDashoffset = String(100.5 * (1 - progress));
  p.querySelector('svg').style.display = progress > 0 ? '' : 'none';
}

let hudKey = '';
let stKey = '';
export function stamina(v, out, boost) {
  $('staminaFill').style.transform = `scaleX(${Math.max(0, v) / 100})`;
  const k = (boost ? 'b' : out ? 'o' : v >= 100 ? 'f' : 'n');
  if (k === stKey) return;
  stKey = k;
  const el = $('stamina');
  el.classList.toggle('boost', !!boost);
  el.classList.toggle('out', !!out && !boost);
  el.classList.toggle('full', k === 'f');
  $('staminaLabel').textContent = boost ? 'ADRENALINE' : out ? 'OUT OF BREATH' : 'STAMINA';
}

export function hud({ floor, have, fed, need, battery, breath, hidden, breathUrgent, adrenaline = 0 }) {
  const key = [floor, have, fed, need, Math.ceil(battery / 20), battery < 20, adrenaline].join('|');
  if (key !== hudKey) {
    hudKey = key;
    $('floorLabel').textContent = floor;
    const tags = $('tags');
    tags.innerHTML = '';
    for (let i = 0; i < need; i++) {
      const t = document.createElement('i');
      t.className = 'tag' + (i < fed ? ' fed' : i < fed + have ? ' got' : '');
      tags.appendChild(t);
    }
    $('tagText').textContent = need === 0 ? '' : `TAGS ${have + fed}/${need}`;
    const b = $('battery');
    b.innerHTML = '';
    const bars = Math.ceil(battery / 20);
    for (let i = 0; i < 5; i++) { const x = document.createElement('i'); if (i >= bars) x.className = 'off'; b.appendChild(x); }
    b.classList.toggle('low', battery < 20);
    $('syringes').textContent = adrenaline ? `R \u00B7 SYRINGE \u00D7${adrenaline}` : '';
  }
  const br = $('breath');
  br.classList.toggle('on', !!hidden);
  br.classList.toggle('urgent', !!breathUrgent);
  if (hidden) $('breathFill').style.transform = `scaleX(${breath / 100})`;
}

// ---------- the shift log ----------
export function timecard(save) {
  const rows = save.runs.slice(-7).reverse();
  const fmt = (s) => `${(s / 60) | 0}:${String((s % 60) | 0).padStart(2, '0')}`;
  $('timecard').classList.toggle('stamped', save.deaths > 0);
  $('timecard').innerHTML = `
    <h3>HOLLOW PINES MEATWORKS</h3>
    <p class="tc-sub">EMPLOYEE TIME CARD · NIGHT SHIFT</p>
    <table>
      <tr><th>SHIFT</th><th>DEEPEST</th><th>TAGS</th><th>HOURS</th></tr>
      ${rows.length ? rows.map((r) => `<tr><td>#${r.n}</td><td class="r">B${r.floor}</td><td>${r.tags}</td><td>${fmt(r.time)}</td></tr>`).join('') : '<tr><td colspan="4"><i>no shifts worked yet</i></td></tr>'}
    </table>
    <div class="tc-tot"><span>STORY: <b>${save.story.active ? 'ON B' + save.story.floor : save.story.done ? 'FINISHED' : 'NOT STARTED'}</b></span><span>OVERTIME BEST: <b>${save.best ? 'B' + save.best : '\u2014'}</b></span></div>
    ${save.deaths ? `<div class="stamp">PROCESSED ×${save.deaths}</div>` : ''}`;
}

// ---------- notes you find, and the shutter keypad ----------
let noteTimer = 0;
export function note(title, big, small) {
  $('noteTitle').textContent = title;
  $('noteBig').textContent = big;
  $('noteSmall').textContent = small || '';
  $('note').classList.add('on');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => $('note').classList.remove('on'), 8000);
}

export const keypad = {
  isOpen: false,
  closedAt: 0,
  digits: [],
  cb: null,
  open(cb) {
    this.cb = cb;
    this.digits = [];
    this.isOpen = true;
    this.render();
    $('keypad').classList.add('on');
  },
  close() {
    this.isOpen = false;
    this.closedAt = performance.now();
    $('keypad').classList.remove('on');
  },
  render() {
    const slots = $('kpSlots');
    slots.innerHTML = '';
    for (let i = 0; i < 4; i++) { const s = document.createElement('i'); s.textContent = this.digits[i] ?? ''; slots.appendChild(s); }
  },
  key(e) {
    if (!this.isOpen) return false;
    const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (m && this.digits.length < 4) { this.digits.push(+m[1]); this.render(); }
    else if (e.code === 'Backspace') { this.digits.pop(); this.render(); }
    else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && this.digits.length === 4) {
      if (!this.cb(this.digits.slice())) {
        const p = $('keypad');
        p.classList.remove('wrong');
        void p.offsetWidth;
        p.classList.add('wrong');
        this.digits = [];
        this.render();
      }
    } else if (e.code === 'KeyE') this.close();
    else return false;
    return true;
  },
};
addEventListener('keydown', (e) => { if (keypad.key(e)) e.preventDefault(); });

// ---------- blood on the lens ----------
export class ScreenBlood {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.drips = [];
    this.fadeAcc = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() {
    this.c.width = Math.round(innerWidth / 2);
    this.c.height = Math.round(innerHeight / 2);
  }
  // amount 0..1; edgesOnly keeps the centre clear (flecks from cutting)
  splash(amount, edgesOnly = false) {
    const W = this.c.width, H = this.c.height, g = this.g;
    const n = Math.ceil(1 + amount * 9);
    for (let i = 0; i < n; i++) {
      let x = Math.random() * W, y = Math.random() * H;
      if (edgesOnly) {
        const a = Math.random() * Math.PI * 2, r = 0.42 + Math.random() * 0.25;
        x = W / 2 + Math.cos(a) * W * r;
        y = H / 2 + Math.sin(a) * H * r;
      }
      const s = (edgesOnly ? 6 + Math.random() * 14 : 20 + Math.random() * 60) * (0.5 + amount) * (W / 900);
      lensSplat(g, x, y, s);
      const k = Math.random() * 3 * amount;
      for (let j = 0; j < k; j++) this.drips.push({ x: x + (Math.random() - 0.5) * s, y: y + s * 0.2, w: 1.5 + Math.random() * 3, v: 20 + Math.random() * 50, life: 1 + Math.random() * 3 });
    }
  }
  // everything goes red
  drown() {
    const g = this.g, W = this.c.width, H = this.c.height;
    const film = g.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.7);
    film.addColorStop(0, 'rgba(90,0,0,0.55)');
    film.addColorStop(1, 'rgba(40,0,0,0.9)');
    g.fillStyle = film;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 30; i++) lensSplat(g, Math.random() * W, Math.random() * H, (50 + Math.random() * 110) * (W / 900), i % 2 === 0);
    for (let i = 0; i < 40; i++) this.drips.push({ x: Math.random() * W, y: Math.random() * H * 0.6, w: 2 + Math.random() * 6, v: 30 + Math.random() * 60, life: 2 + Math.random() * 4 });
  }
  clear() { this.g.clearRect(0, 0, this.c.width, this.c.height); this.drips.length = 0; }
  update(dt) {
    const g = this.g;
    this.fadeAcc += dt;
    if (this.fadeAcc > 0.08) { // slow wash-out; quantised so the alpha step never rounds to zero
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = `rgba(0,0,0,${0.02 + this.fadeAcc * 0.02})`;
      g.fillRect(0, 0, this.c.width, this.c.height);
      g.globalCompositeOperation = 'source-over';
      this.fadeAcc = 0;
    }
    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      const ny = d.y + d.v * dt;
      g.strokeStyle = `rgba(${BLOOD.dark},0.9)`;
      g.lineWidth = d.w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + (Math.random() - 0.5) * 0.6, ny);
      g.stroke();
      d.y = ny;
      d.v *= 0.995;
      d.life -= dt;
      if (d.life < 0) this.drips.splice(i, 1);
    }
  }
}
