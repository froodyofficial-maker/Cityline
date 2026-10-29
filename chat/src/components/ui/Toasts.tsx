import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { setUI, useUI } from '../../store/ui';

const ICONS = { info: 'ℹ️', success: '✅', error: '⚠️', neon: '💎' };

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return createPortal(
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={cn('toast', t.kind)}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
            onClick={() => setUI((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}
          >
            <span className="ti">{t.icon ?? ICONS[t.kind]}</span>
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
