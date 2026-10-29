// Every sound in Cityline is synthesised with the Web Audio API, so there are
// no audio files to host. UI sounds + the built-in soundboard live here.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
export let soundsEnabled = true;
export function setSoundsEnabled(v: boolean) { soundsEnabled = v; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}
export function audioContext() { return ac(); }

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; slideTo?: number; attack?: number; dest?: AudioNode } = {}) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, start);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, start + dur);
  const peak = opts.gain ?? 0.25;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + (opts.attack ?? 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(opts.dest ?? master!);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, opts: { gain?: number; filter?: BiquadFilterType; freq?: number; freqTo?: number; q?: number } = {}) {
  const c = ac();
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = opts.filter ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq ?? 1200, start);
  if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, start + dur);
  f.Q.value = opts.q ?? 0.8;
  const g = c.createGain();
  g.gain.setValueAtTime(opts.gain ?? 0.3, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(start);
  src.stop(start + dur);
}

type UiSound = 'message' | 'mention' | 'join' | 'leave' | 'mute' | 'unmute' | 'deafen' | 'undeafen' | 'ring' | 'send' | 'error' | 'success' | 'boost';

export function playUi(name: UiSound) {
  if (!soundsEnabled) return;
  try {
    const t = ac().currentTime + 0.01;
    switch (name) {
      case 'message': tone(880, t, 0.12, { gain: 0.15 }); tone(1320, t + 0.07, 0.16, { gain: 0.12 }); break;
      case 'mention': tone(988, t, 0.1, { gain: 0.18 }); tone(1319, t + 0.08, 0.1, { gain: 0.16 }); tone(1760, t + 0.16, 0.22, { gain: 0.14 }); break;
      case 'send': tone(660, t, 0.06, { gain: 0.06, slideTo: 990 }); break;
      case 'join': tone(523, t, 0.12, { gain: 0.16, type: 'triangle' }); tone(784, t + 0.1, 0.2, { gain: 0.16, type: 'triangle' }); break;
      case 'leave': tone(784, t, 0.12, { gain: 0.16, type: 'triangle' }); tone(440, t + 0.1, 0.22, { gain: 0.16, type: 'triangle' }); break;
      case 'mute': tone(520, t, 0.07, { gain: 0.14, slideTo: 300 }); break;
      case 'unmute': tone(300, t, 0.07, { gain: 0.14, slideTo: 560 }); break;
      case 'deafen': tone(420, t, 0.08, { gain: 0.14 }); tone(260, t + 0.07, 0.12, { gain: 0.14 }); break;
      case 'undeafen': tone(260, t, 0.08, { gain: 0.14 }); tone(420, t + 0.07, 0.12, { gain: 0.14 }); break;
      case 'error': tone(220, t, 0.18, { gain: 0.16, type: 'square', slideTo: 140 }); break;
      case 'success': [523, 659, 784].forEach((f, i) => tone(f, t + i * 0.07, 0.16, { gain: 0.13 })); break;
      case 'boost': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.06, 0.25, { gain: 0.12, type: 'triangle' })); break;
      case 'ring': ringOnce(t); break;
    }
  } catch { /* audio unavailable */ }
}

function ringOnce(t: number) {
  const notes = [659, 784, 988, 784, 659, 784, 988, 1175];
  notes.forEach((f, i) => tone(f, t + i * 0.13, 0.16, { gain: 0.12, type: 'triangle' }));
}

let ringTimer: ReturnType<typeof setInterval> | null = null;
export function startRinging() {
  stopRinging();
  playUi('ring');
  ringTimer = setInterval(() => playUi('ring'), 2200);
}
export function stopRinging() {
  if (ringTimer) clearInterval(ringTimer);
  ringTimer = null;
}

// --- soundboard ----------------------------------------------------------------

export interface BuiltinSound { id: string; name: string; emoji: string; play: (dest?: AudioNode) => void }

const at = () => ac().currentTime + 0.02;

export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { id: 'airhorn', name: 'Airhorn', emoji: '📯', play: () => { const t = at(); for (let i = 0; i < 3; i++) { [415, 523, 622].forEach((f) => tone(f, t + i * 0.28, 0.24, { type: 'sawtooth', gain: 0.09, attack: 0.02 })); } } },
  { id: 'tada', name: 'Ta-da!', emoji: '🎉', play: () => { const t = at(); [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.5, { type: 'triangle', gain: 0.13 })); } },
  { id: 'rimshot', name: 'Ba-dum-tss', emoji: '🥁', play: () => { const t = at(); tone(160, t, 0.15, { gain: 0.4, slideTo: 60 }); tone(180, t + 0.18, 0.15, { gain: 0.4, slideTo: 70 }); noise(t + 0.4, 0.6, { filter: 'highpass', freq: 6000, gain: 0.3 }); } },
  { id: 'boing', name: 'Boing', emoji: '🤸', play: () => { const t = at(); tone(180, t, 0.5, { slideTo: 520, gain: 0.25 }); tone(520, t + 0.5, 0.25, { slideTo: 300, gain: 0.15 }); } },
  { id: 'sad', name: 'Sad Trombone', emoji: '😢', play: () => { const t = at(); [392, 370, 349, 330].forEach((f, i) => tone(f, t + i * 0.35, i === 3 ? 0.9 : 0.32, { type: 'sawtooth', gain: 0.09, slideTo: i === 3 ? 300 : undefined })); } },
  { id: 'applause', name: 'Applause', emoji: '👏', play: () => { const t = at(); for (let i = 0; i < 26; i++) noise(t + i * 0.06 + Math.random() * 0.04, 0.08, { freq: 1500 + Math.random() * 1500, gain: 0.25 }); } },
  { id: 'crickets', name: 'Crickets', emoji: '🦗', play: () => { const t = at(); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) tone(4200, t + i * 0.45 + j * 0.05, 0.04, { gain: 0.08 }); } },
  { id: 'whoosh', name: 'Whoosh', emoji: '💨', play: () => noise(at(), 0.7, { freq: 300, freqTo: 4000, q: 1.2, gain: 0.35 }) },
  { id: 'laser', name: 'Pew Pew', emoji: '🔫', play: () => { const t = at(); tone(1800, t, 0.18, { slideTo: 200, type: 'square', gain: 0.08 }); tone(1800, t + 0.22, 0.18, { slideTo: 200, type: 'square', gain: 0.08 }); } },
  { id: 'bell', name: 'Ding', emoji: '🔔', play: () => { const t = at(); tone(1318, t, 1.2, { gain: 0.18 }); tone(2636, t, 0.8, { gain: 0.06 }); } },
  { id: 'quack', name: 'Quack', emoji: '🦆', play: () => { const t = at(); tone(480, t, 0.16, { type: 'sawtooth', slideTo: 300, gain: 0.12 }); tone(460, t + 0.22, 0.16, { type: 'sawtooth', slideTo: 290, gain: 0.12 }); } },
  { id: 'levelup', name: 'Level Up', emoji: '⭐', play: () => { const t = at(); [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => tone(f, t + i * 0.05, 0.12, { type: 'square', gain: 0.06 })); } },
];

export function playBuiltin(id: string) {
  if (!soundsEnabled) return;
  try { BUILTIN_SOUNDS.find((s) => s.id === id)?.play(); } catch { /* ignore */ }
}

export function playUrl(url: string, volume = 1) {
  const a = new Audio(url);
  a.volume = Math.max(0, Math.min(1, volume));
  void a.play().catch(() => {});
}
