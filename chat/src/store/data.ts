import { create } from 'zustand';
import type {
  Boost, Channel, CustomEmoji, Member, Message, NeonSubscription, NotificationSetting, Overwrite, PresenceMeta,
  Profile, ReadState, Relationship, Reminder, Role, Server, Sound, Sticker, UserSettings,
} from '../lib/types';

export interface ChannelMsgs {
  ids: string[];
  loading: boolean;
  loaded: boolean;
  hasMore: boolean;      // older messages exist
  hasNewer: boolean;     // we jumped into history; newer messages exist
}

export interface DataState {
  ready: boolean;
  me: string | null;
  profiles: Record<string, Profile>;
  neon: NeonSubscription | null;
  settings: UserSettings;
  servers: Record<string, Server>;
  memberships: Record<string, Member>;
  members: Record<string, Record<string, Member>>;
  membersLoaded: Record<string, boolean>;
  roles: Record<string, Role>;
  channels: Record<string, Channel>;
  overwrites: Record<string, Overwrite[]>;
  readStates: Record<string, ReadState>;
  relationships: Record<string, Relationship>;
  emojis: Record<string, CustomEmoji>;
  stickers: Record<string, Sticker>;
  sounds: Record<string, Sound>;
  notif: Record<string, NotificationSetting>;
  myBoosts: Boost[];
  messages: Record<string, Message>;
  channelMsgs: Record<string, ChannelMsgs>;
  presence: Record<string, PresenceMeta>;
  typing: Record<string, Record<string, number>>;
  reminders: Reminder[];
  connection: 'connecting' | 'online' | 'offline';
}

export const emptyChannelMsgs = (): ChannelMsgs => ({ ids: [], loading: false, loaded: false, hasMore: true, hasNewer: false });

export const initialData: DataState = {
  ready: false,
  me: null,
  profiles: {},
  neon: null,
  settings: {},
  servers: {},
  memberships: {},
  members: {},
  membersLoaded: {},
  roles: {},
  channels: {},
  overwrites: {},
  readStates: {},
  relationships: {},
  emojis: {},
  stickers: {},
  sounds: {},
  notif: {},
  myBoosts: [],
  messages: {},
  channelMsgs: {},
  presence: {},
  typing: {},
  reminders: [],
  connection: 'connecting',
};

export const useData = create<DataState>()(() => ({ ...initialData }));

export const getData = () => useData.getState();
export const setData = (partial: Partial<DataState> | ((s: DataState) => Partial<DataState>)) => useData.setState(partial);

// --- small immutable helpers ------------------------------------------------------

export function upsertProfiles(list: Profile[]) {
  if (!list?.length) return;
  setData((s) => {
    const profiles = { ...s.profiles };
    for (const p of list) if (p) profiles[p.id] = { ...profiles[p.id], ...p };
    return { profiles };
  });
}

export function upsertMessages(channelId: string, list: Message[], mode: 'replace' | 'prepend' | 'append', meta: Partial<ChannelMsgs> = {}) {
  setData((s) => {
    const messages = { ...s.messages };
    for (const m of list) messages[m.id] = { ...messages[m.id], ...m };
    const cur = s.channelMsgs[channelId] ?? emptyChannelMsgs();
    const incoming = list.map((m) => m.id);
    let ids: string[];
    if (mode === 'replace') ids = incoming;
    else if (mode === 'prepend') ids = [...incoming.filter((id) => !cur.ids.includes(id)), ...cur.ids];
    else ids = [...cur.ids, ...incoming.filter((id) => !cur.ids.includes(id))];
    return { messages, channelMsgs: { ...s.channelMsgs, [channelId]: { ...cur, ...meta, ids } } };
  });
}

export function patchMessage(id: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) {
  setData((s) => {
    const m = s.messages[id];
    if (!m) return {};
    const p = typeof patch === 'function' ? patch(m) : patch;
    return { messages: { ...s.messages, [id]: { ...m, ...p } } };
  });
}

export function removeMessage(id: string) {
  setData((s) => {
    const m = s.messages[id];
    if (!m) return {};
    const messages = { ...s.messages };
    delete messages[id];
    const cm = s.channelMsgs[m.channel_id];
    return {
      messages,
      channelMsgs: cm ? { ...s.channelMsgs, [m.channel_id]: { ...cm, ids: cm.ids.filter((x) => x !== id) } } : s.channelMsgs,
    };
  });
}

export function upsertChannel(c: Channel) {
  setData((s) => ({ channels: { ...s.channels, [c.id]: { ...s.channels[c.id], ...c } } }));
}

export function removeChannel(id: string) {
  setData((s) => {
    const channels = { ...s.channels };
    delete channels[id];
    return { channels };
  });
}

export function setMember(serverId: string, m: Member) {
  setData((s) => {
    const members = { ...s.members, [serverId]: { ...(s.members[serverId] || {}), [m.user_id]: { ...(s.members[serverId]?.[m.user_id] || {}), ...m } } };
    const memberships = m.user_id === s.me ? { ...s.memberships, [serverId]: { ...s.memberships[serverId], ...m } } : s.memberships;
    return { members, memberships };
  });
}

export function removeMember(serverId: string, userId: string) {
  setData((s) => {
    const list = { ...(s.members[serverId] || {}) };
    delete list[userId];
    return { members: { ...s.members, [serverId]: list } };
  });
}

export function removeServerLocal(serverId: string) {
  setData((s) => {
    const servers = { ...s.servers };
    delete servers[serverId];
    const memberships = { ...s.memberships };
    delete memberships[serverId];
    const channels = Object.fromEntries(Object.entries(s.channels).filter(([, c]) => c.server_id !== serverId));
    const roles = Object.fromEntries(Object.entries(s.roles).filter(([, r]) => r.server_id !== serverId));
    return { servers, memberships, channels, roles };
  });
}
