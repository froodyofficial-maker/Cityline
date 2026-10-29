import { Hash, Megaphone, MessagesSquare, Volume2, Lock } from 'lucide-react';
import { useData } from '../../store/data';
import { displayName } from '../../store/selectors';
import { navigate, openProfile, setUI } from '../../store/ui';
import { ensureProfiles } from '../../store/actions/bootstrap';
import { Tip } from '../ui/Tooltip';
import { useEffect } from 'react';

export function UserMention({ id, serverId }: { id: string; serverId?: string | null }) {
  const name = useData((s) => (s.profiles[id] ? displayName(id, serverId, s) : null));
  const isMe = useData((s) => s.me === id);
  useEffect(() => { if (!name) ensureProfiles([id]); }, [id, name]);
  return (
    <span
      className={isMe ? 'mention me' : 'mention'}
      role="button"
      onClick={(e) => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openProfile(id, serverId ?? null, { x: r.right + 8, y: r.top }); }}
    >
      @{name ?? 'unknown-user'}
    </span>
  );
}

export function RoleMention({ id }: { id: string; serverId?: string | null }) {
  const role = useData((s) => s.roles[id]);
  if (!role) return <span className="mention">@deleted-role</span>;
  const c = role.color || undefined;
  return (
    <span className="mention role" style={c ? { color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` } : undefined}>
      @{role.name}
    </span>
  );
}

export function ChannelMention({ id }: { id: string }) {
  const ch = useData((s) => s.channels[id]);
  if (!ch) return <span className="mention"><Lock size={13} /> no-access</span>;
  const Icon = ch.type === 'voice' || ch.type === 'stage' ? Volume2 : ch.type === 'announcement' ? Megaphone : ch.type === 'forum' ? MessagesSquare : Hash;
  return (
    <span
      className="mention channel"
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        if (ch.type === 'thread') { setUI({ threadId: ch.id, rightPanel: 'thread' }); return; }
        if (ch.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: ch.id });
      }}
    >
      <Icon size={13} strokeWidth={2.6} />
      {ch.name}
    </span>
  );
}

export function SpecialMention({ label }: { label: string }) {
  return <span className="mention">{label}</span>;
}

export function CustomEmojiImg({ id, name, animated, jumbo }: { id: string; name: string; animated?: boolean; jumbo?: boolean }) {
  const e = useData((s) => s.emojis[id]);
  const url = e?.url;
  if (!url) return <Tip label={`:${name}:`}><span className="emoji-missing">:{name}:</span></Tip>;
  return (
    <Tip label={`:${name}:`}>
      <img className={jumbo ? 'emoji custom jumbo' : 'emoji custom'} src={url} alt={`:${name}:`} draggable={false} data-animated={animated ? '1' : undefined} />
    </Tip>
  );
}
