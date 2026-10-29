import { motion } from 'motion/react';
import { AlarmClock, BarChart3, Clock, Hash, MessagesSquare, Plus, Search, Trash2, X, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { CheckBox, Field, Spinner, Switch } from '../../components/ui/Controls';
import { Modal } from '../../components/ui/Modal';
import { NameTag } from '../../components/ui/NameTag';
import { toTokens } from '../../lib/compose';
import { renderMarkdown } from '../../lib/markdown';
import type { Poll } from '../../lib/types';
import { cn, formatMessageTime, uuid } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { dmChannels, dmName, permsFor } from '../../store/selectors';
import { closeModal, navigate, setUI, toast, toastError } from '../../store/ui';
import { addReminder, cancelScheduled, createThread, forwardMessage, loadScheduled, scheduleMessage, sendMessage } from '../../store/actions/messages';
import { createGroupDM, openDM } from '../../store/actions/users';
import { has, P } from '../../lib/permissions';
import { toLocalInput } from './ServerModals';
import { useShallow } from 'zustand/react/shallow';

// ---------------------------------------------------------------- poll

export function PollModal({ channelId }: { channelId: string }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([{ id: uuid().slice(0, 8), text: '', emoji: '' }, { id: uuid().slice(0, 8), text: '', emoji: '' }]);
  const [multi, setMulti] = useState(false);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const valid = q.trim() && options.filter((o) => o.text.trim()).length >= 2;
  async function post() {
    setBusy(true);
    const poll: Poll = {
      question: q.trim(),
      options: options.filter((o) => o.text.trim()).map((o) => ({ id: o.id, text: o.text.trim(), emoji: o.emoji || null })),
      multi,
      expires_at: hours ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
    };
    const ok = await sendMessage(channelId, { content: '', poll });
    setBusy(false);
    if (ok) closeModal();
  }
  return (
    <Modal width={520} title={<span className="row gap-8"><BarChart3 /> Create a poll</span>}
      footer={<><span className="spacer" /><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={!valid || busy} onClick={() => void post()}>{busy ? <Spinner /> : 'Post'}</button></>}>
      <Field label="Question" required>
        <input className="input" autoFocus maxLength={300} value={q} onChange={(e) => setQ(e.target.value)} placeholder="What question do you want to ask?" />
      </Field>
      <div className="label" style={{ marginBottom: 8 }}>Answers</div>
      {options.map((o, i) => (
        <motion.div key={o.id} className="poll-edit-row" layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <input className="input poll-emoji-input" maxLength={4} value={o.emoji} placeholder="😀" onChange={(e) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, emoji: e.target.value } : x)))} />
          <input className="input" maxLength={55} value={o.text} placeholder={`Answer ${i + 1}`} onChange={(e) => setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
          {options.length > 2 && <button className="icon-btn" onClick={() => setOptions((all) => all.filter((x) => x.id !== o.id))}><Trash2 /></button>}
        </motion.div>
      ))}
      {options.length < 10 && <button className="btn sm secondary" onClick={() => setOptions((all) => [...all, { id: uuid().slice(0, 8), text: '', emoji: '' }])}><Plus size={14} /> Add another answer</button>}
      <div className="row gap-12" style={{ marginTop: 16 }}>
        <Field label="Duration">
          <select className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={1}>1 hour</option><option value={4}>4 hours</option><option value={8}>8 hours</option><option value={24}>24 hours</option><option value={72}>3 days</option><option value={168}>1 week</option><option value={0}>No end</option>
          </select>
        </Field>
        <div className="toggle-row grow" style={{ border: 0 }}>
          <div className="text"><div className="title">Allow multiple answers</div></div>
          <Switch on={multi} onChange={setMulti} />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- schedule (new)

export function ScheduleModal({ channelId, content }: { channelId: string; content: string }) {
  const [text, setText] = useState(content);
  const d = new Date(Date.now() + 3600_000);
  d.setSeconds(0, 0);
  const [at, setAt] = useState(toLocalInput(d));
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<{ id: string; content: string; send_at: string }[]>([]);
  const serverId = useData((s) => s.channels[channelId]?.server_id ?? null);
  useEffect(() => { void loadScheduled(channelId).then(setList).catch(() => {}); }, [channelId]);
  const presets: [string, () => Date][] = [
    ['In 1 hour', () => new Date(Date.now() + 3600_000)],
    ['Tonight 8 PM', () => { const x = new Date(); x.setHours(20, 0, 0, 0); if (x < new Date()) x.setDate(x.getDate() + 1); return x; }],
    ['Tomorrow 9 AM', () => { const x = new Date(); x.setDate(x.getDate() + 1); x.setHours(9, 0, 0, 0); return x; }],
    ['Monday 9 AM', () => { const x = new Date(); x.setDate(x.getDate() + ((8 - x.getDay()) % 7 || 7)); x.setHours(9, 0, 0, 0); return x; }],
  ];
  async function save() {
    const when = new Date(at);
    if (when <= new Date()) { toast('Pick a time in the future', 'error'); return; }
    setBusy(true);
    try {
      await scheduleMessage(channelId, toTokens(text.trim(), serverId), when);
      closeModal();
      setUI((s) => ({ drafts: { ...s.drafts, [channelId]: '' } }));
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={500} title={<span className="row gap-8"><Clock /> Schedule message <span className="tag-new">NEW</span></span>} subtitle="Write now, send later. It’s posted automatically at the time you pick."
      footer={<><span className="spacer" /><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={!text.trim() || busy} onClick={() => void save()}>{busy ? <Spinner /> : <><Send size={15} /> Schedule</>}</button></>}>
      <Field label="Message"><textarea className="textarea" autoFocus value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder="What should we send?" /></Field>
      <div className="chips-wrap" style={{ marginBottom: 12 }}>{presets.map(([l, f]) => <button key={l} className="chip" onClick={() => setAt(toLocalInput(f()))}>{l}</button>)}</div>
      <Field label="Send at"><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      {list.length > 0 && (
        <>
          <div className="label" style={{ margin: '8px 0' }}>Scheduled in this channel</div>
          {list.map((s) => (
            <div key={s.id} className="scheduled-row">
              <Clock size={14} />
              <span className="grow ellipsis">{s.content}</span>
              <span className="tiny muted">{formatMessageTime(s.send_at)}</span>
              <button className="icon-btn sm" onClick={async () => { await cancelScheduled(s.id); setList((l) => l.filter((x) => x.id !== s.id)); }}><X /></button>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- reminder

export function ReminderModal({ messageId, channelId }: { messageId: string; channelId: string }) {
  const d = new Date(Date.now() + 2 * 3600_000);
  d.setSeconds(0, 0);
  const [at, setAt] = useState(toLocalInput(d));
  const [note, setNote] = useState('');
  return (
    <Modal title={<span className="row gap-8"><AlarmClock /> Remind me</span>}
      footer={<><span className="spacer" /><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" onClick={() => { void addReminder({ messageId, channelId, at: new Date(at), note }); closeModal(); }}>Set reminder</button></>}>
      <Field label="When"><input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></Field>
      <Field label="Note (optional)"><input className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Reply to this" /></Field>
    </Modal>
  );
}

// ---------------------------------------------------------------- forward

export function ForwardModal({ messageId }: { messageId: string }) {
  const m = useData((s) => s.messages[messageId]);
  const channels = useData((s) => s.channels);
  const servers = useData((s) => s.servers);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const targets = useMemo(() => {
    const s = getData();
    const dms = dmChannels(s).map((c) => ({ id: c.id, label: dmName(c, s), sub: 'Direct Message', dm: c }));
    const text = Object.values(channels).filter((c) => c.server_id && (c.type === 'text' || c.type === 'announcement') && has(permsFor(c.id, s), P.SEND_MESSAGES))
      .map((c) => ({ id: c.id, label: c.name, sub: servers[c.server_id!]?.name ?? '', dm: null as null }));
    return [...dms, ...text].filter((t) => !q || t.label.toLowerCase().includes(q.toLowerCase()) || t.sub.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  }, [channels, servers, q]);
  if (!m) return null;
  async function send() {
    setBusy(true);
    for (const id of picked) await forwardMessage(messageId, id, note);
    setBusy(false);
    closeModal();
  }
  return (
    <Modal width={480} title="Forward To" subtitle="Select where you want to share this message."
      footer={<><span className="spacer" /><button className="btn" disabled={!picked.length || busy} onClick={() => void send()}>{busy ? <Spinner /> : `Send${picked.length > 1 ? ` (${picked.length})` : ''}`}</button></>}>
      <div className="input-wrap" style={{ marginBottom: 10 }}><Search /><input className="input" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
      <div className="forward-list scroll thin">
        {targets.map((t) => {
          const other = t.dm?.type === 'dm' ? t.dm.recipients?.find((x) => x !== getData().me) : null;
          return (
            <label key={t.id} className="forward-row" onClick={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : p.length < 5 ? [...p, t.id] : p))}>
              {other ? <Avatar userId={other} size={32} /> : t.dm ? <ServerIcon name={t.label} size={32} /> : <span className="forward-hash"><Hash size={18} /></span>}
              <span className="grow ellipsis"><b>{t.label}</b> <span className="tiny muted">{t.sub}</span></span>
              <CheckBox on={picked.includes(t.id)} />
            </label>
          );
        })}
      </div>
      <div className="forward-preview">
        <div className="tiny muted">Forwarding</div>
        <div className="md small">{m.content ? renderMarkdown(m.content.slice(0, 300), { serverId: m.server_id }) : <i>{m.attachments.length} attachment(s)</i>}</div>
      </div>
      <input className="input" placeholder="Add an optional message…" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

// ---------------------------------------------------------------- threads & forum posts

export function CreateThreadModal({ channelId, messageId, forum }: { channelId: string; messageId?: string; forum?: boolean }) {
  const parent = useData((s) => s.channels[channelId]);
  const m = useData((s) => (messageId ? s.messages[messageId] : undefined));
  const [name, setName] = useState(m ? m.content.replace(/[<>*_~`|#@:]/g, '').slice(0, 60) : '');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const isForum = forum || parent?.type === 'forum';
  async function create() {
    setBusy(true);
    try {
      const t = await createThread(channelId, name.trim(), { messageId, content: content.trim() ? toTokens(content.trim(), parent?.server_id ?? null) : undefined, tags });
      closeModal();
      setUI({ threadId: t.id, rightPanel: 'thread' });
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={520} title={<span className="row gap-8"><MessagesSquare /> {isForum ? 'New Post' : 'Create Thread'}</span>} subtitle={parent ? `in #${parent.name}` : undefined}
      footer={<><span className="spacer" /><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy || !name.trim() || (isForum && !content.trim())} onClick={() => void create()}>{busy ? <Spinner /> : isForum ? 'Post' : 'Create Thread'}</button></>}>
      {m && (
        <div className="thread-origin">
          <Avatar userId={m.author_id} size={24} /> <NameTag userId={m.author_id} serverId={m.server_id} className="bold" />
          <span className="ellipsis muted small">{m.content.slice(0, 100)}</span>
        </div>
      )}
      <Field label={isForum ? 'Post title' : 'Thread name'} required>
        <input className="input" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder={isForum ? 'Give it a great title' : 'New Thread'} onKeyDown={(e) => e.key === 'Enter' && !isForum && name.trim() && void create()} />
      </Field>
      {isForum && (parent?.available_tags?.length ?? 0) > 0 && (
        <Field label="Tags">
          <div className="chips-wrap">{parent!.available_tags.map((t) => <button key={t.id} className={cn('chip', tags.includes(t.id) && 'on')} onClick={() => setTags((x) => (x.includes(t.id) ? x.filter((y) => y !== t.id) : [...x, t.id]))}>{t.emoji} {t.name}</button>)}</div>
        </Field>
      )}
      <Field label={isForum ? 'Message' : 'Starter message (optional)'} required={isForum}>
        <textarea className="textarea" value={content} maxLength={4000} onChange={(e) => setContent(e.target.value)} placeholder={isForum ? 'Share your thoughts…' : 'Kick things off'} />
      </Field>
    </Modal>
  );
}

// ---------------------------------------------------------------- group DM

export function CreateGroupModal() {
  const friends = useData(useShallow((s) => Object.values(s.relationships).filter((r) => r.type === 'friend').map((r) => r.target_id)));
  const profiles = useData((s) => s.profiles);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const list = friends.filter((id) => !q || profiles[id]?.username.includes(q.toLowerCase()) || (profiles[id]?.display_name ?? '').toLowerCase().includes(q.toLowerCase()));
  async function create() {
    setBusy(true);
    try {
      if (picked.length === 1) { await openDM(picked[0]); }
      else await createGroupDM(picked, name);
      closeModal();
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={440} title="Select Friends" subtitle={`You can add ${9 - picked.length} more friend${9 - picked.length === 1 ? '' : 's'}.`}
      footer={<button className="btn block" disabled={!picked.length || busy} onClick={() => void create()}>{busy ? <Spinner /> : picked.length > 1 ? 'Create Group DM' : 'Create DM'}</button>}>
      <div className="group-picked">
        {picked.map((id) => <button key={id} className="chip" onClick={() => setPicked((p) => p.filter((x) => x !== id))}>{profiles[id]?.username} <X size={12} /></button>)}
        <input className="group-search" placeholder={picked.length ? '' : 'Type the username of a friend'} value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {picked.length > 1 && <input className="input" style={{ marginBottom: 10 }} placeholder="Group name (optional)" value={name} onChange={(e) => setName(e.target.value)} />}
      <div className="forward-list scroll thin">
        {list.map((id) => (
          <label key={id} className="forward-row" onClick={() => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 9 ? [...p, id] : p))}>
            <Avatar userId={id} size={32} showStatus ring="var(--bg-modal)" />
            <span className="grow ellipsis"><NameTag userId={id} className="bold" /> <span className="tiny muted">{profiles[id]?.username}</span></span>
            <CheckBox on={picked.includes(id)} />
          </label>
        ))}
        {!friends.length && <div className="empty"><div className="art">🦊</div><p>You don’t have any friends to add yet.</p><button className="btn sm" onClick={() => { closeModal(); navigate({ kind: 'friends' }); }}>Add Friends</button></div>}
      </div>
    </Modal>
  );
}
