import { AnimatePresence, motion } from 'motion/react';
import { Bell, BellOff, Check, Compass, Copy, FolderPlus, Gem, LogOut, Plus, Settings, UserPlus, Volume2, Hash, FolderMinus, Pencil } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { LogoMark } from '../../components/Logo';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { Tip } from '../../components/ui/Tooltip';
import { has, P } from '../../lib/permissions';
import { copyText, cn, uuid } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { dmChannels, dmName, firstTextChannel, isUnread, mentionCount, serverPermsFor, sortedServerIds, useServerBadge } from '../../store/selectors';
import { navigate, openMenu, openModal, toast, useUI, type MenuItem } from '../../store/ui';
import { updateSettings } from '../../store/actions/bootstrap';
import { markServerRead } from '../../store/actions/messages';
import { leaveServer, setNotification } from '../../store/actions/servers';
import { useVoice } from '../../store/voice';

type RailItem = { kind: 'server'; id: string } | { kind: 'folder'; id: string; name: string; color: string; servers: string[] };

export function ServerRail() {
  const route = useUI((s) => s.route);
  const [servers, settings] = useData(useShallow((s) => [s.servers, s.settings] as const));
  const memberships = useData((s) => s.memberships);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const items = useMemo<RailItem[]>(() => {
    void servers; void memberships;
    const folders = settings.folders ?? [];
    const inFolder = new Set(folders.flatMap((f) => f.servers));
    const ids = sortedServerIds(getData());
    const out: RailItem[] = [];
    const order = settings.serverOrder ?? [];
    const placed = new Set<string>();
    for (const key of order) {
      if (key.startsWith('folder:')) {
        const f = folders.find((x) => `folder:${x.id}` === key);
        if (f) {
          const list = f.servers.filter((sid) => servers[sid]);
          if (list.length) out.push({ kind: 'folder', id: f.id, name: f.name, color: f.color, servers: list });
          placed.add(key);
        }
      } else if (servers[key] && !inFolder.has(key)) { out.push({ kind: 'server', id: key }); placed.add(key); }
    }
    for (const f of folders) if (!placed.has(`folder:${f.id}`)) {
      const list = f.servers.filter((sid) => servers[sid]);
      if (list.length) out.push({ kind: 'folder', id: f.id, name: f.name, color: f.color, servers: list });
    }
    for (const id of ids) if (!placed.has(id) && !inFolder.has(id)) out.push({ kind: 'server', id });
    return out;
  }, [servers, settings, memberships]);

  const keyOf = (it: RailItem) => (it.kind === 'folder' ? `folder:${it.id}` : it.id);

  function drop(targetKey: string) {
    if (!dragging || dragging === targetKey) return;
    const keys = items.map(keyOf).filter((k) => k !== dragging);
    const at = keys.indexOf(targetKey);
    keys.splice(at < 0 ? keys.length : at, 0, dragging);
    // dragging a server out of a folder
    const folders = (settings.folders ?? []).map((f) => ({ ...f, servers: f.servers.filter((s) => s !== dragging) }));
    updateSettings({ serverOrder: keys, folders });
  }

  return (
    <div className="rail scroll hidden-bar">
      <RailButton
        active={route.kind === 'friends' || route.kind === 'dm'}
        label="Direct Messages"
        onClick={() => navigate({ kind: 'friends' }, { keepNav: true })}
        className="home"
      >
        <LogoMark size={30} />
      </RailButton>
      <UnreadDMs />
      <div className="rail-sep" />
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={keyOf(it)}
            layout
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            draggable
            onDragStartCapture={(e) => { setDragging(keyOf(it)); e.dataTransfer.effectAllowed = 'move'; }}
            onDragEnd={() => { setDragging(null); setOver(null); }}
            onDragOver={(e) => { e.preventDefault(); setOver(keyOf(it)); }}
            onDrop={(e) => { e.preventDefault(); drop(keyOf(it)); setDragging(null); setOver(null); }}
            className={cn('rail-slot', over === keyOf(it) && dragging && dragging !== keyOf(it) && 'drop-target')}
          >
            {it.kind === 'server' ? <ServerButton id={it.id} /> : <Folder folder={it} />}
          </motion.div>
        ))}
      </AnimatePresence>
      <RailButton label="Add a Server" onClick={() => openModal({ kind: 'createServer' })} className="action green">
        <Plus />
      </RailButton>
      <RailButton label="Discover" active={route.kind === 'discover'} onClick={() => navigate({ kind: 'discover' })} className="action green">
        <Compass />
      </RailButton>
      <div className="rail-sep" />
      <RailButton label="Cityline Neon" active={route.kind === 'neon'} onClick={() => navigate({ kind: 'neon' })} className="action neon">
        <Gem />
      </RailButton>
    </div>
  );
}

function RailButton({ children, label, name, active, unread, onClick, onContextMenu, className, badge }: { children: ReactNode; label: ReactNode; name?: string; active?: boolean; unread?: boolean; onClick?: () => void; onContextMenu?: (e: React.MouseEvent) => void; className?: string; badge?: number }) {
  return (
    <div className={cn('rail-item', active && 'active', unread && 'unread', className)}>
      <span className="rail-pill" />
      <Tip label={label} side="right" delay={60}>
        <button className="rail-btn" onClick={onClick} onContextMenu={onContextMenu} aria-label={name ?? (typeof label === 'string' ? label : undefined)}>
          {children}
        </button>
      </Tip>
      {!!badge && <span className="badge rail-badge">{badge > 99 ? '99+' : badge}</span>}
    </div>
  );
}

function ServerButton({ id, inFolder }: { id: string; inFolder?: boolean }) {
  const server = useData((s) => s.servers[id]);
  const route = useUI((s) => s.route);
  const [unread, mentions] = useServerBadge(id);
  const inVoice = useVoice((s) => s.serverId === id);
  const muted = useData((s) => !!s.notif[id]?.muted);
  if (!server) return null;
  const active = route.kind === 'server' && route.serverId === id;
  return (
    <RailButton
      name={server.name}
      label={<span className="row gap-6">{server.name}{inVoice && <Volume2 size={14} />}</span>}
      active={active}
      unread={unread && !muted}
      badge={mentions}
      className={cn('server', inFolder && 'in-folder', muted && 'muted')}
      onClick={() => navigate({ kind: 'server', serverId: id, channelId: lastChannel(id) }, { keepNav: true })}
      onContextMenu={(e) => openMenu(e, serverMenu(id))}
    >
      <ServerIcon name={server.name} url={server.icon_url} size={48} />
      {inVoice && <span className="rail-voice"><Volume2 size={10} /></span>}
    </RailButton>
  );
}

function lastChannel(serverId: string) {
  try {
    const map = JSON.parse(localStorage.getItem('cityline:last-channels') || '{}');
    const id = map[serverId];
    if (id && getData().channels[id]) return id;
  } catch { /* ignore */ }
  return firstTextChannel(serverId);
}

export function rememberChannel(serverId: string, channelId: string) {
  try {
    const map = JSON.parse(localStorage.getItem('cityline:last-channels') || '{}');
    map[serverId] = channelId;
    localStorage.setItem('cityline:last-channels', JSON.stringify(map));
  } catch { /* ignore */ }
}

export function serverMenu(id: string): MenuItem[] {
  const s = getData();
  const server = s.servers[id];
  const perms = serverPermsFor(id, s);
  const muted = !!s.notif[id]?.muted;
  const folders = s.settings.folders ?? [];
  const inFolder = folders.find((f) => f.servers.includes(id));
  const items: MenuItem[] = [
    { label: 'Mark As Read', icon: <Check />, onClick: () => void markServerRead(id) },
    { divider: true },
    ...(has(perms, P.CREATE_INVITE) ? [{ label: 'Invite People', icon: <UserPlus />, color: 'var(--brand-text)', onClick: () => openModal({ kind: 'invite', serverId: id }) }] : []),
    { label: muted ? 'Unmute Server' : 'Mute Server', icon: muted ? <Bell /> : <BellOff />, onClick: () => void setNotification(id, { muted: !muted }) },
    {
      label: 'Notification Settings', icon: <Bell />, submenu: (['all', 'mentions', 'nothing'] as const).map((lv) => ({
        label: lv === 'all' ? 'All Messages' : lv === 'mentions' ? 'Only @mentions' : 'Nothing',
        checked: (s.notif[id]?.level ?? 'mentions') === lv || (lv === 'mentions' && (s.notif[id]?.level ?? 'default') === 'default'),
        onClick: () => void setNotification(id, { level: lv }),
      })),
    },
    { divider: true },
    ...(inFolder
      ? [{ label: 'Remove from Folder', icon: <FolderMinus />, onClick: () => updateSettings({ folders: folders.map((f) => ({ ...f, servers: f.servers.filter((x) => x !== id) })) }) }]
      : [{
          label: 'Add to Folder', icon: <FolderPlus />, submenu: [
            ...folders.map((f) => ({ label: f.name, onClick: () => updateSettings({ folders: folders.map((x) => (x.id === f.id ? { ...x, servers: [...x.servers, id] } : x)) }) })),
            { label: 'New Folder', icon: <Plus />, onClick: () => {
              const fid = uuid().slice(0, 8);
              const order = (s.settings.serverOrder ?? sortedServerIds(s)).map((k) => (k === id ? `folder:${fid}` : k));
              updateSettings({ folders: [...folders, { id: fid, name: 'New Folder', color: '#7c6cff', servers: [id] }], serverOrder: order });
            } },
          ],
        }]),
    ...(has(perms, P.MANAGE_SERVER) || has(perms, P.MANAGE_ROLES) || has(perms, P.MANAGE_CHANNELS)
      ? [{ label: 'Server Settings', icon: <Settings />, onClick: () => openModal({ kind: 'serverSettings', serverId: id }) }] : []),
    ...(has(perms, P.MANAGE_CHANNELS) ? [{ label: 'Create Channel', icon: <Hash />, onClick: () => openModal({ kind: 'createChannel', serverId: id }) }] : []),
    ...(server && server.owner_id !== s.me ? [{ divider: true }, {
      label: 'Leave Server', icon: <LogOut />, danger: true, onClick: () => openModal({
        kind: 'confirm', title: `Leave '${server.name}'`, danger: true, confirm: 'Leave Server',
        body: <>Are you sure you want to leave <b>{server.name}</b>? You won’t be able to rejoin unless you are re-invited.</>,
        onConfirm: async () => { await leaveServer(id); toast(`You left ${server.name}`); },
      }),
    }] : []),
  ];
  if (s.settings.developerMode) items.push({ divider: true }, { label: 'Copy Server ID', icon: <Copy />, onClick: () => void copyText(id) });
  return items;
}

function Folder({ folder }: { folder: { id: string; name: string; color: string; servers: string[] } }) {
  const [open, setOpen] = useState(false);
  const servers = useData((s) => s.servers);
  const route = useUI((s) => s.route);
  const badge = useData((s) => folder.servers.reduce((n, sid) => n + Object.values(s.channels).filter((c) => c.server_id === sid).reduce((m, c) => m + mentionCount(c.id, s), 0), 0));
  const unread = useData((s) => folder.servers.some((sid) => Object.values(s.channels).some((c) => c.server_id === sid && c.type !== 'category' && isUnread(c.id, s))));
  const containsActive = route.kind === 'server' && folder.servers.includes(route.serverId);
  const menu = (e: React.MouseEvent) => openMenu(e, [
    { label: 'Rename Folder', icon: <Pencil />, onClick: () => {
      const name = prompt('Folder name', folder.name);
      if (name) updateSettings({ folders: (getData().settings.folders ?? []).map((f) => (f.id === folder.id ? { ...f, name } : f)) });
    } },
    { label: 'Folder Colour', submenu: ['#7c6cff', '#31d0ff', '#2fd88c', '#ffb547', '#ff5c7a', '#ff5fd2'].map((c) => ({ label: c, icon: <span className="role-dot" style={{ background: c }} />, onClick: () => updateSettings({ folders: (getData().settings.folders ?? []).map((f) => (f.id === folder.id ? { ...f, color: c } : f)) }) })) },
    { label: 'Ungroup', icon: <FolderMinus />, onClick: () => updateSettings({ folders: (getData().settings.folders ?? []).filter((f) => f.id !== folder.id) }) },
  ]);
  return (
    <div className={cn('rail-folder', open && 'open')} style={{ '--folder': folder.color } as React.CSSProperties}>
      <RailButton label={folder.name} active={containsActive && !open} unread={unread && !open} badge={open ? 0 : badge} onClick={() => setOpen(!open)} onContextMenu={menu} className="folder-btn">
        {open ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="var(--folder)"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
        ) : (
          <div className="folder-grid">
            {folder.servers.slice(0, 4).map((sid) => servers[sid] && <ServerIcon key={sid} name={servers[sid].name} url={servers[sid].icon_url} size={20} />)}
          </div>
        )}
      </RailButton>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="folder-items" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {folder.servers.map((sid) => <ServerButton key={sid} id={sid} inFolder />)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UnreadDMs() {
  const channels = useData((s) => s.channels);
  const readStates = useData((s) => s.readStates);
  const list = useMemo(() => {
    void channels; void readStates;
    const s = getData();
    return dmChannels(s).filter((c) => mentionCount(c.id, s) > 0).slice(0, 5);
  }, [channels, readStates]);
  return (
    <AnimatePresence initial={false}>
      {list.map((c) => (
        <motion.div key={c.id} layout initial={{ opacity: 0, scale: 0.4, height: 0 }} animate={{ opacity: 1, scale: 1, height: 'auto' }} exit={{ opacity: 0, scale: 0.4, height: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
          <DMBubble channelId={c.id} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

function DMBubble({ channelId }: { channelId: string }) {
  const c = useData((s) => s.channels[channelId]);
  const count = useData((s) => mentionCount(channelId, s));
  const name = useData((s) => (c ? dmName(c, s) : ''));
  const other = useData((s) => c?.recipients?.find((id) => id !== s.me));
  if (!c) return null;
  return (
    <RailButton label={name} badge={count} onClick={() => navigate({ kind: 'dm', channelId })} className="dm-bubble">
      {c.type === 'group_dm' ? <ServerIcon name={name} url={c.icon_url} size={48} /> : <Avatar userId={other} size={48} />}
    </RailButton>
  );
}
