import { Check } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={cn('switch', on && 'on')} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function CheckBox({ on, onChange, disabled }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className={cn('check', on && 'on')} disabled={disabled} onClick={(e) => { e.stopPropagation(); onChange?.(!on); }}>
      <Check strokeWidth={3} />
    </button>
  );
}

export function ToggleRow({ title, desc, on, onChange, disabled, badge }: { title: ReactNode; desc?: ReactNode; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; badge?: ReactNode }) {
  return (
    <div className="toggle-row">
      <div className="text">
        <div className="title">{title} {badge}</div>
        {desc && <div className="desc">{desc}</div>}
      </div>
      <Switch on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, layoutId = 'tabs' }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; layoutId?: string }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={cn(value === t.id && 'on')} onClick={() => onChange(t.id)}>
          {t.label}
          {value === t.id && <motion.span layoutId={layoutId} className="tab-line" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.id} className={cn(value === o.id && 'on')} onClick={() => onChange(o.id)} type="button">{o.label}</button>
      ))}
    </div>
  );
}

export function Range({ value, min = 0, max = 100, step = 1, onChange }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <input type="range" className="range" min={min} max={max} step={step} value={value} style={{ '--p': `${p}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
  );
}

export function Spinner({ lg }: { lg?: boolean }) {
  return <span className={cn('spinner', lg && 'lg')} />;
}

export function Field({ label, help, error, children, required }: { label?: ReactNode; help?: ReactNode; error?: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <div className="field">
      {label && <label>{label}{required && <span className="req">*</span>}</label>}
      {children}
      {error ? <div className="error">{error}</div> : help ? <div className="help">{help}</div> : null}
    </div>
  );
}

export const ROLE_COLORS = ['#7c6cff', '#31d0ff', '#2fd88c', '#ffb547', '#ff7a45', '#ff5c7a', '#ff5fd2', '#a76bff', '#3dd6c4', '#6aa8ff', '#e8e8f0', '#99aab5', '#1abc9c', '#f1c40f', '#e67e22', '#e91e63'];

export function ColorPicker({ value, onChange, colors = ROLE_COLORS, allowNone }: { value: string | null; onChange: (v: string | null) => void; colors?: string[]; allowNone?: boolean }) {
  return (
    <div className="color-swatches">
      {allowNone && (
        <button type="button" className={cn('swatch', !value && 'on')} style={{ background: 'repeating-linear-gradient(45deg, var(--bg-elev-2) 0 4px, var(--bg-elev) 4px 8px)' }} onClick={() => onChange(null)} title="Default" />
      )}
      {colors.map((c) => (
        <button type="button" key={c} className={cn('swatch', value?.toLowerCase() === c.toLowerCase() && 'on')} style={{ background: c }} onClick={() => onChange(c)} />
      ))}
      <label className={cn('swatch', value && !colors.some((c) => c.toLowerCase() === value.toLowerCase()) && 'on')} style={{ background: value && !colors.includes(value) ? value : 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Custom colour">
        <input type="color" value={value || '#7c6cff'} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  );
}
