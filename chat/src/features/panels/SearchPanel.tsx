import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Message } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { setRightPanel, setUI, useUI } from '../../store/ui';
import { searchMessages } from '../../store/actions/messages';
import { MessageCard } from './MessageCard';
import { Avatar } from '../../components/ui/Avatar';

const HAS = [
  { id: null, label: 'Anything' }, { id: 'link', label: 'Links' }, { id: 'image', label: 'Images' }, { id: 'video', label: 'Videos' },
  { id: 'file', label: 'Files' }, { id: 'sound', label: 'Sounds' }, { id: 'poll', label: 'Polls' }, { id: 'embed', label: 'Embeds' },
] as const;

export function SearchPanel({ channelId }: { channelId: string }) {
  const sq = useUI((s) => s.searchQuery);
  const channel = useData((s) => s.channels[channelId]);
  const members = useData((s) => (channel?.server_id ? s.members[channel.server_id] : undefined));
  const [query, setQuery] = useState(sq?.query ?? '');
  const [has, setHas] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [results, setResults] = useState<{ total: number; messages: Message[] } | null>(null);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<'new' | 'old'>('new');

  useEffect(() => { if (sq) setQuery(sq.query); }, [sq]);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    const t = setTimeout(() => {
      void searchMessages({ query, serverId: channel?.server_id ?? null, channelId: channel?.server_id ? null : channelId, has, author, pinned: pinned || null, offset })
        .then((r) => { if (alive) setResults(r); })
        .catch(() => { if (alive) setResults({ total: 0, messages: [] }); })
        .finally(() => alive && setBusy(false));
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [query, has, author, pinned, offset, channelId, channel?.server_id]);

  const list = results ? (sort === 'new' ? results.messages : [...results.messages].reverse()) : [];
  return (
    <div className="panel search-panel">
      <div className="panel-head">
        <div className="input-wrap grow"><Search /><input className="input" value={query} autoFocus onChange={(e) => { setQuery(e.target.value); setOffset(0); }} placeholder="Search messages" /></div>
        <button className="icon-btn" onClick={() => { setUI({ searchQuery: null }); setRightPanel('members'); }}><X /></button>
      </div>
      <div className="search-filters">
        <div className="chips scroll hidden-bar">
          {HAS.map((h) => <button key={String(h.id)} className={cn('chip', has === h.id && 'on')} onClick={() => { setHas(h.id); setOffset(0); }}>{h.label}</button>)}
          <button className={cn('chip', pinned && 'on')} onClick={() => setPinned(!pinned)}>📌 Pinned</button>
        </div>
        {members && (
          <div className="chips scroll hidden-bar">
            <span className="tiny muted">From:</span>
            <button className={cn('chip', !author && 'on')} onClick={() => setAuthor(null)}>Anyone</button>
            {Object.keys(members).slice(0, 12).map((id) => (
              <button key={id} className={cn('chip', author === id && 'on')} onClick={() => { setAuthor(author === id ? null : id); setOffset(0); }}>
                <Avatar userId={id} size={16} /> {useData.getState().profiles[id]?.username ?? '…'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="search-summary">
        <span>{busy ? 'Searching…' : `${results?.total ?? 0} Results`}</span>
        <span className="spacer" />
        <div className="segmented small-seg">
          <button className={cn(sort === 'new' && 'on')} onClick={() => setSort('new')}>New</button>
          <button className={cn(sort === 'old' && 'on')} onClick={() => setSort('old')}>Old</button>
        </div>
      </div>
      <div className="panel-body scroll thin">
        {!busy && results?.total === 0 && <div className="empty"><div className="art">🔎</div><h3>No results found</h3><p>Try different words or filters.</p></div>}
        {list.map((m) => <MessageCard key={m.id} m={m} showChannel />)}
        {results && results.total > offset + 25 && (
          <div className="row gap-8" style={{ justifyContent: 'center', padding: 12 }}>
            {offset > 0 && <button className="btn sm secondary" onClick={() => setOffset(offset - 25)}>Previous</button>}
            <button className="btn sm" onClick={() => setOffset(offset + 25)}>Next page</button>
          </div>
        )}
      </div>
    </div>
  );
}
