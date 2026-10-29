import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { closeModal } from '../../store/ui';

interface Props {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  onClose?: () => void;
  center?: boolean;
  className?: string;
  bare?: boolean;
  hideClose?: boolean;
}

export function Modal({ title, subtitle, children, footer, width = 460, onClose = closeModal, center, className, bare, hideClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return createPortal(
    <motion.div
      className="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className={cn('modal', className)}
        style={{ '--w': `${width}px` } as React.CSSProperties}
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        role="dialog"
        aria-modal="true"
      >
        {!hideClose && (
          <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">
            <X />
          </button>
        )}
        {bare ? children : (
          <>
            {(title || subtitle) && (
              <div className={cn('modal-head', center && 'center')}>
                {title && <h2>{title}</h2>}
                {subtitle && <p>{subtitle}</p>}
              </div>
            )}
            <div className="modal-body scroll">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </>
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export function Presence({ children }: { children: ReactNode }) {
  return <AnimatePresence>{children}</AnimatePresence>;
}
