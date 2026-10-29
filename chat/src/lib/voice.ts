// Voice, video and screen sharing.
// Everyone in a voice channel connects directly to everyone else (a "mesh"),
// using WebRTC. Supabase Realtime carries the signalling messages and keeps
// the list of who is in the channel (presence). Works well for ~8 people.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { config } from './config';
import { supabase } from './supabase';
import { audioContext, playBuiltin, playUi, playUrl } from './sounds';
import { setPresenceVoice } from './presence';
import { getData } from '../store/data';
import { setVoice, voice, type VoiceParticipant } from '../store/voice';
import { toast } from '../store/ui';

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  senders: Map<string, RTCRtpSender>;
  pendingStreams: Map<string, MediaStream>;
}

const peers = new Map<string, Peer>();
const audioEls = new Map<string, HTMLAudioElement>();
const analysers = new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; data: Uint8Array<ArrayBuffer> }>();
let rt: RealtimeChannel | null = null;
let micStream: MediaStream | null = null;
let speakTimer: ReturnType<typeof setInterval> | null = null;
let joinedAt = 0;
let firstSync = true;
let pttHeld = false;
let knownParticipants = new Set<string>();

function iceServers(): RTCIceServer[] {
  const list: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ];
  if (config.turnUrl) list.push({ urls: config.turnUrl, username: config.turnUsername, credential: config.turnCredential });
  return list;
}

const me = () => getData().me!;
const settings = () => getData().settings;
const isNeon = () => getData().profiles[me()]?.neon === 'neon';

function micEnabled() {
  const v = voice();
  if (v.muted || v.deafened || v.noMic) return false;
  if (settings().pushToTalk) return pttHeld;
  return true;
}

function applyMic() {
  micStream?.getAudioTracks().forEach((t) => (t.enabled = micEnabled()));
}

function selfState(): Omit<VoiceParticipant, 'user_id'> & { user_id: string } {
  const v = voice();
  return {
    user_id: me(),
    muted: v.muted || v.noMic,
    deafened: v.deafened,
    video: !!v.localCamera,
    screen: !!v.localScreen,
    streams: { mic: micStream?.id, camera: v.localCamera?.id, screen: v.localScreen?.id },
    hand: v.hand,
    speaker: v.speaker,
    joined_at: joinedAt,
  };
}

function publishSelf() {
  if (!rt) return;
  void rt.track(selfState());
  const v = voice();
  if (v.channelId) {
    setPresenceVoice({
      channel_id: v.channelId, server_id: v.serverId, muted: v.muted || v.noMic, deafened: v.deafened,
      video: !!v.localCamera, screen: !!v.localScreen, joined_at: joinedAt,
    });
  }
}

function send(event: string, payload: Record<string, unknown>) {
  void rt?.send({ type: 'broadcast', event, payload: { ...payload, from: me() } });
}

// ---------------------------------------------------------------- peers

function classify(userId: string, stream: MediaStream) {
  const p = voice().participants[userId];
  const kind = p?.streams.screen === stream.id ? 'screen' : p?.streams.camera === stream.id ? 'camera' : p?.streams.mic === stream.id ? 'mic' : null;
  if (!kind) return false;
  setVoice((s) => ({ remote: { ...s.remote, [userId]: { ...s.remote[userId], [kind]: stream } } }));
  if (kind === 'mic' || kind === 'screen') attachAudio(`${userId}:${kind}`, stream);
  if (kind === 'mic') watchSpeaking(userId, stream);
  return true;
}

function ensurePeer(userId: string): Peer {
  const existing = peers.get(userId);
  if (existing) return existing;
  const pc = new RTCPeerConnection({ iceServers: iceServers() });
  const peer: Peer = { pc, polite: me() > userId, makingOffer: false, ignoreOffer: false, senders: new Map(), pendingStreams: new Map() };
  peers.set(userId, peer);

  pc.onicecandidate = ({ candidate }) => { if (candidate) send('signal', { to: userId, candidate: candidate.toJSON() }); };
  pc.onnegotiationneeded = async () => {
    try {
      peer.makingOffer = true;
      await pc.setLocalDescription();
      send('signal', { to: userId, description: pc.localDescription?.toJSON() });
    } catch (e) {
      console.warn('negotiation failed', e);
    } finally {
      peer.makingOffer = false;
    }
  };
  pc.ontrack = (ev) => {
    const stream = ev.streams[0] ?? new MediaStream([ev.track]);
    if (!classify(userId, stream)) peer.pendingStreams.set(stream.id, stream);
    ev.track.onunmute = () => { if (!classify(userId, stream)) peer.pendingStreams.set(stream.id, stream); };
    stream.onremovetrack = () => {
      if (stream.getTracks().length === 0) {
        setVoice((s) => {
          const r = { ...s.remote[userId] };
          for (const k of ['camera', 'screen', 'mic'] as const) if (r[k]?.id === stream.id) delete r[k];
          return { remote: { ...s.remote, [userId]: r } };
        });
      }
    };
  };
  pc.onconnectionstatechange = () => {
    setVoice((s) => ({ peerState: { ...s.peerState, [userId]: pc.connectionState } }));
    if (pc.connectionState === 'failed') pc.restartIce();
  };

  // send what we have
  if (micStream) for (const t of micStream.getTracks()) peer.senders.set(t.id, pc.addTrack(t, micStream));
  const v = voice();
  for (const s of [v.localCamera, v.localScreen]) if (s) for (const t of s.getTracks()) peer.senders.set(t.id, pc.addTrack(t, s));
  return peer;
}

function closePeer(userId: string) {
  const p = peers.get(userId);
  if (!p) return;
  p.pc.close();
  peers.delete(userId);
  for (const key of [...audioEls.keys()]) if (key.startsWith(userId + ':')) { audioEls.get(key)!.remove(); audioEls.delete(key); }
  const a = analysers.get(userId);
  if (a) { a.source.disconnect(); analysers.delete(userId); }
  setVoice((s) => {
    const remote = { ...s.remote }; delete remote[userId];
    const speaking = { ...s.speaking }; delete speaking[userId];
    return { remote, speaking };
  });
}

async function onSignal({ payload }: { payload: { from: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit } }) {
  if (payload.to !== me()) return;
  const peer = ensurePeer(payload.from);
  const { pc } = peer;
  try {
    if (payload.description) {
      const d = payload.description;
      const collision = d.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;
      await pc.setRemoteDescription(d);
      if (d.type === 'offer') {
        await pc.setLocalDescription();
        send('signal', { to: payload.from, description: pc.localDescription?.toJSON() });
      }
    } else if (payload.candidate) {
      try { await pc.addIceCandidate(payload.candidate); } catch (e) { if (!peer.ignoreOffer) console.warn(e); }
    }
  } catch (e) {
    console.warn('signal error', e);
  }
}

function onSync() {
  if (!rt) return;
  const state = rt.presenceState<VoiceParticipant>();
  const participants: Record<string, VoiceParticipant> = {};
  for (const metas of Object.values(state)) for (const m of metas) if (m.user_id) participants[m.user_id] = m;
  setVoice({ participants });
  const ids = new Set(Object.keys(participants));
  for (const id of ids) {
    if (id === me()) continue;
    // Only the impolite side opens the connection; the other answers when the
    // offer arrives. If both offered at once, Chromium's rollback of the
    // polite side's offer can leave its ICE agent with no candidates.
    const peer = peers.get(id) ?? (me() < id ? ensurePeer(id) : null);
    if (!peer) continue;
    for (const [sid, stream] of peer.pendingStreams) if (classify(id, stream)) peer.pendingStreams.delete(sid);
  }
  for (const id of [...peers.keys()]) if (!ids.has(id)) closePeer(id);
  if (!firstSync) {
    for (const id of ids) if (!knownParticipants.has(id) && id !== me()) playUi('join');
    for (const id of knownParticipants) if (!ids.has(id) && id !== me()) playUi('leave');
  }
  firstSync = false;
  knownParticipants = ids;
}

// ---------------------------------------------------------------- audio

function attachAudio(key: string, stream: MediaStream) {
  let el = audioEls.get(key);
  if (!el) {
    el = document.createElement('audio');
    el.autoplay = true;
    (el as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioEls.set(key, el);
  }
  if (el.srcObject !== stream) el.srcObject = stream;
  applyVolumes();
  const out = settings().outputDevice;
  const sink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (out && sink.setSinkId) void sink.setSinkId(out).catch(() => {});
  void el.play().catch(() => {});
}

export function applyVolumes() {
  const v = voice();
  for (const [key, el] of audioEls) {
    const uid = key.split(':')[0];
    el.muted = v.deafened || !!v.localMuted[uid];
    el.volume = Math.min(1, (v.volumes[uid] ?? 100) / 100);
  }
}

function watchSpeaking(userId: string, stream: MediaStream) {
  try {
    const c = audioContext();
    const old = analysers.get(userId);
    if (old) old.source.disconnect();
    const source = c.createMediaStreamSource(stream);
    const analyser = c.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analysers.set(userId, { analyser, source, data: new Uint8Array(analyser.fftSize) });
  } catch { /* no audio context */ }
}

function startSpeakingLoop() {
  if (speakTimer) clearInterval(speakTimer);
  const hold: Record<string, number> = {};
  speakTimer = setInterval(() => {
    const threshold = (settings().inputSensitivity ?? 40) / 100 * 0.12 + 0.01;
    const next: Record<string, boolean> = {};
    const now = Date.now();
    for (const [uid, a] of analysers) {
      a.analyser.getByteTimeDomainData(a.data);
      let sum = 0;
      for (let i = 0; i < a.data.length; i++) { const x = (a.data[i] - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / a.data.length);
      const self = uid === me();
      const loud = rms > threshold && (!self || micEnabled());
      if (loud) hold[uid] = now + 250;
      next[uid] = loud || (hold[uid] ?? 0) > now;
    }
    const cur = voice().speaking;
    const changed = Object.keys(next).some((k) => !!cur[k] !== next[k]) || Object.keys(cur).some((k) => !(k in next));
    if (changed) setVoice({ speaking: next });
  }, 90);
}

// ---------------------------------------------------------------- public API

async function getMic(): Promise<MediaStream | null> {
  try {
    const s = settings();
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: s.inputDevice ? { ideal: s.inputDevice } : undefined,
        echoCancellation: true,
        noiseSuppression: s.noiseSuppression !== false,
        autoGainControl: true,
      },
      video: false,
    });
  } catch (e) {
    console.warn('mic unavailable', e);
    return null;
  }
}

export async function joinVoice(channelId: string, serverId: string | null) {
  const v = voice();
  if (v.channelId === channelId && v.status !== 'idle') return;
  if (v.channelId) await leaveVoice(true);
  setVoice({ channelId, serverId, status: 'connecting', participants: {}, remote: {}, speaking: {}, peerState: {}, hand: false, speaker: false, focused: null });
  joinedAt = Date.now();
  firstSync = true;
  knownParticipants = new Set();
  micStream = await getMic();
  if (voice().channelId !== channelId) { micStream?.getTracks().forEach((t) => t.stop()); return; }
  setVoice({ noMic: !micStream });
  if (!micStream) toast('No microphone found — you joined listen-only.', 'info', '🎧');
  applyMic();
  if (micStream) watchSpeaking(me(), micStream);
  startSpeakingLoop();

  rt = supabase.channel(`voice:${channelId}`, { config: { presence: { key: me() }, broadcast: { self: false } } });
  rt.on('broadcast', { event: 'signal' }, (m) => void onSignal(m as never))
    .on('broadcast', { event: 'sound' }, ({ payload }) => playSoundLocal(payload as { id?: string; url?: string; volume?: number }))
    .on('broadcast', { event: 'stage' }, ({ payload }) => onStage(payload as { to: string; speaker: boolean }))
    .on('presence', { event: 'sync' }, onSync)
    .subscribe((st) => {
      if (st === 'SUBSCRIBED') {
        setVoice({ status: 'connected' });
        publishSelf();
        playUi('join');
      }
    });
  window.addEventListener('keydown', pttDown);
  window.addEventListener('keyup', pttUp);
}

export async function leaveVoice(silent = false) {
  window.removeEventListener('keydown', pttDown);
  window.removeEventListener('keyup', pttUp);
  for (const id of [...peers.keys()]) closePeer(id);
  if (rt) {
    try { await rt.untrack(); } catch { /* ignore */ }
    void supabase.removeChannel(rt);
  }
  rt = null;
  const v = voice();
  for (const s of [micStream, v.localCamera, v.localScreen]) s?.getTracks().forEach((t) => t.stop());
  micStream = null;
  for (const el of audioEls.values()) el.remove();
  audioEls.clear();
  for (const a of analysers.values()) a.source.disconnect();
  analysers.clear();
  if (speakTimer) clearInterval(speakTimer);
  speakTimer = null;
  setVoice({ channelId: null, serverId: null, status: 'idle', participants: {}, remote: {}, speaking: {}, localCamera: null, localScreen: null, peerState: {}, focused: null });
  setPresenceVoice(null);
  if (!silent) playUi('leave');
}

export function toggleMute() {
  const v = voice();
  if (v.noMic) { toast('No microphone available', 'error'); return; }
  const muted = v.deafened ? false : !v.muted;   // un-muting while deafened also undeafens (like Discord)
  setVoice({ muted, deafened: false });
  localStorage.setItem('cityline:muted', muted ? '1' : '0');
  localStorage.setItem('cityline:deafened', '0');
  applyMic();
  applyVolumes();
  publishSelf();
  playUi(muted ? 'mute' : 'unmute');
}

export function toggleDeafen() {
  const v = voice();
  const deafened = !v.deafened;
  setVoice({ deafened });   // deafened also silences the mic (see micEnabled); your mute choice is kept
  localStorage.setItem('cityline:deafened', deafened ? '1' : '0');
  applyMic();
  applyVolumes();
  publishSelf();
  playUi(deafened ? 'deafen' : 'undeafen');
}

function addStream(stream: MediaStream) {
  for (const peer of peers.values()) for (const t of stream.getTracks()) peer.senders.set(t.id, peer.pc.addTrack(t, stream));
}
function removeStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const peer of peers.values()) {
    for (const t of stream.getTracks()) {
      const sender = peer.senders.get(t.id);
      if (sender) { try { peer.pc.removeTrack(sender); } catch { /* closed */ } peer.senders.delete(t.id); }
    }
  }
  stream.getTracks().forEach((t) => t.stop());
}

export async function toggleCamera() {
  const v = voice();
  if (v.localCamera) {
    removeStream(v.localCamera);
    setVoice({ localCamera: null, video: false });
    publishSelf();
    return;
  }
  try {
    const hd = isNeon();
    const cam = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: settings().videoDevice ? { ideal: settings().videoDevice } : undefined,
        width: { ideal: hd ? 1920 : 1280 }, height: { ideal: hd ? 1080 : 720 }, frameRate: { ideal: hd ? 60 : 30 },
      },
    });
    setVoice({ localCamera: cam, video: true });
    publishSelf();
    addStream(cam);
  } catch {
    toast('Could not start your camera', 'error');
  }
}

export async function toggleScreen() {
  const v = voice();
  if (v.localScreen) {
    removeStream(v.localScreen);
    setVoice({ localScreen: null, screen: false });
    publishSelf();
    return;
  }
  try {
    const hd = isNeon();
    const scr = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: hd ? 60 : 30 }, width: { ideal: hd ? 1920 : 1280 }, height: { ideal: hd ? 1080 : 720 } },
      audio: true,
    });
    scr.getVideoTracks()[0]?.addEventListener('ended', () => { if (voice().localScreen === scr) void toggleScreen(); });
    setVoice({ localScreen: scr, screen: true });
    publishSelf();
    addStream(scr);
    if (!hd) toast('Streaming in 720p · Neon unlocks 1080p 60fps', 'neon', '📺');
  } catch {
    /* user cancelled */
  }
}

export function setUserVolume(userId: string, vol: number) {
  setVoice((s) => {
    const volumes = { ...s.volumes, [userId]: vol };
    localStorage.setItem('cityline:volumes', JSON.stringify(volumes));
    return { volumes };
  });
  applyVolumes();
}

export function toggleLocalMute(userId: string) {
  setVoice((s) => ({ localMuted: { ...s.localMuted, [userId]: !s.localMuted[userId] } }));
  applyVolumes();
}

function playSoundLocal(p: { id?: string; url?: string; volume?: number }) {
  if (voice().deafened) return;
  if (p.url) playUrl(p.url, p.volume ?? 1);
  else if (p.id) playBuiltin(p.id);
}

export function playSoundboard(p: { id?: string; url?: string; volume?: number }) {
  if (!rt) return;
  send('sound', p);
  playSoundLocal(p);
}

// Stage channels: speakers vs audience (moderators invite people up).
export function setHand(hand: boolean) { setVoice({ hand }); publishSelf(); }
export function setSpeaker(speaker: boolean) { setVoice({ speaker, hand: false }); if (!speaker && !voice().muted) toggleMute(); publishSelf(); }
export function inviteToStage(userId: string, speaker: boolean) { send('stage', { to: userId, speaker }); }
function onStage(p: { to: string; speaker: boolean }) {
  if (p.to !== me()) return;
  setSpeaker(p.speaker);
  toast(p.speaker ? 'You’re on stage — unmute to talk' : 'You were moved to the audience', 'info', '🎙️');
}

// Push to talk
function pttKey() { return settings().pttKey || '`'; }
function pttDown(e: KeyboardEvent) {
  if (!settings().pushToTalk || e.key !== pttKey() || pttHeld) return;
  const t = e.target as HTMLElement;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  pttHeld = true; applyMic();
}
function pttUp(e: KeyboardEvent) {
  if (e.key !== pttKey()) return;
  pttHeld = false; applyMic();
}

export function refreshMicSettings() { applyMic(); }

window.addEventListener('beforeunload', () => { if (rt) void rt.untrack(); });
