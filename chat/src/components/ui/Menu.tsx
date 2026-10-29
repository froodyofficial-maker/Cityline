import { AnimatePresence, motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { closeMenu, setUI, useUI, type MenuItem } from '../../store/ui';

function MenuList({ items, x, y, onDone, origin = 'top left' }: { items: MenuItem[]; x: number; y: number; onDone: () => void; origin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y, origin });
  const [sub, setSub] = useState<{ index: number; x: number; y: number } | null>(null);
  const [focus, setFocus] = useState(-1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let nx = x, ny = y, o = origin;
    if (nx + r.width > window.innerWidth - 8) { nx = Math.max(8, x - r.width); o = o.replace('left', 'right'); }
    if (ny + r.height > window.innerHeight - 8) { ny = Math.max(8, window.innerHeight - r.height - 8); o = o.replace('top', 'bottom'); }
    setPos({ x: nx, y: ny, origin: o });
  }, [x, y, origin]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const usable = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.divider && !it.disabled);
      if (!usable.length) return;
      const idx = usable.findIndex((u) => u.i === focus);
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocus(usable[(idx + 1) % usable.length].i); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setFocus(usable[(idx - 1 + usable.length) % usable.length].i); }
      if (e.key === 'Enter' && focus >= 0) { e.preventDefault(); const it = items[focus]; if (it.onClick) { it.onClick(); onDone(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items, focus, onDone]);

  return (
    <motion.div
      ref={ref}
      className="menu"
      style={{ left: pos.x, top: pos.y, transformOrigin: pos.origin }}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="menu-sep" />
        ) : (
          <button
            key={i}
            className={cn('menu-item', it.danger && 'danger', focus === i && 'focus')}
            disabled={it.disabled}
            style={it.color ? { color: it.color } : undefined}
            onMouseEnter={(e) => {
              setFocus(i);
              if (it.submenu) {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setSub({ index: i, x: r.right + 4, y: r.top - 6 });
              } else setSub(null);
            }}
            onClick={() => {
              if (it.submenu) return;
              it.onClick?.();
              onDone();
            }}
          >
            {it.icon && <span className="mi-icon">{it.icon}</span>}
            <span className="mi-label">{it.label}</span>
            {it.hint && <span className="mi-hint">{it.hint}</span>}
            {it.checked !== undefined && <span className={cn('check', it.checked && 'on')} style={{ width: 18, height: 18 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg></span>}
            {it.submenu && <ChevronRight size={16} />}
          </button>
        ),
      )}
      <AnimatePresence>
        {sub && items[sub.index]?.submenu && <MenuList key={sub.index} items={items[sub.index].submenu!} x={sub.x} y={sub.y} onDone={onDone} />}
      </AnimatePresence>
    </motion.div>
  );
}

/** Renders the app-wide context menu (opened with openMenu()). */
export function ContextMenuHost() {
  const menu = useUI((s) => s.menu);
  useEffect(() => {
    if (!menu) return;
    const close = () => closeMenu();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', close, { passive: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', close);
    };
  }, [menu]);
  return createPortal(
    <AnimatePresence>{menu && <MenuList key={`${menu.x}:${menu.y}`} items={menu.items} x={menu.x} y={menu.y} onDone={() => setUI({ menu: null })} />}</AnimatePresence>,
    document.body,
  );
}
