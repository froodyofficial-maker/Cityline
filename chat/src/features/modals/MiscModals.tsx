import { useEffect, useState } from 'react';
import { Copy, Ban, MessageSquare, UserPlus, Check } from 'lucide-react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { Spinner, Tabs, Field } from '../../components/ui/Controls';
import { Modal } from '../../components/ui/Modal';
import { NameTag } from '../../components/ui/NameTag';
import { copyText } from '../../lib/utils';
import { useData } from '../../store/data';
import { closeModal, navigate, toast, toastError, type ModalSpec } from '../../store/ui';
import { blockUser, getUserProfile, openDM, sendFriendRequestTo, setCustomStatus } from '../../store/actions/users';
import { firstTextChannel } from '../../store/selectors';
import { ProfileCard } from '../profile/ProfileCard';
import { ExpressionPicker } from '../expressions/ExpressionPicker';

export function ConfirmModal({ spec }: { spec: Extract<ModalSpec, { kind: 'confirm' }> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal width={440} title={spec.title}
      footer={<><button className="btn ghost" onClick={closeModal}>Cancel</button><button className={spec.danger ? 'btn danger' : 'btn'} disabled={busy} autoFocus onClick={async () => {
        setBusy(true);
        try { await spec.onConfirm(); closeModal(); } catch (e) { toastError(e); }
        setBusy(false);
      }}>{busy ? <Spinner /> : spec.confirm}</button></>}>
      <div className="confirm-body">{spec.body}</div>
    </Modal>
  );
}

export function ProfileModal({ userId, serverId }: { userId: string; serverId: string | null }) {
  const [tab, setTab] = useState<'about' | 'servers' | 'friends'>('about');
  const [extra, setExtra] = useState<{ mutual_servers: string[]; mutual_friends: string[] } | null>(null);
  const servers = useData((s) => s.servers);
  const me = useData((s) => s.me);
  const rel = useData((s) => s.relationships[userId]?.type);
  useEffect(() => { void getUserProfile(userId).then((r) => setExtra({ mutual_servers: r.mutual_servers ?? [], mutual_friends: r.mutual_friends ?? [] })).catch(() => {}); }, [userId]);
  const self = me === userId;
  return (
    <Modal width={620} bare className="profile-modal">
      <div className="profile-modal-grid">
        <ProfileCard userId={userId} serverId={serverId} variant="modal" onClose={closeModal} />
        {!self && (
          <div className="profile-modal-side">
            <Tabs layoutId="pm-tabs" value={tab} onChange={setTab} tabs={[
              { id: 'about', label: 'Actions' },
              { id: 'servers', label: `Mutual Servers${extra ? ` (${extra.mutual_servers.length})` : ''}` },
              { id: 'friends', label: `Mutual Friends${extra ? ` (${extra.mutual_friends.length})` : ''}` },
            ]} />
            {tab === 'about' && (
              <div className="col gap-8">
                <button className="btn block" onClick={() => { closeModal(); void openDM(userId); }}><MessageSquare size={16} /> Send Message</button>
                {!rel && <button className="btn secondary block" onClick={() => void sendFriendRequestTo(userId).catch(toastError)}><UserPlus size={16} /> Add Friend</button>}
                {rel === 'friend' && <button className="btn secondary block" disabled><Check size={16} /> You’re friends</button>}
                <button className="btn ghost block" onClick={() => { void copyText(userId); toast('User ID copied', 'success'); }}><Copy size={16} /> Copy User ID</button>
                {rel !== 'blocked' && <button className="btn ghost block danger-text" onClick={() => void blockUser(userId).then(() => toast('Blocked', 'info'))}><Ban size={16} /> Block</button>}
              </div>
            )}
            {tab === 'servers' && (
              <div className="col gap-4">
                {!extra ? <Spinner /> : extra.mutual_servers.length === 0 ? <div className="muted small">No servers in common</div> : extra.mutual_servers.map((id) => servers[id] && (
                  <button key={id} className="mutual-row" onClick={() => { closeModal(); navigate({ kind: 'server', serverId: id, channelId: firstTextChannel(id) }); }}>
                    <ServerIcon name={servers[id].name} url={servers[id].icon_url} size={36} /> <span className="ellipsis">{servers[id].name}</span>
                  </button>
                ))}
              </div>
            )}
            {tab === 'friends' && (
              <div className="col gap-4">
                {!extra ? <Spinner /> : extra.mutual_friends.length === 0 ? <div className="muted small">No friends in common</div> : extra.mutual_friends.map((id) => (
                  <div key={id} className="mutual-row"><Avatar userId={id} size={36} showStatus ring="var(--bg-modal)" /> <NameTag userId={id} /></div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string[]][] = [
  ['Quick switcher', ['Ctrl', 'K']],
  ['Toggle inbox', ['Ctrl', 'I']],
  ['Previous / next channel', ['Alt', '↑ / ↓']],
  ['Previous / next unread channel', ['Alt', 'Shift', '↑ / ↓']],
  ['Mark channel as read', ['Esc']],
  ['Edit your last message', ['↑']],
  ['New line', ['Shift', 'Enter']],
  ['Toggle mute (in voice)', ['Ctrl', 'Shift', 'M']],
  ['Toggle deafen (in voice)', ['Ctrl', 'Shift', 'D']],
  ['Push to talk (when enabled)', ['`']],
  ['User settings', ['Ctrl', ',']],
  ['This list', ['Ctrl', '/']],
  ['Pick several emoji', ['Shift', 'Click']],
];

export function ShortcutsModal() {
  return (
    <Modal width={560} title="Keyboard Shortcuts">
      <div className="shortcut-grid">
        {SHORTCUTS.map(([label, keys]) => (
          <div key={label} className="shortcut">
            <span>{label}</span>
            <span className="row gap-4">{keys.map((k) => <span key={k} className="kbd">{k}</span>)}</span>
          </div>
        ))}
      </div>
      <div className="divider" />
      <div className="label" style={{ marginBottom: 8 }}>Markdown cheat sheet</div>
      <div className="md-cheats">
        <code>**bold**</code><code>*italic*</code><code>__underline__</code><code>~~strike~~</code><code>||spoiler||</code><code>`code`</code><code>```js code block```</code><code>&gt; quote</code><code># Big header</code><code>-# small text</code><code>- list</code><code>[link](https://…)</code><code>&lt;t:1730000000:R&gt;</code>
      </div>
    </Modal>
  );
}

const STATUS_PRESETS = [
  { emoji: '🎮', text: 'Playing a game' },
  { emoji: '📚', text: 'Studying' },
  { emoji: '🎧', text: 'Listening to music' },
  { emoji: '🍕', text: 'Grabbing food' },
  { emoji: '💻', text: 'Coding something cool' },
  { emoji: '🌙', text: 'Away for the night' },
];

export function StatusModal() {
  const me = useData((s) => (s.me ? s.profiles[s.me] : undefined));
  const [text, setText] = useState(me?.custom_status ?? '');
  const [emoji, setEmoji] = useState(me?.custom_status_emoji ?? '😀');
  const [clear, setClear] = useState<number | null>(240);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await setCustomStatus(text.trim() || null, text.trim() ? emoji : null, text.trim() && clear ? new Date(Date.now() + clear * 60_000).toISOString() : null);
      closeModal();
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={440} title="Set a custom status" center
      footer={<><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : 'Save'}</button></>}>
      <Field label="What’s cookin’?">
        <div className="status-input">
          <button className="status-emoji" onClick={() => setPicker(!picker)}>{emoji}</button>
          <input className="input" autoFocus value={text} maxLength={128} onChange={(e) => setText(e.target.value)} placeholder="Support has arrived!" />
          {picker && <ExpressionPicker mode="reaction" anchor="message" onClose={() => setPicker(false)} onPick={(t) => { if (!t.startsWith('<')) setEmoji(t); setPicker(false); }} />}
        </div>
      </Field>
      <div className="chips-wrap" style={{ marginBottom: 14 }}>
        {STATUS_PRESETS.map((p) => <button key={p.text} className="chip" onClick={() => { setEmoji(p.emoji); setText(p.text); }}>{p.emoji} {p.text}</button>)}
      </div>
      <Field label="Clear after">
        <select className="select" value={clear ?? 0} onChange={(e) => setClear(Number(e.target.value) || null)}>
          <option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={240}>4 hours</option><option value={1440}>Today</option><option value={0}>Don’t clear</option>
        </select>
      </Field>
    </Modal>
  );
}
