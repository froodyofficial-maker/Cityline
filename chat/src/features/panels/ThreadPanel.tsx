import { Archive, Lock, MessagesSquare, MoreHorizontal, Pencil, Trash2, Unlock, X, Bell, BellOff, ArchiveRestore } from 'lucide-react';
import { useEffect } from 'react';
import { has, P } from '../../lib/permissions';
import { getData, useData } from '../../store/data';
import { isMuted, permsFor } from '../../store/selectors';
import { openMenu, openModal, setRightPanel, setUI } from '../../store/ui';
import { loadMessages, markRead, updateThread } from '../../store/actions/messages';
import { deleteChannel, setNotification } from '../../store/actions/servers';
import { useTypingChannel } from '../../store/realtime';
import { check, supabase } from '../../lib/supabase';
import { upsertChannel } from '../../store/data';
import { MessageList } from '../chat/MessageList';
import { Composer } from '../chat/Composer';
import type { Channel } from '../../lib/types';

export function ThreadPanel({ threadId }: { threadId: string }) {
  const thread = useData((s) => s.channels[threadId]);
  const parent = useData((s) => (thread?.thread_parent_id ? s.channels[thread.thread_parent_id] : undefined));
  useTypingChannel(threadId);
  useEffect(() => {
    (async () => {
      if (!getData().channels[threadId]) {
        const ch = check(await supabase.from('channels').select('*').eq('id', threadId).single()) as Channel;
        upsertChannel(ch);
      }
      await loadMessages(threadId);
      markRead(threadId);
    })().catch(() => {});
  }, [threadId]);
  if (!thread) return <div className="panel"><div className="empty"><span className="spinner" /></div></div>;
  const perms = permsFor(threadId);
  const canManage = has(perms, P.MANAGE_THREADS) || thread.owner_id === getData().me;
  const muted = isMuted(threadId);
  return (
    <div className="panel thread-panel">
      <div className="panel-head">
        <MessagesSquare size={18} />
        <span className="ellipsis bold">{thread.name}</span>
        {thread.locked && <Lock size={14} className="muted" />}
        {parent && <span className="chip tiny">#{parent.name}</span>}
        <span className="spacer" />
        <button className="icon-btn" onClick={(e) => openMenu(e, [
          { label: muted ? 'Unmute Thread' : 'Mute Thread', icon: muted ? <Bell /> : <BellOff />, onClick: () => void setNotification(threadId, { muted: !muted }) },
          ...(canManage ? [
            { divider: true },
            { label: 'Rename Thread', icon: <Pencil />, onClick: () => { const n = prompt('Thread name', thread.name); if (n) void updateThread(threadId, { name: n }); } },
            { label: thread.locked ? 'Unlock Thread' : 'Lock Thread', icon: thread.locked ? <Unlock /> : <Lock />, onClick: () => void updateThread(threadId, { locked: !thread.locked }) },
            { label: thread.archived ? 'Unarchive Thread' : 'Archive Thread', icon: thread.archived ? <ArchiveRestore /> : <Archive />, onClick: () => void updateThread(threadId, { archived: !thread.archived }) },
            { label: 'Delete Thread', icon: <Trash2 />, danger: true, onClick: () => openModal({ kind: 'confirm', title: 'Delete Thread', danger: true, confirm: 'Delete', body: <>Delete <b>{thread.name}</b> and all its messages?</>, onConfirm: async () => { await deleteChannel(threadId); setUI({ threadId: null }); setRightPanel(null); } }) },
          ] : []),
        ])}><MoreHorizontal /></button>
        <button className="icon-btn" onClick={() => { setUI({ threadId: null }); setRightPanel(null); }}><X /></button>
      </div>
      <div className="thread-body">
        <MessageList channelId={threadId} />
        {thread.archived ? <div className="composer-locked"><Archive size={16} /> This thread is archived. {canManage && <button className="btn sm secondary" onClick={() => void updateThread(threadId, { archived: false })}>Unarchive</button>}</div> : <Composer channelId={threadId} compact />}
      </div>
    </div>
  );
}
