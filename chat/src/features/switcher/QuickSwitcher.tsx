import { AnimatePresence, motion } from 'motion/react';
import { CornerDownLeft, Gem, Compass, Settings, Plus, Users, Keyboard } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { cn } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { dmName, dmOther, isUnread, mentionCount, permsFor } from '../../store/selectors';
import { navigate, openModal, setUI, useUI } from '../../store/ui';
import { openDM } from '../../store/actions/users';
import { channelIcon } from '../sidebar/ServerSidebar';

interface Item { key: string; label: string; sub?: string; icon: React.ReactNode; badge?: number; unread?: boolean; run: () => void; score: number }

function fuzzy(q: string, text: string) {
  if (!q) return 1;
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 100;
  if (t.includes(q)) return 50;
  let i = 0;
  for (const ch of t) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
}

export function QuickSwitcher() {
  const open = useUI((s) => s.quickSwitcher);
  return <AnimatePresence>{open && <Switcher />}</AnimatePresence>;
}

function Switcher() {
  const [q, setQ] = useState('');
  const [index, setIndex] = useState(0);
  const channels = useData((s) => s.channels);
  const servers = useData((s) => s.servers);
  const profiles = useData((s) => s.profiles);
  const input = useRef<HTMLInputElement>(null);
  const close = () => setUI({ quickSwitcher: false });

  const items = useMemo<Item[]>(() => {
    const s = getData();
    const query = q.trim().toLowerCase().replace(/^[#@*!]/, '');
    const mode = q.startsWith('#') ? 'channel' : q.startsWith('@') ? 'user' : q.startsWith('*') ? 'server' : q.startsWith('>') ? 'action' : 'all';
    const out: Item[] = [];
    if (mode === 'all' || mode === 'channel') {
      for (const c of Object.values(channels)) {
        if (!c.server_id || c.type === 'category' || permsFor(c.id, s) === 0n) continue;
        const sc = fuzzy(query, c.name);
        if (!sc) continue;
        out.push({ key: c.id, label: c.name, sub: servers[c.server_id]?.name, icon: channelIcon(c, 18), badge: mentionCount(c.id, s), unread: isUnread(c.id, s), score: sc + (isUnread(c.id, s) ? 5 : 0), run: () => {
          if (c.type === 'thread') { navigate({ kind: 'server', serverId: c.server_id!, channelId: c.thread_parent_id }); setUI({ threadId: c.id, rightPanel: 'thread' }); }
          else if (c.type === 'voice' || c.type === 'stage') { navigate({ kind: 'server', serverId: c.server_id!, channelId: null }); setUI({ voiceView: c.id }); }
          else navigate({ kind: 'server', serverId: c.server_id!, channelId: c.id });
        } });
      }
    }
    if (mode === 'all' || mode === 'user') {
      for (const c of Object.values(channels)) {
        if (c.type !== 'dm' && c.type !== 'group_dm') continue;
        const name = dmName(c, s);
        const other = dmOther(c, s);
        const sc = Math.max(fuzzy(query, name), other ? fuzzy(query, other.username) : 0);
        if (!sc) continue;
        out.push({ key: c.id, label: name, sub: other?.username ?? 'Group DM', icon: other ? <Avatar userId={other.id} size={22} showStatus ring="var(--bg-modal)" /> : <ServerIcon name={name} size={22} />, badge: mentionCount(c.id, s), score: sc + 8, run: () => navigate({ kind: 'dm', channelId: c.id }) });
      }
      for (const r of Object.values(s.relationships)) {
        if (r.type !== 'friend') continue;
        if (out.some((x) => x.sub === s.profiles[r.target_id]?.username)) continue;
        const p = s.profiles[r.target_id];
        if (!p) continue;
        const sc = Math.max(fuzzy(query, p.username), fuzzy(query, p.display_name ?? ''));
        if (!sc || !query) continue;
        out.push({ key: 'f' + p.id, label: p.display_name || p.username, sub: p.username, icon: <Avatar userId={p.id} size={22} />, score: sc, run: () => void openDM(p.id) });
      }
    }
    if (mode === 'all' || mode === 'server') {
      for (const sv of Object.values(servers)) {
        const sc = fuzzy(query, sv.name);
        if (!sc) continue;
        out.push({ key: sv.id, label: sv.name, sub: 'Server', icon: <ServerIcon name={sv.name} url={sv.icon_url} size={22} />, score: sc - 2, run: () => navigate({ kind: 'server', serverId: sv.id, channelId: null }) });
      }
    }
    if (mode === 'all' || mode === 'action') {
      const actions = [
        { key: 'a-friends', label: 'Friends', icon: <Users size={18} />, run: () => navigate({ kind: 'friends' }) },
        { key: 'a-neon', label: 'Cityline Neon', icon: <Gem size={18} />, run: () => navigate({ kind: 'neon' }) },
        { key: 'a-discover', label: 'Discover servers', icon: <Compass size={18} />, run: () => navigate({ kind: 'discover' }) },
        { key: 'a-settings', label: 'User Settings', icon: <Settings size={18} />, run: () => openModal({ kind: 'userSettings' }) },
        { key: 'a-create', label: 'Create a server', icon: <Plus size={18} />, run: () => openModal({ kind: 'createServer' }) },
        { key: 'a-keys', label: 'Keyboard shortcuts', icon: <Keyboard size={18} />, run: () => openModal({ kind: 'shortcuts' }) },
      ];
      for (const a of actions) { const sc = fuzzy(query, a.label); if (sc && (query || mode === 'action')) out.push({ ...a, sub: 'Action', score: sc - 5 }); }
    }
    if (!query && mode === 'all') {
      // recent / unread first
      return out.filter((x) => x.unread || x.badge || x.sub === 'Server').sort((a, b) => (b.badge ?? 0) - (a.badge ?? 0) || b.score - a.score).slice(0, 10);
    }
    return out.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [q, channels, servers, profiles]);

  useEffect(() => { setIndex(0); }, [q]);
  useEffect(() => { input.current?.focus(); }, []);

  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <motion.div className="switcher" initial={{ opacity: 0, scale: 0.94, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ type: 'spring', stiffness: 460, damping: 32 }}>
        <div className="switcher-title">Search for servers, channels or DMs</div>
        <input
          ref={input}
          className="switcher-input"
          placeholder="Where would you like to go?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
            if (e.key === 'Enter' && items[index]) { items[index].run(); close(); }
            if (e.key === 'Escape') close();
          }}
        />
        <div className="switcher-list scroll thin">
          {!q && <div className="switcher-section">{items.length ? 'Unread & servers' : 'Start typing to search'}</div>}
          {items.map((it, i) => (
            <button key={it.key} className={cn('switcher-item', i === index && 'on', it.unread && 'unread')} onMouseEnter={() => setIndex(i)} onClick={() => { it.run(); close(); }}>
              <span className="si-icon">{it.icon}</span>
              <span className="si-label ellipsis">{it.label}</span>
              {it.sub && <span className="si-sub ellipsis">{it.sub}</span>}
              {!!it.badge && <span className="badge">{it.badge}</span>}
              {i === index && <CornerDownLeft size={14} className="muted" />}
            </button>
          ))}
        </div>
        <div className="switcher-foot">
          <span><b>Protip:</b> start with <span className="kbd">@</span> for people, <span className="kbd">#</span> channels, <span className="kbd">*</span> servers, <span className="kbd">&gt;</span> actions</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
