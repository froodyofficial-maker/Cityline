import { MessagesSquare, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Channel, Message } from '../../lib/types';
import { cn, formatMessageTime } from '../../lib/utils';
import { setRightPanel, setUI, openModal } from '../../store/ui';
import { loadThreads } from '../../store/actions/messages';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { renderMarkdown } from '../../lib/markdown';
import { usePerms } from '../../store/selectors';
import { has, P } from '../../lib/permissions';
import { useData } from '../../store/data';

type ThreadRow = Channel & { starter: Message | null; last_read_at: string | null };

export function ThreadsPanel({ channelId }: { channelId: string }) {
  const [archived, setArchived] = useState(false);
  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const perms = usePerms(channelId);
  const serverId = useData((s) => s.channels[channelId]?.server_id ?? null);
  useEffect(() => { setThreads(null); void loadThreads(channelId, archived).then((t) => setThreads(t.filter((x) => x.archived === archived))).catch(() => setThreads([])); }, [channelId, archived]);
  return (
    <div className="panel">
      <div className="panel-head">
        <MessagesSquare size={18} /> Threads
        <span className="spacer" />
        {has(perms, P.CREATE_THREADS) && <button className="btn sm" onClick={() => openModal({ kind: 'createThread', channelId })}><Plus size={14} /> Create</button>}
        <button className="icon-btn" onClick={() => setRightPanel('members')}><X /></button>
      </div>
      <div className="segmented" style={{ margin: '0 12px 8px' }}>
        <button className={cn(!archived && 'on')} onClick={() => setArchived(false)}>Active</button>
        <button className={cn(archived && 'on')} onClick={() => setArchived(true)}>Archived</button>
      </div>
      <div className="panel-body scroll thin">
        {threads === null && <div className="empty"><span className="spinner" /></div>}
        {threads?.length === 0 && <div className="empty"><div className="art">🧵</div><h3>There are no {archived ? 'archived' : 'active'} threads.</h3><p>Stay focused on a conversation with a thread — a temporary text channel.</p></div>}
        {threads?.map((t) => (
          <button key={t.id} className="thread-card" onClick={() => setUI({ threadId: t.id, rightPanel: 'thread' })}>
            <div className="bold ellipsis">{t.name}</div>
            <div className="row gap-6 small">
              <Avatar userId={t.owner_id} size={18} serverId={serverId} />
              <NameTag userId={t.owner_id} serverId={serverId} className="small" />
              {t.starter?.content && <span className="ellipsis muted">{renderMarkdown(t.starter.content, { inline: true, noLinks: true })}</span>}
            </div>
            <div className="tiny muted">{t.message_count} messages · {formatMessageTime(t.last_message_at ?? t.created_at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
