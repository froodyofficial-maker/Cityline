import { Hash, X } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { renderMarkdown } from '../../lib/markdown';
import type { Message } from '../../lib/types';
import { formatMessageTime } from '../../lib/utils';
import { useData } from '../../store/data';
import { dmName } from '../../store/selectors';
import { navigate, setUI } from '../../store/ui';
import { Attachments } from '../chat/Attachments';

/** A read-only message used in pins, search results, the inbox and catch up. */
export function MessageCard({ m, showChannel, onJump, onRemove, extra }: { m: Message; showChannel?: boolean; onJump?: () => void; onRemove?: () => void; extra?: React.ReactNode }) {
  const ch = useData((s) => s.channels[m.channel_id]);
  const where = useData((s) => (ch ? (ch.server_id ? `${ch.name}${s.servers[ch.server_id] ? ' · ' + s.servers[ch.server_id].name : ''}` : dmName(ch, s)) : 'unknown'));
  const jump = onJump ?? (() => {
    if (ch?.type === 'thread') setUI({ threadId: ch.id, rightPanel: 'thread' });
    else if (ch?.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: ch.id });
    else navigate({ kind: 'dm', channelId: m.channel_id });
    setUI({ jumpTo: { channelId: m.channel_id, messageId: m.id, at: Date.now() }, inbox: false, voiceView: null });
  });
  return (
    <div className="mcard">
      {showChannel && <div className="mcard-where"><Hash size={13} /> {where}</div>}
      <div className="mcard-body">
        <Avatar userId={m.author_id} size={34} serverId={m.server_id} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="mcard-head">
            <NameTag userId={m.author_id} serverId={m.server_id} className="bold" />
            <span className="tiny muted">{formatMessageTime(m.created_at)}</span>
          </div>
          {m.content && <div className="md mcard-content">{renderMarkdown(m.content, { serverId: m.server_id })}</div>}
          {m.attachments.length > 0 && <Attachments message={m} />}
          {m.sticker && <img className="sticker small" src={m.sticker.url} alt={m.sticker.name} />}
          {m.poll && <div className="muted small">📊 {m.poll.question}</div>}
          {extra}
        </div>
      </div>
      <div className="mcard-actions">
        <button className="btn sm secondary" onClick={jump}>Jump</button>
        {onRemove && <button className="icon-btn sm" onClick={onRemove} aria-label="Remove"><X /></button>}
      </div>
    </div>
  );
}
