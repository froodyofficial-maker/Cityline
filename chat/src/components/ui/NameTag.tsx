import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { displayName, topColorRole } from '../../store/selectors';
import { useShallow } from 'zustand/react/shallow';
import { boostLevel } from '../../lib/neon';

/** A display name in its role colour (gradient for boosted servers) and Neon name style. */
export function NameTag({ userId, serverId, className, onClick, noEffect, nameOverride, effectOverride }: { userId: string | null; serverId?: string | null; className?: string; onClick?: (e: React.MouseEvent) => void; noEffect?: boolean; nameOverride?: string; effectOverride?: string | null }) {
  const [storedName, color, color2, storedEffect, boosted] = useData(useShallow((s) => {
    const r = userId ? topColorRole(userId, serverId, s) : undefined;
    const p = userId ? s.profiles[userId] : undefined;
    const sv = serverId ? s.servers[serverId] : undefined;
    return [displayName(userId, serverId, s), r?.color ?? null, r?.color2 ?? null, p?.neon === 'neon' ? p.name_effect : null, boostLevel(sv?.boost_count ?? 0) >= 2] as const;
  }));
  const name = nameOverride ?? storedName;
  const effect = effectOverride !== undefined ? effectOverride : storedEffect;
  const style: CSSProperties = {};
  if (color && color2 && boosted) {
    style.backgroundImage = `linear-gradient(90deg, ${color}, ${color2})`;
  } else if (color) style.color = color;
  return (
    <span
      className={cn('name-tag', !noEffect && effect && `name-fx name-fx-${effect}`, color && color2 && boosted && 'role-gradient', className)}
      style={!noEffect && effect ? undefined : style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      data-text={name}
    >
      {name}
    </span>
  );
}
