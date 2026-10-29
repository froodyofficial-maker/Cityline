import { motion } from 'motion/react';
import { AlarmClock, AtSign, Bookmark, Check, Inbox } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tabs } from '../../components/ui/Controls';
import type { Message } from '../../lib/types';
import { formatMessageTime } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { setUI } from '../../store/ui';
import { completeReminder, fetchMessage, loadBookmarks, loadMentions, toggleBookmark } from '../../store/actions/messages';
import { MessageCard } from './MessageCard';

type Tab = 'mentions' | 'saved' | 'reminders';

export function InboxPopover() {
  const [tab, setTab] = useState<Tab>('mentions');
  const [mentions, setMentions] = useState<Message[] | null>(null);
  const [saved, setSaved] = useState<Message[] | null>(null);
  const reminders = useData((s) => s.reminders);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest('.inbox-anchor') || t.closest('.menu') || t.closest('.lightbox')) return;
      setUI({ inbox: false });
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  useEffect(() => {
    if (tab === 'mentions' && !mentions) void loadMentions().then(setMentions).catch(() => setMentions([]));
    if (tab === 'saved' && !saved) void loadBookmarks().then(setSaved).catch(() => setSaved([]));
    if (tab === 'reminders') for (const r of reminders) if (r.message_id && !getData().messages[r.message_id]) void fetchMessage(r.message_id).catch(() => {});
  }, [tab, mentions, saved, reminders]);

  return (
    <motion.div ref={ref} className="inbox" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.16 }}>
      <div className="inbox-head"><Inbox size={20} /> <h3>Inbox</h3></div>
      <Tabs layoutId="inbox-tabs" value={tab} onChange={setTab} tabs={[
        { id: 'mentions', label: <span className="row gap-6"><AtSign size={14} /> Mentions</span> },
        { id: 'saved', label: <span className="row gap-6"><Bookmark size={14} /> Saved</span> },
        { id: 'reminders', label: <span className="row gap-6"><AlarmClock size={14} /> Reminders{reminders.length ? ` (${reminders.length})` : ''}</span> },
      ]} />
      <div className="inbox-body scroll thin">
        {tab === 'mentions' && (mentions === null ? <div className="empty"><span className="spinner" /></div>
          : mentions.length === 0 ? <div className="empty"><div className="art">🎉</div><h3>Nobody’s pinged you lately</h3><p>When someone @mentions you, it’ll show up here for 30 days.</p></div>
          : mentions.map((m) => <MessageCard key={m.id} m={m} showChannel />))}
        {tab === 'saved' && (saved === null ? <div className="empty"><span className="spinner" /></div>
          : saved.length === 0 ? <div className="empty"><div className="art">🔖</div><h3>Nothing saved yet</h3><p>Right-click any message → Save for Later.</p></div>
          : saved.map((m) => <MessageCard key={m.id} m={m} showChannel onRemove={() => { void toggleBookmark(m); setSaved((s) => s?.filter((x) => x.id !== m.id) ?? null); }} />))}
        {tab === 'reminders' && (reminders.length === 0
          ? <div className="empty"><div className="art">⏰</div><h3>No reminders</h3><p>Right-click a message → Remind Me, or type <code>/remind 30m stretch</code>.</p></div>
          : reminders.map((r) => <ReminderRow key={r.id} id={r.id} />))}
      </div>
    </motion.div>
  );
}

function ReminderRow({ id }: { id: string }) {
  const r = useData((s) => s.reminders.find((x) => x.id === id));
  const m = useData((s) => (r?.message_id ? s.messages[r.message_id] : undefined));
  if (!r) return null;
  const extra = <div className="reminder-at"><AlarmClock size={13} /> {formatMessageTime(r.remind_at)}{r.note ? ` — ${r.note}` : ''}</div>;
  if (m) return <MessageCard m={m} showChannel extra={extra} onRemove={() => void completeReminder(r.id)} />;
  return (
    <div className="mcard">
      <div className="mcard-body"><div className="grow">{extra}</div></div>
      <div className="mcard-actions"><button className="icon-btn sm" onClick={() => void completeReminder(r.id)}><Check /></button></div>
    </div>
  );
}
