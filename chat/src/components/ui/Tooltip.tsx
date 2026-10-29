import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';

interface Props {
  label: ReactNode;
  side?: Side;
  delay?: number;
  children: ReactElement<{ 'aria-label'?: string; onMouseEnter?: (e: React.MouseEvent) => void; onMouseLeave?: (e: React.MouseEvent) => void; onFocus?: (e: React.FocusEvent) => void; onBlur?: (e: React.FocusEvent) => void; ref?: React.Ref<HTMLElement> }>;
  disabled?: boolean;
}

/** Wraps a single element and shows a floating label on hover/focus. */
export function Tip({ label, side = 'top', delay = 250, children, disabled }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number; side: Side } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef<HTMLElement | null>(null);

  const show = useCallback((el: HTMLElement) => {
    target.current = el;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el.getBoundingClientRect();
      const gap = 10;
      const p = side === 'top' ? { x: r.left + r.width / 2, y: r.top - gap }
        : side === 'bottom' ? { x: r.left + r.width / 2, y: r.bottom + gap }
        : side === 'left' ? { x: r.left - gap, y: r.top + r.height / 2 }
        : { x: r.right + gap, y: r.top + r.height / 2 };
      setPos({ ...p, side });
    }, delay);
  }, [delay, side]);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!pos) return;
    const onScroll = () => hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('pointerdown', onScroll, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('pointerdown', onScroll, true);
    };
  }, [pos, hide]);

  if (!isValidElement(children) || disabled || !label) return children;
  const child = cloneElement(children, {
    // icon-only buttons get their accessible name from the tooltip text
    'aria-label': children.props['aria-label'] ?? (typeof label === 'string' && children.type === 'button' ? label : undefined),
    onMouseEnter: (e: React.MouseEvent) => { children.props.onMouseEnter?.(e); show(e.currentTarget as HTMLElement); },
    onMouseLeave: (e: React.MouseEvent) => { children.props.onMouseLeave?.(e); hide(); },
    onFocus: (e: React.FocusEvent) => { children.props.onFocus?.(e); if ((e.currentTarget as HTMLElement).matches(':focus-visible')) show(e.currentTarget as HTMLElement); },
    onBlur: (e: React.FocusEvent) => { children.props.onBlur?.(e); hide(); },
  });
  const transform = pos?.side === 'top' ? 'translate(-50%, -100%)' : pos?.side === 'bottom' ? 'translate(-50%, 0)' : pos?.side === 'left' ? 'translate(-100%, -50%)' : 'translate(0, -50%)';
  const [tx, ty] = transform.replace('translate(', '').replace(')', '').split(', ');
  return (
    <>
      {child}
      {pos && createPortal(
        <div className="tooltip" style={{ left: pos.x, top: pos.y, transform, '--tx': tx, '--ty': ty } as React.CSSProperties}>{label}</div>,
        document.body,
      )}
    </>
  );
}
