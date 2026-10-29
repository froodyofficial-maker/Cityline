export const cn = (...parts: (string | false | null | undefined | 0)[]) => parts.filter(Boolean).join(' ');

export const uuid = () =>
  (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function timeOnly(d: Date, h24 = false) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: !h24 });
}

/** "Today at 4:20 PM", "Yesterday at 9:00 AM", "10/29/2026 3:15 PM" */
export function formatMessageTime(iso: string, h24 = false) {
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now.getTime() - DAY);
  if (sameDay(d, now)) return `Today at ${timeOnly(d, h24)}`;
  if (sameDay(d, yest)) return `Yesterday at ${timeOnly(d, h24)}`;
  return `${d.toLocaleDateString()} ${timeOnly(d, h24)}`;
}

export function formatFull(iso: string) {
  return new Date(iso).toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function relativeTime(iso: string | number) {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (abs < MIN) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < HOUR) return rtf.format(Math.round(diff / MIN), 'minute');
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), 'hour');
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / DAY), 'day');
  if (abs < 365 * DAY) return rtf.format(Math.round(diff / (30 * DAY)), 'month');
  return rtf.format(Math.round(diff / (365 * DAY)), 'year');
}

/** Discord-style <t:unix:style> */
export function formatTimestampToken(unix: number, style = 'f') {
  const d = new Date(unix * 1000);
  switch (style) {
    case 't': return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    case 'T': return d.toLocaleTimeString();
    case 'd': return d.toLocaleDateString();
    case 'D': return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    case 'F': return formatFull(d.toISOString());
    case 'R': return relativeTime(d.getTime());
    default: return d.toLocaleString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// --- colours ---------------------------------------------------------------

const PALETTE = ['#7c6cff', '#31d0ff', '#ff6b9a', '#2fd88c', '#ffb547', '#ff7a45', '#a76bff', '#3dd6c4', '#ff5c7a', '#6aa8ff'];
export function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0] + (words[2]?.[0] ?? '')).toUpperCase();
}

export function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function readableOn(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b0d14' : '#ffffff';
}

// --- levels (server XP) -----------------------------------------------------

export function levelFromXp(xp: number) {
  // XP needed for level n: 50·n² + 50·n
  let level = 0;
  while (50 * (level + 1) ** 2 + 50 * (level + 1) <= xp) level++;
  const cur = 50 * level ** 2 + 50 * level;
  const next = 50 * (level + 1) ** 2 + 50 * (level + 1);
  return { level, progress: (xp - cur) / (next - cur), toNext: next - xp };
}

// --- misc --------------------------------------------------------------------

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function throttle<T extends (...a: never[]) => void>(fn: T, ms: number) {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function isImage(type: string) { return type.startsWith('image/'); }
export function isVideo(type: string) { return type.startsWith('video/'); }
export function isAudio(type: string) { return type.startsWith('audio/'); }

export function inviteUrl(code: string) {
  const base = window.location.href.split('#')[0];
  return `${base}#/invite/${code}`;
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

export function sanitizeChannelName(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_À-￿]/g, '').slice(0, 100);
}
