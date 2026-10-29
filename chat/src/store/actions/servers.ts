import { check, rpc, supabase } from '../../lib/supabase';
import type { AuditEntry, AutomodRule, Channel, CustomEmoji, Invite, Member, Overwrite, Profile, Role, Server, ServerEvent, Sound, Sticker } from '../../lib/types';
import { squareImage, uploadFile } from '../../lib/upload';
import { playUi } from '../../lib/sounds';
import { getData, removeServerLocal, setData, setMember, upsertChannel, upsertProfiles } from '../data';
import { firstTextChannel } from '../selectors';
import { navigate, toast, ui } from '../ui';
import { loadBootstrap } from './bootstrap';

export async function createServer(name: string, icon: File | null, template: string) {
  let iconUrl: string | null = null;
  if (icon) iconUrl = (await uploadFile(await squareImage(icon, 256), 'icons')).url;
  const id = await rpc<string>('create_server', { p_name: name, p_icon_url: iconUrl, p_template: template });
  await loadBootstrap();
  navigate({ kind: 'server', serverId: id, channelId: firstTextChannel(id) });
  playUi('success');
  return id;
}

// An invite opened while signed out is remembered across sign-up, email
// confirmation and OAuth redirects, then accepted once the app has loaded.
const PENDING_INVITE = 'cityline:pending-invite';

export function rememberInvite(code: string) {
  try { localStorage.setItem(PENDING_INVITE, code); } catch { /* storage unavailable */ }
}

export function takePendingInvite() {
  try {
    const code = localStorage.getItem(PENDING_INVITE);
    localStorage.removeItem(PENDING_INVITE);
    return code;
  } catch { return null; }
}

export async function joinByInvite(code: string) {
  const clean = code.trim().replace(/^.*\/invite\//, '').replace(/[^A-Za-z0-9]/g, '');
  const id = await rpc<string>('join_server', { p_code: clean });
  await loadBootstrap();
  navigate({ kind: 'server', serverId: id, channelId: firstTextChannel(id) });
  playUi('join');
  return id;
}

export async function joinPublic(serverId: string) {
  await rpc('join_public_server', { p_server: serverId });
  await loadBootstrap();
  navigate({ kind: 'server', serverId, channelId: firstTextChannel(serverId) });
}

export async function getInvite(code: string) {
  return rpc<{
    code: string; expires_at: string | null;
    server: { id: string; name: string; icon_url: string | null; banner_url: string | null; description: string; member_count: number; boost_count: number; accent_color: string | null };
    channel: { id: string; name: string; type: string } | null;
    inviter: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
    is_member: boolean;
  } | null>('get_invite', { p_code: code });
}

export async function discover(query = '', tag: string | null = null) {
  return rpc<(Pick<Server, 'id' | 'name' | 'description' | 'icon_url' | 'banner_url' | 'tags' | 'accent_color'> & { member_count: number; boost_count: number; is_member: boolean })[]>('discover_servers', { p_query: query, p_tag: tag });
}

export async function leaveServer(serverId: string) {
  await rpc('leave_server', { p_server: serverId });
  removeServerLocal(serverId);
  if (ui().route.kind === 'server' && (ui().route as { serverId: string }).serverId === serverId) navigate({ kind: 'friends' });
}

export async function deleteServer(serverId: string) {
  check(await supabase.from('servers').delete().eq('id', serverId));
  removeServerLocal(serverId);
  navigate({ kind: 'friends' });
}

export async function updateServer(serverId: string, patch: Partial<Server>) {
  const row = check(await supabase.from('servers').update(patch).eq('id', serverId).select().single()) as Server;
  setData((s) => ({ servers: { ...s.servers, [serverId]: { ...s.servers[serverId], ...row } } }));
  return row;
}

export async function uploadServerImage(file: File, kind: 'icon' | 'banner') {
  const f = kind === 'icon' ? await squareImage(file, 256) : file;
  return (await uploadFile(f, kind === 'icon' ? 'icons' : 'banners')).url;
}

export async function createInvite(serverId: string, channelId: string | null, maxUses = 0, expiresHours: number | null = 168) {
  const expires_at = expiresHours ? new Date(Date.now() + expiresHours * 3600_000).toISOString() : null;
  return check(await supabase.from('invites').insert({ server_id: serverId, channel_id: channelId, max_uses: maxUses, expires_at }).select().single()) as Invite;
}

export async function listInvites(serverId: string) {
  return (check(await supabase.from('invites').select('*').eq('server_id', serverId).order('created_at', { ascending: false })) ?? []) as Invite[];
}

export async function deleteInvite(code: string) {
  check(await supabase.from('invites').delete().eq('code', code));
}

export async function loadMembers(serverId: string, force = false) {
  if (getData().membersLoaded[serverId] && !force) return;
  const res = await rpc<{ members: Member[]; profiles: Profile[] }>('get_server_members', { p_server: serverId });
  upsertProfiles(res.profiles);
  setData((s) => ({
    members: { ...s.members, [serverId]: Object.fromEntries(res.members.map((m) => [m.user_id, m])) },
    membersLoaded: { ...s.membersLoaded, [serverId]: true },
  }));
}

export const kickMember = (serverId: string, userId: string, reason?: string) => rpc('kick_member', { p_server: serverId, p_user: userId, p_reason: reason ?? null });
export const banMember = (serverId: string, userId: string, reason?: string, deleteHours = 0) => rpc('ban_member', { p_server: serverId, p_user: userId, p_reason: reason ?? null, p_delete_hours: deleteHours });
export const unbanMember = (serverId: string, userId: string) => rpc('unban_member', { p_server: serverId, p_user: userId });
export const getBans = (serverId: string) => rpc<{ user_id: string; reason: string | null; created_at: string; profile: Profile }[]>('get_bans', { p_server: serverId });
export const timeoutMember = (serverId: string, userId: string, minutes: number, reason?: string) => rpc('timeout_member', { p_server: serverId, p_user: userId, p_minutes: minutes, p_reason: reason ?? null });

export async function setNickname(serverId: string, userId: string, nickname: string) {
  await rpc('set_nickname', { p_server: serverId, p_user: userId, p_nickname: nickname });
  const m = getData().members[serverId]?.[userId] ?? (userId === getData().me ? getData().memberships[serverId] : undefined);
  if (m) setMember(serverId, { ...m, nickname: nickname.trim() || null });
}

export async function setServerAvatar(serverId: string, file: File | null) {
  const url = file ? (await uploadFile(await squareImage(file, 256), 'avatars')).url : null;
  await rpc('set_server_avatar', { p_server: serverId, p_url: url });
  const m = getData().memberships[serverId];
  if (m) setMember(serverId, { ...m, avatar_url: url });
}

// ---------- roles --------------------------------------------------------------

export async function createRole(serverId: string, patch: Partial<Role> = {}) {
  const role = check(await supabase.from('roles').insert({ server_id: serverId, name: 'new role', position: 1, permissions: 0, ...patch }).select().single()) as Role;
  setData((s) => ({ roles: { ...s.roles, [role.id]: role } }));
  return role;
}

export async function updateRole(roleId: string, patch: Partial<Role>) {
  const role = check(await supabase.from('roles').update(patch).eq('id', roleId).select().single()) as Role;
  setData((s) => ({ roles: { ...s.roles, [role.id]: role } }));
  return role;
}

export async function deleteRole(roleId: string) {
  check(await supabase.from('roles').delete().eq('id', roleId));
  setData((s) => { const roles = { ...s.roles }; delete roles[roleId]; return { roles }; });
}

export async function reorderRoles(serverId: string, items: { id: string; position: number }[]) {
  await rpc('reorder_roles', { p_server: serverId, p_items: items });
  setData((s) => {
    const roles = { ...s.roles };
    for (const it of items) if (roles[it.id]) roles[it.id] = { ...roles[it.id], position: it.position };
    return { roles };
  });
}

export async function addRole(serverId: string, userId: string, roleId: string) {
  check(await supabase.from('member_roles').insert({ server_id: serverId, user_id: userId, role_id: roleId }));
  const m = getData().members[serverId]?.[userId];
  if (m && !m.roles.includes(roleId)) setMember(serverId, { ...m, roles: [...m.roles, roleId] });
}

export async function removeRole(serverId: string, userId: string, roleId: string) {
  check(await supabase.from('member_roles').delete().match({ user_id: userId, role_id: roleId }));
  const m = getData().members[serverId]?.[userId];
  if (m) setMember(serverId, { ...m, roles: m.roles.filter((r) => r !== roleId) });
}

// ---------- channels ---------------------------------------------------------------

export async function createChannel(serverId: string, input: { name: string; type: Channel['type']; parent_id?: string | null; topic?: string; private?: boolean; allowRoles?: string[] }) {
  const siblings = Object.values(getData().channels).filter((c) => c.server_id === serverId && (c.parent_id ?? null) === (input.parent_id ?? null));
  const position = siblings.reduce((m, c) => Math.max(m, c.position), -1) + 1;
  const ch = check(await supabase.from('channels').insert({
    server_id: serverId, name: input.name, type: input.type, parent_id: input.type === 'category' ? null : input.parent_id ?? null,
    topic: input.topic ?? '', position,
  }).select().single()) as Channel;
  upsertChannel(ch);
  if (input.private) {
    const everyone = Object.values(getData().roles).find((r) => r.server_id === serverId && r.is_default);
    if (everyone) await setOverwrite(ch.id, everyone.id, 'role', 0n, 1n);
    for (const r of input.allowRoles ?? []) await setOverwrite(ch.id, r, 'role', 1n, 0n);
  }
  return ch;
}

export async function updateChannel(channelId: string, patch: Partial<Channel>) {
  const ch = check(await supabase.from('channels').update(patch).eq('id', channelId).select().single()) as Channel;
  upsertChannel(ch);
  return ch;
}

export async function deleteChannel(channelId: string) {
  const ch = getData().channels[channelId];
  check(await supabase.from('channels').delete().eq('id', channelId));
  setData((s) => { const channels = { ...s.channels }; delete channels[channelId]; return { channels }; });
  const r = ui().route;
  if (r.kind === 'server' && r.channelId === channelId && ch?.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: firstTextChannel(ch.server_id) });
}

export async function reorderChannels(serverId: string, items: { id: string; position: number; parent_id?: string | null }[]) {
  setData((s) => {
    const channels = { ...s.channels };
    for (const it of items) if (channels[it.id]) channels[it.id] = { ...channels[it.id], position: it.position, ...(it.parent_id !== undefined ? { parent_id: it.parent_id } : {}) };
    return { channels };
  });
  await rpc('reorder_channels', { p_server: serverId, p_items: items });
}

export async function setOverwrite(channelId: string, targetId: string, targetType: 'role' | 'member', allow: bigint, deny: bigint) {
  const row = { channel_id: channelId, target_id: targetId, target_type: targetType, allow: Number(allow), deny: Number(deny) };
  check(await supabase.from('permission_overwrites').upsert(row, { onConflict: 'channel_id,target_id' }));
  setData((s) => ({ overwrites: { ...s.overwrites, [channelId]: [...(s.overwrites[channelId] || []).filter((o) => o.target_id !== targetId), row as Overwrite] } }));
}

export async function removeOverwrite(channelId: string, targetId: string) {
  check(await supabase.from('permission_overwrites').delete().match({ channel_id: channelId, target_id: targetId }));
  setData((s) => ({ overwrites: { ...s.overwrites, [channelId]: (s.overwrites[channelId] || []).filter((o) => o.target_id !== targetId) } }));
}

// ---------- expressions ----------------------------------------------------------------

export async function addEmoji(serverId: string, name: string, file: File) {
  const animated = file.type === 'image/gif';
  const f = animated ? file : await squareImage(file, 128);
  const { url } = await uploadFile(f, 'emoji');
  const e = check(await supabase.from('emojis').insert({ server_id: serverId, name, url, animated }).select().single()) as CustomEmoji;
  setData((s) => ({ emojis: { ...s.emojis, [e.id]: e } }));
  return e;
}

export async function deleteEmoji(id: string) {
  check(await supabase.from('emojis').delete().eq('id', id));
  setData((s) => { const emojis = { ...s.emojis }; delete emojis[id]; return { emojis }; });
}

export async function renameEmoji(id: string, name: string) {
  const e = check(await supabase.from('emojis').update({ name }).eq('id', id).select().single()) as CustomEmoji;
  setData((s) => ({ emojis: { ...s.emojis, [e.id]: e } }));
}

export async function addSticker(serverId: string, name: string, file: File) {
  const { url } = await uploadFile(file, 'stickers');
  const st = check(await supabase.from('stickers').insert({ server_id: serverId, name, url }).select().single()) as Sticker;
  setData((s) => ({ stickers: { ...s.stickers, [st.id]: st } }));
}

export async function deleteSticker(id: string) {
  check(await supabase.from('stickers').delete().eq('id', id));
  setData((s) => { const stickers = { ...s.stickers }; delete stickers[id]; return { stickers }; });
}

export async function addSound(serverId: string, name: string, emoji: string, file: File) {
  if (file.size > 1024 * 1024) throw new Error('Sounds can be up to 1 MB');
  const { url } = await uploadFile(file, 'sounds');
  const snd = check(await supabase.from('soundboard_sounds').insert({ server_id: serverId, name, emoji, url }).select().single()) as Sound;
  setData((s) => ({ sounds: { ...s.sounds, [snd.id]: snd } }));
}

export async function deleteSound(id: string) {
  check(await supabase.from('soundboard_sounds').delete().eq('id', id));
  setData((s) => { const sounds = { ...s.sounds }; delete sounds[id]; return { sounds }; });
}

// ---------- automod, audit, events, boosts, xp -------------------------------------

export async function listAutomod(serverId: string) {
  return (check(await supabase.from('automod_rules').select('*').eq('server_id', serverId).order('created_at')) ?? []) as AutomodRule[];
}
export async function saveAutomod(rule: Partial<AutomodRule> & { server_id: string }) {
  if (rule.id) return check(await supabase.from('automod_rules').update(rule).eq('id', rule.id).select().single()) as AutomodRule;
  return check(await supabase.from('automod_rules').insert(rule).select().single()) as AutomodRule;
}
export async function deleteAutomod(id: string) { check(await supabase.from('automod_rules').delete().eq('id', id)); }

export async function loadAudit(serverId: string, before?: number) {
  const res = await rpc<{ entries: AuditEntry[]; profiles: Profile[] }>('get_audit_log', { p_server: serverId, p_limit: 50, p_before: before ?? null });
  upsertProfiles(res.profiles);
  return res.entries;
}

export async function listEvents(serverId: string) {
  return (check(await supabase.from('server_events').select('*').eq('server_id', serverId).neq('status', 'canceled').order('starts_at')) ?? []) as ServerEvent[];
}
export async function saveEvent(ev: Partial<ServerEvent> & { server_id: string }) {
  if (ev.id) return check(await supabase.from('server_events').update(ev).eq('id', ev.id).select().single()) as ServerEvent;
  return check(await supabase.from('server_events').insert(ev).select().single()) as ServerEvent;
}
export async function deleteEvent(id: string) { check(await supabase.from('server_events').delete().eq('id', id)); }
export async function listRsvps(eventIds: string[]) {
  if (!eventIds.length) return [];
  return (check(await supabase.from('event_rsvps').select('*').in('event_id', eventIds)) ?? []) as { event_id: string; user_id: string }[];
}
export async function toggleRsvp(eventId: string, going: boolean) {
  const me = getData().me!;
  if (going) check(await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: me }));
  else check(await supabase.from('event_rsvps').delete().match({ event_id: eventId, user_id: me }));
}

export async function boostServer(serverId: string) {
  await rpc('boost_server', { p_server: serverId });
  await loadBootstrap();
  playUi('boost');
  toast('Thanks for boosting! 🚀', 'neon', '🚀');
}

export async function removeBoost(serverId: string) {
  await rpc('remove_boost', { p_server: serverId });
  await loadBootstrap();
}

export async function leaderboard(serverId: string) {
  const rows = (check(await supabase.from('server_members').select('user_id,xp,nickname').eq('server_id', serverId).order('xp', { ascending: false }).limit(50)) ?? []) as { user_id: string; xp: number; nickname: string | null }[];
  const missing = rows.map((r) => r.user_id).filter((id) => !getData().profiles[id]);
  if (missing.length) upsertProfiles(await rpc<Profile[]>('get_profiles', { p_ids: missing }));
  return rows;
}

export async function setNotification(targetId: string, patch: { muted?: boolean; level?: 'default' | 'all' | 'mentions' | 'nothing'; muted_until?: string | null }) {
  const me = getData().me!;
  const cur = getData().notif[targetId] ?? { user_id: me, target_id: targetId, level: 'default' as const, muted: false, muted_until: null };
  const next = { ...cur, ...patch };
  setData((s) => ({ notif: { ...s.notif, [targetId]: next } }));
  check(await supabase.from('notification_settings').upsert(next, { onConflict: 'user_id,target_id' }));
}
