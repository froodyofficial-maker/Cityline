import { motion } from 'motion/react';
import { Gem, Hash, Megaphone, MessagesSquare, Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { cn } from '../../lib/utils';

export interface AcItem {
  key: string;
  kind: 'user' | 'role' | 'special' | 'channel' | 'emoji' | 'custom' | 'command';
  label: string;
  sub?: string;
  insert: string;
  token?: string;      // stored form, for roles / custom emoji
  userId?: string;
  color?: string | null;
  emoji?: string;
  url?: string;
  channelType?: string;
  neon?: boolean;
}

const TITLES: Record<string, string> = { '@': 'Members', '#': 'Text Channels', ':': 'Emoji matching', '/': 'Commands' };

export function Autocomplete({ trigger, query, items, index, onPick, onHover }: { trigger: string; query: string; items: AcItem[]; index: number; onPick: (i: AcItem) => void; onHover: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('.ac-item.on')?.scrollIntoView({ block: 'nearest' });
  }, [index]);
  if (!items.length) return null;
  return (
    <motion.div className="autocomplete" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}>
      <div className="ac-title">{TITLES[trigger]}{trigger === ':' && <b> :{query}</b>}</div>
      <div className="ac-list scroll thin" ref={ref}>
        {items.map((it, i) => (
          <button key={it.key} className={cn('ac-item', i === index && 'on')} onMouseEnter={() => onHover(i)} onMouseDown={(e) => { e.preventDefault(); onPick(it); }}>
            {it.kind === 'user' && <Avatar userId={it.userId} size={24} showStatus ring="var(--bg-float)" />}
            {it.kind === 'role' && <span className="ac-role" style={{ color: it.color ?? undefined }}>@</span>}
            {it.kind === 'special' && <span className="ac-role">@</span>}
            {it.kind === 'channel' && <span className="ac-chan">{it.channelType === 'voice' ? <Volume2 size={18} /> : it.channelType === 'announcement' ? <Megaphone size={18} /> : it.channelType === 'forum' ? <MessagesSquare size={18} /> : <Hash size={18} />}</span>}
            {it.kind === 'emoji' && <span className="ac-emoji">{it.emoji}</span>}
            {it.kind === 'custom' && <img className="ac-emoji-img" src={it.url} alt="" />}
            {it.kind === 'command' && <span className="ac-cmd">/</span>}
            <span className="ac-label" style={it.kind === 'role' && it.color ? { color: it.color } : undefined}>{it.label}</span>
            {it.neon && <Gem size={13} className="neon-gem" />}
            {it.sub && <span className="ac-sub ellipsis">{it.sub}</span>}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
