import { AtSign, Ban, Clock, Copy, Crown, Gem, Hammer, MessageSquare, Pencil, Shield, UserMinus, UserPlus, User } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { channelPermissions, has, P } from '../../lib/permissions';
import type { Member } from '../../lib/types';
import { copyText, cn } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { displayName, memberRoles, presenceStatus, serverPermsFor, serverRoles } from '../../store/selectors';
import { openMenu, openModal, openProfile, toast, type MenuItem } from '../../store/ui';
import { addRole, removeRole } from '../../store/actions/servers';
import { blockUser, openDM, sendFriendRequestTo, removeFriend } from '../../store/actions/users';
import { setUserVolume, toggleLocalMute } from '../../lib/voice';
import { useVoice } from '../../store/voice';

export function MemberList({ channelId }: { channelId: string }) {
  const channel = useData((s) => s.channels[channelId]);
  const serverId = channel?.server_id ?? null;
  const [members, roles, presence, profiles, overwrites, channels] = useData(useShallow((s) => [serverId ? s.members[serverId] : undefined, s.roles, s.presence, s.profiles, s.overwrites, s.channels] as const));
  const recipients = channel?.recipients;

  const groups = useMemo(() => {
    void roles; void profiles; void overwrites; void channels;
    const s = getData();
    if (!serverId) {
      const ids = recipients ?? [];
      const online = ids.filter((id) => presenceStatus(id, s) !== 'offline');
      const offline = ids.filter((id) => presenceStatus(id, s) === 'offline');
      return [{ key: 'online', title: 'Online', ids: online }, { key: 'offline', title: 'Offline', ids: offline }].filter((g) => g.ids.length);
    }
    const list = Object.values(members ?? {});
    // who can see this channel (private channels show only their members)
    const visible = list.filter((m) => canMemberView(m, channelId));
    const hoisted = serverRoles(serverId, s).filter((r) => r.hoist && !r.is_default);
    const used = new Set<string>();
    const out: { key: string; title: string; color?: string | null; ids: string[] }[] = [];
    const byName = (a: string, b: string) => displayName(a, serverId, s).localeCompare(displayName(b, serverId, s));
    for (const r of hoisted) {
      const ids = visible.filter((m) => !used.has(m.user_id) && presenceStatus(m.user_id, s) !== 'offline' && m.roles.includes(r.id)).map((m) => m.user_id).sort(byName);
      ids.forEach((id) => used.add(id));
      if (ids.length) out.push({ key: r.id, title: r.name, color: r.color, ids });
    }
    const online = visible.filter((m) => !used.has(m.user_id) && presenceStatus(m.user_id, s) !== 'offline').map((m) => m.user_id).sort(byName);
    if (online.length) out.push({ key: 'online', title: 'Online', ids: online });
    const offline = visible.filter((m) => presenceStatus(m.user_id, s) === 'offline').map((m) => m.user_id).sort(byName);
    if (offline.length) out.push({ key: 'offline', title: 'Offline', ids: offline.slice(0, 200) });
    return out;
  }, [members, roles, presence, profiles, overwrites, channels, serverId, recipients, channelId]);

  return (
    <div className="member-list scroll thin">
      {groups.map((g) => (
        <div key={g.key} className="member-group">
          <div className="member-group-title">{g.title} — {g.ids.length}</div>
          {g.ids.map((id) => <MemberRow key={id} userId={id} serverId={serverId} offline={g.key === 'offline'} />)}
        </div>
      ))}
      {!groups.length && <div className="empty"><span className="spinner" /></div>}
    </div>
  );
}

function canMemberView(m: Member, channelId: string) {
  const s = getData();
  const ch = s.channels[channelId];
  if (!ch?.server_id) return true;
  const server = s.servers[ch.server_id];
  if (server?.owner_id === m.user_id) return true;
  // reuse the permission engine with this member's roles
  const ctx = { me: m.user_id, server, roles: Object.values(s.roles).filter((r) => r.server_id === ch.server_id), member: m, overwrites: s.overwrites, channels: s.channels };
  return channelPermissions(ctx, ch) !== 0n;
}

const MemberRow = memo(function MemberRow({ userId, serverId, offline }: { userId: string; serverId: string | null; offline: boolean }) {
  const p = useData((s) => s.profiles[userId]);
  const isOwner = useData((s) => !!serverId && s.servers[serverId]?.owner_id === userId);
  const activity = useData((s) => s.presence[userId]?.activity);
  const inVoice = useData((s) => s.presence[userId]?.voice);
  if (!p) return null;
  const custom = p.custom_status && (!p.custom_status_expires_at || new Date(p.custom_status_expires_at) > new Date());
  return (
    <div
      className={cn('member', offline && 'offline')}
      onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openProfile(userId, serverId, { x: r.left - 12, y: r.top }, 'left'); }}
      onContextMenu={(e) => openMenu(e, memberMenu(userId, serverId))}
      role="button"
    >
      <Avatar userId={userId} serverId={serverId} size={34} showStatus ring="var(--bg-side)" />
      <div className="member-text">
        <div className="row gap-4">
          <NameTag userId={userId} serverId={serverId} className="member-name ellipsis" />
          {isOwner && <Tip label="Server Owner"><Crown size={14} className="owner-crown" /></Tip>}
          {p.neon && <Gem size={12} className="neon-gem" />}
        </div>
        {inVoice && !offline ? <div className="member-sub">🔊 In voice</div>
          : activity ? <div className="member-sub ellipsis">{activity.emoji} {activity.name}</div>
          : custom ? <div className="member-sub ellipsis">{p.custom_status_emoji} {p.custom_status}</div> : null}
      </div>
    </div>
  );
});

export function memberMenu(userId: string, serverId: string | null): MenuItem[] {
  const s = getData();
  const me = s.me!;
  const self = userId === me;
  const rel = s.relationships[userId]?.type;
  const perms = serverId ? serverPermsFor(serverId, s) : 0n;
  const items: MenuItem[] = [
    { label: 'Profile', icon: <User />, onClick: () => openModal({ kind: 'profile', userId, serverId }) },
    { label: 'Mention', icon: <AtSign />, onClick: () => {
      const ta = document.querySelector<HTMLTextAreaElement>('.chat-main .composer textarea');
      const name = s.profiles[userId]?.username;
      if (ta && name) { ta.focus(); document.execCommand('insertText', false, `@${name} `); }
    } },
  ];
  if (!self) {
    items.push({ label: 'Message', icon: <MessageSquare />, onClick: () => void openDM(userId) });
    if (!rel) items.push({ label: 'Add Friend', icon: <UserPlus />, onClick: () => void sendFriendRequestTo(userId).catch((e: Error) => toast(e.message, 'error')) });
    if (rel === 'friend') items.push({ label: 'Remove Friend', icon: <UserMinus />, onClick: () => void removeFriend(userId) });
  }
  const v = useVoice.getState();
  if (!self && v.channelId && v.participants[userId]) {
    items.push({ divider: true });
    items.push({ label: v.localMuted[userId] ? 'Unmute for me' : 'Mute for me', onClick: () => toggleLocalMute(userId), checked: !!v.localMuted[userId] });
    items.push({ label: 'User Volume', submenu: [25, 50, 75, 100].map((n) => ({ label: `${n}%`, checked: (v.volumes[userId] ?? 100) === n, onClick: () => setUserVolume(userId, n) })) });
  }
  if (serverId) {
    const canRoles = has(perms, P.MANAGE_ROLES);
    const topMine = s.servers[serverId]?.owner_id === me ? Infinity : Math.max(0, ...memberRoles(me, serverId, s).map((r) => r.position));
    const target = s.members[serverId]?.[userId];
    const isOwnerTarget = s.servers[serverId]?.owner_id === userId;
    const topTarget = Math.max(0, ...memberRoles(userId, serverId, s).map((r) => r.position));
    const outranks = !isOwnerTarget && (s.servers[serverId]?.owner_id === me || topMine > topTarget);
    items.push({ divider: true });
    if ((self && has(perms, P.CHANGE_NICKNAME)) || (!self && has(perms, P.MANAGE_NICKNAMES) && outranks)) {
      items.push({ label: self ? 'Edit Server Profile' : 'Change Nickname', icon: <Pencil />, onClick: () => openModal({ kind: 'nickname', serverId, userId }) });
    }
    if (canRoles && target) {
      const roles = serverRoles(serverId, s).filter((r) => !r.is_default);
      if (roles.length) {
        items.push({
          label: 'Roles', icon: <Shield />, submenu: roles.map((r) => ({
            label: r.name,
            color: r.color ?? undefined,
            checked: target.roles.includes(r.id),
            disabled: r.position >= topMine,
            onClick: () => void (target.roles.includes(r.id) ? removeRole(serverId, userId, r.id) : addRole(serverId, userId, r.id)).catch((e: Error) => toast(e.message, 'error')),
          })),
        });
      }
    }
    if (!self && outranks) {
      if (has(perms, P.MODERATE_MEMBERS)) items.push({ label: 'Timeout', icon: <Clock />, danger: true, onClick: () => openModal({ kind: 'moderate', serverId, userId, action: 'timeout' }) });
      if (has(perms, P.KICK_MEMBERS)) items.push({ label: `Kick ${displayName(userId, serverId, s)}`, icon: <UserMinus />, danger: true, onClick: () => openModal({ kind: 'moderate', serverId, userId, action: 'kick' }) });
      if (has(perms, P.BAN_MEMBERS)) items.push({ label: `Ban ${displayName(userId, serverId, s)}`, icon: <Hammer />, danger: true, onClick: () => openModal({ kind: 'moderate', serverId, userId, action: 'ban' }) });
    }
  }
  if (!self && rel !== 'blocked' && !serverId) items.push({ divider: true }, { label: 'Block', icon: <Ban />, danger: true, onClick: () => void blockUser(userId) });
  if (s.settings.developerMode) items.push({ divider: true }, { label: 'Copy User ID', icon: <Copy />, onClick: () => void copyText(userId) });
  return items;
}
