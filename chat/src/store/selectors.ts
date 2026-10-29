import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { channelPermissions, serverPermissions, type PermCtx } from '../lib/permissions';
import type { Channel, Member, PresenceStatus, Profile, Role } from '../lib/types';
import { getData, useData, type DataState } from './data';

export function permCtx(s: DataState, serverId: string | null | undefined): PermCtx {
  return {
    me: s.me!,
    server: serverId ? s.servers[serverId] : null,
    roles: serverId ? Object.values(s.roles).filter((r) => r.server_id === serverId) : [],
    member: serverId ? s.memberships[serverId] : null,
    overwrites: s.overwrites,
    channels: s.channels,
  };
}

export function permsFor(channelId: string | null | undefined, s: DataState = getData()) {
  if (!channelId) return 0n;
  const ch = s.channels[channelId];
  if (!ch) return 0n;
  return channelPermissions(permCtx(s, ch.server_id), ch);
}

export function serverPermsFor(serverId: string | null | undefined, s: DataState = getData()) {
  if (!serverId) return 0n;
  return serverPermissions(permCtx(s, serverId));
}

/** Permissions for the current user in a channel (re-computes when roles/overwrites change). */
export function usePerms(channelId: string | null | undefined) {
  const deps = useData(useShallow((s) => [s.channels, s.roles, s.memberships, s.overwrites, s.servers, s.me] as const));
  return useMemo(() => permsFor(channelId, getData()), [channelId, ...deps]);
}

export function useServerPerms(serverId: string | null | undefined) {
  const deps = useData(useShallow((s) => [s.roles, s.memberships, s.servers, s.me] as const));
  return useMemo(() => serverPermsFor(serverId, getData()), [serverId, ...deps]);
}

export const useMe = () => useData((s) => (s.me ? s.profiles[s.me] : undefined));
export const useProfile = (id: string | null | undefined) => useData((s) => (id ? s.profiles[id] : undefined));

export function serverRoles(serverId: string, s: DataState = getData()) {
  return Object.values(s.roles).filter((r) => r.server_id === serverId).sort((a, b) => b.position - a.position);
}

export function useServerRoles(serverId: string | null | undefined) {
  const roles = useData((s) => s.roles);
  return useMemo(() => (serverId ? Object.values(roles).filter((r) => r.server_id === serverId).sort((a, b) => b.position - a.position) : []), [roles, serverId]);
}

export function memberOf(serverId: string | null | undefined, userId: string, s: DataState = getData()): Member | undefined {
  if (!serverId) return undefined;
  return s.members[serverId]?.[userId] ?? (userId === s.me ? s.memberships[serverId] : undefined);
}

export function displayName(userId: string | null | undefined, serverId?: string | null, s: DataState = getData()) {
  if (!userId) return 'Deleted User';
  const m = memberOf(serverId, userId, s);
  const p = s.profiles[userId];
  return m?.nickname || p?.display_name || p?.username || 'Unknown';
}

export function useDisplayName(userId: string | null | undefined, serverId?: string | null) {
  return useData((s) => displayName(userId, serverId, s));
}

/** Highest coloured role of a member */
export function topColorRole(userId: string, serverId: string | null | undefined, s: DataState = getData()): Role | undefined {
  if (!serverId) return undefined;
  const m = memberOf(serverId, userId, s);
  if (!m) return undefined;
  let best: Role | undefined;
  for (const id of m.roles) {
    const r = s.roles[id];
    if (r?.color && (!best || r.position > best.position)) best = r;
  }
  return best;
}

export function useRoleColor(userId: string | null | undefined, serverId: string | null | undefined) {
  return useData(useShallow((s) => {
    if (!userId) return [null, null] as const;
    const r = topColorRole(userId, serverId, s);
    return [r?.color ?? null, r?.color2 ?? null] as const;
  }));
}

export function memberRoles(userId: string, serverId: string, s: DataState = getData()): Role[] {
  const m = memberOf(serverId, userId, s);
  if (!m) return [];
  return m.roles.map((id) => s.roles[id]).filter(Boolean).sort((a, b) => b.position - a.position);
}

export function presenceStatus(userId: string | null | undefined, s: DataState = getData()): PresenceStatus {
  if (!userId) return 'offline';
  return s.presence[userId]?.status ?? 'offline';
}

export const usePresence = (userId: string | null | undefined): PresenceStatus => useData((s) => presenceStatus(userId, s));

export function isUnread(channelId: string, s: DataState = getData()) {
  const c = s.channels[channelId];
  if (!c || !c.last_message_at) return false;
  if (c.type === 'voice' || c.type === 'stage' || c.type === 'category') return false;
  const rs = s.readStates[channelId];
  if (!rs) return true;
  return new Date(c.last_message_at) > new Date(rs.last_read_at);
}

export function mentionCount(channelId: string, s: DataState = getData()) {
  return s.readStates[channelId]?.mention_count ?? 0;
}

export function isMuted(targetId: string | null | undefined, s: DataState = getData()) {
  if (!targetId) return false;
  const n = s.notif[targetId];
  if (!n?.muted) return false;
  return !n.muted_until || new Date(n.muted_until) > new Date();
}

export function serverBadge(serverId: string, s: DataState = getData()) {
  let unread = false, mentions = 0;
  const serverMuted = isMuted(serverId, s);
  for (const c of Object.values(s.channels)) {
    if (c.server_id !== serverId || c.type === 'category') continue;
    if (permsFor(c.id, s) === 0n) continue;
    mentions += mentionCount(c.id, s);
    if (!serverMuted && !isMuted(c.id, s) && !(c.parent_id && isMuted(c.parent_id, s)) && c.type !== 'thread' && isUnread(c.id, s)) unread = true;
  }
  return { unread, mentions };
}

export function useServerBadge(serverId: string) {
  const deps = useData(useShallow((s) => [s.channels, s.readStates, s.notif, s.roles, s.memberships, s.overwrites] as const));
  return useMemo(() => {
    const b = serverBadge(serverId, getData());
    return [b.unread, b.mentions] as const;
  }, [serverId, ...deps]);
}

export function sortedServerIds(s: DataState = getData()) {
  const ids = Object.keys(s.servers);
  const order = s.settings.serverOrder || [];
  return ids.sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 1e9 : ia) - (ib === -1 ? 1e9 : ib);
    const ja = s.memberships[a]?.joined_at ?? '', jb = s.memberships[b]?.joined_at ?? '';
    return ja.localeCompare(jb);
  });
}

export function dmChannels(s: DataState = getData()): Channel[] {
  return Object.values(s.channels)
    .filter((c) => (c.type === 'dm' || c.type === 'group_dm') && !c.closed)
    .sort((a, b) => (b.last_message_at || b.created_at).localeCompare(a.last_message_at || a.created_at));
}

export function dmName(c: Channel, s: DataState = getData()) {
  if (c.type === 'group_dm') {
    if (c.name) return c.name;
    const others = (c.recipients || []).filter((id) => id !== s.me);
    return others.map((id) => displayName(id, null, s)).join(', ') || 'Empty group';
  }
  const other = (c.recipients || []).find((id) => id !== s.me);
  return displayName(other ?? null, null, s);
}

export function dmOther(c: Channel, s: DataState = getData()): Profile | undefined {
  const other = (c.recipients || []).find((id) => id !== s.me);
  return other ? s.profiles[other] : undefined;
}

export function serverChannels(serverId: string, s: DataState = getData()) {
  return Object.values(s.channels).filter((c) => c.server_id === serverId && c.type !== 'thread').sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

export function firstTextChannel(serverId: string, s: DataState = getData()) {
  const all = serverChannels(serverId, s);
  const cats = all.filter((c) => c.type === 'category');
  const order = (c: Channel) => {
    const cat = cats.findIndex((x) => x.id === c.parent_id);
    return (cat === -1 ? -1 : cat) * 1000 + c.position;
  };
  const sys = s.servers[serverId]?.system_channel_id;
  if (sys && s.channels[sys] && permsFor(sys, s) !== 0n) return sys;
  return all.filter((c) => ['text', 'announcement', 'forum'].includes(c.type) && permsFor(c.id, s) !== 0n).sort((a, b) => order(a) - order(b))[0]?.id ?? null;
}

export function voiceMembers(channelId: string, s: DataState = getData()) {
  return Object.values(s.presence).filter((p) => p.voice?.channel_id === channelId).sort((a, b) => (a.voice!.joined_at - b.voice!.joined_at));
}

export function useVoiceMembers(channelId: string) {
  const presence = useData((s) => s.presence);
  return useMemo(() => Object.values(presence).filter((p) => p.voice?.channel_id === channelId).sort((a, b) => a.voice!.joined_at - b.voice!.joined_at), [presence, channelId]);
}

export function friendIds(s: DataState = getData()) {
  return Object.values(s.relationships).filter((r) => r.type === 'friend').map((r) => r.target_id);
}

export function isBlocked(userId: string, s: DataState = getData()) {
  return s.relationships[userId]?.type === 'blocked';
}
