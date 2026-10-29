import { AnimatePresence, motion } from 'motion/react';
import {
  Bell, BellOff, CalendarDays, Check, ChevronDown, ChevronRight, Copy, Hash, Link, Lock, Megaphone, MessagesSquare, Mic, MicOff,
  HeadphoneOff, Pencil, Plus, Radio, Rocket, Settings, Sparkles, Trash2, Trophy, UserPlus, Users, Video, Volume2, X, LogOut, FolderPlus, Eye, EyeOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { boostLevel, BOOST_LEVELS } from '../../lib/neon';
import { has, P } from '../../lib/permissions';
import type { Channel } from '../../lib/types';
import { cn, copyText, inviteUrl } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { isMuted, isUnread, mentionCount, permsFor, serverChannels, serverPermsFor, useServerPerms, useVoiceMembers } from '../../store/selectors';
import { navigate, openMenu, openModal, setUI, toast, useUI, type MenuItem } from '../../store/ui';
import { updateSettings } from '../../store/actions/bootstrap';
import { markRead, markServerRead } from '../../store/actions/messages';
import { createInvite, deleteChannel, leaveServer, reorderChannels, setNotification } from '../../store/actions/servers';
import { joinVoice } from '../../lib/voice';
import { useVoice } from '../../store/voice';
import { rememberChannel } from '../rail/ServerRail';

export function channelIcon(c: Pick<Channel, 'type'> & { private?: boolean }, size = 20) {
  const props = { size, strokeWidth: 2 };
  switch (c.type) {
    case 'voice': return <Volume2 {...props} />;
    case 'stage': return <Radio {...props} />;
    case 'announcement': return <Megaphone {...props} />;
    case 'forum': return <MessagesSquare {...props} />;
    case 'thread': return <MessagesSquare {...props} />;
    default: return <Hash {...props} />;
  }
}

export function ServerSidebar({ serverId }: { serverId: string }) {
  const server = useData((s) => s.servers[serverId]);
  const perms = useServerPerms(serverId);
  const [menuOpen, setMenuOpen] = useState(false);
  const collapsed = useData(useShallow((s) => s.settings.collapsed ?? {}));
  const hideMuted = useData((s) => !!s.settings.collapsed?.[`hide-muted:${serverId}`]);
  const [deps] = useData(useShallow((s) => [s.channels, s.overwrites, s.roles, s.memberships, s.readStates, s.notif] as const));
  const route = useUI((s) => s.route);
  const [drag, setDrag] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);

  const { loose, cats } = useMemo(() => {
    const s = getData();
    const all = serverChannels(serverId, s).filter((c) => c.type === 'category' || permsFor(c.id, s) !== 0n);
    const visible = (c: Channel) => !hideMuted || !isMuted(c.id, s) || isUnread(c.id, s) || (route.kind === 'server' && route.channelId === c.id);
    const cats = all.filter((c) => c.type === 'category').map((cat) => ({ cat, items: all.filter((c) => c.parent_id === cat.id && c.type !== 'category' && visible(c)) }));
    const loose = all.filter((c) => c.type !== 'category' && (!c.parent_id || !cats.some((x) => x.cat.id === c.parent_id)) && visible(c));
    const canManage = has(serverPermsFor(serverId, s), P.MANAGE_CHANNELS);
    return { loose, cats: cats.filter((x) => x.items.length || canManage) };
  }, [deps, serverId, hideMuted, route]);

  const unreadAny = useData((s) => Object.values(s.channels).some((c) => c.server_id === serverId && c.type !== 'category' && isUnread(c.id, s) && permsFor(c.id, s) !== 0n));

  if (!server) return null;
  const level = boostLevel(server.boost_count);
  const canManage = has(perms, P.MANAGE_CHANNELS);

  async function onDrop(target: Channel) {
    if (!drag || drag === target.id) return;
    const s = getData();
    const moving = s.channels[drag];
    if (!moving) return;
    if (moving.type === 'category') {
      if (target.type !== 'category') return;
      const order = cats.map((x) => x.cat).filter((c) => c.id !== drag);
      order.splice(order.findIndex((c) => c.id === target.id), 0, moving);
      await reorderChannels(serverId, order.map((c, i) => ({ id: c.id, position: i })));
      return;
    }
    const parent = target.type === 'category' ? target.id : target.parent_id;
    const siblings = serverChannels(serverId, s).filter((c) => c.type !== 'category' && (c.parent_id ?? null) === (parent ?? null) && c.id !== drag);
    const idx = target.type === 'category' ? siblings.length : siblings.findIndex((c) => c.id === target.id);
    siblings.splice(idx < 0 ? siblings.length : idx, 0, moving);
    await reorderChannels(serverId, siblings.map((c, i) => ({ id: c.id, position: i, parent_id: parent ?? null })));
  }

  const dnd = (c: Channel) => (canManage ? {
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setDrag(c.id); e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: () => { setDrag(null); setDropOn(null); },
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDropOn(c.id); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); void onDrop(c); setDrag(null); setDropOn(null); },
  } : {});

  return (
    <>
      <ServerHeader serverId={serverId} open={menuOpen} setOpen={setMenuOpen} level={level} />
      <div className="channel-list scroll thin" onContextMenu={(e) => { if (e.target === e.currentTarget && canManage) openMenu(e, [{ label: 'Create Channel', icon: <Plus />, onClick: () => openModal({ kind: 'createChannel', serverId }) }, { label: 'Create Category', icon: <FolderPlus />, onClick: () => openModal({ kind: 'createChannel', serverId, type: 'category' }) }]); }}>
        {server.banner_url && level >= 2 && <div className="server-banner" style={{ backgroundImage: `url(${server.banner_url})` }} />}
        <div className="server-quick">
          {unreadAny && (
            <button className="quick-pill catchup" onClick={() => openModal({ kind: 'catchUp', serverId })}>
              <Sparkles size={15} /> Catch Up <span className="tag-new">NEW</span>
            </button>
          )}
          <button className="quick-pill" onClick={() => openModal({ kind: 'events', serverId })}><CalendarDays size={15} /> Events</button>
          {server.xp_enabled && <button className="quick-pill" onClick={() => openModal({ kind: 'leaderboard', serverId })}><Trophy size={15} /> Levels</button>}
        </div>
        {loose.map((c) => (
          <div key={c.id} className={cn(dropOn === c.id && drag && 'drop-line')} {...dnd(c)}>
            <ChannelRow channel={c} />
          </div>
        ))}
        {cats.map(({ cat, items }) => {
          const isCollapsed = !!collapsed[cat.id];
          return (
            <div key={cat.id} className="category">
              <div
                className={cn('category-head', dropOn === cat.id && drag && 'drop-into')}
                onClick={() => updateSettings({ collapsed: { ...collapsed, [cat.id]: !isCollapsed } })}
                onContextMenu={(e) => openMenu(e, categoryMenu(cat, serverId, isCollapsed, () => updateSettings({ collapsed: { ...collapsed, [cat.id]: !isCollapsed } })))}
                {...dnd(cat)}
              >
                <motion.span animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }} className="cat-chev"><ChevronDown size={12} strokeWidth={3} /></motion.span>
                <span className="cat-name">{cat.name}</span>
                {canManage && (
                  <Tip label="Create Channel">
                    <button className="icon-btn sm cat-add" onClick={(e) => { e.stopPropagation(); openModal({ kind: 'createChannel', serverId, parentId: cat.id }); }}><Plus /></button>
                  </Tip>
                )}
              </div>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
                    {items.map((c) => (
                      <div key={c.id} className={cn(dropOn === c.id && drag && 'drop-line')} {...dnd(c)}>
                        <ChannelRow channel={c} />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              {isCollapsed && items.filter((c) => (route.kind === 'server' && route.channelId === c.id) || isUnread(c.id)).map((c) => <ChannelRow key={c.id} channel={c} />)}
            </div>
          );
        })}
        <div style={{ height: 12 }} />
      </div>
    </>
  );
}

function ServerHeader({ serverId, open, setOpen, level }: { serverId: string; open: boolean; setOpen: (v: boolean) => void; level: number }) {
  const server = useData((s) => s.servers[serverId]);
  const perms = useServerPerms(serverId);
  const me = useData((s) => s.me);
  const ref = useRef<HTMLDivElement>(null);
  const hideMuted = useData((s) => !!s.settings.collapsed?.[`hide-muted:${serverId}`]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open, setOpen]);
  if (!server) return null;
  const isOwner = server.owner_id === me;
  const items: (MenuItem & { neon?: boolean })[] = [
    { label: 'Server Boost', icon: <Rocket />, onClick: () => openModal({ kind: 'boost', serverId }), color: 'var(--neon-pink)' },
    { divider: true },
    ...(has(perms, P.CREATE_INVITE) ? [{ label: 'Invite People', icon: <UserPlus />, onClick: () => openModal({ kind: 'invite', serverId }), color: 'var(--brand-text)' }] : []),
    ...(has(perms, P.MANAGE_SERVER) || has(perms, P.MANAGE_ROLES) || has(perms, P.MANAGE_EXPRESSIONS) || has(perms, P.BAN_MEMBERS) || has(perms, P.VIEW_AUDIT_LOG)
      ? [{ label: 'Server Settings', icon: <Settings />, onClick: () => openModal({ kind: 'serverSettings', serverId }) }] : []),
    ...(has(perms, P.MANAGE_CHANNELS) ? [
      { label: 'Create Channel', icon: <Plus />, onClick: () => openModal({ kind: 'createChannel', serverId }) },
      { label: 'Create Category', icon: <FolderPlus />, onClick: () => openModal({ kind: 'createChannel', serverId, type: 'category' }) },
    ] : []),
    ...(has(perms, P.MANAGE_EVENTS) ? [{ label: 'Create Event', icon: <CalendarDays />, onClick: () => openModal({ kind: 'createEvent', serverId }) }] : []),
    { label: 'Catch Up', icon: <Sparkles />, onClick: () => openModal({ kind: 'catchUp', serverId }) },
    ...(server.xp_enabled ? [{ label: 'Leaderboard', icon: <Trophy />, onClick: () => openModal({ kind: 'leaderboard', serverId }) }] : []),
    { divider: true },
    { label: 'Notification Settings', icon: <Bell />, onClick: () => openModal({ kind: 'serverSettings', serverId, tab: 'notifications' }) },
    { label: hideMuted ? 'Show Muted Channels' : 'Hide Muted Channels', icon: hideMuted ? <Eye /> : <EyeOff />, onClick: () => updateSettings({ collapsed: { ...(getData().settings.collapsed ?? {}), [`hide-muted:${serverId}`]: !hideMuted } }) },
    { label: 'Edit Server Profile', icon: <Pencil />, onClick: () => openModal({ kind: 'nickname', serverId, userId: me! }) },
    { label: 'Mark As Read', icon: <Check />, onClick: () => void markServerRead(serverId) },
    ...(!isOwner ? [{ divider: true }, {
      label: 'Leave Server', icon: <LogOut />, danger: true, onClick: () => openModal({
        kind: 'confirm', title: `Leave '${server.name}'`, danger: true, confirm: 'Leave Server',
        body: <>You won’t be able to rejoin <b>{server.name}</b> unless you are re-invited.</>, onConfirm: () => leaveServer(serverId),
      }),
    }] : []),
  ];
  return (
    <div className="server-head-wrap" ref={ref}>
      <button className={cn('server-head', open && 'open')} onClick={() => setOpen(!open)}>
        {level > 0 && <Tip label={`Boost Level ${level}`}><span className="boost-gem"><Rocket size={14} /></span></Tip>}
        <span className="server-head-name ellipsis">{server.name}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="row">{open ? <X size={18} /> : <ChevronDown size={18} />}</motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="menu server-menu" initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.14 }} style={{ position: 'absolute' }}>
            <BoostMini serverId={serverId} />
            {items.map((it, i) => it.divider ? <div key={i} className="menu-sep" /> : (
              <button key={i} className={cn('menu-item', it.danger && 'danger')} style={it.color ? { color: it.color } : undefined} onClick={() => { setOpen(false); it.onClick?.(); }}>
                <span className="mi-label">{it.label}</span>
                <span className="mi-icon">{it.icon}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BoostMini({ serverId }: { serverId: string }) {
  const count = useData((s) => s.servers[serverId]?.boost_count ?? 0);
  const level = boostLevel(count);
  const next = BOOST_LEVELS[Math.min(level + 1, 3)];
  const prev = BOOST_LEVELS[level];
  const pct = level >= 3 ? 100 : ((count - prev.need) / (next.need - prev.need)) * 100;
  return (
    <div className="boost-mini">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="tiny bold">{level > 0 ? `Level ${level}` : 'No boost level yet'}</span>
        <span className="tiny muted">{count} {count === 1 ? 'Boost' : 'Boosts'}</span>
      </div>
      <div className="progress neon"><i style={{ width: `${Math.max(4, pct)}%` }} /></div>
    </div>
  );
}

function ChannelRow({ channel }: { channel: Channel }) {
  const route = useUI((s) => s.route);
  const voiceView = useUI((s) => s.voiceView);
  const unread = useData((s) => isUnread(channel.id, s));
  const mentions = useData((s) => mentionCount(channel.id, s));
  const muted = useData((s) => isMuted(channel.id, s));
  const isPrivate = useData((s) => {
    const everyone = Object.values(s.roles).find((r) => r.server_id === channel.server_id && r.is_default);
    const src = s.overwrites[channel.id]?.length ? channel.id : channel.parent_id ?? channel.id;
    const ow = everyone && s.overwrites[src]?.find((o) => o.target_id === everyone.id);
    return !!ow && (BigInt(ow.deny) & P.VIEW_CHANNEL) !== 0n;
  });
  const canManage = useData((s) => has(permsFor(channel.id, s), P.MANAGE_CHANNELS));
  const canInvite = useData((s) => has(permsFor(channel.id, s), P.CREATE_INVITE));
  const threads = useData(useShallow((s) => Object.values(s.channels).filter((t) => t.thread_parent_id === channel.id && !t.archived && (s.readStates[t.id] || t.owner_id === s.me)).map((t) => t.id)));
  const isVoice = channel.type === 'voice' || channel.type === 'stage';
  const active = isVoice ? voiceView === channel.id : route.kind === 'server' && route.channelId === channel.id && !voiceView;

  function open() {
    if (isVoice) {
      const perms = permsFor(channel.id);
      if (!has(perms, P.CONNECT)) { toast('You do not have permission to join this channel', 'error'); return; }
      const members = Object.values(getData().presence).filter((p) => p.voice?.channel_id === channel.id);
      if (channel.user_limit && members.length >= channel.user_limit && !has(perms, P.MOVE_MEMBERS) && useVoice.getState().channelId !== channel.id) { toast('That channel is full', 'error'); return; }
      if (useVoice.getState().channelId !== channel.id) void joinVoice(channel.id, channel.server_id);
      setUI({ voiceView: channel.id, mobileNav: false });
      return;
    }
    rememberChannel(channel.server_id!, channel.id);
    setUI({ voiceView: null });
    navigate({ kind: 'server', serverId: channel.server_id!, channelId: channel.id });
  }

  return (
    <>
      <div
        className={cn('channel', active && 'active', unread && !muted && 'unread', muted && 'muted', isVoice && 'voice')}
        onClick={open}
        onContextMenu={(e) => openMenu(e, channelMenu(channel))}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') open(); }}
      >
        <span className="channel-pill" />
        <span className="channel-icon">
          {channelIcon(channel)}
          {isPrivate && <Lock className="channel-lock" size={10} strokeWidth={3} />}
        </span>
        <span className="channel-name ellipsis">{channel.name}</span>
        {channel.user_limit > 0 && isVoice && <VoiceCount channelId={channel.id} limit={channel.user_limit} />}
        <span className="channel-actions">
          {canInvite && (
            <Tip label="Create Invite">
              <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); openModal({ kind: 'invite', serverId: channel.server_id!, channelId: channel.id }); }}><UserPlus /></button>
            </Tip>
          )}
          {canManage && (
            <Tip label="Edit Channel">
              <button className="icon-btn sm" onClick={(e) => { e.stopPropagation(); openModal({ kind: 'channelSettings', channelId: channel.id }); }}><Settings /></button>
            </Tip>
          )}
        </span>
        {mentions > 0 && <span className="badge channel-badge">{mentions}</span>}
      </div>
      {isVoice && <VoiceMembers channelId={channel.id} stage={channel.type === 'stage'} />}
      {threads.length > 0 && (
        <div className="thread-list">
          {threads.map((id) => <ThreadRow key={id} id={id} />)}
        </div>
      )}
    </>
  );
}

function VoiceCount({ channelId, limit }: { channelId: string; limit: number }) {
  const n = useVoiceMembers(channelId).length;
  return <span className="voice-count"><span>{String(n).padStart(2, '0')}</span><span>{String(limit).padStart(2, '0')}</span></span>;
}

function ThreadRow({ id }: { id: string }) {
  const t = useData((s) => s.channels[id]);
  const unread = useData((s) => isUnread(id, s));
  const threadId = useUI((s) => s.threadId);
  if (!t) return null;
  return (
    <div className={cn('thread-row', unread && 'unread', threadId === id && 'active')} onClick={() => setUI({ threadId: id, rightPanel: 'thread' })} role="button">
      <svg className="thread-spine" width="12" height="22" viewBox="0 0 12 22"><path d="M1 0 V12 Q1 17 6 17 H12" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      <span className="ellipsis">{t.name}</span>
    </div>
  );
}

function VoiceMembers({ channelId, stage }: { channelId: string; stage?: boolean }) {
  const members = useVoiceMembers(channelId);
  const serverId = useData((s) => s.channels[channelId]?.server_id ?? null);
  const speaking = useVoice(useShallow((s) => (s.channelId === channelId ? s.speaking : {})));
  if (!members.length) return null;
  return (
    <div className="voice-members">
      <AnimatePresence initial={false}>
        {members.map((p) => (
          <motion.div
            key={p.user_id}
            className="voice-member"
            initial={{ opacity: 0, height: 0, x: -8 }}
            animate={{ opacity: 1, height: 'auto', x: 0 }}
            exit={{ opacity: 0, height: 0, x: -8 }}
            transition={{ duration: 0.2 }}
            onContextMenu={(e) => openMenu(e, [{ label: 'Profile', icon: <Users />, onClick: () => openModal({ kind: 'profile', userId: p.user_id, serverId }) }])}
            onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setUI({ popout: { kind: 'profile', userId: p.user_id, serverId, x: r.right + 8, y: r.top, side: 'right' } }); }}
          >
            <Avatar userId={p.user_id} size={22} serverId={serverId} speaking={!!speaking[p.user_id]} />
            <NameTag userId={p.user_id} serverId={serverId} className="ellipsis grow" noEffect />
            <span className="vm-icons">
              {p.voice?.screen && <span className="live-tag">LIVE</span>}
              {p.voice?.video && <Video size={14} />}
              {p.voice?.deafened ? <HeadphoneOff size={14} className="red" /> : p.voice?.muted ? <MicOff size={14} className="red" /> : stage ? <Mic size={14} /> : null}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function channelMenu(c: Channel): MenuItem[] {
  const s = getData();
  const perms = permsFor(c.id, s);
  const muted = isMuted(c.id, s);
  const items: MenuItem[] = [];
  if (c.type !== 'voice' && c.type !== 'stage') items.push({ label: 'Mark As Read', icon: <Check />, onClick: () => markRead(c.id), disabled: !isUnread(c.id, s) && !mentionCount(c.id, s) });
  items.push({ divider: true });
  if (has(perms, P.CREATE_INVITE)) items.push({ label: 'Invite People', icon: <UserPlus />, color: 'var(--brand-text)', onClick: () => openModal({ kind: 'invite', serverId: c.server_id!, channelId: c.id }) });
  items.push({ label: 'Copy Link', icon: <Link />, onClick: async () => { const inv = await createInvite(c.server_id!, c.id, 0, 168).catch(() => null); void copyText(inv ? inviteUrl(inv.code) : window.location.href); toast('Link copied', 'success', '🔗'); } });
  items.push({ divider: true });
  items.push({ label: muted ? 'Unmute Channel' : 'Mute Channel', icon: muted ? <Bell /> : <BellOff />, onClick: () => void setNotification(c.id, { muted: !muted }) });
  if (has(perms, P.MANAGE_CHANNELS)) {
    items.push({ divider: true });
    items.push({ label: 'Edit Channel', icon: <Pencil />, onClick: () => openModal({ kind: 'channelSettings', channelId: c.id }) });
    items.push({ label: 'Delete Channel', icon: <Trash2 />, danger: true, onClick: () => openModal({
      kind: 'confirm', title: 'Delete Channel', danger: true, confirm: 'Delete Channel',
      body: <>Are you sure you want to delete <b>#{c.name}</b>? This cannot be undone.</>, onConfirm: () => deleteChannel(c.id),
    }) });
  }
  if (s.settings.developerMode) items.push({ divider: true }, { label: 'Copy Channel ID', icon: <Copy />, onClick: () => void copyText(c.id) });
  return items;
}

function categoryMenu(cat: Channel, serverId: string, collapsed: boolean, toggle: () => void): MenuItem[] {
  const s = getData();
  const perms = serverPermsFor(serverId, s);
  const muted = isMuted(cat.id, s);
  const items: MenuItem[] = [
    { label: collapsed ? 'Expand Category' : 'Collapse Category', icon: collapsed ? <ChevronDown /> : <ChevronRight />, onClick: toggle },
    { label: muted ? 'Unmute Category' : 'Mute Category', icon: muted ? <Bell /> : <BellOff />, onClick: () => void setNotification(cat.id, { muted: !muted }) },
  ];
  if (has(perms, P.MANAGE_CHANNELS)) {
    items.push({ divider: true },
      { label: 'Create Channel', icon: <Plus />, onClick: () => openModal({ kind: 'createChannel', serverId, parentId: cat.id }) },
      { label: 'Edit Category', icon: <Pencil />, onClick: () => openModal({ kind: 'channelSettings', channelId: cat.id }) },
      { label: 'Delete Category', icon: <Trash2 />, danger: true, onClick: () => openModal({ kind: 'confirm', title: 'Delete Category', danger: true, confirm: 'Delete', body: <>Delete <b>{cat.name}</b>? Its channels will be kept and moved out of the category.</>, onConfirm: () => deleteChannel(cat.id) }) });
  }
  return items;
}

