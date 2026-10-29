import { AnimatePresence, motion } from 'motion/react';
import { Camera, ChevronRight, Hash, Lock, Megaphone, MessagesSquare, Radio, Rocket, Sparkles, Trophy, Volume2, Check, CalendarDays, MapPin, Trash2, Clock, Users, Gamepad2, GraduationCap, Heart, Palette, Globe, Folder } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { CheckBox, Field, Spinner, Switch } from '../../components/ui/Controls';
import { Modal } from '../../components/ui/Modal';
import { NameTag } from '../../components/ui/NameTag';
import { boostLevel, BOOST_LEVELS } from '../../lib/neon';
import { has, P } from '../../lib/permissions';
import type { Channel, Message, ServerEvent } from '../../lib/types';
import { cn, copyText, formatFull, inviteUrl, levelFromXp, sanitizeChannelName } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { displayName, serverRoles, useServerPerms } from '../../store/selectors';
import { closeModal, navigate, openModal, setUI, toast, toastError } from '../../store/ui';
import {
  banMember, boostServer, createChannel, createInvite, createServer, deleteEvent, joinByInvite, kickMember, leaderboard, listEvents, listRsvps, removeBoost, saveEvent, setNickname, setServerAvatar, timeoutMember, toggleRsvp,
} from '../../store/actions/servers';
import { loadCatchUp, markServerRead, sendMessage } from '../../store/actions/messages';
import { rpc } from '../../lib/supabase';
import { MessageCard } from '../panels/MessageCard';
import { useShallow } from 'zustand/react/shallow';

// ---------------------------------------------------------------- create / join server

const TEMPLATES = [
  { id: 'default', label: 'Create My Own', icon: <Sparkles />, desc: 'Start from scratch' },
  { id: 'gaming', label: 'Gaming', icon: <Gamepad2 />, desc: 'Lobby, clips, squad voice rooms' },
  { id: 'friends', label: 'Friends', icon: <Heart />, desc: 'Group chat, memes, movie night' },
  { id: 'study', label: 'Study Group', icon: <GraduationCap />, desc: 'Resources, homework forum, study rooms' },
  { id: 'creators', label: 'Artists & Creators', icon: <Palette />, desc: 'Showcase forum, feedback, live Q&A' },
  { id: 'community', label: 'Local Community', icon: <Globe />, desc: 'Welcome, rules, ideas forum, events stage' },
];

export function CreateServerModal() {
  const me = useData((s) => (s.me ? s.profiles[s.me] : undefined));
  const [step, setStep] = useState<'template' | 'customize'>('template');
  const [template, setTemplate] = useState('default');
  const [name, setName] = useState(`${me?.display_name || me?.username || 'My'}'s server`);
  const [icon, setIcon] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function create() {
    setBusy(true);
    try { await createServer(name.trim(), icon, template); closeModal(); } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={480} title={step === 'template' ? 'Create Your Server' : 'Customize Your Server'} subtitle={step === 'template' ? 'Your server is where you and your friends hang out. Make yours and start talking.' : 'Give your new server a personality with a name and an icon. You can always change it later.'} center
      footer={step === 'customize' ? (
        <>
          <button className="btn ghost" onClick={() => setStep('template')}>Back</button>
          <span className="spacer" />
          <button className="btn" disabled={busy || name.trim().length < 2} onClick={() => void create()}>{busy ? <Spinner /> : 'Create'}</button>
        </>
      ) : (
        <div className="col grow" style={{ alignItems: 'center', gap: 8 }}>
          <span className="bold">Have an invite already?</span>
          <button className="btn secondary block" onClick={() => { closeModal(); openModal({ kind: 'joinServer' }); }}>Join a Server</button>
        </div>
      )}>
      <AnimatePresence mode="wait">
        {step === 'template' ? (
          <motion.div key="t" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {TEMPLATES.map((t, i) => (
              <motion.button key={t.id} className="template-row" onClick={() => { setTemplate(t.id); setStep('customize'); }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <span className="template-icon">{t.icon}</span>
                <span className="grow"><b>{t.label}</b><br /><span className="tiny muted">{t.desc}</span></span>
                <ChevronRight size={18} />
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="c" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <button className="icon-upload" onClick={() => input.current?.click()}>
              {preview ? <img src={preview} alt="" /> : <><Camera size={26} /><span>UPLOAD</span></>}
              <span className="icon-upload-plus">+</span>
            </button>
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIcon(f); setPreview(URL.createObjectURL(f)); } }} />
            <Field label="Server name" required>
              <input className="input" value={name} maxLength={100} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void create()} />
            </Field>
            <p className="tiny muted">By creating a server, you agree to keep it a friendly place.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

export function JoinServerModal({ code: initial }: { code?: string }) {
  const [code, setCode] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function join() {
    setBusy(true);
    try { await joinByInvite(code); closeModal(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }
  return (
    <Modal title="Join a Server" subtitle="Enter an invite below to join an existing server." center
      footer={<><button className="btn ghost" onClick={() => { closeModal(); openModal({ kind: 'createServer' }); }}>Back</button><span className="spacer" /><button className="btn" disabled={!code || busy} onClick={() => void join()}>{busy ? <Spinner /> : 'Join Server'}</button></>}>
      <Field label="Invite link" required error={err}>
        <input className="input" autoFocus placeholder="https://…/#/invite/hTKzmak or hTKzmak" value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && void join()} />
      </Field>
      <div className="label">Invites should look like</div>
      <div className="muted small mono">hTKzmak<br />{inviteUrl('hTKzmak')}</div>
      <button className="discover-promo" onClick={() => { closeModal(); navigate({ kind: 'discover' }); }}>
        <span className="template-icon"><Globe /></span>
        <span className="grow"><b>Don’t have an invite?</b><br /><span className="tiny muted">Check out public communities in Discover.</span></span>
        <ChevronRight size={18} />
      </button>
    </Modal>
  );
}

// ---------------------------------------------------------------- channels

const CHANNEL_TYPES = [
  { id: 'text', label: 'Text', desc: 'Send messages, images, GIFs, emoji, opinions, and puns', icon: <Hash /> },
  { id: 'voice', label: 'Voice', desc: 'Hang out together with voice, video, and screen share', icon: <Volume2 /> },
  { id: 'forum', label: 'Forum', desc: 'Create a space for organized discussions', icon: <MessagesSquare /> },
  { id: 'announcement', label: 'Announcement', desc: 'Important updates — only moderators can post', icon: <Megaphone /> },
  { id: 'stage', label: 'Stage', desc: 'Host events with speakers and an audience', icon: <Radio /> },
] as const;

export function CreateChannelModal({ serverId, parentId, type: initialType }: { serverId: string; parentId: string | null; type?: string }) {
  const isCategory = initialType === 'category';
  const [type, setType] = useState<Channel['type']>(isCategory ? 'category' : 'text');
  const [name, setName] = useState('');
  const [priv, setPriv] = useState(false);
  const [allow, setAllow] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const roles = serverRoles(serverId).filter((r) => !r.is_default);
  const parent = useData((s) => (parentId ? s.channels[parentId] : undefined));
  const textual = type === 'text' || type === 'announcement' || type === 'forum';
  async function create() {
    setBusy(true);
    try {
      const ch = await createChannel(serverId, { name: textual ? sanitizeChannelName(name) : name.trim(), type, parent_id: parentId, private: priv, allowRoles: allow });
      closeModal();
      if (ch.type === 'voice' || ch.type === 'stage') setUI({ voiceView: null });
      else if (ch.type !== 'category') navigate({ kind: 'server', serverId, channelId: ch.id });
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={480} title={isCategory ? 'Create Category' : 'Create Channel'} subtitle={parent ? `in ${parent.name}` : undefined}
      footer={<><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={!name.trim() || busy} onClick={() => void create()}>{busy ? <Spinner /> : isCategory ? 'Create Category' : 'Create Channel'}</button></>}>
      {!isCategory && (
        <>
          <div className="label" style={{ marginBottom: 8 }}>Channel Type</div>
          {CHANNEL_TYPES.map((t) => (
            <button key={t.id} className={cn('radio-card', type === t.id && 'on')} onClick={() => setType(t.id)}>
              <span className="ic">{t.icon}</span>
              <span className="grow"><span className="t">{t.label}</span><br /><span className="d">{t.desc}</span></span>
              <span className="radio-dot" />
            </button>
          ))}
        </>
      )}
      <Field label={isCategory ? 'Category Name' : 'Channel Name'} required>
        <div className="input-wrap">
          {isCategory ? <Folder /> : type === 'voice' ? <Volume2 /> : type === 'stage' ? <Radio /> : <Hash />}
          <input className="input" autoFocus value={name} placeholder={isCategory ? 'New Category' : textual ? 'new-channel' : 'New Channel'} maxLength={100} onChange={(e) => setName(textual ? e.target.value.toLowerCase().replace(/\s/g, '-') : e.target.value)} onKeyDown={(e) => e.key === 'Enter' && name.trim() && void create()} />
        </div>
      </Field>
      <div className="toggle-row">
        <div className="text">
          <div className="title row gap-6"><Lock size={16} /> Private {isCategory ? 'Category' : 'Channel'}</div>
          <div className="desc">Only selected roles (and admins) will be able to view it.</div>
        </div>
        <Switch on={priv} onChange={setPriv} />
      </div>
      {priv && roles.length > 0 && (
        <div className="role-allow">
          <div className="label">Who can access?</div>
          {roles.map((r) => (
            <label key={r.id} className="role-allow-row" onClick={() => setAllow((a) => (a.includes(r.id) ? a.filter((x) => x !== r.id) : [...a, r.id]))}>
              <CheckBox on={allow.includes(r.id)} />
              <span className="role-dot" style={{ background: r.color || 'var(--text-3)' }} />
              {r.name}
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- invite

export function InviteModal({ serverId, channelId }: { serverId: string; channelId: string | null }) {
  const server = useData((s) => s.servers[serverId]);
  const channel = useData((s) => (channelId ? s.channels[channelId] : undefined));
  const friends = useData(useShallow((s) => Object.values(s.relationships).filter((r) => r.type === 'friend').map((r) => r.target_id)));
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expire, setExpire] = useState<number | null>(168);
  const [maxUses, setMaxUses] = useState(0);
  const [sent, setSent] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  useEffect(() => {
    setCode(null);
    void createInvite(serverId, channelId, maxUses, expire).then((i) => setCode(i.code)).catch(toastError);
  }, [serverId, channelId, expire, maxUses]);
  const url = code ? inviteUrl(code) : '';
  async function sendTo(id: string) {
    const dm = await rpc<string>('open_dm', { p_user: id });
    await sendMessage(dm, { content: `You’re invited to join **${server?.name}** on Cityline! ${url}` });
    setSent((s) => [...s, id]);
  }
  return (
    <Modal width={460} title={`Invite friends to ${server?.name}`} subtitle={channel ? <span className="row gap-6"><Hash size={14} /> {channel.name}</span> : undefined}>
      {friends.length > 0 && (
        <div className="invite-friends scroll thin">
          {friends.map((id) => (
            <div key={id} className="invite-friend">
              <Avatar userId={id} size={32} />
              <span className="grow ellipsis"><NameTag userId={id} /></span>
              <button className={cn('btn sm', sent.includes(id) ? 'secondary' : 'outline')} disabled={!code || sent.includes(id)} onClick={() => void sendTo(id)}>{sent.includes(id) ? 'Sent' : 'Invite'}</button>
            </div>
          ))}
        </div>
      )}
      <div className="label" style={{ margin: friends.length > 0 ? '14px 0 8px' : '0 0 8px' }}>{friends.length > 0 ? 'Or, send a server invite link to a friend' : 'Send a server invite link to a friend'}</div>
      <div className={cn('invite-link', copied && 'copied')}>
        <input readOnly value={url || 'Creating invite…'} onFocus={(e) => e.target.select()} />
        <button className={cn('btn sm', copied && 'success')} disabled={!code} onClick={() => { void copyText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <><Check size={14} /> Copied</> : 'Copy'}</button>
      </div>
      <div className="tiny muted" style={{ marginTop: 8 }}>
        {expire ? `Your invite link expires in ${expire >= 24 ? `${expire / 24} day${expire === 24 ? '' : 's'}` : `${expire} hours`}.` : 'Your invite link never expires.'}{' '}
        <button className="btn link tiny" onClick={() => setSettings(!settings)}>Edit invite link.</button>
      </div>
      <AnimatePresence>
        {settings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="row gap-12" style={{ marginTop: 12 }}>
              <Field label="Expire after">
                <select className="select" value={expire ?? 0} onChange={(e) => setExpire(Number(e.target.value) || null)}>
                  <option value={1}>1 hour</option><option value={6}>6 hours</option><option value={24}>1 day</option><option value={168}>7 days</option><option value={0}>Never</option>
                </select>
              </Field>
              <Field label="Max uses">
                <select className="select" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))}>
                  <option value={0}>No limit</option><option value={1}>1 use</option><option value={5}>5 uses</option><option value={10}>10 uses</option><option value={25}>25 uses</option><option value={100}>100 uses</option>
                </select>
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}

// ---------------------------------------------------------------- boost

export function BoostModal({ serverId: initial }: { serverId?: string }) {
  const servers = useData((s) => s.servers);
  const [serverId] = useState(initial ?? Object.keys(servers)[0]);
  const server = servers[serverId];
  const myBoosts = useData((s) => s.myBoosts);
  const neon = useData((s) => s.profiles[s.me!]?.neon);
  const [busy, setBusy] = useState(false);
  if (!server) return null;
  const count = server.boost_count ?? 0;
  const level = boostLevel(count);
  const mine = myBoosts.filter((b) => b.server_id === serverId).length;
  return (
    <Modal width={560} bare>
      <div className="boost-modal">
        <div className="boost-hero">
          <div className="boost-rockets">{[0, 1, 2].map((i) => <motion.span key={i} animate={{ y: [0, -12, 0] }} transition={{ duration: 2 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}>🚀</motion.span>)}</div>
          <ServerIcon name={server.name} url={server.icon_url} size={64} />
          <h2>Boost {server.name}</h2>
          <p>{count} boost{count === 1 ? '' : 's'} · Level {level}</p>
        </div>
        <div className="boost-levels">
          {BOOST_LEVELS.slice(1).map((l) => (
            <div key={l.level} className={cn('boost-level', level >= l.level && 'reached')}>
              <div className="bl-head"><Rocket size={16} /> Level {l.level} <span className="tiny muted">{l.need} boosts</span>{level >= l.level && <Check size={16} className="green" />}</div>
              <ul>{l.perks.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          {mine > 0 && <button className="btn ghost" disabled={busy} onClick={async () => { setBusy(true); try { await removeBoost(serverId); } catch (e) { toastError(e); } setBusy(false); }}>Remove my boost</button>}
          <span className="spacer" />
          {neon === 'neon' ? (
            <button className="btn neon" disabled={busy || myBoosts.length >= 2} onClick={async () => { setBusy(true); try { await boostServer(serverId); closeModal(); } catch (e) { toastError(e); } setBusy(false); }}>
              {myBoosts.length >= 2 ? 'Both boosts in use' : busy ? <Spinner /> : <><Rocket size={16} /> Boost this server</>}
            </button>
          ) : (
            <button className="btn neon" onClick={() => { closeModal(); navigate({ kind: 'neon' }); }}><Sparkles size={16} /> Get Neon to boost</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- events

export function EventsModal({ serverId }: { serverId: string }) {
  const [events, setEvents] = useState<ServerEvent[] | null>(null);
  const [rsvps, setRsvps] = useState<{ event_id: string; user_id: string }[]>([]);
  const me = useData((s) => s.me!);
  const perms = useServerPerms(serverId);
  const channels = useData((s) => s.channels);
  const load = async () => {
    const ev = await listEvents(serverId);
    setEvents(ev);
    setRsvps(await listRsvps(ev.map((e) => e.id)));
  };
  useEffect(() => { void load().catch(() => setEvents([])); }, [serverId]);
  return (
    <Modal width={560} title={<span className="row gap-8"><CalendarDays /> Events</span>}
      footer={has(perms, P.MANAGE_EVENTS) ? <button className="btn" onClick={() => { closeModal(); openModal({ kind: 'createEvent', serverId }); }}>Create Event</button> : undefined}>
      {events === null && <div className="empty"><Spinner /></div>}
      {events?.length === 0 && <div className="empty"><div className="art">🗓️</div><h3>There are no upcoming events.</h3><p>Schedule an event for any planned activity in your server.</p></div>}
      {events?.map((e) => {
        const going = rsvps.filter((r) => r.event_id === e.id);
        const mine = going.some((r) => r.user_id === me);
        const live = new Date(e.starts_at) <= new Date() && (!e.ends_at || new Date(e.ends_at) > new Date());
        return (
          <motion.div key={e.id} className="event-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {e.image_url && <div className="event-img" style={{ backgroundImage: `url(${e.image_url})` }} />}
            <div className={cn('event-when', live && 'live')}><Clock size={14} /> {live ? 'Happening now' : formatFull(e.starts_at)}</div>
            <h3>{e.name}</h3>
            {e.description && <p className="muted small">{e.description}</p>}
            <div className="row gap-8 small muted" style={{ marginTop: 6 }}>
              {e.channel_id && channels[e.channel_id] ? <span className="row gap-4"><Volume2 size={14} /> {channels[e.channel_id].name}</span> : e.location ? <span className="row gap-4"><MapPin size={14} /> {e.location}</span> : null}
              <span className="row gap-4"><Users size={14} /> {going.length} interested</span>
            </div>
            <div className="row gap-8" style={{ marginTop: 10 }}>
              <button className={cn('btn sm', mine ? 'secondary' : '')} onClick={async () => { await toggleRsvp(e.id, !mine).catch(toastError); await load(); }}>{mine ? <><Check size={14} /> Interested</> : 'Interested'}</button>
              {(e.creator_id === me || has(perms, P.MANAGE_EVENTS)) && <button className="btn sm ghost" onClick={async () => { await deleteEvent(e.id).catch(toastError); await load(); }}><Trash2 size={14} /> Cancel event</button>}
            </div>
          </motion.div>
        );
      })}
    </Modal>
  );
}

export function CreateEventModal({ serverId }: { serverId: string }) {
  const voiceChannels = useData(useShallow((s) => Object.values(s.channels).filter((c) => c.server_id === serverId && (c.type === 'voice' || c.type === 'stage'))));
  const [where, setWhere] = useState<'voice' | 'elsewhere'>(voiceChannels.length ? 'voice' : 'elsewhere');
  const [channelId, setChannelId] = useState(voiceChannels[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const def = new Date(Date.now() + 86400000);
  def.setMinutes(0, 0, 0);
  const [start, setStart] = useState(toLocalInput(def));
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await saveEvent({ server_id: serverId, name: name.trim(), description: desc, starts_at: new Date(start).toISOString(), channel_id: where === 'voice' ? channelId || null : null, location: where === 'elsewhere' ? location : null });
      closeModal();
      toast('Event created', 'success', '🗓️');
      openModal({ kind: 'events', serverId });
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal width={500} title="Create an Event" subtitle="Tell people what’s happening and when."
      footer={<><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy || !name.trim()} onClick={() => void save()}>{busy ? <Spinner /> : 'Create Event'}</button></>}>
      <div className="label" style={{ marginBottom: 8 }}>Where is your event?</div>
      <button className={cn('radio-card', where === 'voice' && 'on')} onClick={() => setWhere('voice')} disabled={!voiceChannels.length}><span className="ic"><Volume2 /></span><span className="grow"><span className="t">Voice Channel</span><br /><span className="d">Hang out with voice, video and screen share</span></span><span className="radio-dot" /></button>
      <button className={cn('radio-card', where === 'elsewhere' && 'on')} onClick={() => setWhere('elsewhere')}><span className="ic"><MapPin /></span><span className="grow"><span className="t">Somewhere Else</span><br /><span className="d">A link or a place in the real world</span></span><span className="radio-dot" /></button>
      {where === 'voice' ? (
        <Field label="Channel"><select className="select" value={channelId} onChange={(e) => setChannelId(e.target.value)}>{voiceChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      ) : (
        <Field label="Location"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add a location, link or something" /></Field>
      )}
      <Field label="Event topic" required><input className="input" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="What’s your event?" /></Field>
      <Field label="Start"><input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      <Field label="Description"><textarea className="textarea" value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} placeholder="Tell people a little more about your event." /></Field>
    </Modal>
  );
}

export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------------------------- leaderboard (new)

export function LeaderboardModal({ serverId }: { serverId: string }) {
  const [rows, setRows] = useState<{ user_id: string; xp: number }[] | null>(null);
  const me = useData((s) => s.me);
  const server = useData((s) => s.servers[serverId]);
  useEffect(() => { void leaderboard(serverId).then(setRows).catch(() => setRows([])); }, [serverId]);
  const medal = ['🥇', '🥈', '🥉'];
  return (
    <Modal width={520} title={<span className="row gap-8"><Trophy className="gold-text" /> {server?.name} Leaderboard</span>} subtitle="Earn XP by chatting (once a minute). Level up to climb the city skyline! ✨">
      {rows === null && <div className="empty"><Spinner /></div>}
      <div className="leaderboard">
        {rows?.map((r, i) => {
          const lv = levelFromXp(r.xp);
          return (
            <motion.div key={r.user_id} className={cn('lb-row', r.user_id === me && 'me', i < 3 && 'top')} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <span className="lb-rank">{medal[i] ?? `#${i + 1}`}</span>
              <Avatar userId={r.user_id} serverId={serverId} size={36} />
              <div className="grow" style={{ minWidth: 0 }}>
                <NameTag userId={r.user_id} serverId={serverId} className="bold ellipsis" />
                <div className="progress neon" style={{ marginTop: 6 }}><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
              </div>
              <div className="lb-level"><b>Lv {lv.level}</b><span className="tiny muted">{r.xp.toLocaleString()} XP</span></div>
            </motion.div>
          );
        })}
        {rows?.length === 0 && <div className="empty"><div className="art">🏆</div><p>No XP yet — start chatting!</p></div>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- catch up (new)

export function CatchUpModal({ serverId }: { serverId: string }) {
  const [data, setData] = useState<{ messages: Message[]; unread_messages: number; channels: number } | null>(null);
  const server = useData((s) => s.servers[serverId]);
  useEffect(() => { void loadCatchUp(serverId).then(setData).catch(() => setData({ messages: [], unread_messages: 0, channels: 0 })); }, [serverId]);
  return (
    <Modal width={620} title={<span className="row gap-8"><Sparkles className="neon-icon" /> Catch Up <span className="tag-new">NEW</span></span>}
      subtitle={data ? `${data.unread_messages} new messages across ${data.channels} channel${data.channels === 1 ? '' : 's'} in ${server?.name}. Here’s what people are talking about most.` : 'Finding the highlights…'}
      footer={<><span className="spacer" /><button className="btn secondary" onClick={async () => { await markServerRead(serverId); closeModal(); }}>Mark all as read</button></>}>
      {data === null && <div className="empty"><Spinner lg /></div>}
      {data?.messages.length === 0 && <div className="empty"><div className="art">☕</div><h3>You’re all caught up!</h3><p>Nothing new since you last looked.</p></div>}
      <div className="catchup-list">
        {data?.messages.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <MessageCard m={m} showChannel onJump={() => {
              const ch = getData().channels[m.channel_id];
              closeModal();
              if (ch?.type === 'thread') setUI({ threadId: ch.id, rightPanel: 'thread' });
              else navigate({ kind: 'server', serverId, channelId: m.channel_id });
              setUI({ jumpTo: { channelId: m.channel_id, messageId: m.id, at: Date.now() } });
            }} extra={(m.reactions?.length ?? 0) > 0 ? <div className="tiny muted">{m.reactions!.map((r) => `${r.emoji.startsWith('<') ? '✨' : r.emoji} ${r.count + r.super_count}`).join('  ')}</div> : null} />
          </motion.div>
        ))}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- server profile / nickname

export function NicknameModal({ serverId, userId }: { serverId: string; userId: string }) {
  const me = useData((s) => s.me);
  const self = me === userId;
  const current = useData((s) => (s.members[serverId]?.[userId] ?? (self ? s.memberships[serverId] : undefined))?.nickname ?? '');
  const neon = useData((s) => s.profiles[s.me!]?.neon === 'neon');
  const [nick, setNick] = useState(current);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  async function save() {
    setBusy(true);
    try { await setNickname(serverId, userId, nick); closeModal(); toast('Saved', 'success'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal title={self ? 'Edit Server Profile' : 'Change Nickname'} subtitle={self ? 'Your nickname and avatar here only apply to this server.' : `Changing ${displayName(userId, serverId)}’s nickname`}
      footer={<><button className="btn ghost" onClick={() => setNick('')}>Reset</button><span className="spacer" /><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn" disabled={busy} onClick={() => void save()}>{busy ? <Spinner /> : 'Save'}</button></>}>
      <Field label="Nickname"><input className="input" value={nick} maxLength={32} autoFocus placeholder={getData().profiles[userId]?.display_name ?? ''} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} /></Field>
      {self && (
        <div className="notice neon">
          <Sparkles />
          <div className="grow">
            <b>Per-server avatar</b> {neon ? '— upload a different avatar just for this server.' : 'is a Neon perk.'}
            {neon && (
              <div className="row gap-8" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={() => file.current?.click()}>Upload</button>
                <button className="btn sm secondary" onClick={() => void setServerAvatar(serverId, null).then(() => toast('Server avatar removed'))}>Remove</button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void setServerAvatar(serverId, f).then(() => toast('Server avatar updated', 'success')).catch(toastError); }} />
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- moderation

export function ModerateModal({ serverId, userId, action }: { serverId: string; userId: string; action: 'kick' | 'ban' | 'timeout' }) {
  const name = displayName(userId, serverId);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [hours, setHours] = useState(0);
  const [busy, setBusy] = useState(false);
  const titles = { kick: `Kick ${name} from server`, ban: `Ban ${name}`, timeout: `Timeout ${name}` };
  async function go() {
    setBusy(true);
    try {
      if (action === 'kick') await kickMember(serverId, userId, reason);
      if (action === 'ban') await banMember(serverId, userId, reason, hours);
      if (action === 'timeout') await timeoutMember(serverId, userId, minutes, reason);
      toast(action === 'kick' ? `${name} was kicked` : action === 'ban' ? `${name} was banned` : `${name} was timed out`, 'success', '🔨');
      closeModal();
    } catch (e) { toastError(e); }
    setBusy(false);
  }
  return (
    <Modal title={titles[action]} subtitle={action === 'kick' ? 'They will be able to rejoin with a new invite.' : action === 'ban' ? 'They won’t be able to rejoin.' : 'Timed-out members can read but not chat, react or speak.'}
      footer={<><button className="btn ghost" onClick={closeModal}>Cancel</button><button className="btn danger" disabled={busy} onClick={() => void go()}>{busy ? <Spinner /> : action === 'kick' ? 'Kick' : action === 'ban' ? 'Ban' : 'Timeout'}</button></>}>
      {action === 'timeout' && (
        <Field label="Duration">
          <div className="chips-wrap">
            {[[1, '60 secs'], [5, '5 mins'], [10, '10 mins'], [60, '1 hour'], [1440, '1 day'], [10080, '1 week']].map(([m, l]) => (
              <button key={m} className={cn('chip', minutes === m && 'on')} onClick={() => setMinutes(Number(m))}>{l}</button>
            ))}
          </div>
        </Field>
      )}
      {action === 'ban' && (
        <Field label="Delete message history">
          <select className="select" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
            <option value={0}>Don’t delete any</option><option value={1}>Previous hour</option><option value={24}>Previous 24 hours</option><option value={168}>Previous 7 days</option>
          </select>
        </Field>
      )}
      <Field label="Reason (optional)"><textarea className="textarea" value={reason} maxLength={512} onChange={(e) => setReason(e.target.value)} placeholder="Shown in the audit log" /></Field>
    </Modal>
  );
}

