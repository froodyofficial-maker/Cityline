import { rpc, supabase } from '../../lib/supabase';
import type { Bootstrap, Channel, Member, Profile, UserSettings } from '../../lib/types';
import { applyAppearance } from '../../lib/theme';
import { setSoundsEnabled } from '../../lib/sounds';
import { debounce } from '../../lib/utils';
import { getData, setData, upsertProfiles } from '../data';

export function applyBootstrap(b: Bootstrap) {
  const s = getData();
  const profiles: Record<string, Profile> = { ...s.profiles };
  for (const p of [b.me, ...b.profiles]) if (p) profiles[p.id] = { ...profiles[p.id], ...p };

  const channels: Record<string, Channel> = {};
  for (const c of b.channels) channels[c.id] = c;
  for (const c of b.dm_channels) channels[c.id] = c;
  // keep threads we already know about (opened from a link) if still visible
  for (const c of Object.values(s.channels)) if (c.type === 'thread' && !channels[c.id] && c.server_id && b.servers.some((x) => x.id === c.server_id)) channels[c.id] = c;

  const memberships: Record<string, Member> = {};
  const members = { ...s.members };
  for (const m of b.memberships) {
    memberships[m.server_id] = m;
    members[m.server_id] = { ...(members[m.server_id] || {}), [m.user_id]: m };
  }

  const overwrites: Record<string, typeof b.overwrites> = {};
  for (const o of b.overwrites) (overwrites[o.channel_id] ||= []).push(o);

  setData({
    ready: true,
    me: b.me.id,
    profiles,
    neon: b.neon,
    settings: b.settings || {},
    servers: Object.fromEntries(b.servers.map((x) => [x.id, x])),
    memberships,
    members,
    roles: Object.fromEntries(b.roles.map((r) => [r.id, r])),
    channels,
    overwrites,
    readStates: Object.fromEntries(b.read_states.map((r) => [r.channel_id, r])),
    relationships: Object.fromEntries(b.relationships.map((r) => [r.target_id, r])),
    emojis: Object.fromEntries(b.emojis.map((e) => [e.id, e])),
    stickers: Object.fromEntries(b.stickers.map((e) => [e.id, e])),
    sounds: Object.fromEntries(b.sounds.map((e) => [e.id, e])),
    notif: Object.fromEntries(b.notification_settings.map((n) => [n.target_id, n])),
    myBoosts: b.my_boosts,
  });
  applyAppearance(b.settings || {}, b.me.neon === 'neon');
  setSoundsEnabled(b.settings?.notifySounds !== false);
}

export async function loadBootstrap() {
  const b = await rpc<Bootstrap>('get_bootstrap');
  applyBootstrap(b);
  return b;
}

export const reloadBootstrap = debounce(() => { void loadBootstrap().catch(() => {}); }, 400);

// Profiles we have not seen yet are fetched in small batches.
const wanted = new Set<string>();
const flushProfiles = debounce(async () => {
  const ids = [...wanted].filter((id) => !getData().profiles[id]);
  wanted.clear();
  if (!ids.length) return;
  try {
    upsertProfiles(await rpc<Profile[]>('get_profiles', { p_ids: ids }));
  } catch { /* ignore */ }
}, 60);

export function ensureProfiles(ids: (string | null | undefined)[]) {
  for (const id of ids) if (id && !getData().profiles[id]) wanted.add(id);
  if (wanted.size) flushProfiles();
}

export async function refreshProfile(id: string) {
  const list = await rpc<Profile[]>('get_profiles', { p_ids: [id] });
  upsertProfiles(list);
  return list[0];
}

const persistSettings = debounce(async (settings: UserSettings) => {
  const me = getData().me;
  if (!me) return;
  await supabase.from('user_settings').upsert({ user_id: me, settings, updated_at: new Date().toISOString() });
}, 700);

export function updateSettings(patch: Partial<UserSettings>) {
  const settings = { ...getData().settings, ...patch };
  setData({ settings });
  const me = getData().me;
  applyAppearance(settings, me ? getData().profiles[me]?.neon === 'neon' : false);
  setSoundsEnabled(settings.notifySounds !== false);
  persistSettings(settings);
}
