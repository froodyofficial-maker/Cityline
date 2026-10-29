import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { useData } from '../../store/data';
import { getUserProfile } from '../../store/actions/users';
import { navigate } from '../../store/ui';
import { displayName, firstTextChannel } from '../../store/selectors';
import { ProfileCard } from './ProfileCard';

/** Right-hand profile panel in 1:1 DMs, with mutual servers and friends. */
export function DMProfilePanel({ channelId }: { channelId: string }) {
  const other = useData((s) => s.channels[channelId]?.recipients?.find((id) => id !== s.me));
  const [mutual, setMutual] = useState<{ servers: string[]; friends: string[] } | null>(null);
  const [open, setOpen] = useState({ servers: false, friends: false });
  const servers = useData((s) => s.servers);
  useEffect(() => {
    if (!other) return;
    void getUserProfile(other).then((r) => setMutual({ servers: r.mutual_servers ?? [], friends: r.mutual_friends ?? [] })).catch(() => {});
  }, [other]);
  if (!other) return null;
  return (
    <div className="dm-profile scroll thin">
      <ProfileCard userId={other} serverId={null} variant="panel" />
      {mutual && (
        <div className="dm-mutuals">
          <button className="mutual-head" onClick={() => setOpen((o) => ({ ...o, servers: !o.servers }))}>
            Mutual Servers — {mutual.servers.length} {open.servers ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {open.servers && mutual.servers.map((id) => servers[id] && (
            <button key={id} className="mutual-row" onClick={() => navigate({ kind: 'server', serverId: id, channelId: firstTextChannel(id) })}>
              <ServerIcon name={servers[id].name} url={servers[id].icon_url} size={32} /> <span className="ellipsis">{servers[id].name}</span>
            </button>
          ))}
          <button className="mutual-head" onClick={() => setOpen((o) => ({ ...o, friends: !o.friends }))}>
            Mutual Friends — {mutual.friends.length} {open.friends ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
          {open.friends && mutual.friends.map((id) => (
            <div key={id} className="mutual-row"><Avatar userId={id} size={32} showStatus ring="var(--bg-side)" /> <span className="ellipsis">{displayName(id)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
