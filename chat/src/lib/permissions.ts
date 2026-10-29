// Mirrors public.perm() / channel_permissions() in supabase/schema.sql.
// The database is always the one that enforces these; the app uses them to
// decide which buttons to show.
import type { Channel, Member, Overwrite, Role, Server } from './types';

export const P = {
  VIEW_CHANNEL: 1n << 0n,
  SEND_MESSAGES: 1n << 1n,
  MANAGE_MESSAGES: 1n << 2n,
  MANAGE_CHANNELS: 1n << 3n,
  MANAGE_ROLES: 1n << 4n,
  MANAGE_SERVER: 1n << 5n,
  KICK_MEMBERS: 1n << 6n,
  BAN_MEMBERS: 1n << 7n,
  CREATE_INVITE: 1n << 8n,
  CHANGE_NICKNAME: 1n << 9n,
  MANAGE_NICKNAMES: 1n << 10n,
  MANAGE_EXPRESSIONS: 1n << 11n,
  MENTION_EVERYONE: 1n << 12n,
  ADD_REACTIONS: 1n << 13n,
  ATTACH_FILES: 1n << 14n,
  EMBED_LINKS: 1n << 15n,
  READ_HISTORY: 1n << 16n,
  CONNECT: 1n << 17n,
  SPEAK: 1n << 18n,
  VIDEO: 1n << 19n,
  MUTE_MEMBERS: 1n << 20n,
  DEAFEN_MEMBERS: 1n << 21n,
  MOVE_MEMBERS: 1n << 22n,
  MODERATE_MEMBERS: 1n << 23n,
  VIEW_AUDIT_LOG: 1n << 24n,
  CREATE_THREADS: 1n << 25n,
  SEND_IN_THREADS: 1n << 26n,
  USE_EXTERNAL_EMOJI: 1n << 27n,
  ADMINISTRATOR: 1n << 28n,
  MANAGE_EVENTS: 1n << 29n,
  USE_SOUNDBOARD: 1n << 30n,
  MANAGE_THREADS: 1n << 31n,
  CREATE_POLLS: 1n << 32n,
  SEND_VOICE_MESSAGES: 1n << 33n,
} as const;

export type PermName = keyof typeof P;
export const ALL = (1n << 34n) - 1n;
export const DM_PERMS = 14093901827n;
export const DEFAULT_PERMS = 14194565891n;

export const big = (v: number | string | bigint | null | undefined) => {
  if (v === null || v === undefined || v === '') return 0n;
  try {
    return BigInt(v);
  } catch {
    return 0n;
  }
};
export const has = (perms: bigint, bit: bigint) => (perms & bit) === bit;

export interface PermCtx {
  me: string;
  server?: Server | null;
  roles: Role[]; // roles of that server
  member?: Member | null; // my member row
  overwrites: Record<string, Overwrite[]>;
  channels: Record<string, Channel>;
}

export function serverPermissions(ctx: PermCtx): bigint {
  const { server, member, roles, me } = ctx;
  if (!server) return 0n;
  if (server.owner_id === me) return ALL;
  if (!member) return 0n;
  let perms = 0n;
  for (const r of roles) if (r.is_default || member.roles.includes(r.id)) perms |= big(r.permissions);
  if (has(perms, P.ADMINISTRATOR)) return ALL;
  if (member.timeout_until && new Date(member.timeout_until) > new Date()) perms &= P.VIEW_CHANNEL | P.READ_HISTORY | P.CONNECT;
  return perms;
}

export function channelPermissions(ctx: PermCtx, channel: Channel | undefined | null): bigint {
  if (!channel) return 0n;
  if (channel.type === 'dm' || channel.type === 'group_dm') return DM_PERMS;
  if (channel.type === 'thread') {
    const parent = channel.thread_parent_id ? ctx.channels[channel.thread_parent_id] : undefined;
    let base = channelPermissions(ctx, parent);
    if (base === 0n) return 0n;
    if (has(base, P.SEND_IN_THREADS) && (!channel.locked || has(base, P.MANAGE_THREADS))) base |= P.SEND_MESSAGES;
    else base &= ~P.SEND_MESSAGES;
    return base;
  }
  let base = serverPermissions(ctx);
  if (base === 0n) return 0n;
  if (base === ALL) return ALL;
  let src = channel.id;
  if (channel.parent_id && !(ctx.overwrites[channel.id]?.length)) src = channel.parent_id;
  const ows = ctx.overwrites[src] || [];
  const everyone = ctx.roles.find((r) => r.is_default);
  let explicitSend = false;
  const ev = everyone && ows.find((o) => o.target_id === everyone.id);
  if (ev) {
    base = (base & ~big(ev.deny)) | big(ev.allow);
    explicitSend = has(big(ev.allow), P.SEND_MESSAGES);
  }
  let allow = 0n, deny = 0n;
  for (const o of ows) {
    if (o.target_type === 'role' && ctx.member?.roles.includes(o.target_id)) {
      allow |= big(o.allow);
      deny |= big(o.deny);
    }
  }
  base = (base & ~deny) | allow;
  if (has(allow, P.SEND_MESSAGES)) explicitSend = true;
  const mine = ows.find((o) => o.target_type === 'member' && o.target_id === ctx.me);
  if (mine) {
    base = (base & ~big(mine.deny)) | big(mine.allow);
    if (has(big(mine.allow), P.SEND_MESSAGES)) explicitSend = true;
  }
  if (!has(base, P.VIEW_CHANNEL)) return 0n;
  if (channel.type === 'announcement' && !has(base, P.MANAGE_MESSAGES) && !explicitSend) base &= ~P.SEND_MESSAGES;
  if (ctx.member?.timeout_until && new Date(ctx.member.timeout_until) > new Date()) base &= P.VIEW_CHANNEL | P.READ_HISTORY | P.CONNECT;
  return base;
}

export const PERMISSION_GROUPS: { title: string; items: { key: PermName; label: string; help: string }[] }[] = [
  {
    title: 'General',
    items: [
      { key: 'VIEW_CHANNEL', label: 'View Channels', help: 'Lets members see channels (unless a channel says otherwise).' },
      { key: 'MANAGE_CHANNELS', label: 'Manage Channels', help: 'Create, edit and delete channels.' },
      { key: 'MANAGE_ROLES', label: 'Manage Roles', help: 'Create and edit roles below their highest role, and channel permissions.' },
      { key: 'MANAGE_EXPRESSIONS', label: 'Manage Expressions', help: 'Add or remove custom emoji, stickers and soundboard sounds.' },
      { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log', help: 'See who changed what in this server.' },
      { key: 'MANAGE_SERVER', label: 'Manage Server', help: 'Change the server name, icon, AutoMod and other settings.' },
      { key: 'MANAGE_EVENTS', label: 'Manage Events', help: 'Create, edit and cancel events.' },
    ],
  },
  {
    title: 'Membership',
    items: [
      { key: 'CREATE_INVITE', label: 'Create Invite', help: 'Invite new people to this server.' },
      { key: 'CHANGE_NICKNAME', label: 'Change Nickname', help: 'Change their own nickname.' },
      { key: 'MANAGE_NICKNAMES', label: 'Manage Nicknames', help: 'Change other members’ nicknames.' },
      { key: 'KICK_MEMBERS', label: 'Kick Members', help: 'Remove members (they can rejoin with an invite).' },
      { key: 'BAN_MEMBERS', label: 'Ban Members', help: 'Permanently remove members and stop them rejoining.' },
      { key: 'MODERATE_MEMBERS', label: 'Timeout Members', help: 'Stop members from chatting or speaking for a while.' },
    ],
  },
  {
    title: 'Text Channels',
    items: [
      { key: 'SEND_MESSAGES', label: 'Send Messages', help: 'Send messages in text channels.' },
      { key: 'SEND_IN_THREADS', label: 'Send Messages in Threads', help: 'Talk in threads.' },
      { key: 'CREATE_THREADS', label: 'Create Threads', help: 'Start threads and forum posts.' },
      { key: 'EMBED_LINKS', label: 'Embed Links', help: 'Links show a preview.' },
      { key: 'ATTACH_FILES', label: 'Attach Files', help: 'Upload images and files.' },
      { key: 'ADD_REACTIONS', label: 'Add Reactions', help: 'Add new reactions to messages.' },
      { key: 'USE_EXTERNAL_EMOJI', label: 'Use External Emoji', help: 'Use emoji from other servers (Neon members).' },
      { key: 'MENTION_EVERYONE', label: 'Mention @everyone, @here and All Roles', help: 'Ping everyone, or any role.' },
      { key: 'MANAGE_MESSAGES', label: 'Manage Messages', help: 'Delete and pin other people’s messages.' },
      { key: 'MANAGE_THREADS', label: 'Manage Threads', help: 'Rename, lock, archive and delete threads.' },
      { key: 'READ_HISTORY', label: 'Read Message History', help: 'Read messages sent before they opened the channel.' },
      { key: 'CREATE_POLLS', label: 'Create Polls', help: 'Post polls.' },
      { key: 'SEND_VOICE_MESSAGES', label: 'Send Voice Messages', help: 'Record and send voice clips.' },
    ],
  },
  {
    title: 'Voice Channels',
    items: [
      { key: 'CONNECT', label: 'Connect', help: 'Join voice channels.' },
      { key: 'SPEAK', label: 'Speak', help: 'Talk in voice channels.' },
      { key: 'VIDEO', label: 'Video & Screen Share', help: 'Turn on camera or share the screen.' },
      { key: 'USE_SOUNDBOARD', label: 'Use Soundboard', help: 'Play soundboard sounds in voice.' },
      { key: 'MUTE_MEMBERS', label: 'Mute Members', help: 'Mute other people in voice.' },
      { key: 'DEAFEN_MEMBERS', label: 'Deafen Members', help: 'Deafen other people in voice.' },
      { key: 'MOVE_MEMBERS', label: 'Move Members', help: 'Disconnect or move people between voice channels.' },
    ],
  },
  {
    title: 'Advanced',
    items: [
      { key: 'ADMINISTRATOR', label: 'Administrator', help: 'Every permission, and bypasses channel overrides. Grant with care.' },
    ],
  },
];
