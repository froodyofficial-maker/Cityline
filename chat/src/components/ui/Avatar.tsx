import { memo, type CSSProperties } from 'react';
import type { PresenceStatus } from '../../lib/types';
import { cn, hashColor, initials } from '../../lib/utils';
import { useData } from '../../store/data';
import { presenceStatus } from '../../store/selectors';

interface Props {
  userId?: string | null;
  url?: string | null;
  name?: string;
  size?: number;
  status?: PresenceStatus | 'none';
  showStatus?: boolean;
  ring?: string;
  decoration?: string | null;
  serverId?: string | null;
  speaking?: boolean;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  animate?: boolean;
}

/** Avatar with optional presence dot, speaking ring and Neon decoration. */
export const Avatar = memo(function Avatar({
  userId, url, name, size = 40, status, showStatus = false, ring, decoration, serverId, speaking, className, style, onClick, animate = true,
}: Props) {
  const profile = useData((s) => (userId ? s.profiles[userId] : undefined));
  const serverAvatar = useData((s) => (userId && serverId ? s.members[serverId]?.[userId]?.avatar_url ?? (userId === s.me ? s.memberships[serverId]?.avatar_url : null) : null));
  const live = useData((s) => (showStatus && userId && !status ? presenceStatus(userId, s) : null));
  const src = url !== undefined ? url : serverAvatar || profile?.avatar_url;
  const label = name ?? profile?.display_name ?? profile?.username ?? '?';
  const st = status ?? live ?? 'offline';
  const deco = decoration !== undefined ? decoration : profile?.neon === 'neon' ? profile?.avatar_decoration : null;
  const bg = hashColor(userId || label);
  return (
    <div
      className={cn('avatar', speaking && 'speaking', className)}
      style={{ '--size': `${size}px`, ...(ring ? { '--ring': ring } : {}), ...style } as CSSProperties}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {src ? (
        <img className="img" src={src} alt="" loading="lazy" draggable={false} style={animate ? undefined : { imageRendering: 'auto' }} />
      ) : (
        <div className="img" style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in srgb, ${bg} 60%, #000))` }}>
          {initials(label).slice(0, 2)}
        </div>
      )}
      {deco && <Decoration id={deco} />}
      {showStatus && st !== 'none' && (
        <span className={cn('status', st)} aria-label={st}>
          <i />
        </span>
      )}
    </div>
  );
});

export function Decoration({ id }: { id: string }) {
  return (
    <span className={`deco deco-${id}`} aria-hidden>
      {id === 'crown' && (
        <svg viewBox="0 0 64 40" className="deco-crown">
          <defs>
            <linearGradient id="crownG" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ffe48a" />
              <stop offset="1" stopColor="#ff9f2e" />
            </linearGradient>
          </defs>
          <path d="M4 34 L8 10 L22 24 L32 4 L42 24 L56 10 L60 34 Z" fill="url(#crownG)" stroke="#b86b00" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="32" cy="22" r="4" fill="#ff5fd2" />
          <circle cx="18" cy="28" r="3" fill="#2fd0ff" />
          <circle cx="46" cy="28" r="3" fill="#2fd88c" />
        </svg>
      )}
      {id === 'cat-ears' && (
        <>
          <i className="ear l" />
          <i className="ear r" />
        </>
      )}
      {id === 'orbit-hearts' && (
        <span className="orbit">
          <i>💗</i>
          <i>💜</i>
          <i>💙</i>
        </span>
      )}
      {id === 'flames' && (
        <span className="flames">
          <i /><i /><i /><i /><i />
        </span>
      )}
      {id === 'sakura' && (
        <span className="petal-ring">
          {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}>🌸</i>)}
        </span>
      )}
    </span>
  );
}

export function ServerIcon({ name, url, size = 48, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    <div className={cn('server-icon-img', className)} style={{ width: size, height: size, fontSize: size * (name.length > 3 ? 0.3 : 0.38) }}>
      {url ? <img src={url} alt="" draggable={false} /> : <span>{initials(name)}</span>}
    </div>
  );
}
