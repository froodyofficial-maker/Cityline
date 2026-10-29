import { AnimatePresence, motion } from 'motion/react';
import { Copy, Headphones, HeadphoneOff, Mic, MicOff, Pencil, Settings, Smile, Target, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import type { Status } from '../../lib/types';
import { cn, copyText } from '../../lib/utils';
import { toggleDeafen, toggleMute } from '../../lib/voice';
import { playUi } from '../../lib/sounds';
import { useData } from '../../store/data';
import { useMe } from '../../store/selectors';
import { openModal, setUI, toast, useUI } from '../../store/ui';
import { setCustomStatus, setStatus } from '../../store/actions/users';
import { useVoice, setVoice } from '../../store/voice';

const STATUSES: { id: Status; label: string; desc?: string }[] = [
  { id: 'online', label: 'Online' },
  { id: 'idle', label: 'Idle' },
  { id: 'dnd', label: 'Do Not Disturb', desc: 'You will not receive desktop notifications' },
  { id: 'invisible', label: 'Invisible', desc: 'You will appear offline, but have full access' },
];

export function UserPanel() {
  const me = useMe();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const muted = useVoice((s) => s.muted);
  const deafened = useVoice((s) => s.deafened);
  const inVoice = useVoice((s) => !!s.channelId);
  const focus = useUI((s) => s.focusMode);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  if (!me) return null;
  const status = me.status === 'invisible' ? 'offline' : me.status;

  function mute() {
    if (inVoice) toggleMute();
    else {
      const next = !muted;
      setVoice({ muted: next, deafened: false });
      localStorage.setItem('cityline:muted', next ? '1' : '0');
      playUi(next ? 'mute' : 'unmute');
    }
  }
  function deafen() {
    if (inVoice) toggleDeafen();
    else {
      const next = !deafened;
      setVoice({ deafened: next });
      localStorage.setItem('cityline:deafened', next ? '1' : '0');
      playUi(next ? 'deafen' : 'undeafen');
    }
  }

  return (
    <div className="user-panel" ref={ref}>
      <button className="user-chip" onClick={() => setOpen(!open)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <Avatar userId={me.id} size={34} status={status} showStatus ring="var(--bg-panel-foot, var(--bg-rail))" />
        <div className="user-chip-text">
          <NameTag userId={me.id} className="user-chip-name ellipsis" />
          <div className="user-chip-sub">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={hover ? 'u' : 's'} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }} transition={{ duration: 0.15 }} className="ellipsis">
                {hover || !me.custom_status ? me.username : <>{me.custom_status_emoji} {me.custom_status}</>}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </button>
      <div className="user-btns">
        <Tip label={deafened ? 'Undeafen to talk' : muted ? 'Unmute' : 'Mute'}>
          <button className={cn('icon-btn', (muted || deafened) && 'red')} onClick={mute} aria-label="Toggle mute">{muted || deafened ? <MicOff /> : <Mic />}</button>
        </Tip>
        <Tip label={deafened ? 'Undeafen' : 'Deafen'}>
          <button className={cn('icon-btn', deafened && 'red')} onClick={deafen} aria-label="Toggle deafen">{deafened ? <HeadphoneOff /> : <Headphones />}</button>
        </Tip>
        <Tip label="User Settings">
          <button className="icon-btn spin-hover" onClick={() => openModal({ kind: 'userSettings' })} aria-label="User settings"><Settings /></button>
        </Tip>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="status-menu" initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }} transition={{ duration: 0.16 }}>
            <div className="status-card-banner" style={{ background: me.banner_url && me.neon === 'neon' ? `center/cover url(${me.banner_url})` : me.theme_colors && me.neon === 'neon' ? `linear-gradient(135deg, ${me.theme_colors[0]}, ${me.theme_colors[1]})` : me.banner_color || 'var(--grad-brand)' }} />
            <div className="status-card-head">
              <Avatar userId={me.id} size={64} status={status} showStatus ring="var(--bg-float)" />
              <div>
                <NameTag userId={me.id} className="status-card-name" />
                <div className="muted small">{me.username}</div>
              </div>
            </div>
            <button className="menu-item" onClick={() => { setOpen(false); openModal({ kind: 'status' }); }}>
              <span className="mi-icon"><Smile /></span>
              <span className="mi-label">{me.custom_status ? <>{me.custom_status_emoji} {me.custom_status}</> : 'Set a custom status'}</span>
              {me.custom_status && <span className="icon-btn sm" onClick={(e) => { e.stopPropagation(); void setCustomStatus(null, null, null); }}><X /></span>}
            </button>
            <div className="menu-sep" />
            {STATUSES.map((s) => (
              <button key={s.id} className={cn('menu-item status-opt', me.status === s.id && 'on')} onClick={() => { void setStatus(s.id); setOpen(false); }}>
                <span className={cn('status-dot', s.id === 'invisible' ? 'offline' : s.id)} />
                <span className="mi-label">
                  {s.label}
                  {s.desc && <div className="tiny" style={{ opacity: 0.75 }}>{s.desc}</div>}
                </span>
              </button>
            ))}
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => {
              setOpen(false);
              if (focus && focus > Date.now()) { setUI({ focusMode: null }); toast('Focus mode off', 'info', '🎯'); return; }
              setUI({ focusMode: Date.now() + 50 * 60_000 });
              toast('Focus mode on for 50 minutes — notifications are paused', 'info', '🎯');
            }}>
              <span className="mi-icon"><Target /></span>
              <span className="mi-label">{focus && focus > Date.now() ? 'End Focus Mode' : 'Focus Mode (50 min)'} <span className="tag-new">NEW</span></span>
            </button>
            <button className="menu-item" onClick={() => { setOpen(false); openModal({ kind: 'userSettings', tab: 'profile' }); }}>
              <span className="mi-icon"><Pencil /></span><span className="mi-label">Edit Profile</span>
            </button>
            <button className="menu-item" onClick={() => { void copyText(me.id); toast('User ID copied', 'success'); setOpen(false); }}>
              <span className="mi-icon"><Copy /></span><span className="mi-label">Copy User ID</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {focus && focus > Date.now() && <FocusRibbon until={focus} />}
    </div>
  );
}

function FocusRibbon({ until }: { until: number }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  const mins = Math.max(0, Math.round((until - Date.now()) / 60_000));
  return <div className="focus-ribbon"><Target size={12} /> Focus · {mins}m left</div>;
}

export function useMyStatus() {
  return useData((s) => (s.me ? s.profiles[s.me]?.status : 'online'));
}
