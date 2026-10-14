// All sound is synthesised with Web Audio: no files. Positional sounds use HRTF panners, so with
// headphones you can hear exactly where the Foreman's hook is scraping, and which way the flies are.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.out = ctx.createGain();
    this.out.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 5;
    comp.knee.value = 8;
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.connect(comp).connect(this.out).connect(ctx.destination);
    this.sfx = this.gain(1, this.muffle);
    this.amb = this.gain(0.9, this.muffle);
    this.mus = this.gain(0.75, this.muffle);
    // a long concrete reverb that everything bleeds into
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(3.2, 2.2);
    this.verb.connect(this.muffle);
    const send = this.gain(0.45, this.verb);
    this.sfx.connect(send);
    this.mus.connect(this.gain(0.25, this.verb));
    const len = ctx.sampleRate * 3;
    this.white = ctx.createBuffer(1, len, ctx.sampleRate);
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const w = this.white.getChannelData(0), b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      w[i] = Math.random() * 2 - 1;
      last = (last + 0.02 * w[i]) / 1.02;
      b[i] = last * 3.5;
    }
    this.dist = this.curve(60);
    // jumpscares skip the compressor (it would soften them) and go through their own hard clipper
    this.shockClip = ctx.createWaveShaper();
    this.shockClip.curve = this.curve(4);
    this.shockOut = this.gain(this.volume, ctx.destination);
    this.shockClip.connect(this.shockOut);
    this.fliesBus = this.gain(1, this.sfx);
    this.startAmbience();
  }

  setVolume(v) {
    this.volume = v;
    if (this.out) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); this.shockOut.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  }
  // listening: the flies come up out of the mix
  setListen(on) { if (this.ctx) this.fliesBus.gain.setTargetAtTime(on ? 3.2 : 1, this.t, 0.15); }
  get t() { return this.ctx.currentTime; }

  // ---------- building blocks ----------
  gain(v, to) { const g = this.ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; }
  filter(type, f, q = 1, to) { const n = this.ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; if (to) n.connect(to); return n; }
  osc(type, f, to) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; if (to) o.connect(to); return o; }
  noise(brown = false, to) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.white;
    s.loop = true;
    s.loopStart = 0;
    if (to) s.connect(to);
    return s;
  }
  curve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((3 + k) * x * 20 * Math.PI) / 180 / (Math.PI + k * Math.abs(x)); }
    return c;
  }
  impulse(dur, decay) {
    const rate = this.ctx.sampleRate, len = rate * dur, buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  env(g, t0, a, peak, d) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  pan(pos, ref = 1.5, roll = 1.1, to = this.sfx) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = roll;
    p.maxDistance = 100;
    this.place(p, pos);
    p.connect(to);
    return p;
  }
  place(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y || 1.2; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y || 1.2, pos.z);
  }
  listen(pos, fwd) {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
      l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }
  setMuffle(on) { if (this.ctx) this.muffle.frequency.setTargetAtTime(on ? 700 : 20000, this.t, 0.15); }

  // a short noise burst through a filter
  burst(to, { type = 'bandpass', f = 1000, q = 1, dur = 0.1, vol = 0.2, a = 0.004, brown = false, sweep = null, at = 0 }) {
    const t = this.t + at, g = this.gain(0, to), fl = this.filter(type, f, q, g), n = this.noise(brown, fl);
    if (sweep) { fl.frequency.setValueAtTime(sweep[0], t); fl.frequency.exponentialRampToValueAtTime(sweep[1], t + dur); }
    this.env(g, t, a, vol, dur);
    n.start(t, Math.random() * 2);
    n.stop(t + a + dur + 0.05);
  }
  tone(to, { type = 'sine', f = 100, f2 = null, dur = 0.2, vol = 0.3, a = 0.005, at = 0 }) {
    const t = this.t + at, g = this.gain(0, to), o = this.osc(type, f, g);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    this.env(g, t, a, vol, dur);
    o.start(t);
    o.stop(t + a + dur + 0.05);
  }

  // ---------- ambience ----------
  startAmbience() {
    const lp = this.filter('lowpass', 150, 0.7, this.gain(0.12, this.amb));
    this.droneA = this.osc('sawtooth', 41.2, lp);
    this.droneB = this.osc('sawtooth', 41.75, lp);
    this.droneA.start();
    this.droneB.start();
    const lfo = this.osc('sine', 0.05), lg = this.gain(60);
    lfo.connect(lg).connect(lp.frequency);
    lfo.start();
    this.noise(true, this.filter('lowpass', 240, 0.5, this.gain(0.2, this.amb))).start();
    // the ringing in your ears
    const tin = this.gain(0.0035, this.amb);
    this.osc('sine', 1244, tin).start();
    this.osc('sine', 1251.5, tin).start();
    // chase bed: a cluster of saws that swells when something is running at you
    this.chaseG = this.gain(0, this.mus);
    const cbp = this.filter('bandpass', 700, 0.6, this.chaseG);
    for (const f of [110, 116.54, 164.81, 174.61, 233.08]) { const o = this.osc('sawtooth', f, cbp); o.detune.value = (Math.random() - 0.5) * 20; o.start(); }
    const trem = this.osc('square', 7.5), tg = this.gain(0.4);
    trem.connect(tg).connect(this.chaseG.gain);
    trem.start();
    // your own breathing
    this.breathG = this.gain(0, this.sfx);
    this.noise(false, this.filter('bandpass', 900, 0.8, this.breathG)).start();
    this.nextAmb = 2;
  }
  setDepth(depth) {
    if (!this.ctx) return;
    const f = 41.2 * Math.pow(0.97, depth);
    this.droneA.frequency.setTargetAtTime(f, this.t, 2);
    this.droneB.frequency.setTargetAtTime(f * (1.012 + depth * 0.003), this.t, 2);
  }
  setChase(level) { if (this.ctx) this.chaseG.gain.setTargetAtTime(level * 0.11, this.t, level > 0 ? 0.15 : 1.2); }
  setBreath(level, rate) {
    if (!this.ctx) return;
    const s = 0.5 + 0.5 * Math.sin(this.t * Math.PI * 2 * rate);
    this.breathG.gain.setTargetAtTime(level * 0.06 * s * s, this.t, 0.04);
  }
  // drips, distant metal, things moving in other rooms
  ambienceTick(dt, pos) {
    if (!this.ctx) return;
    this.nextAmb -= dt;
    if (this.nextAmb > 0) return;
    this.nextAmb = 1.5 + Math.random() * 5;
    const r = Math.random(), a = Math.random() * Math.PI * 2;
    const at = (d) => ({ x: pos.x + Math.cos(a) * d, y: 2.6, z: pos.z + Math.sin(a) * d });
    if (r < 0.45) this.drip(at(2 + Math.random() * 6));
    else if (r < 0.7) this.clank(at(14 + Math.random() * 14), 0.5);
    else if (r < 0.88) this.creak(at(8 + Math.random() * 10));
    else this.distantThud(at(20 + Math.random() * 10));
  }

  // ---------- one-shots ----------
  step(kind, wet) {
    const v = kind === 'run' ? 0.22 : kind === 'crouch' ? 0.04 : 0.11;
    this.burst(this.sfx, { f: 700 + Math.random() * 500, q: 1.2, dur: 0.06, vol: v });
    this.tone(this.sfx, { f: 130, f2: 60, dur: 0.07, vol: v * 0.8 });
    if (wet) {
      this.burst(this.sfx, { type: 'lowpass', f: 1500, dur: 0.16, vol: v * 0.9, sweep: [1800, 200], at: 0.02 });
      this.burst(this.sfx, { type: 'highpass', f: 3000, dur: 0.01, vol: v * 0.5, at: 0.07 + Math.random() * 0.05 });
    }
  }
  thud(pos, v) {
    const p = this.pan(pos, 2.5, 1);
    this.tone(p, { f: 75, f2: 32, dur: 0.22, vol: 0.9 * v });
    this.burst(p, { type: 'lowpass', f: 500, dur: 0.09, vol: 0.5 * v });
  }
  squelch(i = 1) {
    const n = 2 + ((Math.random() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const at = k * (0.06 + Math.random() * 0.08);
      this.burst(this.sfx, { type: 'bandpass', f: 600, q: 2.5, dur: 0.15 + Math.random() * 0.2, vol: 0.35 * i, sweep: [300 + Math.random() * 500, 1500 + Math.random() * 1500], at });
      this.burst(this.sfx, { type: 'lowpass', f: 400, dur: 0.2, vol: 0.35 * i, brown: true, at });
    }
    if (Math.random() < 0.6) this.crackle(0.5 * i);
  }
  crackle(v = 0.6) {
    for (let k = 0; k < 4; k++) this.burst(this.sfx, { type: 'highpass', f: 2000 + Math.random() * 2000, dur: 0.008, vol: v * (0.3 + Math.random() * 0.7), at: Math.random() * 0.25 });
  }
  crack() {
    this.burst(this.sfx, { type: 'highpass', f: 1400, dur: 0.02, vol: 0.9 });
    this.burst(this.sfx, { type: 'highpass', f: 900, dur: 0.04, vol: 0.6, at: 0.03 });
    this.tone(this.sfx, { f: 160, f2: 50, dur: 0.12, vol: 0.6 });
  }
  tear() {
    this.burst(this.sfx, { type: 'bandpass', f: 300, q: 3, dur: 0.5, vol: 0.6, sweep: [250, 3200] });
    this.burst(this.sfx, { type: 'lowpass', f: 500, dur: 0.6, vol: 0.5, brown: true });
    this.crackle(0.8);
  }
  pickup() {
    this.tone(this.sfx, { type: 'square', f: 1400, dur: 0.03, vol: 0.05 });
    this.burst(this.sfx, { type: 'highpass', f: 2500, dur: 0.03, vol: 0.15, at: 0.04 });
  }
  tick() {
    this.burst(this.sfx, { type: 'highpass', f: 3000, dur: 0.012, vol: 0.25 });
  }
  heartbeat(v) {
    this.tone(this.sfx, { f: 58, f2: 38, dur: 0.16, vol: v });
    this.tone(this.sfx, { f: 52, f2: 34, dur: 0.18, vol: v * 0.7, at: 0.26 });
  }
  gasp() {
    this.burst(this.sfx, { type: 'bandpass', f: 1100, q: 1.5, dur: 0.45, vol: 0.35, a: 0.05, sweep: [700, 1600] });
  }
  hurt() {
    const g = this.gain(0, this.sfx), bp = this.filter('bandpass', 750, 2, g), o = this.osc('sawtooth', 190, bp);
    o.frequency.exponentialRampToValueAtTime(85, this.t + 0.4);
    this.env(g, this.t, 0.01, 0.25, 0.4);
    o.start();
    o.stop(this.t + 0.5);
    this.squelch(1.4);
    this.crack();
  }
  // what you hear the moment it sees you
  stinger() {
    const t = this.t, g = this.gain(0, this.mus), hp = this.filter('highpass', 500, 0.7, g);
    const ws = this.ctx.createWaveShaper();
    ws.curve = this.curve(8);
    ws.connect(hp);
    for (const f of [1180, 1250, 1660, 1765, 2350]) {
      const o = this.osc('sawtooth', f, ws), vib = this.osc('sine', 5 + Math.random() * 3), vg = this.gain(f * 0.015);
      vib.connect(vg).connect(o.frequency);
      o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 1.8);
      o.start(t); vib.start(t); o.stop(t + 2.2); vib.stop(t + 2.2);
    }
    this.env(g, t, 0.02, 0.09, 1.9);
    this.tone(this.mus, { f: 62, f2: 26, dur: 1.4, vol: 1 });
    this.burst(this.mus, { type: 'lowpass', f: 3000, dur: 0.5, vol: 0.4 });
  }
  // the jumpscare
  scream() {
    const t = this.t, g = this.gain(0, this.sfx), ws = this.ctx.createWaveShaper();
    ws.curve = this.dist;
    const hp = this.filter('highpass', 250, 0.7, g);
    ws.connect(hp);
    for (const f of [320, 345, 470, 505, 690, 950]) {
      const o = this.osc('sawtooth', f * 0.7, ws), vib = this.osc('sine', 9 + Math.random() * 6), vg = this.gain(f * 0.05);
      vib.connect(vg).connect(o.frequency);
      o.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.25);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.5);
      o.start(t); vib.start(t); o.stop(t + 1.7); vib.stop(t + 1.7);
    }
    const n = this.noise(false, this.filter('bandpass', 2500, 0.8, ws));
    n.start(t);
    n.stop(t + 1.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.015);
    g.gain.setValueAtTime(0.5, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    this.tone(this.sfx, { f: 90, f2: 30, dur: 0.8, vol: 1 });
  }
  // the shock: everything else drops out and this hits at full level with no attack at all
  jumpscare(v = 1) {
    if (!this.ctx) return;
    const t = this.t, len = 0.9 + v * 0.9;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.volume * 0.05, t);
    this.out.gain.setValueAtTime(this.volume * 0.05, t + len * 0.6);
    this.out.gain.linearRampToValueAtTime(this.volume, t + len + 1.5);
    const bus = this.gain(0, this.shockClip);
    bus.gain.setValueAtTime(1.6 * v, t);
    bus.gain.setValueAtTime(1.6 * v, t + len * 0.45);
    bus.gain.exponentialRampToValueAtTime(0.001, t + len);
    const stop = t + len + 0.05;
    // full-band blast
    const n = this.noise(false, this.gain(0.9, bus));
    n.start(t, Math.random());
    n.stop(t + 0.3);
    // the scream: a dissonant cluster of saws with a fast, sick vibrato, sliding down
    const scream = this.filter('highpass', 400, 0.7, this.gain(0.32, bus));
    for (const f of [740, 784, 1046, 1108, 1480, 1568, 2217]) {
      const o = this.osc('sawtooth', f * 1.15, scream), vib = this.osc('sine', 11 + Math.random() * 6), vg = this.gain(f * 0.045);
      vib.connect(vg).connect(o.frequency);
      o.frequency.exponentialRampToValueAtTime(f * 0.62, t + len);
      o.start(t); vib.start(t); o.stop(stop); vib.stop(stop);
    }
    // a throat in it
    const throat = this.gain(0.5, bus), f1 = this.filter('bandpass', 1150, 5, throat), f2 = this.filter('bandpass', 2900, 7, throat);
    const v1 = this.osc('sawtooth', 420);
    v1.connect(f1); v1.connect(f2);
    v1.frequency.linearRampToValueAtTime(610, t + 0.12);
    v1.frequency.exponentialRampToValueAtTime(260, t + len);
    v1.start(t); v1.stop(stop);
    // metal on metal
    const scr = this.filter('bandpass', 4200, 18, this.gain(1.4, bus));
    scr.frequency.exponentialRampToValueAtTime(2600, t + len);
    const sn = this.noise(false, scr);
    sn.start(t); sn.stop(stop);
    // the hit in your chest
    const sub = this.gain(0, bus);
    sub.gain.setValueAtTime(1.2, t);
    sub.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    const s1 = this.osc('sine', 62, sub), s2 = this.osc('square', 41, this.filter('lowpass', 180, 1, sub));
    s1.frequency.exponentialRampToValueAtTime(26, t + 1);
    s1.start(t); s2.start(t); s1.stop(t + 1.2); s2.stop(t + 1.2);
  }
  roar(pos) {
    const t = this.t, p = this.pan(pos, 3, 0.8), g = this.gain(0, p), ws = this.ctx.createWaveShaper();
    ws.curve = this.curve(30);
    const bp = this.filter('bandpass', 500, 0.8, g);
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.linearRampToValueAtTime(1100, t + 0.4);
    bp.frequency.linearRampToValueAtTime(350, t + 1.4);
    ws.connect(bp);
    for (const f of [88, 93, 141]) { const o = this.osc('sawtooth', f, ws); o.frequency.linearRampToValueAtTime(f * 0.8, t + 1.4); o.start(t); o.stop(t + 1.6); }
    const n = this.noise(true, ws);
    n.start(t);
    n.stop(t + 1.6);
    this.env(g, t, 0.06, 0.7, 1.4);
  }
  growl(pos, v = 1) {
    const t = this.t, p = this.pan(pos, 2, 1), g = this.gain(0, p), lp = this.filter('lowpass', 420, 2, g);
    const trem = this.osc('sine', 17), tg = this.gain(0.5);
    for (const f of [54, 57.5]) { const o = this.osc('sawtooth', f, lp); o.start(t); o.stop(t + 1.1); }
    const n = this.noise(true, lp);
    n.start(t);
    n.stop(t + 1.1);
    trem.connect(tg).connect(g.gain);
    trem.start(t);
    trem.stop(t + 1.1);
    this.env(g, t, 0.1, 0.5 * v, 0.9);
  }
  sniff(pos) {
    const p = this.pan(pos, 2, 1);
    for (let i = 0; i < 3; i++) this.burst(p, { f: 2600, q: 1.5, dur: 0.09, vol: 0.25, a: 0.03, at: i * 0.17 });
  }
  // the neck, when the head snaps round
  click(pos) {
    const p = this.pan(pos, 2, 1.2);
    for (let i = 0; i < 3; i++) this.burst(p, { type: 'highpass', f: 2500, dur: 0.006, vol: 0.5, at: i * 0.035 + Math.random() * 0.02 });
  }
  whoosh(pos) { this.burst(this.pan(pos), { f: 500, q: 1.5, dur: 0.3, vol: 0.4, sweep: [400, 2200] }); }
  whisper(pos) {
    const p = this.pan(pos, 0.6, 1.5);
    let at = 0;
    for (let i = 0; i < 7 + Math.random() * 6; i++) {
      const d = 0.06 + Math.random() * 0.14;
      this.burst(p, { f: 2000 + Math.random() * 2500, q: 2 + Math.random() * 3, dur: d, vol: 0.18, a: 0.02, at });
      at += d + Math.random() * 0.08;
    }
  }
  drip(pos) {
    const p = this.pan(pos, 1, 1.5);
    this.tone(p, { f: 1500 + Math.random() * 600, f2: 500, dur: 0.06, vol: 0.12 });
  }
  clank(pos, v = 0.5) {
    const p = this.pan(pos, 2, 0.9);
    for (const f of [210, 547, 891, 1340, 1820]) this.tone(p, { type: 'sine', f: f * (0.9 + Math.random() * 0.2), dur: 0.6 + Math.random() * 1.2, vol: v * 0.12, a: 0.002 });
    this.burst(p, { type: 'highpass', f: 1500, dur: 0.02, vol: v * 0.4 });
  }
  creak(pos) {
    const t = this.t, p = this.pan(pos, 2, 1), g = this.gain(0, p), bp = this.filter('bandpass', 700, 12, g);
    const o = this.osc('sawtooth', 35, bp);
    for (let i = 0; i < 12; i++) o.frequency.setValueAtTime(30 + Math.random() * 45, t + i * 0.1);
    this.env(g, t, 0.15, 0.5, 1.1);
    o.start(t);
    o.stop(t + 1.4);
  }
  distantThud(pos) {
    const p = this.pan(pos, 4, 0.6);
    this.tone(p, { f: 55, f2: 30, dur: 0.6, vol: 0.6 });
  }
  distantScream(pos) {
    const t = this.t, p = this.pan(pos, 4, 0.5), g = this.gain(0, p);
    const f1 = this.filter('bandpass', 1100, 5, g), f2 = this.filter('bandpass', 2600, 6, g);
    const o = this.osc('sawtooth', 520), vib = this.osc('sine', 6), vg = this.gain(18);
    o.connect(f1); o.connect(f2);
    vib.connect(vg).connect(o.frequency);
    o.frequency.linearRampToValueAtTime(880, t + 0.4);
    o.frequency.linearRampToValueAtTime(760, t + 1.4);
    o.frequency.linearRampToValueAtTime(380, t + 2.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.15);
    g.gain.setValueAtTime(0.35, t + 1.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
    o.start(t); vib.start(t); o.stop(t + 2.4); vib.stop(t + 2.4);
  }
  // a body that is not quite finished
  moan(pos) {
    const t = this.t, p = this.pan(pos, 2, 1), g = this.gain(0, p), bp = this.filter('bandpass', 600, 4, g);
    const o = this.osc('sawtooth', 110), vib = this.osc('sine', 4), vg = this.gain(6);
    o.connect(bp);
    vib.connect(vg).connect(o.frequency);
    o.frequency.linearRampToValueAtTime(160, t + 0.3);
    o.frequency.linearRampToValueAtTime(90, t + 1.6);
    this.env(g, t, 0.08, 0.5, 1.6);
    o.start(t); vib.start(t); o.stop(t + 1.8); vib.stop(t + 1.8);
    this.squelch(0.5);
  }
  shriek(pos) { // the hanging thing, waking up
    const t = this.t, p = this.pan(pos, 3, 0.7), g = this.gain(0, p), ws = this.ctx.createWaveShaper();
    ws.curve = this.curve(20);
    ws.connect(this.filter('bandpass', 1500, 1.2, g));
    for (const f of [700, 742, 1050]) { const o = this.osc('sawtooth', f, ws); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 1.3); o.start(t); o.stop(t + 1.4); }
    this.env(g, t, 0.01, 0.6, 1.3);
    this.chainRattle(pos);
  }
  chainRattle(pos) {
    const p = this.pan(pos, 2, 1);
    for (let i = 0; i < 9; i++) this.tone(p, { type: 'square', f: 1800 + Math.random() * 2500, dur: 0.03, vol: 0.05, at: i * 0.04 + Math.random() * 0.03 });
  }
  bodyDrop(pos) {
    this.chainRattle(pos);
    const p = this.pan(pos, 3, 0.8);
    this.tone(p, { f: 70, f2: 30, dur: 0.4, vol: 1, at: 0.25 });
    this.burst(p, { type: 'lowpass', f: 900, dur: 0.3, vol: 0.8, brown: true, at: 0.25 });
    this.burst(p, { type: 'bandpass', f: 500, q: 2, dur: 0.3, vol: 0.5, sweep: [300, 1500], at: 0.3 });
  }
  lockerOpen(pos) { this.creak(pos); this.clank(pos, 0.4); }
  lockerClose(pos) { this.clank(pos, 0.6); this.distantThud(pos); }
  gateRattle(pos) { for (let i = 0; i < 3; i++) setTimeout(() => this.clank(pos, 0.7), i * 90); }
  gateSlide(pos) {
    const p = this.pan(pos, 2, 1);
    this.burst(p, { f: 1300, q: 6, dur: 2.6, vol: 0.3, a: 0.2 });
    this.burst(p, { type: 'lowpass', f: 200, dur: 2.6, vol: 0.4, brown: true, a: 0.2 });
    setTimeout(() => this.clank(pos, 1), 2600);
  }
  liftMotor(on) {
    if (!this.ctx) return;
    if (on && !this.motor) {
      const g = this.gain(0, this.sfx), lp = this.filter('lowpass', 300, 1, g);
      const a = this.osc('sawtooth', 48, lp), b = this.osc('sawtooth', 96.5, lp), n = this.noise(true, lp);
      a.start(); b.start(); n.start();
      g.gain.setTargetAtTime(0.3, this.t, 0.4);
      this.motor = { g, nodes: [a, b, n] };
    } else if (!on && this.motor) {
      const m = this.motor;
      m.g.gain.setTargetAtTime(0, this.t, 0.3);
      m.nodes.forEach((n) => n.stop(this.t + 1.5));
      this.motor = null;
    }
  }
  chime() { // the PA system clearing its throat
    const bp = this.filter('bandpass', 1200, 0.7, this.gain(1, this.sfx));
    this.tone(bp, { f: 659, dur: 0.9, vol: 0.2, a: 0.01 });
    this.tone(bp, { f: 523, dur: 1.4, vol: 0.2, a: 0.01, at: 0.5 });
    this.burst(bp, { type: 'highpass', f: 2000, dur: 2, vol: 0.05, a: 0.1 });
  }
  flashlight() { this.burst(this.sfx, { type: 'highpass', f: 2200, dur: 0.015, vol: 0.3 }); }

  // ---------- loops ----------
  monsterVoice() {
    const p = this.pan({ x: 0, z: 0 }, 1.8, 1.0);
    const occ = this.filter('lowpass', 16000, 0.7, p);
    const sG = this.gain(0, occ), sBp = this.filter('bandpass', 2800, 7, sG), sN = this.noise(false, sBp);
    const bG = this.gain(0, occ), bBp = this.filter('bandpass', 480, 0.9, bG), bN = this.noise(true, bBp);
    const gG = this.gain(0, occ), gl = this.filter('lowpass', 380, 1.5, gG);
    const o1 = this.osc('sawtooth', 51, gl), o2 = this.osc('sawtooth', 54.7, gl);
    const nodes = [sN, bN, o1, o2];
    nodes.forEach((n) => n.start(this.t, n.buffer ? Math.random() * 2 : undefined));
    let breathPh = Math.random() * 6;
    return {
      update: (pos, { scrape, breath, growl, occluded }) => {
        const t = this.t;
        this.place(p, pos);
        sG.gain.setTargetAtTime(scrape * 0.4, t, 0.04);
        sBp.frequency.setTargetAtTime(2000 + Math.random() * 2200, t, 0.03);
        breathPh += 0.016 * Math.PI * 2 * (breath > 0.8 ? 0.75 : 0.32);
        const b = 0.5 + 0.5 * Math.sin(breathPh);
        bG.gain.setTargetAtTime(breath * 0.55 * b * b, t, 0.06);
        gG.gain.setTargetAtTime(growl * 0.28 * (0.7 + 0.3 * Math.sin(t * 23)), t, 0.05);
        occ.frequency.setTargetAtTime(occluded ? 650 : 16000, t, 0.12);
      },
      stop: () => { nodes.forEach((n) => { try { n.stop(); } catch {} }); p.disconnect(); },
    };
  }
  flies(pos) {
    const p = this.pan({ ...pos, y: 0.5 }, 1.2, 1.1, this.fliesBus), g = this.gain(0.05, p), bp = this.filter('bandpass', 420, 1.4, g);
    const a = this.osc('sawtooth', 188, bp), b = this.osc('sawtooth', 203, bp);
    const lfo = this.osc('sine', 9 + Math.random() * 4), lg = this.gain(30);
    lfo.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency);
    const am = this.osc('sine', 3.3), ag = this.gain(0.02);
    am.connect(ag).connect(g.gain);
    const nodes = [a, b, lfo, am];
    nodes.forEach((n) => n.start());
    return { stop: () => { nodes.forEach((n) => n.stop()); p.disconnect(); } };
  }
}
