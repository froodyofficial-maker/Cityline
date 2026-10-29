import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { closeModal } from '../../store/ui';

export interface SettingsTab { id: string; label: ReactNode; section?: string; danger?: boolean; onClick?: () => void; badge?: ReactNode }

export function SettingsLayout({ tabs, active, onTab, children, title }: { tabs: SettingsTab[]; active: string; onTab: (id: string) => void; children: ReactNode; title?: ReactNode }) {
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.overlay')) closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  let lastSection: string | undefined;
  return createPortal(
    <motion.div className="settings" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
      <nav className={cn('settings-nav scroll thin', mobileMenu && 'open')}>
        <div className="settings-nav-inner">
          {title && <div className="settings-title">{title}</div>}
          {tabs.map((t) => {
            const header = t.section && t.section !== lastSection ? t.section : null;
            lastSection = t.section ?? lastSection;
            return (
              <div key={t.id}>
                {header && <div className="settings-section">{header}</div>}
                {t.id.startsWith('sep') ? <div className="settings-sep" /> : (
                  <button className={cn('settings-tab', active === t.id && 'on', t.danger && 'danger')} onClick={() => { if (t.onClick) t.onClick(); else { onTab(t.id); setMobileMenu(false); } }}>
                    {t.label}{t.badge}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </nav>
      <main className="settings-main scroll">
        <button className="btn sm secondary only-mobile settings-menu-btn" onClick={() => setMobileMenu(!mobileMenu)}>☰ Menu</button>
        <motion.div key={active} className="settings-content" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
          {children}
        </motion.div>
        <div className="settings-close">
          <button className="settings-x" onClick={closeModal} aria-label="Close settings"><X /></button>
          <span>ESC</span>
        </div>
      </main>
    </motion.div>,
    document.body,
  );
}

export function SettingsHeader({ title, desc }: { title: ReactNode; desc?: ReactNode }) {
  return (
    <div className="settings-head">
      <h2>{title}</h2>
      {desc && <p>{desc}</p>}
    </div>
  );
}

/** Floating "unsaved changes" bar */
export function SaveBar({ show, onSave, onReset, busy }: { show: boolean; onSave: () => void; onReset: () => void; busy?: boolean }) {
  return show ? (
    <motion.div className="save-bar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}>
      <span>Careful — you have unsaved changes!</span>
      <span className="spacer" />
      <button className="btn link" onClick={onReset}>Reset</button>
      <button className="btn success sm" disabled={busy} onClick={onSave}>{busy ? 'Saving…' : 'Save Changes'}</button>
    </motion.div>
  ) : null;
}
