import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { setUI, useUI, type Popout as PopoutState } from '../../store/ui';
import { ensureProfiles, refreshProfile } from '../../store/actions/bootstrap';
import { ProfileCard } from './ProfileCard';

export function ProfilePopoutHost() {
  const pop = useUI((s) => s.popout);
  useEffect(() => {
    if (!pop) return;
    ensureProfiles([pop.userId]);
    void refreshProfile(pop.userId).catch(() => {});
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.profile-popout') || t.closest('.menu') || t.closest('.overlay')) return;
      setUI({ popout: null });
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setUI({ popout: null }); };
    setTimeout(() => window.addEventListener('mousedown', close), 0);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', key); };
  }, [pop]);
  return createPortal(<AnimatePresence>{pop && <Popout key={pop.userId + pop.x + pop.y} pop={pop} />}</AnimatePresence>, document.body);
}

// `pop` arrives as a prop so the exit animation keeps rendering after the
// store has already cleared it.
function Popout({ pop }: { pop: PopoutState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: pop.x, top: pop.y });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = pop.side === 'left' ? pop.x - r.width : pop.x;
    let top = pop.y;
    if (left + r.width > window.innerWidth - 10) left = window.innerWidth - r.width - 10;
    if (left < 10) left = 10;
    if (top + r.height > window.innerHeight - 10) top = window.innerHeight - r.height - 10;
    if (top < 10) top = 10;
    setPos({ left, top });
  }, [pop]);
  return (
    <motion.div
      ref={ref}
      className="profile-popout"
      style={pos}
      initial={{ opacity: 0, scale: 0.94, x: pop.side === 'left' ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 480, damping: 32 }}
    >
      <ProfileCard userId={pop.userId} serverId={pop.serverId} variant="popout" onClose={() => setUI({ popout: null })} />
    </motion.div>
  );
}
