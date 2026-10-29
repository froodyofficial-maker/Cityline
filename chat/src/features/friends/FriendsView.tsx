import { AnimatePresence, motion } from 'motion/react';
import { Check, Menu, MessageSquare, MoreVertical, Search, UserPlus, Users, X, Volume2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { cn } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { presenceStatus } from '../../store/selectors';
import { navigate, openMenu, openModal, setUI, toast } from '../../store/ui';
import { acceptFriend, blockUser, openDM, removeFriend, sendFriendRequest, startCall, unblockUser } from '../../store/actions/users';
import { joinVoice } from '../../lib/voice';

type Tab = 'online' | 'all' | 'pending' | 'blocked' | 'add';

export function FriendsView() {
  const [tab, setTab] = useState<Tab>('online');
  const rels = useData((s) => s.relationships);
  const presence = useData((s) => s.presence);
  const [q, setQ] = useState('');
  const pending = Object.values(rels).filter((r) => r.type === 'incoming').length;

  const list = useMemo(() => {
    const s = getData();
    let ids: string[] = [];
    const all = Object.values(rels);
    if (tab === 'online') ids = all.filter((r) => r.type === 'friend' && presenceStatus(r.target_id, s) !== 'offline').map((r) => r.target_id);
    if (tab === 'all') ids = all.filter((r) => r.type === 'friend').map((r) => r.target_id);
    if (tab === 'pending') ids = all.filter((r) => r.type === 'incoming' || r.type === 'outgoing').map((r) => r.target_id);
    if (tab === 'blocked') ids = all.filter((r) => r.type === 'blocked').map((r) => r.target_id);
    const ql = q.toLowerCase();
    return ids.filter((id) => !ql || s.profiles[id]?.username.includes(ql) || (s.profiles[id]?.display_name ?? '').toLowerCase().includes(ql))
      .sort((a, b) => (s.profiles[a]?.display_name || s.profiles[a]?.username || '').localeCompare(s.profiles[b]?.display_name || s.profiles[b]?.username || ''));
  }, [rels, presence, tab, q]);

  const titles: Record<Tab, string> = { online: 'Online', all: 'All friends', pending: 'Pending', blocked: 'Blocked', add: '' };

  return (
    <div className="friends">
      <header className="chat-header">
        <button className="icon-btn only-mobile" onClick={() => setUI({ mobileNav: true })}><Menu /></button>
        <div className="chat-title"><Users size={22} className="muted" /><h1>Friends</h1></div>
        <span className="hdr-sep" />
        <nav className="friends-tabs">
          {(['online', 'all', 'pending', 'blocked'] as Tab[]).map((t) => (
            <button key={t} className={cn(tab === t && 'on')} onClick={() => setTab(t)}>
              {t === 'online' ? 'Online' : t === 'all' ? 'All' : t === 'pending' ? 'Pending' : 'Blocked'}
              {t === 'pending' && pending > 0 && <span className="badge" style={{ marginLeft: 6 }}>{pending}</span>}
            </button>
          ))}
          <button className={cn('add-friend', tab === 'add' && 'on')} onClick={() => setTab('add')}>Add Friend</button>
        </nav>
        <span className="spacer" />
        <Tip label="New Group DM" side="bottom"><button className="icon-btn" onClick={() => openModal({ kind: 'createGroup' })}><MessageSquare /></button></Tip>
      </header>
      <div className="friends-body">
        <div className="friends-main">
          {tab === 'add' ? <AddFriend /> : (
            <>
              <div className="friends-search input-wrap">
                <Search />
                <input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="friends-count">{titles[tab]} — {list.length}</div>
              <div className="friends-list scroll thin">
                <AnimatePresence initial={false}>
                  {list.map((id) => (
                    <motion.div key={id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
                      <FriendRow userId={id} />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!list.length && <FriendsEmpty tab={tab} onAdd={() => setTab('add')} />}
              </div>
            </>
          )}
        </div>
        <ActiveNow />
      </div>
    </div>
  );
}

function FriendRow({ userId }: { userId: string }) {
  const rel = useData((s) => s.relationships[userId]?.type);
  const p = useData((s) => s.profiles[userId]);
  const status = useData((s) => presenceStatus(userId, s));
  if (!p) return null;
  const sub = rel === 'incoming' ? 'Incoming Friend Request' : rel === 'outgoing' ? 'Outgoing Friend Request' : rel === 'blocked' ? 'Blocked'
    : p.custom_status ? `${p.custom_status_emoji ?? ''} ${p.custom_status}` : status === 'offline' ? 'Offline' : status === 'dnd' ? 'Do Not Disturb' : status === 'idle' ? 'Idle' : 'Online';
  return (
    <div className="friend-row" onClick={() => rel === 'friend' && void openDM(userId)} role="button"
      onContextMenu={(e) => openMenu(e, [
        { label: 'Profile', onClick: () => openModal({ kind: 'profile', userId }) },
        { label: 'Message', onClick: () => void openDM(userId) },
        { divider: true },
        ...(rel === 'friend' ? [{ label: 'Remove Friend', danger: true, onClick: () => openModal({ kind: 'confirm', title: `Remove '${p.display_name || p.username}'`, danger: true, confirm: 'Remove Friend', body: <>Are you sure you want to remove <b>{p.display_name || p.username}</b> from your friends?</>, onConfirm: () => removeFriend(userId) }) }] : []),
        rel === 'blocked' ? { label: 'Unblock', onClick: () => void unblockUser(userId) } : { label: 'Block', danger: true, onClick: () => void blockUser(userId) },
      ])}>
      <Avatar userId={userId} size={36} showStatus ring="var(--bg-chat)" />
      <div className="friend-text">
        <div className="row gap-6"><NameTag userId={userId} className="bold" /><span className="friend-username">{p.username}</span></div>
        <div className="friend-sub ellipsis">{sub}</div>
      </div>
      <div className="friend-actions">
        {rel === 'friend' && <Tip label="Message"><button className="round-btn" onClick={(e) => { e.stopPropagation(); void openDM(userId); }}><MessageSquare size={18} /></button></Tip>}
        {rel === 'incoming' && <Tip label="Accept"><button className="round-btn ok" onClick={(e) => { e.stopPropagation(); void acceptFriend(userId); }}><Check size={18} /></button></Tip>}
        {(rel === 'incoming' || rel === 'outgoing') && <Tip label={rel === 'incoming' ? 'Ignore' : 'Cancel'}><button className="round-btn no" onClick={(e) => { e.stopPropagation(); void removeFriend(userId); }}><X size={18} /></button></Tip>}
        {rel === 'blocked' && <Tip label="Unblock"><button className="round-btn no" onClick={(e) => { e.stopPropagation(); void unblockUser(userId); }}><X size={18} /></button></Tip>}
        {rel === 'friend' && (
          <Tip label="More"><button className="round-btn" onClick={(e) => { e.stopPropagation(); openMenu(e, [
            { label: 'Start Voice Call', onClick: async () => { const id = await openDM(userId); await startCall(id); await joinVoice(id, null); } },
            { label: 'Remove Friend', danger: true, onClick: () => void removeFriend(userId) },
          ]); }}><MoreVertical size={18} /></button></Tip>
        )}
      </div>
    </div>
  );
}

function AddFriend() {
  const [name, setName] = useState('');
  const [state, setState] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const me = useData((s) => (s.me ? s.profiles[s.me]?.username : ''));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await sendFriendRequest(name);
      setState({ kind: 'ok', text: r === 'friend' ? `You and ${name} are now friends!` : `Success! Your friend request to ${name} was sent.` });
      setName('');
    } catch (err) {
      setState({ kind: 'err', text: err instanceof Error ? err.message : String(err) });
    }
    setBusy(false);
  }
  return (
    <div className="add-friend-wrap">
      <h2>Add Friend</h2>
      <p className="muted">You can add friends with their Cityline username. Yours is <b className="dim">{me}</b>.</p>
      <form className={cn('add-friend-box', state?.kind === 'ok' && 'ok', state?.kind === 'err' && 'err')} onSubmit={submit}>
        <input autoFocus placeholder="You can add friends with their Cityline username." value={name} onChange={(e) => { setName(e.target.value.toLowerCase().replace(/\s/g, '')); setState(null); }} />
        <button className="btn sm" disabled={!name || busy}>Send Friend Request</button>
      </form>
      {state && <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className={cn('add-friend-msg', state.kind)}>{state.text}</motion.div>}
      <div className="add-friend-art">
        <div className="wumpus">🦊</div>
        <p className="muted">Waiting on friends? You don’t have to! Explore public servers in <button className="btn link" onClick={() => navigate({ kind: 'discover' })}>Discover</button>.</p>
      </div>
    </div>
  );
}

function FriendsEmpty({ tab, onAdd }: { tab: Tab; onAdd: () => void }) {
  const copy = {
    online: ['🌙', 'No one’s around to play with right now.'],
    all: ['🦊', 'Cityline’s mascot is waiting on friends. You don’t have to though!'],
    pending: ['📭', 'There are no pending friend requests. Here’s a fox for now.'],
    blocked: ['🛡️', 'You can’t unblock the fox.'],
    add: ['', ''],
  }[tab];
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <div className="art" style={{ fontSize: 80 }}>{copy[0]}</div>
      <p>{copy[1]}</p>
      {tab !== 'blocked' && <button className="btn" onClick={onAdd}><UserPlus size={16} /> Add Friend</button>}
    </div>
  );
}

function ActiveNow() {
  const presence = useData((s) => s.presence);
  const rels = useData((s) => s.relationships);
  const channels = useData((s) => s.channels);
  const servers = useData((s) => s.servers);
  const active = useMemo(() => Object.values(rels).filter((r) => r.type === 'friend').map((r) => presence[r.target_id]).filter((p) => p && (p.voice || p.activity)), [presence, rels]);
  return (
    <aside className="active-now hide-mobile">
      <h3>Active Now</h3>
      {!active.length ? (
        <div className="active-empty">
          <h4>It’s quiet for now…</h4>
          <p>When a friend starts an activity — like hanging out in voice — we’ll show it here!</p>
        </div>
      ) : active.map((p) => {
        const ch = p!.voice ? channels[p!.voice.channel_id] : null;
        return (
          <div key={p!.user_id} className="active-card">
            <div className="row gap-8">
              <Avatar userId={p!.user_id} size={32} showStatus ring="var(--bg-elev)" />
              <div className="grow">
                <NameTag userId={p!.user_id} className="bold" />
                <div className="tiny muted">{p!.voice ? (ch?.server_id ? `In ${servers[ch.server_id]?.name ?? 'a server'}` : 'In a call') : p!.activity?.name}</div>
              </div>
            </div>
            {ch && <div className="active-voice"><Volume2 size={14} /> {ch.server_id ? ch.name : 'Private call'}</div>}
          </div>
        );
      })}
      <div className="active-tip">
        <b>Tip:</b> Press <span className="kbd">Ctrl</span> + <span className="kbd">K</span> to find anyone fast.
      </div>
      <button className="btn sm secondary" style={{ marginTop: 12 }} onClick={() => toast('Share your username so friends can add you!', 'info', '👋')}>How do friends add me?</button>
    </aside>
  );
}
