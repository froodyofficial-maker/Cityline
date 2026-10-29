// Online status for everyone, via one Supabase Realtime presence channel.
// Each tab tracks { status, voice } and everybody sees everybody — simple and
// fine for communities up to a few thousand people.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { PresenceMeta, PresenceStatus, Status, VoiceState } from './types';
import { getData, setData } from '../store/data';

let channel: RealtimeChannel | null = null;
let current: PresenceMeta | null = null;
let chosen: Status = 'online';
let idle = false;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const IDLE_AFTER = 10 * 60_000;

const rank: Record<PresenceStatus, number> = { online: 3, dnd: 2, idle: 1, offline: 0 };

function effectiveStatus(): PresenceStatus {
  if (chosen === 'invisible') return 'offline';
  if (chosen === 'online' && idle) return 'idle';
  return chosen;
}

function publish() {
  if (!channel || !current) return;
  current = { ...current, status: effectiveStatus(), at: Date.now() };
  void channel.track(current);
  mergeSelf();
}

function mergeSelf() {
  const me = getData().me;
  if (!me || !current) return;
  // Show our own state immediately, even before the server echoes it back.
  setData((s) => ({ presence: { ...s.presence, [me]: { ...current!, status: chosen === 'invisible' ? 'offline' : current!.status } } }));
}

function sync() {
  if (!channel) return;
  const state = channel.presenceState<PresenceMeta>();
  const map: Record<string, PresenceMeta> = {};
  for (const metas of Object.values(state)) {
    for (const m of metas) {
      if (!m.user_id) continue;
      const prev = map[m.user_id];
      if (!prev) map[m.user_id] = { ...m };
      else {
        map[m.user_id] = {
          ...prev,
          status: rank[m.status] > rank[prev.status] ? m.status : prev.status,
          voice: prev.voice ?? m.voice,
          activity: prev.activity ?? m.activity,
        };
      }
    }
  }
  const me = getData().me;
  if (me && current) map[me] = { ...(map[me] ?? current), status: chosen === 'invisible' ? 'offline' : effectiveStatus(), voice: current.voice };
  setData({ presence: map });
}

function bump() {
  if (idle) {
    idle = false;
    publish();
  }
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idle = true; publish(); }, IDLE_AFTER);
}

export function startPresence(userId: string, status: Status) {
  stopPresence();
  chosen = status;
  current = { user_id: userId, status: effectiveStatus(), voice: null, activity: null, at: Date.now() };
  channel = supabase.channel('presence:online', { config: { presence: { key: userId } } });
  channel
    .on('presence', { event: 'sync' }, sync)
    .subscribe((st) => {
      if (st === 'SUBSCRIBED') publish();
      if (st === 'SUBSCRIBED') setData({ connection: 'online' });
      if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setData({ connection: 'offline' });
    });
  ['mousemove', 'keydown', 'pointerdown', 'focus'].forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
  bump();
  mergeSelf();
}

export function stopPresence() {
  ['mousemove', 'keydown', 'pointerdown', 'focus'].forEach((ev) => window.removeEventListener(ev, bump));
  if (idleTimer) clearTimeout(idleTimer);
  if (channel) {
    void channel.untrack();
    void supabase.removeChannel(channel);
  }
  channel = null;
}

export function setPresenceStatus(status: Status) {
  chosen = status;
  publish();
}

export function setPresenceVoice(v: VoiceState | null) {
  if (!current) return;
  current = { ...current, voice: v };
  publish();
}

export function setPresenceActivity(a: PresenceMeta['activity']) {
  if (!current) return;
  current = { ...current, activity: a };
  publish();
}
