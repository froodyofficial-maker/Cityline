import { motion } from 'motion/react';
import { BarChart3, Check } from 'lucide-react';
import { useState } from 'react';
import type { Message } from '../../lib/types';
import { cn, relativeTime } from '../../lib/utils';
import { votePoll } from '../../store/actions/messages';
import { toastError } from '../../store/ui';

export function PollCard({ message }: { message: Message }) {
  const poll = message.poll!;
  const results = message.poll_results ?? [];
  const total = results.reduce((n, r) => n + r.count, 0);
  const mine = results.filter((r) => r.me).map((r) => r.option_id);
  const ended = !!poll.expires_at && new Date(poll.expires_at) < new Date();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const voted = mine.length > 0;
  const [showResults, setShowResults] = useState(false);
  const reveal = voted || ended || showResults;
  const max = Math.max(1, ...results.map((r) => r.count));

  async function vote(ids: string[]) {
    setBusy(true);
    try { await votePoll(message.id, ids); setPicked([]); } catch (e) { toastError(e); }
    setBusy(false);
  }

  function click(id: string) {
    if (ended || busy) return;
    if (poll.multi) setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    else if (!voted) void vote([id]);
    else setPicked([id]);
  }

  return (
    <div className="poll">
      <div className="poll-q">{poll.question}</div>
      <div className="poll-sub muted small">{poll.multi ? 'Select one or more answers' : 'Select one answer'}</div>
      <div className="poll-options">
        {poll.options.map((o) => {
          const r = results.find((x) => x.option_id === o.id);
          const n = r?.count ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const sel = picked.includes(o.id) || (!picked.length && mine.includes(o.id));
          const winner = ended && n === max && n > 0;
          return (
            <button key={o.id} className={cn('poll-opt', sel && 'sel', reveal && 'reveal', winner && 'winner')} onClick={() => click(o.id)} disabled={ended}>
              {reveal && <motion.span className="poll-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />}
              {o.emoji && <span className="poll-emoji">{o.emoji}</span>}
              <span className="poll-text">{o.text}</span>
              {reveal && <span className="poll-pct">{pct}% <span className="muted">({n})</span></span>}
              <span className={cn(poll.multi ? 'check' : 'radio-dot', sel && 'on')}>{poll.multi && <Check size={12} strokeWidth={3} />}</span>
            </button>
          );
        })}
      </div>
      <div className="poll-foot">
        <span className="muted small">
          <BarChart3 size={13} /> {total} {total === 1 ? 'vote' : 'votes'} · {ended ? 'Poll closed' : poll.expires_at ? `ends ${relativeTime(poll.expires_at)}` : 'no end date'}
        </span>
        <span className="spacer" />
        {!ended && !voted && !showResults && <button className="btn link small" onClick={() => setShowResults(true)}>Show results</button>}
        {!ended && voted && !picked.length && <button className="btn link small" onClick={() => void vote([])}>Remove vote</button>}
        {!ended && picked.length > 0 && (poll.multi || voted) && <button className="btn sm" disabled={busy} onClick={() => void vote(picked)}>Vote</button>}
      </div>
    </div>
  );
}
