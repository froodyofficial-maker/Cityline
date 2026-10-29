import { AnimatePresence, motion } from 'motion/react';
import { Gem, Plus, Users, X, Compass } from 'lucide-react';
import { useMemo } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { Tip } from '../../components/ui/Tooltip';
import { cn, plural } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { dmChannels, dmName, isUnread, mentionCount } from '../../store/selectors';
import { navigate, openMenu, openModal, setUI, useUI } from '../../store/ui';
import { closeDM } from '../../store/actions/users';
import { markRead } from '../../store/actions/messages';
import { Check, Copy } from 'lucide-react';
import { copyText } from '../../lib/utils';

export function DMSidebar() {
  const route = useUI((s) => s.route);
  const channels = useData((s) => s.channels);
  const incoming = useData((s) => Object.values(s.relationships).filter((r) => r.type === 'incoming').length);
  const list = useMemo(() => { void channels; return dmChannels(getData()); }, [channels]);
  return (
    <>
      <div className="side-search">
        <button className="side-search-btn" onClick={() => setUI({ quickSwitcher: true })}>Find or start a conversation</button>
      </div>
      <div className="channel-list scroll thin">
        <div className="dm-nav">
          <button className={cn('dm-nav-item', route.kind === 'friends' && 'active')} onClick={() => navigate({ kind: 'friends' })}>
            <Users size={22} /> Friends
            {incoming > 0 && <span className="badge" style={{ marginLeft: 'auto' }}>{incoming}</span>}
          </button>
          <button className={cn('dm-nav-item', route.kind === 'neon' && 'active')} onClick={() => navigate({ kind: 'neon' })}>
            <Gem size={22} className="neon-icon" /> <span className="grad-text bold">Neon</span>
          </button>
          <button className={cn('dm-nav-item', route.kind === 'discover' && 'active')} onClick={() => navigate({ kind: 'discover' })}>
            <Compass size={22} /> Discover
          </button>
        </div>
        <div className="dm-head">
          <span>Direct Messages</span>
          <Tip label="Create DM">
            <button className="icon-btn sm" onClick={() => openModal({ kind: 'createGroup' })}><Plus /></button>
          </Tip>
        </div>
        <AnimatePresence initial={false}>
          {list.map((c) => (
            <motion.div key={c.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
              <DMRow channelId={c.id} active={route.kind === 'dm' && route.channelId === c.id} />
            </motion.div>
          ))}
        </AnimatePresence>
        {!list.length && (
          <div className="dm-empty">
            {[0, 1, 2, 3].map((i) => <div key={i} className="dm-ghost" style={{ opacity: 1 - i * 0.22 }}><i /><span /></div>)}
            <p className="muted small center">Your DMs will show up here. Add a friend to start chatting!</p>
          </div>
        )}
      </div>
    </>
  );
}

function DMRow({ channelId, active }: { channelId: string; active: boolean }) {
  const c = useData((s) => s.channels[channelId]);
  const name = useData((s) => (c ? dmName(c, s) : ''));
  const other = useData((s) => (c?.type === 'dm' ? c.recipients?.find((id) => id !== s.me) : undefined));
  const status = useData((s) => (other ? s.profiles[other]?.custom_status : null));
  const unread = useData((s) => isUnread(channelId, s));
  const count = useData((s) => mentionCount(channelId, s));
  const typing = useData((s) => Object.keys(s.typing[channelId] || {}).length > 0);
  const dev = useData((s) => !!s.settings.developerMode);
  if (!c) return null;
  const members = c.recipients?.length ?? 0;
  return (
    <div
      className={cn('dm-row', active && 'active', unread && 'unread')}
      onClick={() => navigate({ kind: 'dm', channelId })}
      onContextMenu={(e) => openMenu(e, [
        { label: 'Mark As Read', icon: <Check />, onClick: () => markRead(channelId) },
        ...(other ? [{ label: 'Profile', icon: <Users />, onClick: () => openModal({ kind: 'profile', userId: other }) }] : []),
        { divider: true },
        { label: c.type === 'group_dm' ? 'Leave Group' : 'Close DM', icon: <X />, danger: c.type === 'group_dm', onClick: () => void closeDM(channelId) },
        ...(dev ? [{ label: 'Copy Channel ID', icon: <Copy />, onClick: () => void copyText(channelId) }] : []),
      ])}
      role="button"
    >
      {c.type === 'group_dm' ? (
        <ServerIcon name={name} url={c.icon_url} size={34} className="group-icon" />
      ) : (
        <Avatar userId={other} size={34} showStatus ring="var(--bg-side)" />
      )}
      <div className="dm-text">
        <div className="dm-name ellipsis">{name}</div>
        {typing ? <div className="dm-sub typing-sub">typing…</div>
          : c.type === 'group_dm' ? <div className="dm-sub">{plural(members, 'Member')}</div>
          : status ? <div className="dm-sub ellipsis">{status}</div> : null}
      </div>
      {count > 0 && <span className="badge">{count}</span>}
      <button className="icon-btn sm dm-close" onClick={(e) => { e.stopPropagation(); void closeDM(channelId); }} aria-label="Close DM"><X /></button>
    </div>
  );
}
