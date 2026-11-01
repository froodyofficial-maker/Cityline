// All sound is synthesised live with WebAudio: no samples. A generated concrete-room reverb glues it together.
import { G, clamp } from './state.js';

let ctx = null, master, sfx, conv, dryClose, noiseBuf, brownBuf, shaperCurve;
let choir = null, wind = null;
let drone = null, chase = null, buzz = null, heart = { next: 0 }, breath = { next: 0, phase: 0 };
export const A = { ready: false, holding: false, exertion: 0 };

function makeNoise(sec) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function makeBrown(sec) {
  const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return b;
}
function makeIR(sec, decay) {
  const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 400 ? i / 400 : 1);
    for (let k = 0; k < 6; k++) { const at = Math.floor(ctx.sampleRate * (0.012 + k * 0.017 + Math.random() * 0.01)); d[at] += (Math.random() < 0.5 ? -1 : 1) * 0.6 / (k + 1); }
  }
  return b;
}
function distCurve(k) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; }

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
  master = ctx.createGain(); master.gain.value = 0.95; master.connect(comp); comp.connect(ctx.destination);
  conv = ctx.createConvolver(); conv.buffer = makeIR(3.4, 2.6);
  const wet = ctx.createGain(); wet.gain.value = 0.5; conv.connect(wet); wet.connect(master);
  sfx = ctx.createGain(); sfx.connect(master); sfx.connect(conv);
  dryClose = ctx.createGain(); dryClose.connect(master);           // intimate sounds: no room
  noiseBuf = makeNoise(2); brownBuf = makeBrown(4); shaperCurve = distCurve(40);
  startDrone(); startChaseBed(); startBuzz(); startChoir(); startWind();
  A.ready = true;
}
export const now = () => ctx ? ctx.currentTime : 0;
export function suspend() { ctx?.suspend(); }
export function resume() { ctx?.resume(); }
export function setMasterMuted(m) { if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.95, ctx.currentTime, 0.1); }

// ---------- plumbing ----------
function src(buf = noiseBuf, loop = true) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = loop; s.loopStart = Math.random(); return s; }
function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function env(g, t, a, peak, d, hold = 0) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.setValueAtTime(Math.max(0.0002, peak), t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
}
function stopAt(node, t) { try { node.start(ctx.currentTime); node.stop(t); } catch (e) { } }
// output: a positional panner (with optional muffling when behind walls), a plain bus, or the dry close bus
function out(pos, opts = {}) {
  if (!pos) return opts.close ? dryClose : sfx;
  const p = ctx.createPanner();
  p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = opts.ref || 1.6; p.maxDistance = 80; p.rolloffFactor = opts.roll || 1.25;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y ?? 1; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y ?? 1, pos.z);
  p.connect(sfx);
  if (opts.muffle) { const lp = filt('lowpass', 520, 0.7); lp.connect(p); return lp; }
  return p;
}
export function setListener(pos, fwd) {
  if (!ctx) return;
  const l = ctx.listener;
  if (l.positionX) {
    const t = ctx.currentTime;
    l.positionX.setTargetAtTime(pos.x, t, 0.02); l.positionY.setTargetAtTime(pos.y, t, 0.02); l.positionZ.setTargetAtTime(pos.z, t, 0.02);
    l.forwardX.setTargetAtTime(fwd.x, t, 0.02); l.forwardY.setTargetAtTime(fwd.y, t, 0.02); l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
}

// ---------- beds ----------
function startDrone() {
  const g = gain(0.0); g.connect(master);
  const lp = filt('lowpass', 140, 0.8); lp.connect(g);
  const o1 = osc('sawtooth', 41.2), o2 = osc('sawtooth', 41.9), o3 = osc('sine', 27.5);
  [o1, o2].forEach(o => { const gg = gain(0.32); o.connect(gg); gg.connect(lp); o.start(); });
  const g3 = gain(0.5); o3.connect(g3); g3.connect(g); o3.start();
  // rumbling air
  const n = src(brownBuf), bp = filt('bandpass', 260, 0.6), ng = gain(0.5); n.connect(bp); bp.connect(ng); ng.connect(g); n.start();
  const lfo = osc('sine', 0.05), lfoG = gain(160); lfo.connect(lfoG); lfoG.connect(bp.frequency); lfo.start();
  // a thin, sick ringing that wanders
  const ring = osc('sine', 1490), ringG = gain(0.0), trem = osc('sine', 0.13), tremG = gain(0.012);
  trem.connect(tremG); tremG.connect(ringG.gain); ring.connect(ringG); ringG.connect(g); ring.start(); trem.start();
  const rl = osc('sine', 0.021), rlg = gain(40); rl.connect(rlg); rlg.connect(ring.frequency); rl.start();
  drone = { g, lp };
}
function startChaseBed() {
  const g = gain(0); g.connect(master);
  // pounding low ostinato
  const bass = osc('square', 55), blp = filt('lowpass', 260, 4), amp = gain(0);
  const pulse = osc('square', 4.4), pg = gain(0.5); pulse.connect(pg); pg.connect(amp.gain);
  const off = ctx.createConstantSource ? ctx.createConstantSource() : null; if (off) { off.offset.value = 0.5; off.connect(amp.gain); off.start(); }
  bass.connect(blp); blp.connect(amp); amp.connect(g); bass.start(); pulse.start();
  // screeching high cluster
  [1244, 1318, 1397].forEach((f, i) => { const o = osc('sawtooth', f), og = gain(0.018), t = osc('sine', 7 + i * 1.3), tg = gain(0.014); t.connect(tg); tg.connect(og.gain); const hp = filt('bandpass', f, 3); o.connect(hp); hp.connect(og); og.connect(g); o.start(); t.start(); });
  // sub
  const sub = osc('sine', 36.7), sg = gain(0.35); sub.connect(sg); sg.connect(g); sub.start();
  chase = { g, level: 0, nextHit: 0 };
}
function startBuzz() {
  const o = osc('sawtooth', 120), hp = filt('highpass', 900, 0.7), g = gain(0);
  const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 1; p.rolloffFactor = 1.6;
  o.connect(hp); hp.connect(g); g.connect(p); p.connect(sfx); o.start();
  buzz = { g, p };
}
export function setBuzz(pos, level) {
  if (!buzz) return;
  if (pos) { if (buzz.p.positionX) { buzz.p.positionX.value = pos.x; buzz.p.positionY.value = pos.y; buzz.p.positionZ.value = pos.z; } else buzz.p.setPosition(pos.x, pos.y, pos.z); }
  buzz.g.gain.setTargetAtTime(level * 0.05, ctx.currentTime, 0.01);
}

// per-frame: drone level, heart, breath, chase bed
export function updateAudio(dt, chaseOn) {
  if (!ctx) return;
  const t = ctx.currentTime, fear = G.fear;
  drone.g.gain.setTargetAtTime((G.state === 'play' || G.state === 'note' ? 0.38 : 0.2) * (chaseOn ? 0.5 : 1), t, 0.6);
  drone.lp.frequency.setTargetAtTime(110 + fear * 260, t, 0.5);
  // the choir drifts between chords and swells in phrases; it goes quiet when you're being chased
  if (choir) {
    choir.g.gain.setTargetAtTime(chaseOn ? 0.0 : (G.state === 'play' || G.state === 'title' || G.state === 'note' ? 0.16 + fear * 0.1 : 0.04), t, 1.2);
    if (t > choir.next) {
      const ch = CHORDS[(Math.random() * CHORDS.length) | 0];
      choir.voices.forEach((v, i) => { v.o.frequency.setTargetAtTime(ch[(i >> 1) % 4] * (i & 1 ? 1.004 : 0.996), t, 1.4); v.vg.gain.setTargetAtTime(Math.random() < 0.25 ? 0 : 0.5 + Math.random() * 0.5, t, 1.5); });
      choir.next = t + 8 + Math.random() * 7;
    }
  }
  if (wind) wind.g.gain.setTargetAtTime(G.state === 'title' ? 0.3 : 0.22, t, 1);
  // chase bed
  chase.g.gain.setTargetAtTime(chaseOn ? 0.55 : 0, t, chaseOn ? 0.15 : 1.4);
  if (chaseOn && t > chase.nextHit) { metalHit(null, 0.25 + Math.random() * 0.2, true); chase.nextHit = t + 0.45 + Math.random() * 0.9; }
  // heart
  if (G.state === 'play' || G.state === 'dying') {
    const bpm = 58 + fear * 100;
    if (t > heart.next) {
      const v = 0.08 + fear * 0.6;
      if (fear > 0.12) { thump(v, 62); setTimeout(() => thump(v * 0.65, 52), 230); }
      heart.next = t + 60 / bpm;
    }
    // breath
    const ex = clamp(A.exertion + fear * 0.6, 0, 1.4);
    if (!A.holding && t > breath.next) {
      const per = 3.6 - ex * 2.2, v = 0.015 + ex * 0.07;
      breathe(breath.phase ? 'out' : 'in', per * 0.45, v);
      breath.phase ^= 1; breath.next = t + per * 0.5;
    }
  }
}
function thump(v, f) {
  const t = ctx.currentTime, o = osc('sine', f), g = gain(0);
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.12);
  o.connect(g); g.connect(dryClose); env(g, t, 0.008, v, 0.16); stopAt(o, t + 0.3);
}
function breathe(dir, dur, v) {
  const t = ctx.currentTime, n = src(), bp = filt('bandpass', dir === 'in' ? 1300 : 800, 0.8), g = gain(0);
  n.connect(bp); bp.connect(g); g.connect(dryClose);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + dur * (dir === 'in' ? 0.7 : 0.25)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  stopAt(n, t + dur + 0.05);
}
export function gasp(v = 0.35) {
  if (!ctx) return; const t = ctx.currentTime, n = src(), bp = filt('bandpass', 1500, 1.2), g = gain(0);
  n.connect(bp); bp.connect(g); g.connect(dryClose); bp.frequency.linearRampToValueAtTime(2100, t + 0.4);
  env(g, t, 0.05, v, 0.45); stopAt(n, t + 0.6); breath.next = t + 0.7;
}

// ---------- one-shots ----------
export function thud(pos, v = 0.8, opts) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, opts);
  const s = osc('sine', 80), g = gain(0); s.frequency.exponentialRampToValueAtTime(32, t + 0.3); s.connect(g); g.connect(o); env(g, t, 0.004, v, 0.35); stopAt(s, t + 0.5);
  const n = src(), lp = filt('lowpass', 380), ng = gain(0); n.connect(lp); lp.connect(ng); ng.connect(o); env(ng, t, 0.003, v * 0.8, 0.18); stopAt(n, t + 0.3);
}
export function squelch(pos, v = 0.6, opts) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, opts);
  for (let k = 0; k < 2; k++) {
    const n = src(), bp = filt('bandpass', 900 + Math.random() * 900, 4 + Math.random() * 4), g = gain(0), tt = t + k * (0.04 + Math.random() * 0.08);
    bp.frequency.setValueAtTime(1400 - k * 500, tt); bp.frequency.exponentialRampToValueAtTime(180 + Math.random() * 120, tt + 0.22);
    n.connect(bp); bp.connect(g); g.connect(o); env(g, tt, 0.01, v * (1.6 - k * 0.6), 0.25); stopAt(n, tt + 0.4);
  }
  const s = osc('sine', 110), sg = gain(0); s.frequency.exponentialRampToValueAtTime(45, t + 0.15); s.connect(sg); sg.connect(o); env(sg, t, 0.005, v * 0.7, 0.15); stopAt(s, t + 0.3);
}
export function boneCrack(pos, v = 0.6, opts) {
  if (!ctx) return; const o = out(pos, opts); let t = ctx.currentTime;
  const k = 3 + (Math.random() * 4 | 0);
  for (let i = 0; i < k; i++) {
    const n = src(), hp = filt('bandpass', 2500 + Math.random() * 2500, 2), g = gain(0);
    n.connect(hp); hp.connect(g); g.connect(o); env(g, t, 0.001, v * (0.6 + Math.random() * 0.6), 0.02 + Math.random() * 0.03); stopAt(n, t + 0.08);
    t += 0.012 + Math.random() * 0.035;
  }
  thud(pos, v * 0.5, opts);
}
export function metalHit(pos, v = 0.5, close = false, base = 0, opts) {
  if (!ctx) return; const t = ctx.currentTime, o = pos ? out(pos, opts) : (close ? dryClose : sfx);
  const f0 = base || (300 + Math.random() * 700);
  [1, 2.76, 5.4, 8.93].forEach((r, i) => {
    const s = osc('sine', f0 * r), g = gain(0); s.connect(g); g.connect(o);
    env(g, t, 0.002, v / (i + 1.4), (base ? 2.2 : 0.7) / (i * 0.5 + 1)); stopAt(s, t + 2.5);
  });
}
export function chain(pos, v = 0.4, opts) {
  if (!ctx) return; for (let i = 0; i < 5; i++) setTimeout(() => metalHit(pos, v * (0.5 + Math.random() * 0.5), false, 900 + Math.random() * 1200, opts), i * (40 + Math.random() * 90));
}
export function clang(pos, v = 0.6, opts) { metalHit(pos, v, false, 90 + Math.random() * 80, opts); thud(pos, v * 0.5, opts); }
export function doorCreak(pos, v = 0.35, opts) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, opts), d = 0.8 + Math.random() * 0.7;
  const s = osc('sawtooth', 70), bp = filt('bandpass', 1100, 9), g = gain(0), am = osc('square', 26 + Math.random() * 20), amg = gain(0.5);
  s.frequency.setValueAtTime(60, t); s.frequency.linearRampToValueAtTime(140 + Math.random() * 60, t + d * 0.6); s.frequency.linearRampToValueAtTime(90, t + d);
  am.connect(amg); amg.connect(g.gain); s.connect(bp); bp.connect(g); g.connect(o);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.1); g.gain.linearRampToValueAtTime(0, t + d);
  s.start(t); am.start(t); s.stop(t + d + 0.1); am.stop(t + d + 0.1);
}
export function doorSlam(pos, v = 0.9, opts) { thud(pos, v, opts); metalHit(pos, v * 0.35, false, 140, opts); }
export function drip(pos, v = 0.12) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, { ref: 1 }), f = 1400 + Math.random() * 1200;
  const s = osc('sine', f), g = gain(0); s.frequency.exponentialRampToValueAtTime(f * 0.4, t + 0.06); s.connect(g); g.connect(o); env(g, t, 0.002, v, 0.07); stopAt(s, t + 0.12);
}
export function footstep(kind = 'walk', wet = false) {
  if (!ctx) return; const t = ctx.currentTime;
  const v = kind === 'run' ? 0.22 : kind === 'crouch' ? 0.04 : 0.11;
  const n = src(), lp = filt('lowpass', kind === 'run' ? 900 : 600, 0.8), g = gain(0); n.connect(lp); lp.connect(g); g.connect(sfx);
  env(g, t, 0.004, v, 0.09); stopAt(n, t + 0.15);
  if (wet) squelch(null, v * 0.5);
}
export function monsterStep(pos, muffle, heavy = 1) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, { muffle, ref: 2.2 });
  const s = osc('sine', 55), g = gain(0); s.frequency.exponentialRampToValueAtTime(30, t + 0.2); s.connect(g); g.connect(o); env(g, t, 0.005, 0.9 * heavy, 0.25); stopAt(s, t + 0.35);
  const n = src(), lp = filt('lowpass', 300), ng = gain(0); n.connect(lp); lp.connect(ng); ng.connect(o); env(ng, t, 0.004, 0.6 * heavy, 0.12); stopAt(n, t + 0.2);
  if (Math.random() < 0.5) squelch(pos, 0.25 * heavy, { muffle });
  if (Math.random() < 0.18) { // the hook scraping on concrete
    const sn = src(), bp = filt('bandpass', 3200, 12), sg = gain(0); sn.connect(bp); bp.connect(sg); sg.connect(o);
    bp.frequency.linearRampToValueAtTime(2500, t + 0.5); sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(0.5, t + 0.05); sg.gain.linearRampToValueAtTime(0, t + 0.55); stopAt(sn, t + 0.6);
  }
}
// wet, croaking breath: the thing's idle noise
export function monsterBreath(pos, muffle, v = 0.6) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, { muffle, ref: 2 }), d = 1 + Math.random() * 1.2;
  const n = src(), bp = filt('bandpass', 380, 5), g = gain(0), am = osc('square', 16 + Math.random() * 14), amg = gain(0.5);
  const fl = osc('sine', 3 + Math.random() * 4), flg = gain(180); fl.connect(flg); flg.connect(bp.frequency);
  am.connect(amg); amg.connect(g.gain); n.connect(bp); bp.connect(g); g.connect(o);
  const sw = osc('sawtooth', 48 + Math.random() * 20), sl = filt('lowpass', 300), sg = gain(0); sw.connect(sl); sl.connect(sg); sg.connect(o);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.2); g.gain.linearRampToValueAtTime(0, t + d);
  sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(v * 0.4, t + 0.3); sg.gain.linearRampToValueAtTime(0, t + d);
  [n, am, fl, sw].forEach(x => { x.start(t); x.stop(t + d + 0.05); });
}
export function monsterClicks(pos, muffle, v = 0.5) {
  if (!ctx) return; const o = out(pos, { muffle, ref: 2 }); let t = ctx.currentTime;
  const k = 8 + (Math.random() * 14 | 0);
  for (let i = 0; i < k; i++) {
    const n = src(), bp = filt('bandpass', 1300 + Math.random() * 500, 6), g = gain(0); n.connect(bp); bp.connect(g); g.connect(o);
    env(g, t, 0.001, v, 0.025); stopAt(n, t + 0.05); t += 0.03 + Math.random() * 0.05;
  }
}
export function monsterScream(pos, v = 0.9, muffle = false) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, { muffle, ref: 3, roll: 0.8 }), d = 1.9;
  const sh = ctx.createWaveShaper(); sh.curve = shaperCurve; const bp = filt('bandpass', 1100, 0.9), g = gain(0);
  sh.connect(bp); bp.connect(g); g.connect(o);
  [1, 1.06, 1.41].forEach(r => {
    const s = osc('sawtooth', 200 * r);
    s.frequency.setValueAtTime(180 * r, t); s.frequency.exponentialRampToValueAtTime(720 * r, t + 0.22); s.frequency.exponentialRampToValueAtTime(480 * r, t + 0.6);
    s.frequency.exponentialRampToValueAtTime(880 * r, t + 1.1); s.frequency.exponentialRampToValueAtTime(160 * r, t + d);
    const vib = osc('sine', 11), vg = gain(25 * r); vib.connect(vg); vg.connect(s.frequency);
    s.connect(sh); s.start(t); vib.start(t); s.stop(t + d); vib.stop(t + d);
  });
  const n = src(), ng = gain(0.6); n.connect(ng); ng.connect(sh); n.start(t); n.stop(t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.08); g.gain.setValueAtTime(v * 0.5, t + 1.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
}
export function sniff(pos, v = 0.5) {
  if (!ctx) return; const o = out(pos, { ref: 1.2 }); let t = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const n = src(), hp = filt('bandpass', 2400, 1.5), g = gain(0); n.connect(hp); hp.connect(g); g.connect(o);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.11); g.gain.linearRampToValueAtTime(0, t + 0.14); stopAt(n, t + 0.2); t += 0.18;
  }
}
// sudden dissonant blast. used rarely.
export function stinger(v = 0.7) {
  if (!ctx) return; const t = ctx.currentTime, g = gain(0); g.connect(master); g.connect(conv);
  const base = 90 + Math.random() * 40;
  [1, 1.06, 1.5, 2.12, 2.24, 3.17, 4.25, 4.5].forEach(r => { const s = osc('sawtooth', base * r * (1 + (Math.random() - 0.5) * 0.01)); s.connect(g); s.start(t); s.stop(t + 3); });
  const n = src(), ng = gain(0); n.connect(ng); ng.connect(master); env(ng, t, 0.003, v * 0.6, 0.6); stopAt(n, t + 0.8);
  const sub = osc('sine', 60), sg = gain(0); sub.frequency.exponentialRampToValueAtTime(25, t + 1.5); sub.connect(sg); sg.connect(master); env(sg, t, 0.005, v, 1.6); stopAt(sub, t + 2);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
}
// slow sick swell: when you notice something
export function swell(v = 0.4, d = 3.5) {
  if (!ctx) return; const t = ctx.currentTime, lp = filt('lowpass', 150, 2), g = gain(0); lp.connect(g); g.connect(master); g.connect(conv);
  lp.frequency.exponentialRampToValueAtTime(1600, t + d * 0.8);
  [65.4, 69.3, 98, 103.8].forEach(f => { const s = osc('sawtooth', f); s.connect(lp); s.start(t); s.stop(t + d + 0.2); });
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v * 0.25, t + d * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
}
// close whispering, right at one ear
const VOWELS = [[700, 1200, 2600], [300, 2300, 3000], [500, 900, 2400], [400, 1900, 2550], [350, 700, 2400]];
export function whisper(v = 0.18, side = Math.random() < 0.5 ? -1 : 1, d = 1.6 + Math.random() * 1.6) {
  if (!ctx) return; const t = ctx.currentTime, n = src(), g = gain(0), pan = ctx.createStereoPanner(); pan.pan.value = side * 0.9;
  const fs = [0, 1, 2].map(() => filt('bandpass', 800, 9));
  fs.forEach(f => { n.connect(f); f.connect(g); });
  g.connect(pan); pan.connect(dryClose);
  for (let k = 0, tt = t; tt < t + d; k++, tt += 0.07 + Math.random() * 0.1) { const vw = VOWELS[(Math.random() * VOWELS.length) | 0]; fs.forEach((f, i) => f.frequency.setTargetAtTime(vw[i] * (0.9 + Math.random() * 0.25), tt, 0.02)); }
  g.gain.setValueAtTime(0, t);
  for (let tt = t; tt < t + d; tt += 0.12 + Math.random() * 0.12) { g.gain.linearRampToValueAtTime(v * (0.4 + Math.random()), tt + 0.04); g.gain.linearRampToValueAtTime(v * 0.05, tt + 0.1); }
  g.gain.linearRampToValueAtTime(0, t + d + 0.1);
  n.start(t); n.stop(t + d + 0.2);
}
export function distantScream(v = 0.25) {
  if (!ctx) return; const t = ctx.currentTime, d = 1.4 + Math.random(), f = 520 + Math.random() * 200;
  const s = osc('sawtooth', f), vib = osc('sine', 6), vg = gain(18); vib.connect(vg); vg.connect(s.frequency);
  s.frequency.setValueAtTime(f * 0.8, t); s.frequency.linearRampToValueAtTime(f * 1.15, t + 0.3); s.frequency.linearRampToValueAtTime(f * 0.7, t + d);
  const g = gain(0), lp = filt('lowpass', 1400), pan = ctx.createStereoPanner(); pan.pan.value = (Math.random() - 0.5) * 1.6;
  [800, 1150, 2900].forEach((ff, i) => { const b = filt('bandpass', ff, 6); s.connect(b); const bg = gain(1 / (i + 1)); b.connect(bg); bg.connect(lp); });
  lp.connect(g); g.connect(pan); pan.connect(conv);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.15); g.gain.linearRampToValueAtTime(0, t + d);
  s.start(t); vib.start(t); s.stop(t + d + 0.1); vib.stop(t + d + 0.1);
}
// metal groan through the building
export function groan(v = 0.3) {
  if (!ctx) return; const t = ctx.currentTime, d = 2.5 + Math.random() * 2;
  const s = osc('sawtooth', 50), bp = filt('bandpass', 400, 8), g = gain(0), am = osc('square', 9 + Math.random() * 10), amg = gain(0.4);
  s.frequency.linearRampToValueAtTime(38 + Math.random() * 30, t + d); bp.frequency.linearRampToValueAtTime(200 + Math.random() * 500, t + d);
  am.connect(amg); amg.connect(g.gain); s.connect(bp); bp.connect(g); g.connect(conv);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + d * 0.4); g.gain.linearRampToValueAtTime(0, t + d);
  [s, am].forEach(x => { x.start(t); x.stop(t + d + 0.1); });
}
export function footstepsAbove() { if (!ctx) return; for (let i = 0; i < 6; i++) setTimeout(() => thud({ x: G.camera.position.x + 8, y: 6, z: G.camera.position.z }, 0.25, { muffle: true }), i * 520); }
export function lightBurst(pos) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos);
  const n = src(), hp = filt('highpass', 2000), g = gain(0); n.connect(hp); hp.connect(g); g.connect(o); env(g, t, 0.001, 0.8, 0.25); stopAt(n, t + 0.3);
  for (let i = 0; i < 8; i++) { const s = osc('sine', 3000 + Math.random() * 4000), sg = gain(0); s.connect(sg); sg.connect(o); env(sg, t + 0.05 + Math.random() * 0.4, 0.001, 0.1, 0.1); stopAt(s, t + 0.7); }
  thud(pos, 0.3);
}
export function phoneRing(pos) {
  if (!ctx) return () => { };
  const g = gain(0), o = out(pos, { ref: 1.5 });
  const a = osc('sine', 440), b = osc('sine', 480), am = osc('square', 20), amg = gain(0.5);
  am.connect(amg); amg.connect(g.gain); a.connect(g); b.connect(g); g.connect(o); [a, b, am].forEach(x => x.start());
  let alive = true; const t0 = ctx.currentTime;
  for (let k = 0; k < 30; k++) { const tt = t0 + k * 4; g.gain.setValueAtTime(0.0, tt); g.gain.setValueAtTime(0.18, tt + 0.01); g.gain.setValueAtTime(0, tt + 2); }
  return () => { if (!alive) return; alive = false; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.value = 0; [a, b, am].forEach(x => x.stop()); };
}
export function staticNoise(d = 3, v = 0.12) {
  if (!ctx) return; const t = ctx.currentTime, n = src(), bp = filt('bandpass', 2200, 0.6), g = gain(0), am = osc('sawtooth', 50), amg = gain(0.3);
  am.connect(amg); amg.connect(g.gain); n.connect(bp); bp.connect(g); g.connect(dryClose);
  g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + d - 0.1); g.gain.linearRampToValueAtTime(0, t + d);
  n.start(t); am.start(t); n.stop(t + d); am.stop(t + d);
}
export function bubble(pos, v = 0.2) {
  if (!ctx) return; const t = ctx.currentTime, o = out(pos, { ref: 1.2 }), f = 140 + Math.random() * 160;
  const s = osc('sine', f), g = gain(0); s.frequency.exponentialRampToValueAtTime(f * 2.4, t + 0.08); s.connect(g); g.connect(o); env(g, t, 0.003, v, 0.09); stopAt(s, t + 0.15);
}
export function tear(v = 0.8) {
  if (!ctx) return; const t = ctx.currentTime, d = 1.6;
  const n = src(), lp = filt('lowpass', 900, 3), g = gain(0); n.connect(lp); lp.connect(g); g.connect(dryClose); g.connect(conv);
  for (let tt = t; tt < t + d; tt += 0.03) { g.gain.setValueAtTime(Math.random() * v * (1 - (tt - t) / d * 0.6), tt); lp.frequency.setValueAtTime(300 + Math.random() * 1500, tt); }
  g.gain.setValueAtTime(0, t + d); n.start(t); n.stop(t + d + 0.05);
}
export function elevatorRumble(d = 8, v = 0.4) {
  if (!ctx) return; const t = ctx.currentTime, n = src(brownBuf), lp = filt('lowpass', 180), g = gain(0); n.connect(lp); lp.connect(g); g.connect(sfx);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1); g.gain.setValueAtTime(v, t + d - 1); g.gain.linearRampToValueAtTime(0, t + d);
  n.start(t); n.stop(t + d + 0.1);
  for (let i = 0; i < d * 1.5; i++) setTimeout(() => metalHit(null, 0.08 + Math.random() * 0.1, false, 120 + Math.random() * 200), i * 650 + Math.random() * 300);
}
export function bell() { if (!ctx) return; metalHit(null, 0.5, false, 660); setTimeout(() => metalHit(null, 0.4, false, 523), 350); }
export function click(v = 0.12) {
  if (!ctx) return; const t = ctx.currentTime, n = src(), hp = filt('highpass', 3000), g = gain(0); n.connect(hp); hp.connect(g); g.connect(dryClose); env(g, t, 0.001, v, 0.02); stopAt(n, t + 0.05);
}
export function pickup() { click(0.2); if (!ctx) return; const t = ctx.currentTime, s = osc('triangle', 220), g = gain(0); s.connect(g); g.connect(dryClose); env(g, t, 0.01, 0.05, 0.3); stopAt(s, t + 0.4); }
export function lockerSound(pos, open = true) { doorCreak(pos, 0.15); setTimeout(() => metalHit(pos, open ? 0.12 : 0.22, false, 260 + Math.random() * 60), open ? 50 : 280); }
// SpeechSynthesis voice, pushed as low and slow as it goes. Best-effort: returns false if unavailable.
export function speak(text, pitch = 0.1, rate = 0.62) {
  try {
    if (!('speechSynthesis' in window)) return false;
    const u = new SpeechSynthesisUtterance(text); u.pitch = pitch; u.rate = rate; u.volume = 0.9;
    const vs = speechSynthesis.getVoices(); const f = vs.find(v => /female|zira|samantha|victoria|karen|fiona/i.test(v.name)); if (f) u.voice = f;
    speechSynthesis.speak(u); return true;
  } catch (e) { return false; }
}
export function stopSpeech() { try { speechSynthesis.cancel(); } catch (e) { } }

// ---------- the abbey ----------
const CHORDS = [[73.42, 110, 146.83, 174.61], [58.27, 116.54, 146.83, 174.61], [73.42, 98, 146.83, 196], [73.42, 103.83, 146.83, 207.65], [65.41, 98, 155.56, 196]];
function startChoir() {
  // monks somewhere far off: sawtooth voices through 'oh' formants, almost all reverb
  const g = gain(0); g.connect(conv); const dry = gain(0.2); g.connect(dry); dry.connect(master);
  const forms = [[330, 0.9], [760, 0.5], [2500, 0.12]];
  const voices = [];
  CHORDS[0].forEach(f => { for (let d = 0; d < 2; d++) {
    const o = osc('sawtooth', f * (d ? 1.004 : 0.996)); const vib = osc('sine', 4.2 + Math.random() * 1.2); const vb = gain(f * 0.007); vib.connect(vb); vb.connect(o.frequency);
    const vg = gain(0.6); forms.forEach(([ff, a]) => { const b = filt('bandpass', ff, 7); const bg = gain(a); o.connect(b); b.connect(bg); bg.connect(vg); });
    vg.connect(g); o.start(); vib.start(); voices.push({ o, vg });
  } });
  choir = { g, voices, next: 0 };
}
function startWind() {
  const g = gain(0); g.connect(master);
  const n = src(brownBuf), bp = filt('bandpass', 520, 1.4), ng = gain(1.2); n.connect(bp); bp.connect(ng); ng.connect(g); n.start();
  const lf = osc('sine', 0.06), lg = gain(320); lf.connect(lg); lg.connect(bp.frequency); lf.start();
  const gust = osc('sine', 0.11), gg = gain(0.5); gust.connect(gg); gg.connect(ng.gain); gust.start();
  const wh = src(noiseBuf), wb = filt('bandpass', 1350, 16), wgn = gain(0.25); wh.connect(wb); wb.connect(wgn); wgn.connect(g); wh.start();
  const wl = osc('sine', 0.09), wlg = gain(260); wl.connect(wlg); wlg.connect(wb.frequency); wl.start();
  wind = { g };
}
// the abbey bell, rung by nobody
export function bellToll(v = 0.35) {
  if (!ctx) return; const t = ctx.currentTime, g = gain(0); g.connect(conv); g.connect(master);
  [[1, 1], [2, 0.6], [2.4, 0.5], [3, 0.35], [4.2, 0.25], [5.4, 0.15]].forEach(([r, a]) => { const o = osc('sine', 62 * r), og = gain(0); o.connect(og); og.connect(g); env(og, t, 0.004, a, 6 / r); stopAt(o, t + 7); });
  g.gain.value = v;
}
// the portcullis winch: a ratchet and a chain, for d seconds
export function winch(d = 40, v = 0.25) {
  if (!ctx) return; const t0 = ctx.currentTime;
  for (let k = 0; k < d / 0.16; k++) { const tt = t0 + k * 0.16 + Math.random() * 0.03; const n = src(), bp = filt('bandpass', 2600 + Math.random() * 1500, 5), g = gain(0); n.connect(bp); bp.connect(g); g.connect(sfx); env(g, tt, 0.001, v * (0.5 + Math.random() * 0.5), 0.05); n.start(tt); n.stop(tt + 0.1); }
  for (let k = 0; k < d / 4; k++) setTimeout(() => groan(0.2), k * 4000);
  elevatorRumble(d, v * 0.8);
}
// an old valve radio between stations. returns stop()
export function radioHiss(pos) {
  if (!ctx) return () => { };
  const o = out(pos, { ref: 1.2 }), n = src(), bp = filt('bandpass', 1800, 0.7), g = gain(0), whine = osc('sine', 2200), wg = gain(0.012);
  n.connect(bp); bp.connect(g); whine.connect(wg); wg.connect(g); g.connect(o); n.start(); whine.start();
  let alive = true;
  const tick = () => { if (!alive) return; const t = ctx.currentTime; g.gain.setTargetAtTime(Math.random() < 0.35 ? 0.25 : 0.05, t, 0.05); whine.frequency.setTargetAtTime(1500 + Math.random() * 1500, t, 0.2); setTimeout(tick, 150 + Math.random() * 500); };
  tick();
  return () => { if (!alive) return; alive = false; g.gain.cancelScheduledValues(ctx.currentTime); g.gain.value = 0; n.stop(); whine.stop(); };
}
