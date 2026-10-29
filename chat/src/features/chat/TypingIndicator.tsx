import { AnimatePresence, motion } from 'motion/react';
import { useShallow } from 'zustand/react/shallow';
import { useData } from '../../store/data';
import { displayName } from '../../store/selectors';

export function TypingIndicator({ channelId }: { channelId: string }) {
  const names = useData(useShallow((s) => {
    const ch = s.channels[channelId];
    return Object.keys(s.typing[channelId] || {}).map((id) => displayName(id, ch?.server_id, s));
  }));
  let text: React.ReactNode = null;
  if (names.length === 1) text = <><b>{names[0]}</b> is typing…</>;
  else if (names.length === 2) text = <><b>{names[0]}</b> and <b>{names[1]}</b> are typing…</>;
  else if (names.length === 3) text = <><b>{names[0]}</b>, <b>{names[1]}</b> and <b>{names[2]}</b> are typing…</>;
  else if (names.length > 3) text = <>Several people are typing…</>;
  return (
    <div className="typing">
      <AnimatePresence>
        {text && (
          <motion.div className="typing-inner" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.15 }}>
            <span className="typing-dots"><i /><i /><i /></span>
            <span className="ellipsis">{text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
