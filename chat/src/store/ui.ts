import { create } from 'zustand';
import type { ReactNode } from 'react';

export type Route =
  | { kind: 'friends' }
  | { kind: 'dm'; channelId: string }
  | { kind: 'server'; serverId: string; channelId: string | null }
  | { kind: 'discover' }
  | { kind: 'neon' }
  | { kind: 'invite'; code: string };

export type RightPanel = null | 'members' | 'pins' | 'search' | 'thread' | 'threads' | 'profile';

export type ModalSpec =
  | { kind: 'createServer' }
  | { kind: 'joinServer'; code?: string }
  | { kind: 'createChannel'; serverId: string; parentId?: string | null; type?: string }
  | { kind: 'invite'; serverId: string; channelId?: string | null }
  | { kind: 'serverSettings'; serverId: string; tab?: string }
  | { kind: 'channelSettings'; channelId: string; tab?: string }
  | { kind: 'userSettings'; tab?: string }
  | { kind: 'profile'; userId: string; serverId?: string | null; tab?: string }
  | { kind: 'poll'; channelId: string }
  | { kind: 'schedule'; channelId: string; content: string }
  | { kind: 'reminder'; messageId: string; channelId: string }
  | { kind: 'forward'; messageId: string }
  | { kind: 'createThread'; channelId: string; messageId?: string; forum?: boolean }
  | { kind: 'createGroup' }
  | { kind: 'events'; serverId: string }
  | { kind: 'createEvent'; serverId: string }
  | { kind: 'leaderboard'; serverId: string }
  | { kind: 'catchUp'; serverId: string }
  | { kind: 'shortcuts' }
  | { kind: 'nickname'; serverId: string; userId: string }
  | { kind: 'moderate'; serverId: string; userId: string; action: 'kick' | 'ban' | 'timeout' }
  | { kind: 'status' }
  | { kind: 'boost'; serverId?: string }
  | { kind: 'confirm'; title: string; body: ReactNode; confirm: string; danger?: boolean; onConfirm: () => unknown };

export interface Toast { id: number; kind: 'info' | 'success' | 'error' | 'neon'; text: string; icon?: string }

export interface MenuItem {
  label?: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
  checked?: boolean;
  onClick?: () => void;
  divider?: boolean;
  submenu?: MenuItem[];
  color?: string;
}

export interface Popout { kind: 'profile'; userId: string; serverId: string | null; x: number; y: number; side?: 'left' | 'right' }

export interface UIState {
  route: Route;
  modals: ModalSpec[];
  rightPanel: RightPanel;
  threadId: string | null;
  replyTo: Record<string, { id: string; ping: boolean } | undefined>;
  editing: string | null;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  popout: Popout | null;
  mobileNav: boolean;
  toasts: Toast[];
  effects: { id: number; effect: string }[];
  quickSwitcher: boolean;
  lightbox: { items: { url: string; name?: string; type?: string }[]; index: number } | null;
  drafts: Record<string, string>;
  searchQuery: { serverId: string | null; channelId: string | null; query: string; author?: string | null; has?: string | null } | null;
  inbox: boolean;
  jumpTo: { channelId: string; messageId: string; at: number } | null;
  highlight: string | null;
  voiceView: string | null;      // voice channel shown in the main area
  showVoiceChat: boolean;
  incomingCall: { channelId: string; from: string; messageId: string } | null;
  focusMode: number | null;
  uploads: Record<string, number>;
}

const ROUTE_KEY = 'cityline:last-route';

export function parseHash(hash = window.location.hash): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'invite' && parts[1]) return { kind: 'invite', code: parts[1] };
  if (parts[0] === 'discover') return { kind: 'discover' };
  if (parts[0] === 'neon') return { kind: 'neon' };
  if (parts[0] === 'channels') {
    if (parts[1] === '@me') return parts[2] ? { kind: 'dm', channelId: parts[2] } : { kind: 'friends' };
    if (parts[1]) return { kind: 'server', serverId: parts[1], channelId: parts[2] ?? null };
  }
  try {
    const last = JSON.parse(localStorage.getItem(ROUTE_KEY) || 'null');
    if (last && last.kind) return last;
  } catch { /* ignore */ }
  return { kind: 'friends' };
}

export function routeToHash(r: Route) {
  switch (r.kind) {
    case 'friends': return '#/channels/@me';
    case 'dm': return `#/channels/@me/${r.channelId}`;
    case 'server': return `#/channels/${r.serverId}${r.channelId ? '/' + r.channelId : ''}`;
    case 'discover': return '#/discover';
    case 'neon': return '#/neon';
    case 'invite': return `#/invite/${r.code}`;
  }
}

export const useUI = create<UIState>()(() => ({
  route: parseHash(),
  modals: [],
  rightPanel: (localStorage.getItem('cityline:members') ?? '1') === '1' ? 'members' : null,
  threadId: null,
  replyTo: {},
  editing: null,
  menu: null,
  popout: null,
  mobileNav: false,
  toasts: [],
  effects: [],
  quickSwitcher: false,
  lightbox: null,
  drafts: {},
  searchQuery: null,
  inbox: false,
  jumpTo: null,
  highlight: null,
  voiceView: null,
  showVoiceChat: false,
  incomingCall: null,
  focusMode: null,
  uploads: {},
}));

export const ui = () => useUI.getState();
export const setUI = (p: Partial<UIState> | ((s: UIState) => Partial<UIState>)) => useUI.setState(p);

export function navigate(r: Route, opts: { replace?: boolean } = {}) {
  const hash = routeToHash(r);
  if (window.location.hash !== hash) {
    if (opts.replace) history.replaceState(null, '', hash);
    else history.pushState(null, '', hash);
  }
  if (r.kind !== 'invite') localStorage.setItem(ROUTE_KEY, JSON.stringify(r));
  setUI({ route: r, mobileNav: false, editing: null, voiceView: r.kind === 'server' ? ui().voiceView : null });
}

window.addEventListener('popstate', () => setUI({ route: parseHash() }));

export function openModal(m: ModalSpec) { setUI((s) => ({ modals: [...s.modals, m], menu: null, popout: null })); }
export function closeModal() { setUI((s) => ({ modals: s.modals.slice(0, -1) })); }
export function closeAllModals() { setUI({ modals: [] }); }

let toastSeq = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', icon?: string) {
  const id = toastSeq++;
  setUI((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text, icon }] }));
  setTimeout(() => setUI((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), kind === 'error' ? 6000 : 3800);
}
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : String(e), 'error');

export function openMenu(e: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }, items: MenuItem[]) {
  e.preventDefault?.();
  e.stopPropagation?.();
  setUI({ menu: { x: e.clientX, y: e.clientY, items }, popout: null });
}
export const closeMenu = () => setUI({ menu: null });

let effectSeq = 1;
export function playEffect(effect: string) {
  const id = effectSeq++;
  setUI((s) => ({ effects: [...s.effects, { id, effect }] }));
  setTimeout(() => setUI((s) => ({ effects: s.effects.filter((x) => x.id !== id) })), 5200);
}

export function openProfile(userId: string, serverId: string | null, anchor: { x: number; y: number }, side: 'left' | 'right' = 'right') {
  setUI({ popout: { kind: 'profile', userId, serverId, x: anchor.x, y: anchor.y, side }, menu: null });
}

export function setRightPanel(p: RightPanel) {
  if (p === 'members' || p === null) localStorage.setItem('cityline:members', p === 'members' ? '1' : '0');
  setUI({ rightPanel: p });
}
