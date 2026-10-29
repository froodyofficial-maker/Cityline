import { Pin, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Message } from '../../lib/types';
import { useData } from '../../store/data';
import { setRightPanel } from '../../store/ui';
import { loadPins, togglePin } from '../../store/actions/messages';
import { MessageCard } from './MessageCard';
import { usePerms } from '../../store/selectors';
import { has, P } from '../../lib/permissions';

export function PinsPanel({ channelId }: { channelId: string }) {
  const [pins, setPins] = useState<Message[] | null>(null);
  const pinnedFlags = useData((s) => (s.channelMsgs[channelId]?.ids ?? []).filter((id) => s.messages[id]?.pinned).join(','));
  const perms = usePerms(channelId);
  const isDM = useData((s) => !s.channels[channelId]?.server_id);
  useEffect(() => { void loadPins(channelId).then(setPins).catch(() => setPins([])); }, [channelId, pinnedFlags]);
  return (
    <div className="panel">
      <div className="panel-head"><Pin size={18} /> Pinned Messages <span className="spacer" /><button className="icon-btn" onClick={() => setRightPanel('members')}><X /></button></div>
      <div className="panel-body scroll thin">
        {pins === null && <div className="empty"><span className="spinner" /></div>}
        {pins?.length === 0 && (
          <div className="empty">
            <div className="art">📌</div>
            <h3>This channel doesn’t have any pinned messages… yet.</h3>
            <p>Pin important messages so they’re easy to find. Right-click a message → Pin Message.</p>
          </div>
        )}
        {pins?.map((m) => (
          <MessageCard key={m.id} m={m} onRemove={isDM || has(perms, P.MANAGE_MESSAGES) ? () => { void togglePin(m); setPins((p) => p?.filter((x) => x.id !== m.id) ?? null); } : undefined} />
        ))}
      </div>
    </div>
  );
}
