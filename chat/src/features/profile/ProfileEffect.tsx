import { memo, useMemo, type CSSProperties } from 'react';

const GLYPHS: Record<string, string[]> = {
  petals: ['🌸', '🌸', '💮'],
  stars: ['✦', '✧', '⋆'],
  embers: ['', '', ''],
  bubbles: ['', '', ''],
  snow: ['❄', '❅', '❆'],
};

/** Neon profile effects: particles that drift over a profile card. */
export const ProfileEffect = memo(function ProfileEffect({ id }: { id: string }) {
  const parts = useMemo(() => Array.from({ length: id === 'cybergrid' ? 0 : 16 }, (_, i) => ({
    left: Math.random() * 100,
    delay: -Math.random() * 8,
    dur: 5 + Math.random() * 6,
    size: 0.6 + Math.random() * 0.9,
    drift: (Math.random() - 0.5) * 60,
    g: GLYPHS[id]?.[i % 3] ?? '',
  })), [id]);
  return (
    <div className={`pfx pfx-${id}`} aria-hidden>
      {id === 'cybergrid' && <div className="pfx-grid" />}
      {parts.map((p, i) => (
        <span
          key={i}
          className="pfx-p"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, '--s': p.size, '--drift': `${p.drift}px` } as CSSProperties}
        >
          {p.g}
        </span>
      ))}
    </div>
  );
});
