import { Check, Minus, Plus, Search, Trash2, X, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { Field, Range, ToggleRow } from '../../components/ui/Controls';
import { NameTag } from '../../components/ui/NameTag';
import { big, P, PERMISSION_GROUPS, type PermName } from '../../lib/permissions';
import type { Channel, ForumTag, Overwrite } from '../../lib/types';
import { cn, sanitizeChannelName, uuid } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { displayName, serverRoles } from '../../store/selectors';
import { closeModal, openModal, toast, toastError } from '../../store/ui';
import { deleteChannel, removeOverwrite, setOverwrite, updateChannel } from '../../store/actions/servers';
import { SaveBar, SettingsHeader, SettingsLayout, type SettingsTab } from './SettingsLayout';
import { useShallow } from 'zustand/react/shallow';

const SLOWMODE = [0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600];
const slowLabel = (s: number) => (s === 0 ? 'Off' : s < 60 ? `${s}s` : s < 3600 ? `${s / 60}m` : `${s / 3600}h`);

export function ChannelSettings({ channelId, tab }: { channelId: string; tab?: string }) {
  const ch = useData((s) => s.channels[channelId]);
  const [active, setActive] = useState(tab ?? 'overview');
  if (!ch) return null;
  const isCat = ch.type === 'category';
  const tabs: SettingsTab[] = [
    { id: 'overview', label: 'Overview', section: isCat ? `${ch.name} — Category` : `#${ch.name}` },
    { id: 'permissions', label: 'Permissions', section: isCat ? `${ch.name} — Category` : `#${ch.name}` },
    ...(ch.type === 'forum' ? [{ id: 'tags', label: 'Forum Tags', section: `#${ch.name}` }] : []),
    { id: 'sep', label: '' },
    { id: 'delete', label: `Delete ${isCat ? 'Category' : 'Channel'}`, danger: true, onClick: () => openModal({ kind: 'confirm', title: `Delete ${isCat ? 'Category' : 'Channel'}`, danger: true, confirm: 'Delete', body: <>Are you sure you want to delete <b>{ch.name}</b>? This cannot be undone.</>, onConfirm: async () => { await deleteChannel(channelId); closeModal(); } }) },
  ];
  return (
    <SettingsLayout tabs={tabs} active={active} onTab={setActive}>
      {active === 'overview' && <Overview ch={ch} />}
      {active === 'permissions' && <Permissions ch={ch} />}
      {active === 'tags' && <ForumTags ch={ch} />}
    </SettingsLayout>
  );
}

function Overview({ ch }: { ch: Channel }) {
  const [draft, setDraft] = useState<Partial<Channel>>({});
  const [busy, setBusy] = useState(false);
  const v = <K extends keyof Channel>(k: K): Channel[K] => (k in draft ? (draft[k] as Channel[K]) : ch[k]);
  const textual = ['text', 'announcement', 'forum'].includes(ch.type);
  const voice = ch.type === 'voice' || ch.type === 'stage';
  async function save() {
    setBusy(true);
    try { await updateChannel(ch.id, { ...draft, ...(draft.name && textual ? { name: sanitizeChannelName(draft.name) } : {}) }); setDraft({}); toast('Saved', 'success'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  const slowIdx = Math.max(0, SLOWMODE.indexOf(v('slowmode_seconds')));
  return (
    <>
      <SettingsHeader title="Overview" />
      <Field label="Channel Name"><input className="input" value={v('name')} maxLength={100} onChange={(e) => setDraft((d) => ({ ...d, name: textual ? e.target.value.toLowerCase().replace(/\s/g, '-') : e.target.value }))} /></Field>
      {ch.type !== 'category' && (
        <Field label={ch.type === 'forum' ? 'Post Guidelines' : 'Channel Topic'} help="Markdown works here.">
          <textarea className="textarea" value={v('topic')} maxLength={1024} placeholder="Let everyone know how to use this channel!" onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))} />
        </Field>
      )}
      {(textual || ch.type === 'voice') && (
        <>
          <div className="label">Slowmode — {slowLabel(v('slowmode_seconds'))}</div>
          <Range value={slowIdx} min={0} max={SLOWMODE.length - 1} onChange={(i) => setDraft((d) => ({ ...d, slowmode_seconds: SLOWMODE[i] }))} />
          <div className="tiny muted" style={{ marginBottom: 14 }}>Members are limited to one message per interval, unless they have Manage Messages or Manage Channel.</div>
        </>
      )}
      {voice && (
        <>
          <div className="label">User Limit — {v('user_limit') || '∞'}</div>
          <Range value={v('user_limit')} min={0} max={99} onChange={(n) => setDraft((d) => ({ ...d, user_limit: n }))} />
        </>
      )}
      {ch.type !== 'category' && <ToggleRow title="Age-Restricted Channel" desc="Members will be asked to confirm they’re over 18 before viewing." on={v('nsfw')} onChange={(x) => setDraft((d) => ({ ...d, nsfw: x }))} />}
      <SaveBar show={Object.keys(draft).length > 0} busy={busy} onSave={() => void save()} onReset={() => setDraft({})} />
    </>
  );
}

function ForumTags({ ch }: { ch: Channel }) {
  const [tags, setTags] = useState<ForumTag[]>(ch.available_tags ?? []);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const save = (t: ForumTag[]) => { setTags(t); void updateChannel(ch.id, { available_tags: t }).catch(toastError); };
  return (
    <>
      <SettingsHeader title="Forum Tags" desc="Tags help people find and filter posts." />
      <div className="row gap-8" style={{ marginBottom: 14 }}>
        <input className="input" style={{ width: 70 }} placeholder="🏷️" value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
        <input className="input" placeholder="Tag name" value={name} maxLength={20} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={!name.trim() || tags.length >= 20} onClick={() => { save([...tags, { id: uuid().slice(0, 8), name: name.trim(), emoji: emoji || null }]); setName(''); setEmoji(''); }}><Plus size={14} /> Add</button>
      </div>
      <div className="chips-wrap">
        {tags.map((t) => <span key={t.id} className="chip">{t.emoji} {t.name} <button onClick={() => save(tags.filter((x) => x.id !== t.id))}><X size={12} /></button></span>)}
        {!tags.length && <span className="muted small">No tags yet.</span>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- permissions

type Tri = 'allow' | 'deny' | 'inherit';

function Permissions({ ch }: { ch: Channel }) {
  const overwrites = useData(useShallow((s) => s.overwrites[ch.id] ?? []));
  const rolesMap = useData((s) => s.roles);
  const roles = useMemo(() => serverRoles(ch.server_id!), [rolesMap, ch.server_id]);
  const everyone = roles.find((r) => r.is_default)!;
  const [target, setTarget] = useState<string>(everyone?.id);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const members = useData((s) => s.members[ch.server_id!]);
  const isPrivate = useMemo(() => { const o = overwrites.find((x) => x.target_id === everyone?.id); return !!o && (big(o.deny) & P.VIEW_CHANNEL) !== 0n; }, [overwrites, everyone]);
  const synced = ch.parent_id && overwrites.length === 0;
  const parent = useData((s) => (ch.parent_id ? s.channels[ch.parent_id] : undefined));
  const ow: Overwrite | undefined = overwrites.find((o) => o.target_id === target);
  const targets = [everyone?.id, ...overwrites.map((o) => o.target_id).filter((id) => id !== everyone?.id)];
  if (!everyone) return null;

  async function setBit(perm: PermName, state: Tri) {
    const bit = P[perm];
    let allow = big(ow?.allow), deny = big(ow?.deny);
    allow &= ~bit; deny &= ~bit;
    if (state === 'allow') allow |= bit;
    if (state === 'deny') deny |= bit;
    const type = getData().roles[target] ? 'role' : 'member';
    try {
      if (allow === 0n && deny === 0n && target !== everyone.id) await removeOverwrite(ch.id, target);
      else await setOverwrite(ch.id, target, type, allow, deny);
    } catch (e) { toastError(e); }
  }
  async function togglePrivate(v: boolean) {
    const o = overwrites.find((x) => x.target_id === everyone.id);
    let allow = big(o?.allow), deny = big(o?.deny);
    if (v) { deny |= P.VIEW_CHANNEL; allow &= ~P.VIEW_CHANNEL; } else deny &= ~P.VIEW_CHANNEL;
    try { await setOverwrite(ch.id, everyone.id, 'role', allow, deny); } catch (e) { toastError(e); }
  }
  const label = (id: string) => (getData().roles[id] ? getData().roles[id].name : displayName(id, ch.server_id));
  const state = (perm: PermName): Tri => (big(ow?.allow) & P[perm] ? 'allow' : big(ow?.deny) & P[perm] ? 'deny' : 'inherit');

  return (
    <>
      <SettingsHeader title="Channel Permissions" desc="Use permissions to customise who can do what in this channel." />
      {synced && parent && <div className="notice" style={{ marginBottom: 14 }}>Permissions are synced with the category <b>&nbsp;{parent.name}</b>. Changing them here un-syncs this channel.</div>}
      <div className="private-card">
        <div className="grow"><b>🔒 Private {ch.type === 'category' ? 'Category' : 'Channel'}</b><div className="tiny muted">Only members with the roles you add below (and admins) can see it.</div></div>
        <button className={cn('switch', isPrivate && 'on')} onClick={() => void togglePrivate(!isPrivate)} />
      </div>
      <div className="perm-editor">
        <div className="perm-targets">
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="label">Roles / Members</span><button className="icon-btn sm" onClick={() => setAdding(!adding)}><Plus /></button></div>
          {adding && (
            <div className="perm-add">
              <div className="input-wrap"><Search /><input className="input" autoFocus placeholder="Role or member" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              {roles.filter((r) => !r.is_default && !targets.includes(r.id) && r.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6).map((r) => (
                <button key={r.id} className="menu-item" onClick={() => { void setOverwrite(ch.id, r.id, 'role', isPrivate ? P.VIEW_CHANNEL : 0n, 0n).then(() => { setTarget(r.id); setAdding(false); }); }}>
                  <span className="role-dot" style={{ background: r.color || 'var(--text-3)' }} /> <span className="mi-label">{r.name}</span>
                </button>
              ))}
              {Object.values(members ?? {}).filter((m) => !targets.includes(m.user_id) && displayName(m.user_id, ch.server_id).toLowerCase().includes(q.toLowerCase())).slice(0, 5).map((m) => (
                <button key={m.user_id} className="menu-item" onClick={() => { void setOverwrite(ch.id, m.user_id, 'member', isPrivate ? P.VIEW_CHANNEL : 0n, 0n).then(() => { setTarget(m.user_id); setAdding(false); }); }}>
                  <Avatar userId={m.user_id} size={18} /> <span className="mi-label"><NameTag userId={m.user_id} serverId={ch.server_id} /></span>
                </button>
              ))}
            </div>
          )}
          {targets.map((id) => (
            <button key={id} className={cn('perm-target', target === id && 'on')} onClick={() => setTarget(id)}>
              {getData().roles[id] ? <span className="role-dot" style={{ background: getData().roles[id].color || 'var(--text-3)' }} /> : <Users size={14} />}
              <span className="ellipsis grow">{label(id)}</span>
              {id !== everyone.id && <span className="icon-btn sm" onClick={(e) => { e.stopPropagation(); void removeOverwrite(ch.id, id).then(() => setTarget(everyone.id)); }}><Trash2 /></span>}
            </button>
          ))}
        </div>
        <div className="perm-list grow">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="perm-group">
              <div className="label">{g.title}</div>
              {g.items.filter((it) => it.key !== 'ADMINISTRATOR' && it.key !== 'MANAGE_SERVER' && it.key !== 'KICK_MEMBERS' && it.key !== 'BAN_MEMBERS' && it.key !== 'VIEW_AUDIT_LOG' && it.key !== 'CHANGE_NICKNAME' && it.key !== 'MANAGE_NICKNAMES' && it.key !== 'MODERATE_MEMBERS' && it.key !== 'MANAGE_EXPRESSIONS').map((it) => (
                <div key={it.key} className="perm-row">
                  <div className="grow"><div className="bold">{it.label}</div><div className="tiny muted">{it.help}</div></div>
                  <TriSwitch value={state(it.key)} onChange={(s) => void setBit(it.key, s)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TriSwitch({ value, onChange }: { value: Tri; onChange: (v: Tri) => void }) {
  return (
    <div className="tri">
      <button className={cn('tri-btn deny', value === 'deny' && 'on')} onClick={() => onChange('deny')} aria-label="Deny"><X size={14} /></button>
      <button className={cn('tri-btn inherit', value === 'inherit' && 'on')} onClick={() => onChange('inherit')} aria-label="Inherit"><Minus size={14} /></button>
      <button className={cn('tri-btn allow', value === 'allow' && 'on')} onClick={() => onChange('allow')} aria-label="Allow"><Check size={14} /></button>
    </div>
  );
}

