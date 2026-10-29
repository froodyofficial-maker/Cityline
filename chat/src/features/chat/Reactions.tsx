import { AnimatePresence, motion } from 'motion/react';
import { SmilePlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Tip } from '../../components/ui/Tooltip';
import { CUSTOM_EMOJI_RE, notoAnimatedUrl, parseCustomEmoji } from '../../lib/emoji';
import type { Message, ReactionAgg } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { displayName } from '../../store/selectors';
import { reactors, toggleReaction } from '../../store/actions/messages';
import { useUI } from '../../store/ui';
import { ensureProfiles } from '../../store/actions/bootstrap';

export function ReactionEmoji({ emoji, size = 18 }: { emoji: string; size?: number }) {
  const custom = CUSTOM_EMOJI_RE.test(emoji) ? parseCustomEmoji(emoji) : null;
  const url = useData((s) => (custom ? s.emojis[custom.id]?.url : undefined));
  if (custom) return url ? <img className="emoji custom" src={url} alt={custom.name} style={{ width: size, height: size }} /> : <span className="tiny">:{custom.name}:</span>;
  return <span className="emoji-native" style={{ fontSize: size }}>{emoji}</span>;
}

export function Reactions({ message, canReact, onAdd }: { message: Message; canReact: boolean; onAdd: () => void }) {
  const list = message.reactions ?? [];
  const burst = useUI((s) => s.highlight);
  return (
    <div className="reactions">
      <AnimatePresence initial={false}>
        {list.flatMap((r) => {
          const out = [];
          if (r.super_count > 0) out.push(<ReactionPill key={r.emoji + ':s'} r={r} superR message={message} burstKey={burst} />);
          if (r.count > 0) out.push(<ReactionPill key={r.emoji} r={r} message={message} burstKey={burst} />);
          return out;
        })}
      </AnimatePresence>
      {canReact && (
        <Tip label="Add Reaction">
          <button className="reaction add" onClick={onAdd} aria-label="Add reaction"><SmilePlus size={16} /></button>
        </Tip>
      )}
    </div>
  );
}

function ReactionPill({ r, superR, message, burstKey }: { r: ReactionAgg; superR?: boolean; message: Message; burstKey: string | null }) {
  const me = superR ? r.me_super : r.me;
  const count = superR ? r.super_count : r.count;
  const [tip, setTip] = useState<string>('');
  const [burst, setBurst] = useState(0);
  const serverId = message.server_id;

  // someone else's super reaction arrived for this pill
  useEffect(() => {
    if (superR && burstKey?.startsWith(`super:${message.id}:${r.emoji}:`)) setBurst((n) => n + 1);
  }, [burstKey, superR, message.id, r.emoji]);

  const loadTip = async () => {
    const rows = (await reactors(message.id, r.emoji)).filter((x) => x.is_super === !!superR);
    ensureProfiles(rows.map((x) => x.user_id));
    setTimeout(() => {
      const names = rows.slice(0, 6).map((x) => displayName(x.user_id, serverId));
      const more = rows.length - names.length;
      const label = r.emoji.startsWith('<') ? `:${parseCustomEmoji(r.emoji)?.name}:` : r.emoji;
      setTip(names.length ? `${names.join(', ')}${more > 0 ? ` and ${more} others` : ''} reacted with ${label}${superR ? ' (super)' : ''}` : '');
    }, 120);
  };

  return (
    <Tip label={tip || '…'}>
      <motion.button
        layout
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.4, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 22 }}
        whileTap={{ scale: 0.85 }}
        className={cn('reaction', me && 'me', superR && 'super')}
        onMouseEnter={() => void loadTip()}
        onClick={() => {
          if (superR && !me) setBurst((n) => n + 1);
          void toggleReaction(message.id, r.emoji, !!superR);
        }}
      >
        <ReactionEmoji emoji={r.emoji} />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={count} className="reaction-count" initial={{ y: me ? 10 : -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: me ? -10 : 10, opacity: 0 }} transition={{ duration: 0.18 }}>
            {count}
          </motion.span>
        </AnimatePresence>
        {burst > 0 && <SuperBurst key={burst} emoji={r.emoji} />}
      </motion.button>
    </Tip>
  );
}

/** Particles + a big animated emoji that fly out of a super reaction. */
function SuperBurst({ emoji }: { emoji: string }) {
  const isCustom = emoji.startsWith('<');
  const parts = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const d = 40 + Math.random() * 50;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d - 20, r: Math.random() * 360, s: 0.6 + Math.random() * 0.7 };
  });
  return (
    <span className="super-burst" aria-hidden>
      {!isCustom && (
        <motion.img
          className="super-big"
          src={notoAnimatedUrl(emoji)}
          alt=""
          initial={{ scale: 0.2, opacity: 0, y: 0 }}
          animate={{ scale: [0.2, 1.4, 1.1], opacity: [0, 1, 0], y: [0, -60, -90] }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      )}
      {parts.map((p, i) => (
        <motion.span key={i} className="super-particle" initial={{ x: 0, y: 0, scale: 0, opacity: 1 }} animate={{ x: p.x, y: p.y, scale: p.s, opacity: 0, rotate: p.r }} transition={{ duration: 0.9 + Math.random() * 0.4, ease: 'easeOut' }}>
          {isCustom ? '✨' : emoji}
        </motion.span>
      ))}
    </span>
  );
}
