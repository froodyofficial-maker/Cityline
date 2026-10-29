import { motion } from 'motion/react';
import { Camera, Check, Gem, Lock, LogOut, Mic, Pencil, Sparkles, Trash2, Upload, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Decoration } from '../../components/ui/Avatar';
import { ColorPicker, Field, Range, Segmented, Spinner, ToggleRow } from '../../components/ui/Controls';
import { Modal } from '../../components/ui/Modal';
import { DECORATIONS, NAME_EFFECTS, PROFILE_EFFECTS, THEMES } from '../../lib/neon';
import { canNotify, requestNotifyPermission } from '../../lib/notify';
import { audioContext } from '../../lib/sounds';
import { refreshMicSettings } from '../../lib/voice';
import type { Profile, UserSettings as US } from '../../lib/types';
import { cn, formatShortDate } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { useData } from '../../store/data';
import { closeModal, navigate, openModal, toast, toastError } from '../../store/ui';
import { updateSettings } from '../../store/actions/bootstrap';
import { changeEmail, changePassword, deleteAccount, signOut, unblockUser, updateProfile, uploadAvatar, uploadBanner, redeemCode, startTrial } from '../../store/actions/users';
import { ProfileCard } from '../profile/ProfileCard';
import { ProfileEffect } from '../profile/ProfileEffect';
import { SaveBar, SettingsHeader, SettingsLayout, type SettingsTab } from './SettingsLayout';
import { DEFAULT_QUICK_REACTIONS } from '../../lib/emoji';
import { useShallow } from 'zustand/react/shallow';

export function UserSettings({ tab }: { tab?: string }) {
  const [active, setActive] = useState(tab ?? 'account');
  const tabs: SettingsTab[] = [
    { id: 'account', label: 'My Account', section: 'User Settings' },
    { id: 'profile', label: 'Profiles', section: 'User Settings' },
    { id: 'privacy', label: 'Privacy & Safety', section: 'User Settings' },
    { id: 'neon', label: <span className="grad-text bold">Neon</span>, section: 'Billing', badge: <Gem size={14} className="neon-icon" style={{ marginLeft: 'auto' }} /> },
    { id: 'appearance', label: 'Appearance', section: 'App Settings' },
    { id: 'accessibility', label: 'Accessibility', section: 'App Settings' },
    { id: 'voice', label: 'Voice & Video', section: 'App Settings' },
    { id: 'notifications', label: 'Notifications', section: 'App Settings' },
    { id: 'keybinds', label: 'Keybinds', section: 'App Settings' },
    { id: 'advanced', label: 'Advanced', section: 'App Settings' },
    { id: 'sep1', label: '' },
    { id: 'logout', label: <span className="row gap-6">Log Out <LogOut size={14} /></span>, danger: true, onClick: () => openModal({ kind: 'confirm', title: 'Log Out', body: 'Are you sure you want to log out?', confirm: 'Log Out', danger: true, onConfirm: async () => { closeModal(); await signOut(); } }) },
  ];
  return (
    <SettingsLayout tabs={tabs} active={active} onTab={setActive}>
      {active === 'account' && <AccountTab onEdit={() => setActive('profile')} />}
      {active === 'profile' && <ProfileTab />}
      {active === 'privacy' && <PrivacyTab />}
      {active === 'neon' && <NeonTab />}
      {active === 'appearance' && <AppearanceTab />}
      {active === 'accessibility' && <AccessibilityTab />}
      {active === 'voice' && <VoiceTab />}
      {active === 'notifications' && <NotificationsTab />}
      {active === 'keybinds' && <KeybindsTab />}
      {active === 'advanced' && <AdvancedTab />}
    </SettingsLayout>
  );
}

function useSettings() { return useData((s) => s.settings); }
const setS = (p: Partial<US>) => updateSettings(p);

// ---------------------------------------------------------------- account

function AccountTab({ onEdit }: { onEdit: () => void }) {
  const me = useData((s) => (s.me ? s.profiles[s.me] : undefined));
  const [email, setEmail] = useState<string>('');
  const [reveal, setReveal] = useState(false);
  const [modal, setModal] = useState<null | 'username' | 'email' | 'password'>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')); }, []);
  if (!me) return null;
  const masked = email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => a + '*'.repeat(Math.min(b.length, 10)) + c);
  return (
    <>
      <SettingsHeader title="My Account" />
      <div className="account-card">
        <div className="account-banner" style={{ background: me.banner_color || 'var(--grad-brand)' }} />
        <div className="account-top">
          <Avatar userId={me.id} size={88} showStatus ring="var(--bg-side)" />
          <div className="grow"><h3>{me.display_name || me.username}</h3><div className="muted">{me.username}</div></div>
          <button className="btn" onClick={onEdit}>Edit User Profile</button>
        </div>
        <div className="account-fields">
          <AccountRow label="Display Name" value={me.display_name || me.username} onEdit={onEdit} />
          <AccountRow label="Username" value={me.username} onEdit={() => setModal('username')} />
          <AccountRow label="Email" value={<span className="streamer-hide">{reveal ? email : masked} <button className="btn link small" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide' : 'Reveal'}</button></span>} onEdit={() => setModal('email')} />
          <AccountRow label="Member since" value={formatShortDate(me.created_at)} />
        </div>
      </div>
      <div className="settings-block">
        <h3>Password and Authentication</h3>
        <button className="btn" onClick={() => setModal('password')}>Change Password</button>
      </div>
      <div className="settings-block danger-zone">
        <h3>Account Removal</h3>
        <p className="muted small">Deleting your account removes your profile and messages for good. Transfer or delete servers you own first.</p>
        <button className="btn danger" onClick={() => openModal({ kind: 'confirm', title: 'Delete Account', danger: true, confirm: 'Delete Account', body: 'This cannot be undone. Are you absolutely sure?', onConfirm: () => deleteAccount() })}><Trash2 size={16} /> Delete Account</button>
      </div>
      {modal === 'username' && <EditFieldModal title="Change your username" label="Username" initial={me.username} onClose={() => setModal(null)} onSave={(v) => updateProfile({ username: v.toLowerCase() })} />}
      {modal === 'email' && <EditFieldModal title="Change your email" label="Email" initial={email} onClose={() => setModal(null)} onSave={async (v) => { await changeEmail(v); toast('Check both inboxes to confirm the change', 'info', '📬'); }} />}
      {modal === 'password' && <EditFieldModal title="Update your password" label="New password" type="password" initial="" onClose={() => setModal(null)} onSave={async (v) => { if (v.length < 8) throw new Error('At least 8 characters'); await changePassword(v); toast('Password updated', 'success'); }} />}
    </>
  );
}

function AccountRow({ label, value, onEdit }: { label: string; value: React.ReactNode; onEdit?: () => void }) {
  return (
    <div className="account-row">
      <div className="grow"><div className="label">{label}</div><div>{value}</div></div>
      {onEdit && <button className="btn sm secondary" onClick={onEdit}>Edit</button>}
    </div>
  );
}

function EditFieldModal({ title, label, initial, type = 'text', onSave, onClose }: { title: string; label: string; initial: string; type?: string; onSave: (v: string) => Promise<unknown>; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={title} onClose={onClose} center footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy || !v} onClick={async () => { setBusy(true); try { await onSave(v); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } setBusy(false); }}>{busy ? <Spinner /> : 'Done'}</button></>}>
      <Field label={label} error={err}><input className="input" type={type} autoFocus value={v} onChange={(e) => setV(e.target.value)} /></Field>
    </Modal>
  );
}

// ---------------------------------------------------------------- profile editor

function ProfileTab() {
  const me = useData((s) => (s.me ? s.profiles[s.me] : undefined));
  const neon = me?.neon === 'neon';
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [busy, setBusy] = useState(false);
  const avatarIn = useRef<HTMLInputElement>(null);
  const bannerIn = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  if (!me) return null;
  const val = <K extends keyof Profile>(k: K): Profile[K] => (k in draft ? (draft[k] as Profile[K]) : me[k]);
  const dirty = Object.keys(draft).length > 0;
  const preview = { ...me, ...draft };

  async function save() {
    setBusy(true);
    try { await updateProfile(draft); setDraft({}); toast('Profile saved', 'success', '✨'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function upload(kind: 'avatar' | 'banner', f: File) {
    setUploading(kind);
    try {
      const url = kind === 'avatar' ? await uploadAvatar(f) : await uploadBanner(f);
      setDraft((d) => ({ ...d, [kind === 'avatar' ? 'avatar_url' : 'banner_url']: url }));
    } catch (e) { toastError(e); }
    setUploading(null);
  }
  const lockNote = (perk: string) => !neon && <button className="neon-lock" onClick={() => { closeModal(); navigate({ kind: 'neon' }); }}><Lock size={12} /> {perk} with Neon</button>;

  return (
    <>
      <SettingsHeader title="Profiles" desc="Your profile shows up everywhere you chat. Make it yours." />
      <div className="profile-editor">
        <div className="pe-form">
          <Field label="Display Name"><input className="input" value={val('display_name') ?? ''} maxLength={32} onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value || null }))} /></Field>
          <Field label="Pronouns"><input className="input" value={val('pronouns')} maxLength={40} placeholder="Add your pronouns" onChange={(e) => setDraft((d) => ({ ...d, pronouns: e.target.value }))} /></Field>
          <div className="label">Avatar</div>
          <div className="row gap-8 pe-row">
            <button className="btn sm" onClick={() => avatarIn.current?.click()} disabled={!!uploading}>{uploading === 'avatar' ? <Spinner /> : <><Camera size={14} /> Change Avatar</>}</button>
            {val('avatar_url') && <button className="btn sm ghost" onClick={() => setDraft((d) => ({ ...d, avatar_url: null }))}>Remove</button>}
            <span className="tiny muted">{neon ? 'GIFs stay animated ✨' : 'Animated GIF avatars need Neon'}</span>
            <input ref={avatarIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.type === 'image/gif' && !neon) { toast('Animated avatars are a Neon perk', 'neon', '💎'); return; } void upload('avatar', f); } e.target.value = ''; }} />
          </div>
          <div className="label">Banner Color</div>
          <ColorPicker value={val('banner_color')} onChange={(c) => setDraft((d) => ({ ...d, banner_color: c }))} allowNone />
          <div className="label row gap-6" style={{ marginTop: 16 }}>Profile Banner {lockNote('Upload a banner')}</div>
          <div className="row gap-8 pe-row">
            <button className="btn sm" disabled={!neon || !!uploading} onClick={() => bannerIn.current?.click()}>{uploading === 'banner' ? <Spinner /> : <><Upload size={14} /> Upload Banner</>}</button>
            {val('banner_url') && <button className="btn sm ghost" onClick={() => setDraft((d) => ({ ...d, banner_url: null }))}>Remove</button>}
            <input ref={bannerIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('banner', f); e.target.value = ''; }} />
          </div>
          <div className="label row gap-6" style={{ marginTop: 16 }}>Profile Theme {lockNote('Theme')}</div>
          <div className={cn('row gap-12 pe-row', !neon && 'locked')}>
            <ThemeColor label="Primary" value={val('theme_colors')?.[0] ?? '#7c6cff'} onChange={(c) => setDraft((d) => ({ ...d, theme_colors: [c, (d.theme_colors ?? me.theme_colors)?.[1] ?? '#2fd0ff'] }))} disabled={!neon} />
            <ThemeColor label="Accent" value={val('theme_colors')?.[1] ?? '#2fd0ff'} onChange={(c) => setDraft((d) => ({ ...d, theme_colors: [(d.theme_colors ?? me.theme_colors)?.[0] ?? '#7c6cff', c] }))} disabled={!neon} />
            {val('theme_colors') && <button className="btn sm ghost" onClick={() => setDraft((d) => ({ ...d, theme_colors: null }))}>Reset</button>}
          </div>
          <div className="label row gap-6" style={{ marginTop: 16 }}>Avatar Decoration {lockNote('Decorations')}</div>
          <div className={cn('cosmetic-grid', !neon && 'locked')}>
            <button className={cn('cosmetic', !val('avatar_decoration') && 'on')} onClick={() => setDraft((d) => ({ ...d, avatar_decoration: null }))} disabled={!neon}><X size={20} /><span>None</span></button>
            {DECORATIONS.map((d) => (
              <button key={d.id} className={cn('cosmetic', val('avatar_decoration') === d.id && 'on')} disabled={!neon} onClick={() => setDraft((x) => ({ ...x, avatar_decoration: d.id }))}>
                <span className="cosmetic-avatar"><Avatar userId={me.id} size={44} decoration={null} /><Decoration id={d.id} /></span>
                <span>{d.name}</span>
              </button>
            ))}
          </div>
          <div className="label row gap-6" style={{ marginTop: 16 }}>Profile Effect {lockNote('Effects')}</div>
          <div className={cn('cosmetic-grid', !neon && 'locked')}>
            <button className={cn('cosmetic', !val('profile_effect') && 'on')} onClick={() => setDraft((d) => ({ ...d, profile_effect: null }))} disabled={!neon}><X size={20} /><span>None</span></button>
            {PROFILE_EFFECTS.map((p) => (
              <button key={p.id} className={cn('cosmetic fx', val('profile_effect') === p.id && 'on')} disabled={!neon} onClick={() => setDraft((x) => ({ ...x, profile_effect: p.id }))}>
                <span className="cosmetic-fx"><ProfileEffect id={p.id} /></span>
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <div className="label row gap-6" style={{ marginTop: 16 }}>Name Style <span className="tag-new">NEW</span> {lockNote('Name styles')}</div>
          <div className={cn('cosmetic-grid names', !neon && 'locked')}>
            <button className={cn('cosmetic', !val('name_effect') && 'on')} onClick={() => setDraft((d) => ({ ...d, name_effect: null }))} disabled={!neon}><span>Plain</span></button>
            {NAME_EFFECTS.map((n) => (
              <button key={n.id} className={cn('cosmetic', val('name_effect') === n.id && 'on')} disabled={!neon} onClick={() => setDraft((x) => ({ ...x, name_effect: n.id }))}>
                <span className={`name-tag name-fx name-fx-${n.id}`} data-text={me.display_name || me.username}>{me.display_name || me.username}</span>
                <span className="tiny muted">{n.name}</span>
              </button>
            ))}
          </div>
          <Field label="About Me" help={`${(val('bio') ?? '').length}/${neon ? 400 : 190} · You can use markdown and links.`}>
            <textarea className="textarea" value={val('bio')} maxLength={neon ? 400 : 190} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} />
          </Field>
        </div>
        <div className="pe-preview">
          <div className="label">Preview</div>
          <ProfileCard userId={me.id} serverId={null} variant="panel" override={preview as Profile} />
        </div>
      </div>
      <SaveBar show={dirty} busy={busy} onSave={() => void save()} onReset={() => setDraft({})} />
    </>
  );
}

function ThemeColor({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <label className={cn('theme-color', disabled && 'disabled')}>
      <span className="theme-swatch" style={{ background: value }}><Pencil size={14} /><input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></span>
      <span className="tiny">{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------- privacy

function PrivacyTab() {
  const blocked = useData(useShallow((s) => Object.values(s.relationships).filter((r) => r.type === 'blocked').map((r) => r.target_id)));
  const profiles = useData((s) => s.profiles);
  return (
    <>
      <SettingsHeader title="Privacy & Safety" desc="Blocked users can’t message you, and you won’t see their DMs." />
      <div className="label">Blocked Users — {blocked.length}</div>
      {blocked.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>You haven’t blocked anyone.</div>}
      {blocked.map((id) => (
        <div key={id} className="account-row">
          <Avatar userId={id} size={32} />
          <span className="grow">{profiles[id]?.display_name || profiles[id]?.username}</span>
          <button className="btn sm secondary" onClick={() => void unblockUser(id)}>Unblock</button>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- neon

function NeonTab() {
  const sub = useData((s) => s.neon);
  const active = !!sub && new Date(sub.expires_at) > new Date();
  const [code, setCode] = useState('');
  return (
    <>
      <SettingsHeader title={<span className="grad-text">Cityline Neon</span>} desc="Premium perks that make Cityline shine." />
      <div className={cn('neon-sub-card', active && 'active')}>
        <Gem size={36} />
        <div className="grow">
          {active ? <><h3>{sub!.tier === 'neon' ? 'Neon' : 'Neon Lite'} is active</h3><p className="muted">{sub!.source === 'trial' ? 'Free trial' : 'Subscription'} · renews or ends {formatShortDate(sub!.expires_at)}</p></>
            : <><h3>You don’t have Neon yet</h3><p className="muted">{sub?.trial_used_at ? 'Redeem a gift code to get Neon.' : 'Try every perk free for 7 days.'}</p></>}
        </div>
        {!active && !sub?.trial_used_at && <button className="btn neon" onClick={() => void startTrial().catch(toastError)}><Sparkles size={16} /> Start free trial</button>}
        <button className="btn secondary" onClick={() => { closeModal(); navigate({ kind: 'neon' }); }}>See all perks</button>
      </div>
      <div className="settings-block">
        <h3>Redeem a gift code</h3>
        <div className="row gap-8">
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XXXX" />
          <button className="btn" disabled={!code} onClick={() => void redeemCode(code).then(() => setCode('')).catch(toastError)}>Redeem</button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- appearance

function AppearanceTab() {
  const s = useSettings();
  const neon = useData((st) => st.profiles[st.me!]?.neon === 'neon');
  const current = s.theme || 'midnight';
  const quick = s.quickReactions?.length ? s.quickReactions : DEFAULT_QUICK_REACTIONS;
  return (
    <>
      <SettingsHeader title="Appearance" />
      <div className="label">Theme</div>
      <div className="theme-grid">
        {THEMES.map((t) => {
          const locked = t.neon && !neon;
          return (
            <motion.button key={t.id} className={cn('theme-tile', current === t.id && 'on', locked && 'locked')} whileHover={{ y: -3 }} onClick={() => {
              if (locked) { toast('Gradient themes are part of Neon', 'neon', '💎'); return; }
              setS({ theme: t.id });
            }}>
              <span className="theme-preview" style={{ background: t.neon ? `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]} 60%, ${t.swatch[2]})` : t.swatch[0] }}>
                <i style={{ background: t.swatch[1] }} /><i style={{ background: t.swatch[2] }} />
                {current === t.id && <span className="theme-check"><Check size={14} /></span>}
                {locked && <span className="theme-lock"><Lock size={14} /></span>}
              </span>
              <span className="theme-name">{t.name}{t.neon && <Gem size={12} className="neon-icon" />}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="label" style={{ marginTop: 24 }}>Message Display</div>
      <Segmented value={s.compact ? 'compact' : 'cozy'} onChange={(v) => setS({ compact: v === 'compact' })} options={[{ id: 'cozy', label: 'Cozy' }, { id: 'compact', label: 'Compact' }]} />
      <div className="label" style={{ marginTop: 24 }}>Chat Font Scaling — {Math.round((s.fontScale ?? 1) * 100)}%</div>
      <Range value={(s.fontScale ?? 1) * 100} min={80} max={130} step={5} onChange={(v) => setS({ fontScale: v / 100 })} />
      <div className="label" style={{ marginTop: 24 }}>Saturation — {Math.round((s.saturation ?? 1) * 100)}%</div>
      <Range value={(s.saturation ?? 1) * 100} min={0} max={100} step={5} onChange={(v) => setS({ saturation: v / 100 })} />
      <div style={{ marginTop: 16 }}>
        <ToggleRow title="Round avatars" desc="Turn off for squircle avatars." on={s.roundedAvatars !== false} onChange={(v) => setS({ roundedAvatars: v })} />
        <ToggleRow title="24-hour time" on={!!s.timestamps24h} onChange={(v) => setS({ timestamps24h: v })} />
      </div>
      <div className="label" style={{ marginTop: 24 }}>Quick reactions</div>
      <p className="muted small">The emoji shown when you hover a message. Click to remove; type an emoji to add.</p>
      <div className="row gap-6" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {quick.map((e) => <button key={e} className="chip" onClick={() => setS({ quickReactions: quick.filter((x) => x !== e) })}>{e} <X size={12} /></button>)}
        {quick.length < 6 && <input className="input" style={{ width: 120 }} placeholder="Add emoji" onKeyDown={(ev) => { const v = (ev.target as HTMLInputElement).value.trim(); if (ev.key === 'Enter' && v) { setS({ quickReactions: [...quick, v].slice(0, 6) }); (ev.target as HTMLInputElement).value = ''; } }} />}
      </div>
    </>
  );
}

function AccessibilityTab() {
  const s = useSettings();
  return (
    <>
      <SettingsHeader title="Accessibility" />
      <ToggleRow title="Reduced motion" desc="Tone down animations, effects and parallax." on={!!s.reducedMotion} onChange={(v) => setS({ reducedMotion: v })} />
      <ToggleRow title="Show message effects" desc="Confetti, fireworks and friends that Neon members send." on={s.showEffects !== false} onChange={(v) => setS({ showEffects: v })} />
      <ToggleRow title="Play animated emoji & stickers" desc="When off, stickers are shown as still images (where possible)." on={true} onChange={() => toast('Coming soon', 'info')} />
    </>
  );
}

// ---------------------------------------------------------------- voice & video

function VoiceTab() {
  const s = useSettings();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    void navigator.mediaDevices?.enumerateDevices().then(setDevices).catch(() => {});
  }, [testing, cam]);
  useEffect(() => {
    if (!testing) return;
    let raf = 0;
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: s.inputDevice ? { ideal: s.inputDevice } : undefined, noiseSuppression: s.noiseSuppression !== false } });
        const c = audioContext();
        const src = c.createMediaStreamSource(stream);
        const an = c.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const data = new Uint8Array(an.fftSize);
        const loop = () => {
          an.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; sum += x * x; }
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 6));
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch { toast('Could not access your microphone', 'error'); setTesting(false); }
    })();
    return () => { cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [testing, s.inputDevice, s.noiseSuppression]);
  useEffect(() => { if (video.current && cam) video.current.srcObject = cam; }, [cam]);
  useEffect(() => () => cam?.getTracks().forEach((t) => t.stop()), [cam]);
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); setS({ pttKey: e.key }); setCapturing(false); };
    window.addEventListener('keydown', onKey, { once: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [capturing]);
  const inputs = devices.filter((d) => d.kind === 'audioinput');
  const outputs = devices.filter((d) => d.kind === 'audiooutput');
  const cams = devices.filter((d) => d.kind === 'videoinput');
  const threshold = (s.inputSensitivity ?? 40) / 100;
  return (
    <>
      <SettingsHeader title="Voice & Video" />
      <div className="row gap-12 wrap-mobile">
        <Field label="Input Device"><select className="select" value={s.inputDevice ?? ''} onChange={(e) => { setS({ inputDevice: e.target.value || undefined }); refreshMicSettings(); }}><option value="">Default</option>{inputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}</select></Field>
        <Field label="Output Device"><select className="select" value={s.outputDevice ?? ''} onChange={(e) => setS({ outputDevice: e.target.value || undefined })}><option value="">Default</option>{outputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speakers'}</option>)}</select></Field>
      </div>
      <div className="label">Mic Test</div>
      <div className="mic-test">
        <button className="btn sm" onClick={() => setTesting(!testing)}><Mic size={14} /> {testing ? 'Stop' : 'Let’s Check'}</button>
        <div className="mic-meter"><i style={{ width: `${level * 100}%` }} className={level > threshold ? 'hot' : ''} /><span className="mic-threshold" style={{ left: `${threshold * 100}%` }} /></div>
      </div>
      <div className="label" style={{ marginTop: 18 }}>Input Sensitivity</div>
      <Range value={s.inputSensitivity ?? 40} onChange={(v) => setS({ inputSensitivity: v })} />
      <div className="tiny muted">Sound below the marker won’t light up your speaking ring.</div>
      <div style={{ marginTop: 12 }}>
        <ToggleRow title="Noise suppression" desc="Filters out background noise from your mic." on={s.noiseSuppression !== false} onChange={(v) => setS({ noiseSuppression: v })} />
        <ToggleRow title="Push to talk" desc={<>Only transmit while you hold <span className="kbd">{s.pttKey || '`'}</span>. <button className="btn link small" onClick={() => setCapturing(true)}>{capturing ? 'Press a key…' : 'Change key'}</button></>} on={!!s.pushToTalk} onChange={(v) => { setS({ pushToTalk: v }); refreshMicSettings(); }} />
      </div>
      <div className="label" style={{ marginTop: 24 }}>Video</div>
      <div className="cam-preview">
        {cam ? <video ref={video} autoPlay playsInline muted className="mirror" /> : <div className="cam-off"><Video size={36} /><span>Preview your camera</span></div>}
      </div>
      <div className="row gap-8" style={{ marginTop: 10 }}>
        <button className="btn sm" onClick={async () => { if (cam) { cam.getTracks().forEach((t) => t.stop()); setCam(null); return; } try { setCam(await navigator.mediaDevices.getUserMedia({ video: { deviceId: s.videoDevice ? { ideal: s.videoDevice } : undefined } })); } catch { toast('Could not start your camera', 'error'); } }}>{cam ? 'Stop preview' : 'Test Video'}</button>
        <select className="select" style={{ maxWidth: 280 }} value={s.videoDevice ?? ''} onChange={(e) => setS({ videoDevice: e.target.value || undefined })}><option value="">Default camera</option>{cams.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}</select>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- notifications

function NotificationsTab() {
  const s = useSettings();
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : 'denied');
  return (
    <>
      <SettingsHeader title="Notifications" />
      {perm !== 'granted' && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <span className="grow">Desktop notifications are {perm === 'denied' ? 'blocked by your browser' : 'not enabled yet'}.</span>
          {perm === 'default' && <button className="btn sm" onClick={() => void requestNotifyPermission().then(setPerm)}>Enable</button>}
        </div>
      )}
      <ToggleRow title="Desktop notifications" desc="Pop up a notification for DMs and mentions while Cityline is in the background." on={s.notifyDesktop !== false} onChange={(v) => { setS({ notifyDesktop: v }); if (v) void requestNotifyPermission().then(setPerm); }} />
      <ToggleRow title="Notification sounds" desc="Message, mention, call and voice sounds." on={s.notifySounds !== false} onChange={(v) => setS({ notifySounds: v })} />
      <div className="notice neon" style={{ marginTop: 16 }}><Sparkles /><span><b>Focus Mode</b> (from your avatar menu) pauses every notification for 50 minutes. Mute single servers or channels by right-clicking them.</span></div>
    </>
  );
}

function KeybindsTab() {
  return (
    <>
      <SettingsHeader title="Keybinds" desc="Shortcuts that work anywhere in Cityline." />
      <button className="btn secondary" onClick={() => openModal({ kind: 'shortcuts' })}>View all keyboard shortcuts</button>
    </>
  );
}

function AdvancedTab() {
  const s = useSettings();
  return (
    <>
      <SettingsHeader title="Advanced" />
      <ToggleRow title="Developer Mode" desc="Adds “Copy ID” to context menus for servers, channels, messages and users." on={!!s.developerMode} onChange={(v) => setS({ developerMode: v })} />
      <ToggleRow title="Streamer Mode" desc="Blurs your email and other personal info while you stream." on={!!s.streamerMode} onChange={(v) => setS({ streamerMode: v })} />
      <div className="settings-block">
        <h3>About</h3>
        <p className="muted small">Cityline · built on Supabase. Your data lives in your own Supabase project.</p>
      </div>
    </>
  );
}
