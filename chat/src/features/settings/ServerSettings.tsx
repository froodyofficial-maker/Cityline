import { motion, Reorder } from 'motion/react';
import { ArrowLeft, Camera, ChevronRight, Crown, Hammer, Plus, Rocket, Search, Shield, Trash2, Upload, Users, X, Gem, Lock, GripVertical } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { ColorPicker, Field, Spinner, Switch, Tabs, ToggleRow } from '../../components/ui/Controls';
import { NameTag } from '../../components/ui/NameTag';
import { boostLevel, BOOST_LEVELS } from '../../lib/neon';
import { big, has, P, PERMISSION_GROUPS, type PermName } from '../../lib/permissions';
import type { AuditEntry, AutomodRule, Invite, Role, Server } from '../../lib/types';
import { cn, copyText, formatMessageTime, formatShortDate, inviteUrl, plural } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { displayName, serverRoles, useServerPerms } from '../../store/selectors';
import { closeModal, openMenu, openModal, toast, toastError } from '../../store/ui';
import {
  addEmoji, addRole, addSound, addSticker, deleteAutomod, deleteEmoji, deleteInvite, deleteRole, deleteServer, deleteSound, deleteSticker, getBans, listAutomod, listInvites, loadAudit, loadMembers,
  removeRole, renameEmoji, reorderRoles, saveAutomod, setNotification, unbanMember, updateRole, updateServer, uploadServerImage, createRole,
} from '../../store/actions/servers';
import { memberMenu } from '../members/MemberList';
import { SaveBar, SettingsHeader, SettingsLayout, type SettingsTab } from './SettingsLayout';
import { useShallow } from 'zustand/react/shallow';

export function ServerSettings({ serverId, tab }: { serverId: string; tab?: string }) {
  const server = useData((s) => s.servers[serverId]);
  const perms = useServerPerms(serverId);
  const isOwner = useData((s) => s.servers[serverId]?.owner_id === s.me);
  const [active, setActive] = useState(tab ?? (has(perms, P.MANAGE_SERVER) ? 'overview' : has(perms, P.MANAGE_ROLES) ? 'roles' : 'notifications'));
  useEffect(() => { void loadMembers(serverId); }, [serverId]);
  if (!server) return null;
  const tabs: SettingsTab[] = [
    ...(has(perms, P.MANAGE_SERVER) ? [{ id: 'overview', label: 'Overview', section: server.name }] : []),
    ...(has(perms, P.MANAGE_ROLES) ? [{ id: 'roles', label: 'Roles', section: server.name }] : []),
    ...(has(perms, P.MANAGE_EXPRESSIONS) ? [
      { id: 'emoji', label: 'Emoji', section: 'Expressions' }, { id: 'stickers', label: 'Stickers', section: 'Expressions' }, { id: 'soundboard', label: 'Soundboard', section: 'Expressions' },
    ] : []),
    { id: 'members', label: 'Members', section: 'User Management' },
    ...(has(perms, P.MANAGE_SERVER) ? [{ id: 'invites', label: 'Invites', section: 'User Management' }] : []),
    ...(has(perms, P.BAN_MEMBERS) ? [{ id: 'bans', label: 'Bans', section: 'User Management' }] : []),
    ...(has(perms, P.MANAGE_SERVER) ? [{ id: 'automod', label: 'AutoMod', section: 'Moderation' }] : []),
    ...(has(perms, P.VIEW_AUDIT_LOG) ? [{ id: 'audit', label: 'Audit Log', section: 'Moderation' }] : []),
    ...(has(perms, P.MANAGE_SERVER) ? [{ id: 'discovery', label: 'Discovery', section: 'Community' }] : []),
    { id: 'boost', label: <span className="row gap-6">Server Boost <Rocket size={14} className="pink" /></span>, section: 'Boosts' },
    { id: 'notifications', label: 'My Notifications', section: 'You' },
    ...(isOwner ? [{ id: 'sep', label: '' }, { id: 'delete', label: 'Delete Server', danger: true, onClick: () => openModal({
      kind: 'confirm', title: `Delete '${server.name}'`, danger: true, confirm: 'Delete Server',
      body: <>Are you sure you want to delete <b>{server.name}</b>? This action cannot be undone — every channel and message will be gone.</>,
      onConfirm: async () => { await deleteServer(serverId); closeModal(); toast('Server deleted'); },
    }) }] : []),
  ];
  return (
    <SettingsLayout tabs={tabs} active={active} onTab={setActive}>
      {active === 'overview' && <Overview server={server} />}
      {active === 'roles' && <RolesTab serverId={serverId} />}
      {active === 'emoji' && <EmojiTab serverId={serverId} />}
      {active === 'stickers' && <StickersTab serverId={serverId} />}
      {active === 'soundboard' && <SoundsTab serverId={serverId} />}
      {active === 'members' && <MembersTab serverId={serverId} />}
      {active === 'invites' && <InvitesTab serverId={serverId} />}
      {active === 'bans' && <BansTab serverId={serverId} />}
      {active === 'automod' && <AutomodTab serverId={serverId} />}
      {active === 'discovery' && <DiscoveryTab server={server} />}
      {active === 'audit' && <AuditTab serverId={serverId} />}
      {active === 'boost' && <BoostTab server={server} />}
      {active === 'notifications' && <NotifTab serverId={serverId} />}
    </SettingsLayout>
  );
}

// ---------------------------------------------------------------- overview

function Overview({ server }: { server: Server }) {
  const [draft, setDraft] = useState<Partial<Server>>({});
  const [busy, setBusy] = useState(false);
  const iconIn = useRef<HTMLInputElement>(null);
  const bannerIn = useRef<HTMLInputElement>(null);
  const channels = useData((s) => s.channels);
  const textChannels = useMemo(() => Object.values(channels).filter((c) => c.server_id === server.id && (c.type === 'text' || c.type === 'announcement')), [channels, server.id]);
  const v = <K extends keyof Server>(k: K): Server[K] => (k in draft ? (draft[k] as Server[K]) : server[k]);
  const level = boostLevel(server.boost_count);
  async function save() {
    setBusy(true);
    try { await updateServer(server.id, draft); setDraft({}); toast('Saved', 'success'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  async function upload(kind: 'icon' | 'banner', f: File) {
    if (kind === 'icon' && f.type === 'image/gif' && level < 1) { toast('Animated icons unlock at Boost Level 1', 'neon', '🚀'); return; }
    try { const url = await uploadServerImage(f, kind); setDraft((d) => ({ ...d, [kind === 'icon' ? 'icon_url' : 'banner_url']: url })); } catch (e) { toastError(e); }
  }
  return (
    <>
      <SettingsHeader title="Server Overview" />
      <div className="overview-grid">
        <div className="overview-icon">
          <button className="icon-upload big" onClick={() => iconIn.current?.click()}>
            {v('icon_url') ? <img src={v('icon_url')!} alt="" /> : <ServerIcon name={v('name')} size={100} />}
            <span className="icon-upload-hover"><Camera size={22} />CHANGE ICON</span>
          </button>
          {v('icon_url') && <button className="btn link small" onClick={() => setDraft((d) => ({ ...d, icon_url: null }))}>Remove</button>}
          <input ref={iconIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('icon', f); e.target.value = ''; }} />
        </div>
        <div className="grow">
          <Field label="Server Name"><input className="input" value={v('name')} maxLength={100} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
          <Field label="Description" help="Shown on invites and in Discover."><textarea className="textarea" value={v('description')} maxLength={300} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></Field>
        </div>
      </div>
      <div className="divider" />
      <Field label="System Messages Channel" help="Where we post welcome and boost messages.">
        <select className="select" value={v('system_channel_id') ?? ''} onChange={(e) => setDraft((d) => ({ ...d, system_channel_id: e.target.value || null }))}>
          <option value="">No system messages</option>
          {textChannels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
        </select>
      </Field>
      <Field label="Welcome message" help="Shown to new members in their first visit (optional).">
        <textarea className="textarea" value={v('welcome_message')} maxLength={500} onChange={(e) => setDraft((d) => ({ ...d, welcome_message: e.target.value }))} />
      </Field>
      <div className="label">Accent colour</div>
      <ColorPicker value={v('accent_color')} onChange={(c) => setDraft((d) => ({ ...d, accent_color: c }))} allowNone />
      <div style={{ marginTop: 16 }}>
        <ToggleRow title="Levels & XP" desc="Members earn XP for chatting and climb the server leaderboard." badge={<span className="tag-new">NEW</span>} on={v('xp_enabled')} onChange={(x) => setDraft((d) => ({ ...d, xp_enabled: x }))} />
      </div>
      <div className="divider" />
      <div className="label row gap-6">Server Banner {level < 2 && <span className="chip tiny"><Lock size={10} /> Boost Level 2</span>}</div>
      <div className="banner-upload" style={v('banner_url') ? { backgroundImage: `url(${v('banner_url')})` } : undefined}>
        <button className="btn sm" disabled={level < 2} onClick={() => bannerIn.current?.click()}><Upload size={14} /> Upload Banner</button>
        {v('banner_url') && <button className="btn sm secondary" onClick={() => setDraft((d) => ({ ...d, banner_url: null }))}>Remove</button>}
        <input ref={bannerIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload('banner', f); e.target.value = ''; }} />
      </div>
      <SaveBar show={Object.keys(draft).length > 0} busy={busy} onSave={() => void save()} onReset={() => setDraft({})} />
    </>
  );
}

function DiscoveryTab({ server }: { server: Server }) {
  const [tags, setTags] = useState(server.tags.join(', '));
  const TAGS = ['gaming', 'music', 'education', 'art', 'tech', 'entertainment', 'community'];
  return (
    <>
      <SettingsHeader title="Discovery" desc="List your server in Discover so anyone can find and join it." />
      <ToggleRow title="Public server" desc="Anyone on this Cityline site can see and join without an invite." on={server.is_public} onChange={(v) => void updateServer(server.id, { is_public: v }).then(() => toast(v ? 'Your server is now discoverable' : 'Server hidden from Discover', 'success')).catch(toastError)} />
      <Field label="Categories" help="Comma separated. Pick from: gaming, music, education, art, tech, entertainment, community.">
        <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => void updateServer(server.id, { tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter((t) => TAGS.includes(t)).slice(0, 3) }).catch(toastError)} />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------- roles

function RolesTab({ serverId }: { serverId: string }) {
  const rolesMap = useData((s) => s.roles);
  const roles = useMemo(() => serverRoles(serverId), [rolesMap, serverId]);
  const members = useData((s) => s.members[serverId]);
  const [editing, setEditing] = useState<string | null>(null);
  const [order, setOrder] = useState<Role[]>([]);
  useEffect(() => setOrder(roles.filter((r) => !r.is_default)), [roles]);
  const everyone = roles.find((r) => r.is_default);
  if (editing) return <RoleEditor key={editing} roleId={editing} serverId={serverId} onBack={() => setEditing(null)} />;
  const count = (id: string) => Object.values(members ?? {}).filter((m) => m.roles.includes(id)).length;
  return (
    <>
      <SettingsHeader title="Roles" desc="Use roles to group your members and assign permissions." />
      {everyone && (
        <button className="role-default-card" onClick={() => setEditing(everyone.id)}>
          <Users size={22} />
          <div className="grow"><b>Default Permissions</b><div className="tiny muted">@everyone · applies to all server members</div></div>
          <ChevronRight size={18} />
        </button>
      )}
      <div className="row" style={{ justifyContent: 'space-between', margin: '20px 0 8px' }}>
        <span className="muted small">Members use the colour of the highest role they have. Drag to reorder.</span>
        <button className="btn sm" onClick={async () => { try { const r = await createRole(serverId, { name: 'new role', color: '#99aab5', position: 1 }); setEditing(r.id); } catch (e) { toastError(e); } }}><Plus size={14} /> Create Role</button>
      </div>
      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="role-list">
        {order.map((r) => (
          <Reorder.Item key={r.id} value={r} className="role-row" onDragEnd={() => {
            const items = order.map((x, i) => ({ id: x.id, position: order.length - i }));
            void reorderRoles(serverId, items).catch(toastError);
          }}>
            <GripVertical size={16} className="muted grip" />
            <span className="role-dot" style={{ background: r.color || 'var(--text-3)' }} />
            {r.icon && <span>{r.icon}</span>}
            <span className="grow bold">{r.name}</span>
            <span className="muted small row gap-4"><Users size={14} /> {count(r.id)}</span>
            <button className="btn sm secondary" onClick={() => setEditing(r.id)}>Edit</button>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {!order.length && <div className="empty"><div className="art">🛡️</div><p>No roles yet. Create one to organise members and give them powers.</p></div>}
    </>
  );
}

function RoleEditor({ roleId, serverId, onBack }: { roleId: string; serverId: string; onBack: () => void }) {
  const role = useData((s) => s.roles[roleId]);
  const members = useData((s) => s.members[serverId]);
  const server = useData((s) => s.servers[serverId]);
  const [tab, setTab] = useState<'display' | 'permissions' | 'members'>('display');
  const [draft, setDraft] = useState<Partial<Role>>({});
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  if (!role) return null;
  const v = <K extends keyof Role>(k: K): Role[K] => (k in draft ? (draft[k] as Role[K]) : role[k]);
  const perms = big(v('permissions'));
  const level = boostLevel(server?.boost_count ?? 0);
  const togglePerm = (k: PermName) => setDraft((d) => ({ ...d, permissions: Number((has(perms, P[k]) ? perms & ~P[k] : perms | P[k])) }));
  async function save() {
    setBusy(true);
    try { await updateRole(roleId, draft); setDraft({}); toast('Role saved', 'success'); } catch (e) { toastError(e); }
    setBusy(false);
  }
  const holders = Object.values(members ?? {}).filter((m) => m.roles.includes(roleId));
  const others = Object.values(members ?? {}).filter((m) => !m.roles.includes(roleId) && displayName(m.user_id, serverId).toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  return (
    <>
      <button className="btn link" onClick={onBack}><ArrowLeft size={16} /> Back to roles</button>
      <SettingsHeader title={<span className="row gap-8"><span className="role-dot big" style={{ background: v('color') || 'var(--text-3)' }} /> Edit Role — {v('name')}</span>} />
      {!role.is_default && <Tabs layoutId="role-tabs" value={tab} onChange={setTab} tabs={[{ id: 'display', label: 'Display' }, { id: 'permissions', label: 'Permissions' }, { id: 'members', label: `Manage Members (${holders.length})` }]} />}
      {(tab === 'display' && !role.is_default) && (
        <>
          <Field label="Role name" required><input className="input" value={v('name')} maxLength={100} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></Field>
          <div className="label">Role colour</div>
          <ColorPicker value={v('color')} onChange={(c) => setDraft((d) => ({ ...d, color: c }))} allowNone />
          <div className="label row gap-6" style={{ marginTop: 16 }}>Gradient end colour {level < 2 && <span className="chip tiny"><Lock size={10} /> Boost Level 2</span>}</div>
          <div className={cn(level < 2 && 'locked')}><ColorPicker value={v('color2')} onChange={(c) => level >= 2 && setDraft((d) => ({ ...d, color2: c }))} allowNone /></div>
          <div className="role-preview">
            <span style={v('color') && v('color2') && level >= 2 ? { backgroundImage: `linear-gradient(90deg, ${v('color')}, ${v('color2')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', fontWeight: 700 } : { color: v('color') ?? undefined, fontWeight: 700 }}>{v('icon')} {getData().profiles[getData().me!]?.display_name ?? 'You'}</span>
            <span className="muted small"> — preview</span>
          </div>
          <Field label="Role icon (emoji)" help={level < 1 ? 'Unlocks at Boost Level 1' : 'Shown next to member names'}>
            <input className="input" style={{ maxWidth: 120 }} disabled={level < 1} value={v('icon') ?? ''} maxLength={4} onChange={(e) => setDraft((d) => ({ ...d, icon: e.target.value || null }))} />
          </Field>
          <ToggleRow title="Display role members separately from online members" on={v('hoist')} onChange={(x) => setDraft((d) => ({ ...d, hoist: x }))} />
          <ToggleRow title="Allow anyone to @mention this role" desc="Members with Mention @everyone can always ping it." on={v('mentionable')} onChange={(x) => setDraft((d) => ({ ...d, mentionable: x }))} />
          <div className="settings-block danger-zone">
            <button className="btn danger sm" onClick={() => openModal({ kind: 'confirm', title: 'Delete Role', danger: true, confirm: 'Delete', body: <>Delete the role <b>{role.name}</b>?</>, onConfirm: async () => { await deleteRole(roleId); onBack(); } })}><Trash2 size={14} /> Delete Role</button>
          </div>
        </>
      )}
      {(tab === 'permissions' || role.is_default) && (
        <div className="perm-list">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g.title} className="perm-group">
              <div className="label">{g.title} Permissions</div>
              {g.items.map((it) => (
                <div key={it.key} className="perm-row">
                  <div className="grow"><div className="bold">{it.label}</div><div className="tiny muted">{it.help}</div></div>
                  <Switch on={has(perms, P[it.key])} onChange={() => togglePerm(it.key)} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {tab === 'members' && !role.is_default && (
        <>
          <div className="input-wrap" style={{ marginBottom: 10 }}><Search /><input className="input" placeholder="Add members" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {q && others.map((m) => (
            <button key={m.user_id} className="member-pick" onClick={() => void addRole(serverId, m.user_id, roleId).catch(toastError)}>
              <Avatar userId={m.user_id} size={28} /> <NameTag userId={m.user_id} serverId={serverId} /> <Plus size={14} className="muted" />
            </button>
          ))}
          <div className="label" style={{ margin: '12px 0 6px' }}>Members with this role</div>
          {holders.map((m) => (
            <div key={m.user_id} className="account-row">
              <Avatar userId={m.user_id} size={28} /><span className="grow"><NameTag userId={m.user_id} serverId={serverId} /></span>
              <button className="icon-btn sm" onClick={() => void removeRole(serverId, m.user_id, roleId).catch(toastError)}><X /></button>
            </div>
          ))}
        </>
      )}
      <SaveBar show={Object.keys(draft).length > 0} busy={busy} onSave={() => void save()} onReset={() => setDraft({})} />
    </>
  );
}

// ---------------------------------------------------------------- expressions

function EmojiTab({ serverId }: { serverId: string }) {
  const emojis = useData(useShallow((s) => Object.values(s.emojis).filter((e) => e.server_id === serverId)));
  const server = useData((s) => s.servers[serverId]);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const max = [50, 100, 150, 250][boostLevel(server?.boost_count ?? 0)];
  async function add(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const name = f.name.replace(/\.\w+$/, '').replace(/[^A-Za-z0-9_]/g, '_').slice(0, 32).padEnd(2, '_');
      try { await addEmoji(serverId, name, f); } catch (e) { toastError(e); }
    }
    setBusy(false);
  }
  return (
    <>
      <SettingsHeader title="Emoji" desc={`Add up to ${max} custom emoji that anyone can use in this server. Neon members can use them everywhere.`} />
      <div className="notice"><span className="grow">Square PNG, WebP or GIF works best. Names: letters, numbers and underscores.</span></div>
      <div className="row gap-8" style={{ margin: '16px 0' }}>
        <button className="btn" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Spinner /> : <><Upload size={16} /> Upload Emoji</>}</button>
        <span className="muted small">{emojis.length} / {max} slots used</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      </div>
      <div className="progress neon" style={{ marginBottom: 16 }}><i style={{ width: `${(emojis.length / max) * 100}%` }} /></div>
      <div className="emoji-table">
        {emojis.map((e) => (
          <div key={e.id} className="emoji-row">
            <img src={e.url} alt="" />
            <input className="input" defaultValue={e.name} onBlur={(ev) => { const n = ev.target.value.replace(/[^A-Za-z0-9_]/g, ''); if (n !== e.name && n.length >= 2) void renameEmoji(e.id, n).catch(toastError); }} />
            <span className="row gap-6 small muted grow"><Avatar userId={e.created_by} size={18} /> {displayName(e.created_by)}</span>
            <button className="icon-btn danger" onClick={() => void deleteEmoji(e.id).catch(toastError)}><Trash2 /></button>
          </div>
        ))}
      </div>
    </>
  );
}

function StickersTab({ serverId }: { serverId: string }) {
  const stickers = useData(useShallow((s) => Object.values(s.stickers).filter((x) => x.server_id === serverId)));
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  return (
    <>
      <SettingsHeader title="Stickers" desc="Big, expressive images for your members — PNG, APNG, WebP or GIF up to 512 KB." />
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Sticker name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={name.length < 2} onClick={() => input.current?.click()}><Upload size={16} /> Upload Sticker</button>
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { if (f.size > 512 * 1024) toast('Stickers can be up to 512 KB', 'error'); else void addSticker(serverId, name, f).then(() => setName('')).catch(toastError); } e.target.value = ''; }} />
      </div>
      <div className="sticker-admin">
        {stickers.map((s) => (
          <div key={s.id} className="sticker-admin-item">
            <img src={s.url} alt={s.name} />
            <span className="ellipsis">{s.name}</span>
            <button className="icon-btn sm danger" onClick={() => void deleteSticker(s.id).catch(toastError)}><Trash2 /></button>
          </div>
        ))}
        {!stickers.length && <div className="muted small">No stickers yet.</div>}
      </div>
    </>
  );
}

function SoundsTab({ serverId }: { serverId: string }) {
  const sounds = useData(useShallow((s) => Object.values(s.sounds).filter((x) => x.server_id === serverId)));
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🔊');
  return (
    <>
      <SettingsHeader title="Soundboard" desc="Upload short sounds (MP3, OGG, WAV — up to 1 MB) everyone can play in voice channels." />
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <input className="input" style={{ width: 70 }} value={emoji} maxLength={4} onChange={(e) => setEmoji(e.target.value)} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="Sound name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={name.length < 2} onClick={() => input.current?.click()}><Upload size={16} /> Upload Sound</button>
        <input ref={input} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void addSound(serverId, name, emoji, f).then(() => setName('')).catch(toastError); e.target.value = ''; }} />
      </div>
      {sounds.map((s) => (
        <div key={s.id} className="account-row">
          <span style={{ fontSize: 22 }}>{s.emoji}</span>
          <span className="grow bold">{s.name}</span>
          <button className="btn sm secondary" onClick={() => new Audio(s.url).play()}>Preview</button>
          <button className="icon-btn danger" onClick={() => void deleteSound(s.id).catch(toastError)}><Trash2 /></button>
        </div>
      ))}
      {!sounds.length && <div className="muted small">No custom sounds yet — the built-in Cityline Classics are always available.</div>}
    </>
  );
}

// ---------------------------------------------------------------- members, invites, bans

function MembersTab({ serverId }: { serverId: string }) {
  const members = useData((s) => s.members[serverId]);
  const owner = useData((s) => s.servers[serverId]?.owner_id);
  const roles = useData((s) => s.roles);
  const [q, setQ] = useState('');
  const list = useMemo(() => Object.values(members ?? {}).filter((m) => displayName(m.user_id, serverId).toLowerCase().includes(q.toLowerCase()) || getData().profiles[m.user_id]?.username.includes(q.toLowerCase())), [members, q, serverId]);
  return (
    <>
      <SettingsHeader title="Server Members" desc={plural(Object.keys(members ?? {}).length, 'member')} />
      <div className="input-wrap" style={{ marginBottom: 12 }}><Search /><input className="input" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="members-table">
        {list.map((m) => (
          <div key={m.user_id} className="members-row" onContextMenu={(e) => openMenu(e, memberMenu(m.user_id, serverId))}>
            <Avatar userId={m.user_id} size={36} serverId={serverId} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-4"><NameTag userId={m.user_id} serverId={serverId} className="bold" />{owner === m.user_id && <Crown size={14} className="owner-crown" />}</div>
              <div className="tiny muted">{getData().profiles[m.user_id]?.username} · joined {formatShortDate(m.joined_at)}{m.timeout_until && new Date(m.timeout_until) > new Date() ? ' · ⏳ timed out' : ''}</div>
            </div>
            <div className="members-roles">{m.roles.slice(0, 3).map((r) => roles[r] && <span key={r} className="role-chip"><span className="role-dot" style={{ background: roles[r].color || 'var(--text-3)' }} />{roles[r].name}</span>)}{m.roles.length > 3 && <span className="tiny muted">+{m.roles.length - 3}</span>}</div>
            <button className="icon-btn" onClick={(e) => openMenu(e, memberMenu(m.user_id, serverId))}><Shield /></button>
          </div>
        ))}
      </div>
    </>
  );
}

function InvitesTab({ serverId }: { serverId: string }) {
  const [list, setList] = useState<Invite[] | null>(null);
  const channels = useData((s) => s.channels);
  useEffect(() => { void listInvites(serverId).then(setList).catch(() => setList([])); }, [serverId]);
  return (
    <>
      <SettingsHeader title="Invites" desc="Here’s a list of all active invite links. You can revoke any one." />
      {list === null && <Spinner />}
      {list?.length === 0 && <div className="muted small">No invites yet.</div>}
      {list?.map((i) => {
        const expired = !!i.expires_at && new Date(i.expires_at) < new Date();
        return (
          <div key={i.code} className={cn('account-row', expired && 'dim')}>
            <Avatar userId={i.inviter_id} size={28} />
            <div className="grow"><b className="mono">{i.code}</b><div className="tiny muted">by {displayName(i.inviter_id)} · {i.channel_id && channels[i.channel_id] ? `#${channels[i.channel_id].name}` : 'server'} · {i.uses}{i.max_uses ? `/${i.max_uses}` : ''} uses · {i.expires_at ? (expired ? 'expired' : `expires ${formatMessageTime(i.expires_at)}`) : 'never expires'}</div></div>
            <button className="btn sm secondary" onClick={() => { void copyText(inviteUrl(i.code)); toast('Copied', 'success'); }}>Copy</button>
            <button className="icon-btn danger" onClick={async () => { await deleteInvite(i.code).catch(toastError); setList((l) => l?.filter((x) => x.code !== i.code) ?? null); }}><X /></button>
          </div>
        );
      })}
    </>
  );
}

function BansTab({ serverId }: { serverId: string }) {
  const [bans, setBans] = useState<Awaited<ReturnType<typeof getBans>> | null>(null);
  useEffect(() => { void getBans(serverId).then(setBans).catch(() => setBans([])); }, [serverId]);
  return (
    <>
      <SettingsHeader title="Bans" desc="Banned people can’t rejoin, even with an invite." />
      {bans === null && <Spinner />}
      {bans?.length === 0 && <div className="empty"><div className="art">🕊️</div><p>No bans. A peaceful city!</p></div>}
      {bans?.map((b) => (
        <div key={b.user_id} className="account-row">
          <Avatar url={b.profile?.avatar_url} name={b.profile?.username} size={32} />
          <div className="grow"><b>{b.profile?.display_name || b.profile?.username}</b><div className="tiny muted">{b.reason || 'No reason given'} · {formatShortDate(b.created_at)}</div></div>
          <button className="btn sm secondary" onClick={async () => { await unbanMember(serverId, b.user_id).catch(toastError); setBans((l) => l?.filter((x) => x.user_id !== b.user_id) ?? null); }}>Revoke Ban</button>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- automod

const RULE_TYPES: { id: AutomodRule['type']; title: string; desc: string; icon: string }[] = [
  { id: 'keyword', title: 'Block custom words', desc: 'Stop messages containing words you choose.', icon: '🚫' },
  { id: 'links', title: 'Block links', desc: 'Nobody except moderators can post links.', icon: '🔗' },
  { id: 'invites', title: 'Block invite links', desc: 'Stop people advertising other servers.', icon: '📨' },
  { id: 'mention_spam', title: 'Block mention spam', desc: 'Block messages with too many mentions.', icon: '📣' },
  { id: 'caps', title: 'Block SHOUTING', desc: 'Block messages that are mostly capital letters.', icon: '🔠' },
];

function AutomodTab({ serverId }: { serverId: string }) {
  const [rules, setRules] = useState<AutomodRule[] | null>(null);
  const load = () => void listAutomod(serverId).then(setRules).catch(() => setRules([]));
  useEffect(load, [serverId]);
  return (
    <>
      <SettingsHeader title="AutoMod" desc="Automatically keep your server safe. Members with Manage Server are never blocked." />
      {RULE_TYPES.map((t) => {
        const rule = rules?.find((r) => r.type === t.id);
        return (
          <motion.div key={t.id} className={cn('automod-card', rule?.enabled && 'on')} layout>
            <div className="row gap-12">
              <span className="automod-icon">{t.icon}</span>
              <div className="grow"><b>{t.title}</b><div className="tiny muted">{t.desc}</div></div>
              <Switch on={!!rule?.enabled} onChange={async (v) => {
                try {
                  if (rule) await saveAutomod({ ...rule, enabled: v });
                  else await saveAutomod({ server_id: serverId, type: t.id, name: t.title, enabled: true, keywords: [], mention_limit: 5 });
                  load();
                } catch (e) { toastError(e); }
              }} />
            </div>
            {rule?.enabled && t.id === 'keyword' && (
              <Field label="Words (comma separated)" help="Matched anywhere in a message, ignoring case.">
                <textarea className="textarea" defaultValue={rule.keywords.join(', ')} onBlur={(e) => void saveAutomod({ ...rule, keywords: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) }).then(load).catch(toastError)} />
              </Field>
            )}
            {rule?.enabled && t.id === 'mention_spam' && (
              <Field label="Max mentions per message">
                <input className="input" type="number" min={1} max={50} defaultValue={rule.mention_limit} style={{ maxWidth: 120 }} onBlur={(e) => void saveAutomod({ ...rule, mention_limit: Number(e.target.value) || 5 }).then(load).catch(toastError)} />
              </Field>
            )}
            {rule && !rule.enabled && <button className="btn link small" onClick={() => void deleteAutomod(rule.id).then(load)}>Remove rule</button>}
          </motion.div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- audit

const ACTIONS: Record<string, string> = {
  channels_insert: 'created a channel', channels_update: 'updated a channel', channels_delete: 'deleted a channel',
  roles_insert: 'created a role', roles_update: 'updated a role', roles_delete: 'deleted a role',
  member_roles_insert: 'gave a role to', member_roles_delete: 'removed a role from',
  servers_update: 'updated the server', invites_insert: 'created an invite', invites_delete: 'revoked an invite',
  emojis_insert: 'added an emoji', emojis_delete: 'removed an emoji', permission_overwrites_insert: 'changed channel permissions',
  permission_overwrites_update: 'changed channel permissions', permission_overwrites_delete: 'removed a permission override',
  member_kick: 'kicked', member_ban: 'banned', member_unban: 'unbanned', member_timeout: 'timed out', member_timeout_remove: 'removed the timeout of',
  message_delete: 'deleted a message by',
};

function AuditTab({ serverId }: { serverId: string }) {
  const [rows, setRows] = useState<AuditEntry[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { void loadAudit(serverId).then(setRows).catch(() => setRows([])); }, [serverId]);
  const target = (e: AuditEntry) => {
    if (e.target_type === 'member' || e.action.startsWith('member_roles')) return <b>{displayName(e.target_id)}</b>;
    const c = e.changes as Record<string, unknown> | null;
    const name = (c?.name as string) ?? ((c?.name as { new?: string })?.new);
    return name ? <b>{String(name)}</b> : null;
  };
  return (
    <>
      <SettingsHeader title="Audit Log" desc="Every important change, who made it and when." />
      {rows === null && <Spinner />}
      {rows?.length === 0 && <div className="muted small">Nothing logged yet.</div>}
      {rows?.map((e) => (
        <div key={e.id} className="audit-row" onClick={() => setOpen(open === e.id ? null : e.id)}>
          <Avatar userId={e.actor_id} size={32} />
          <div className="grow">
            <div><b>{displayName(e.actor_id)}</b> {ACTIONS[e.action] ?? e.action} {target(e)}</div>
            <div className="tiny muted">{formatMessageTime(e.created_at)}{e.reason ? ` · Reason: ${e.reason}` : ''}</div>
            {open === e.id && e.changes && <pre className="audit-changes">{JSON.stringify(e.changes, null, 2).slice(0, 1500)}</pre>}
          </div>
          <Hammer size={14} className="muted" />
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- boosts, notifications

function BoostTab({ server }: { server: Server }) {
  const count = server.boost_count ?? 0;
  const level = boostLevel(count);
  return (
    <>
      <SettingsHeader title="Server Boost Status" desc="Neon members can boost servers to unlock perks for everyone." />
      <div className="boost-status">
        <div className="boost-status-top"><Rocket size={28} /><div><h3>Level {level}</h3><span className="muted">{plural(count, 'Boost')}</span></div><span className="spacer" /><button className="btn neon" onClick={() => openModal({ kind: 'boost', serverId: server.id })}><Gem size={16} /> Boost This Server</button></div>
        <div className="boost-track">
          {BOOST_LEVELS.map((l) => <div key={l.level} className={cn('boost-step', level >= l.level && 'on')}><span>{l.level === 0 ? 'Start' : `Lvl ${l.level}`}</span><i /><small>{l.need}</small></div>)}
        </div>
      </div>
      {BOOST_LEVELS.slice(1).map((l) => (
        <div key={l.level} className={cn('boost-level', level >= l.level && 'reached')}>
          <div className="bl-head"><Rocket size={16} /> Level {l.level} perks</div>
          <ul>{l.perks.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      ))}
    </>
  );
}

function NotifTab({ serverId }: { serverId: string }) {
  const n = useData((s) => s.notif[serverId]);
  const level = n?.level && n.level !== 'default' ? n.level : 'mentions';
  return (
    <>
      <SettingsHeader title="Notification Settings" desc="Applies to this server only." />
      <ToggleRow title="Mute server" desc="Unread dots and notifications are hidden; mentions still show a badge." on={!!n?.muted} onChange={(v) => void setNotification(serverId, { muted: v })} />
      <div className="label" style={{ margin: '16px 0 8px' }}>Server Notification Settings</div>
      {(['all', 'mentions', 'nothing'] as const).map((l) => (
        <button key={l} className={cn('radio-card', level === l && 'on')} onClick={() => void setNotification(serverId, { level: l })}>
          <span className="grow"><span className="t">{l === 'all' ? 'All Messages' : l === 'mentions' ? 'Only @mentions' : 'Nothing'}</span></span>
          <span className="radio-dot" />
        </button>
      ))}
    </>
  );
}
