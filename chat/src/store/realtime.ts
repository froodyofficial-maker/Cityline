// Live updates: one Realtime channel listens to every table the app cares about.
// Row Level Security means each user only receives rows they are allowed to see.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Channel, CustomEmoji, Member, Message, NeonSubscription, NotificationSetting, Overwrite, Profile, ReadState, Relationship, Reminder, Role, Server, Sound, Sticker, UserSettings } from '../lib/types';
import { desktopNotify } from '../lib/notify';
import { playUi, startRinging } from '../lib/sounds';
import { applyAppearance } from '../lib/theme';
import { throttle } from '../lib/utils';
import { voice } from './voice';
import {
  getData, patchMessage, removeChannel, removeMember, removeMessage, removeServerLocal, setData, setMember, upsertChannel, upsertMessages, upsertProfiles,
} from './data';
import { displayName, dmName, isMuted, permsFor } from './selectors';
import { navigate, playEffect, setUI, toast, ui } from './ui';
import { ensureProfiles, reloadBootstrap } from './actions/bootstrap';
import { applyReactionEvent, fetchMessage } from './actions/messages';
import { P, has } from '../lib/permissions';

type Row = Record<string, unknown>;
interface Change<T = Row> { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: Partial<T> }

let dbChannel: RealtimeChannel | null = null;

export function startRealtime() {
  stopRealtime();
  const me = getData().me!;
  const ch = supabase.channel('db-changes');
  const on = <T,>(table: string, fn: (c: Change<T>) => void, filter?: string) =>
    ch.on('postgres_changes' as never, { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) } as never, (p: Change<T>) => {
      try { fn(p); } catch (e) { console.error('realtime handler', table, e); }
    });
  on<Message>('messages', onMessage);
  on<{ message_id: string; user_id: string; emoji: string; is_super: boolean }>('reactions', onReaction);
  on<{ message_id: string }>('poll_votes', onPollVote);
  on<Channel>('channels', onChannel);
  on<Server>('servers', onServer);
  on<Member>('server_members', onMember);
  on<Role>('roles', onRole);
  on<{ server_id: string; user_id: string; role_id: string }>('member_roles', onMemberRole);
  on<Overwrite>('permission_overwrites', onOverwrite);
  on<{ channel_id: string; user_id: string; closed: boolean }>('channel_recipients', onRecipient);
  on<Profile>('profiles', onProfile);
  on<Relationship>('relationships', onRelationship, `user_id=eq.${me}`);
  on<ReadState>('read_states', onReadState, `user_id=eq.${me}`);
  on<CustomEmoji>('emojis', (c) => upsertOrRemove('emojis', c));
  on<Sticker>('stickers', (c) => upsertOrRemove('stickers', c));
  on<Sound>('soundboard_sounds', (c) => upsertOrRemove('sounds', c));
  on<NeonSubscription>('neon_subscriptions', onNeon);
  on<{ user_id: string; settings: UserSettings }>('user_settings', onSettings, `user_id=eq.${me}`);
  on<NotificationSetting>('notification_settings', (c) => {
    if (c.eventType === 'DELETE') return;
    setData((s) => ({ notif: { ...s.notif, [c.new.target_id]: c.new } }));
  }, `user_id=eq.${me}`);
  on<Reminder>('reminders', (c) => {
    if (c.eventType === 'DELETE' || c.new.done) setData((s) => ({ reminders: s.reminders.filter((r) => r.id !== ((c.new as Reminder)?.id ?? c.old.id)) }));
    else setData((s) => ({ reminders: [...s.reminders.filter((r) => r.id !== c.new.id), c.new] }));
  }, `user_id=eq.${me}`);
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') setData({ connection: 'online' });
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setData({ connection: 'offline' });
  });
  dbChannel = ch;
}

export function stopRealtime() {
  if (dbChannel) void supabase.removeChannel(dbChannel);
  dbChannel = null;
}

// ---------------------------------------------------------------- handlers

function upsertOrRemove(key: 'emojis' | 'stickers' | 'sounds', c: Change<{ id: string }>) {
  setData((s) => {
    const map = { ...(s[key] as Record<string, unknown>) };
    if (c.eventType === 'DELETE') delete map[c.old.id as string];
    else map[c.new.id] = c.new;
    return { [key]: map } as never;
  });
}

function mentionsMe(m: Message) {
  const s = getData();
  const me = s.me!;
  if (m.author_id === me) return false;
  if (!m.server_id) return true; // DMs always notify
  if (m.mentions?.includes(me)) return true;
  if (m.mention_everyone) return true;
  const roles = s.memberships[m.server_id]?.roles ?? [];
  return (m.mention_roles ?? []).some((r) => roles.includes(r));
}

function viewingChannel(channelId: string) {
  const r = ui().route;
  const current = r.kind === 'dm' ? r.channelId : r.kind === 'server' ? r.channelId : null;
  return (current === channelId || ui().threadId === channelId) && document.visibilityState === 'visible' && document.hasFocus();
}

function onMessage(c: Change<Message>) {
  const s = getData();
  if (c.eventType === 'DELETE') {
    removeMessage(c.old.id as string);
    return;
  }
  const m = c.new;
  if (c.eventType === 'UPDATE') {
    if (s.messages[m.id]) patchMessage(m.id, { ...m, pending: false });
    return;
  }
  // INSERT
  ensureProfiles([m.author_id]);
  const existing = s.messages[m.id];
  const ch = s.channels[m.channel_id];
  if (ch) setData((st) => ({ channels: { ...st.channels, [m.channel_id]: { ...st.channels[m.channel_id], last_message_at: m.created_at, message_count: (st.channels[m.channel_id]?.message_count ?? 0) + (existing ? 0 : 1), closed: false } } }));
  else if (!m.server_id) reloadBootstrap(); // a brand-new DM
  const cm = s.channelMsgs[m.channel_id];
  if (cm?.loaded && !cm.hasNewer) {
    const reply = m.reply_to_id ? s.messages[m.reply_to_id] : null;
    upsertMessages(m.channel_id, [{
      ...m, reactions: existing?.reactions ?? [], pending: false,
      reply: reply ? { id: reply.id, author_id: reply.author_id, content: reply.content.slice(0, 200), attachments: reply.attachments.length, type: reply.type } : existing?.reply ?? null,
    }], 'append');
    if (m.reply_to_id && !reply) void fetchMessage(m.id);
  }
  if (m.thread_id || m.type === 'thread') {
    // thread created from a message in a loaded channel
    if (m.reply_to_id && s.messages[m.reply_to_id]) void fetchMessage(m.reply_to_id);
  }
  if (existing || m.author_id === s.me) return;

  const viewing = viewingChannel(m.channel_id);
  if (m.effect && viewing && s.settings.showEffects !== false) playEffect(m.effect);

  // incoming call
  if (m.type === 'call' && !m.server_id && Date.now() - new Date(m.created_at).getTime() < 60_000) {
    if (voice().channelId !== m.channel_id && s.profiles[s.me!]?.status !== 'dnd') {
      setUI({ incomingCall: { channelId: m.channel_id, from: m.author_id!, messageId: m.id } });
      startRinging();
    }
    return;
  }
  if (m.type !== 'default') return;
  if (viewing) return;

  // mention counts are bumped by the database and arrive as read_states changes
  const isMention = mentionsMe(m);
  const muted = isMuted(m.channel_id) || isMuted(m.server_id) || (ch?.parent_id ? isMuted(ch.parent_id) : false);
  const level = (m.server_id && getData().notif[m.server_id]?.level) || 'default';
  const meStatus = getData().profiles[getData().me!]?.status;
  const focus = ui().focusMode && ui().focusMode! > Date.now();
  const shouldNotify = !muted && meStatus !== 'dnd' && !focus && (m.flags & 1) === 0 && (isMention || level === 'all') && level !== 'nothing';
  if (!shouldNotify) return;
  playUi(isMention ? 'mention' : 'message');
  if (getData().settings.notifyDesktop !== false && document.visibilityState !== 'visible') {
    const author = displayName(m.author_id, m.server_id);
    const where = ch ? (ch.server_id ? `#${ch.name} · ${getData().servers[ch.server_id]?.name ?? ''}` : dmName(ch)) : '';
    const body = m.content || (m.attachments.length ? '📎 Sent an attachment' : m.sticker ? `Sticker: ${m.sticker.name}` : m.poll ? `📊 ${m.poll.question}` : '');
    desktopNotify(`${author}${where ? ' — ' + where : ''}`, body, getData().profiles[m.author_id!]?.avatar_url ?? null, () => {
      if (ch?.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: ch.id });
      else navigate({ kind: 'dm', channelId: m.channel_id });
    });
  }
}

function onReaction(c: Change<{ message_id: string; user_id: string; emoji: string; is_super: boolean }>) {
  if (c.eventType === 'INSERT') {
    applyReactionEvent('add', c.new);
    if (c.new.is_super && c.new.user_id !== getData().me) setUI({ highlight: `super:${c.new.message_id}:${c.new.emoji}:${Date.now()}` });
  } else if (c.eventType === 'DELETE') applyReactionEvent('remove', c.old as never);
}

const pollRefresh = new Map<string, ReturnType<typeof setTimeout>>();
function onPollVote(c: Change<{ message_id: string }>) {
  const id = (c.new?.message_id ?? c.old?.message_id) as string | undefined;
  if (!id || !getData().messages[id]) return;
  clearTimeout(pollRefresh.get(id));
  pollRefresh.set(id, setTimeout(() => void fetchMessage(id), 400));
}

function onChannel(c: Change<Channel>) {
  if (c.eventType === 'DELETE') {
    const id = c.old.id as string;
    const ch = getData().channels[id];
    removeChannel(id);
    const r = ui().route;
    if (r.kind === 'server' && r.channelId === id && ch?.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: null });
    if (ui().threadId === id) setUI({ threadId: null, rightPanel: null });
    return;
  }
  const prev = getData().channels[c.new.id];
  // DM rows from realtime do not carry recipients; keep what we have
  upsertChannel({ ...prev, ...c.new, recipients: prev?.recipients ?? c.new.recipients, closed: prev?.closed ?? false });
  if (!prev && (c.new.type === 'dm' || c.new.type === 'group_dm')) reloadBootstrap();
}

function onServer(c: Change<Server>) {
  if (c.eventType === 'DELETE') {
    const id = c.old.id as string;
    if (getData().servers[id]) {
      const name = getData().servers[id].name;
      removeServerLocal(id);
      const r = ui().route;
      if (r.kind === 'server' && r.serverId === id) navigate({ kind: 'friends' });
      toast(`${name} was deleted`, 'info');
    }
    return;
  }
  if (!getData().memberships[c.new.id]) return; // public server we are not in
  setData((s) => ({ servers: { ...s.servers, [c.new.id]: { ...s.servers[c.new.id], ...c.new } } }));
}

function onMember(c: Change<Member>) {
  const me = getData().me;
  if (c.eventType === 'DELETE') {
    const { server_id, user_id } = c.old as Member;
    if (!server_id || !user_id) return;
    if (user_id === me) {
      const name = getData().servers[server_id]?.name;
      if (name) {
        removeServerLocal(server_id);
        const r = ui().route;
        if (r.kind === 'server' && r.serverId === server_id) navigate({ kind: 'friends' });
      }
      return;
    }
    removeMember(server_id, user_id);
    setData((s) => {
      const sv = s.servers[server_id];
      return sv ? { servers: { ...s.servers, [server_id]: { ...sv, member_count: Math.max(0, (sv.member_count ?? 1) - 1) } } } : {};
    });
    return;
  }
  const m = c.new;
  const prev = getData().members[m.server_id]?.[m.user_id] ?? (m.user_id === me ? getData().memberships[m.server_id] : undefined);
  if (m.user_id === me && !getData().servers[m.server_id]) { reloadBootstrap(); return; }
  setMember(m.server_id, { ...m, roles: prev?.roles ?? [] });
  ensureProfiles([m.user_id]);
  if (c.eventType === 'INSERT') {
    setData((s) => {
      const sv = s.servers[m.server_id];
      return sv ? { servers: { ...s.servers, [m.server_id]: { ...sv, member_count: (sv.member_count ?? 0) + 1 } } } : {};
    });
  }
  if (m.user_id === me && prev && m.xp > prev.xp) {
    const lv = (x: number) => { let l = 0; while (50 * (l + 1) ** 2 + 50 * (l + 1) <= x) l++; return l; };
    if (lv(m.xp) > lv(prev.xp)) {
      toast(`Level up! You’re now level ${lv(m.xp)} in ${getData().servers[m.server_id]?.name}`, 'neon', '⭐');
      playUi('success');
    }
  }
  if (m.user_id === me && prev?.timeout_until !== m.timeout_until && m.timeout_until && new Date(m.timeout_until) > new Date()) {
    toast(`You were timed out in ${getData().servers[m.server_id]?.name}`, 'error', '⏳');
  }
}

function onRole(c: Change<Role>) {
  if (c.eventType === 'DELETE') {
    const id = c.old.id as string;
    setData((s) => {
      const roles = { ...s.roles };
      delete roles[id];
      return { roles };
    });
    return;
  }
  setData((s) => ({ roles: { ...s.roles, [c.new.id]: c.new } }));
  const mine = getData().memberships[c.new.server_id];
  if (mine && (c.new.is_default || mine.roles.includes(c.new.id))) reloadBootstrap();
}

function onMemberRole(c: Change<{ server_id: string; user_id: string; role_id: string }>) {
  const me = getData().me;
  if (c.eventType === 'INSERT') {
    const { server_id, user_id, role_id } = c.new;
    const m = getData().members[server_id]?.[user_id] ?? (user_id === me ? getData().memberships[server_id] : undefined);
    if (m && !m.roles.includes(role_id)) setMember(server_id, { ...m, roles: [...m.roles, role_id] });
    if (user_id === me) reloadBootstrap();
  } else if (c.eventType === 'DELETE') {
    const { user_id, role_id } = c.old as { user_id: string; role_id: string };
    for (const [sid, list] of Object.entries(getData().members)) {
      const m = list[user_id];
      if (m?.roles.includes(role_id)) setMember(sid, { ...m, roles: m.roles.filter((r) => r !== role_id) });
    }
    if (user_id === me) {
      for (const [sid, m] of Object.entries(getData().memberships)) if (m.roles.includes(role_id)) setMember(sid, { ...m, roles: m.roles.filter((r) => r !== role_id) });
      reloadBootstrap();
    }
  }
}

function onOverwrite(c: Change<Overwrite>) {
  const row = (c.eventType === 'DELETE' ? c.old : c.new) as Overwrite;
  if (!row.channel_id) { reloadBootstrap(); return; }
  setData((s) => {
    const list = (s.overwrites[row.channel_id] || []).filter((o) => o.target_id !== row.target_id);
    if (c.eventType !== 'DELETE') list.push(c.new);
    return { overwrites: { ...s.overwrites, [row.channel_id]: list } };
  });
  reloadBootstrap();
}

function onRecipient(c: Change<{ channel_id: string; user_id: string; closed: boolean }>) {
  const me = getData().me;
  if (c.eventType === 'INSERT') {
    const ch = getData().channels[c.new.channel_id];
    if (!ch) { reloadBootstrap(); return; }
    if (!ch.recipients?.includes(c.new.user_id)) upsertChannel({ ...ch, recipients: [...(ch.recipients || []), c.new.user_id] });
    ensureProfiles([c.new.user_id]);
  } else if (c.eventType === 'UPDATE') {
    if (c.new.user_id === me) {
      const ch = getData().channels[c.new.channel_id];
      if (ch) upsertChannel({ ...ch, closed: c.new.closed });
    }
  } else {
    reloadBootstrap();
  }
}

function onProfile(c: Change<Profile>) {
  if (c.eventType === 'DELETE') return;
  const prev = getData().profiles[c.new.id];
  if (!prev && !c.new.id) return;
  upsertProfiles([{ ...c.new, neon: prev?.neon ?? null }]);
}

function onRelationship(c: Change<Relationship>) {
  const s = getData();
  if (c.eventType === 'DELETE') {
    const target = c.old.target_id as string;
    setData((st) => {
      const relationships = { ...st.relationships };
      delete relationships[target];
      return { relationships };
    });
    return;
  }
  const prev = s.relationships[c.new.target_id];
  setData((st) => ({ relationships: { ...st.relationships, [c.new.target_id]: c.new } }));
  ensureProfiles([c.new.target_id]);
  if (c.new.type === 'incoming' && prev?.type !== 'incoming') {
    playUi('message');
    toast(`${displayName(c.new.target_id)} sent you a friend request`, 'info', '👋');
  }
  if (c.new.type === 'friend' && prev?.type === 'outgoing') toast(`${displayName(c.new.target_id)} accepted your friend request`, 'success', '🎉');
}

function onReadState(c: Change<ReadState>) {
  if (c.eventType === 'DELETE') return;
  setData((s) => {
    const cur = s.readStates[c.new.channel_id];
    // ignore stale echoes of our own optimistic updates
    if (cur && new Date(cur.last_read_at) > new Date(c.new.last_read_at) && c.new.mention_count === 0) return {};
    return { readStates: { ...s.readStates, [c.new.channel_id]: c.new } };
  });
}

function onNeon(c: Change<NeonSubscription>) {
  if (c.eventType === 'DELETE') return;
  const s = getData();
  const active = new Date(c.new.expires_at) > new Date() ? c.new.tier : null;
  const p = s.profiles[c.new.user_id];
  if (p) upsertProfiles([{ ...p, neon: active }]);
  if (c.new.user_id === s.me) {
    setData({ neon: c.new });
    applyAppearance(s.settings, active === 'neon');
  }
}

function onSettings(c: Change<{ user_id: string; settings: UserSettings }>) {
  if (c.eventType === 'DELETE') return;
  const cur = getData().settings;
  if (JSON.stringify(cur) === JSON.stringify(c.new.settings)) return;
  setData({ settings: c.new.settings });
  applyAppearance(c.new.settings, getData().profiles[getData().me!]?.neon === 'neon');
}

// ---------------------------------------------------------------- typing

const typingChannels = new Map<string, RealtimeChannel>();

export function useTypingChannel(channelId: string | null) {
  useEffect(() => {
    if (!channelId) return;
    const me = getData().me;
    const ch = supabase.channel(`typing:${channelId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const uid = (payload as { user_id: string }).user_id;
      if (!uid || uid === me) return;
      ensureProfiles([uid]);
      setData((s) => ({ typing: { ...s.typing, [channelId]: { ...(s.typing[channelId] || {}), [uid]: Date.now() + 7000 } } }));
    }).on('broadcast', { event: 'stop' }, ({ payload }) => {
      const uid = (payload as { user_id: string }).user_id;
      setData((s) => {
        const t = { ...(s.typing[channelId] || {}) };
        delete t[uid];
        return { typing: { ...s.typing, [channelId]: t } };
      });
    }).subscribe();
    typingChannels.set(channelId, ch);
    return () => {
      typingChannels.delete(channelId);
      void supabase.removeChannel(ch);
    };
  }, [channelId]);
}

const throttled = new Map<string, () => void>();
export function sendTyping(channelId: string) {
  if (!throttled.has(channelId)) {
    throttled.set(channelId, throttle(() => {
      void typingChannels.get(channelId)?.send({ type: 'broadcast', event: 'typing', payload: { user_id: getData().me } });
    }, 3500));
  }
  throttled.get(channelId)!();
}

export function stopTyping(channelId: string) {
  throttled.delete(channelId);
  void typingChannels.get(channelId)?.send({ type: 'broadcast', event: 'stop', payload: { user_id: getData().me } });
}

// Clean up stale typing entries and expired statuses every few seconds.
setInterval(() => {
  const s = getData();
  const now = Date.now();
  let changed = false;
  const typing: typeof s.typing = {};
  for (const [cid, users] of Object.entries(s.typing)) {
    const kept = Object.fromEntries(Object.entries(users).filter(([, exp]) => exp > now));
    if (Object.keys(kept).length !== Object.keys(users).length) changed = true;
    typing[cid] = kept;
  }
  if (changed) setData({ typing });
}, 2000);

export function canSeeChannel(channelId: string) {
  return has(permsFor(channelId), P.VIEW_CHANNEL);
}
