import { THEMES } from './neon';
import type { UserSettings } from './types';

export function applyAppearance(s: UserSettings, neon: boolean) {
  const root = document.documentElement;
  let theme = s.theme || 'midnight';
  const def = THEMES.find((t) => t.id === theme);
  if (!def || (def.neon && !neon)) theme = 'midnight';
  root.dataset.theme = theme;
  root.dataset.light = THEMES.find((t) => t.id === theme)?.light ? '1' : '0';
  root.style.setProperty('--font-scale', String(s.fontScale ?? 1));
  root.style.setProperty('--saturation', String(s.saturation ?? 1));
  root.classList.toggle('reduce-motion', !!s.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches && s.reducedMotion !== false);
  root.classList.toggle('compact', !!s.compact);
  root.classList.toggle('square-avatars', s.roundedAvatars === false);
  root.classList.toggle('streamer', !!s.streamerMode);
  const meta = document.querySelector('meta[name="theme-color"]');
  const sw = THEMES.find((t) => t.id === theme)?.swatch[0];
  if (meta && sw) meta.setAttribute('content', sw);
}
