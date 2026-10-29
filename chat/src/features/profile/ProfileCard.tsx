import { motion } from 'motion/react';
import { Crown, Gem, Pencil, Plus, X, MessageSquare, UserPlus, Check, MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { LogoMark } from '../../components/Logo';
import { renderMarkdown } from '../../lib/markdown';
import { has, P } from '../../lib/permissions';
import { cn, formatShortDate, hashColor } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { memberOf, memberRoles, presenceStatus, serverPermsFor, serverRoles } from '../../store/selectors';
import type { Profile } from '../../lib/types';
import { openMenu, openModal, setUI, toast } from '../../store/ui';
import { addRole, removeRole } from '../../store/actions/servers';
import { acceptFriend, openDM, sendFriendRequestTo } from '../../store/actions/users';
import { sendMessage } from '../../store/actions/messages';
import { memberMenu } from '../members/MemberList';
import { ProfileEffect } from './ProfileEffect';

export function profileTheme(userId: string) {
  const p = getData().profiles[userId];
  if (p?.neon === 'neon' && p.theme_colors?.length === 2) return p.theme_colors as [string, string];
  return null;
}

export function ProfileCard({ userId, serverId, variant, onClose, override }: { userId: string; serverId: string | null; variant: 'popout' | 'panel' | 'modal'; onClose?: () => void; override?: Partial<Profile> }) {
  const stored = useData((s) => s.profiles[userId]);
  const p = stored && override ? { ...stored, ...override } : stored;
  const me = useData((s) => s.me);
  const status = useData((s) => presenceStatus(userId, s));
  const member = useData((s) => memberOf(serverId, userId, s));
  const roles = useData((s) => s.roles);
  const isOwner = useData((s) => !!serverId && s.servers[serverId]?.owner_id === userId);
  const server = useData((s) => (serverId ? s.servers[serverId] : undefined));
  const rel = useData((s) => s.relationships[userId]?.type);
  const neonSince = useData((s) => (s.me === userId ? s.neon?.started_at : null));
  const canRoles = useData((s) => !!serverId && has(serverPermsFor(serverId, s), P.MANAGE_ROLES));
  const [msg, setMsg] = useState('');
  const [addingRole, setAddingRole] = useState(false);
  const myRoles = useMemo(() => (serverId ? memberRoles(userId, serverId) : []), [userId, serverId, roles, member]);
  if (!p) return <div className="profile-card loading"><span className="spinner" /></div>;

  const neon = p.neon === 'neon';
  const theme = neon && p.theme_colors?.length === 2 ? p.theme_colors : null;
  const bannerStyle: CSSProperties = neon && p.banner_url ? { backgroundImage: `url(${p.banner_url})` }
    : theme ? { background: `linear-gradient(135deg, ${theme[0]}, ${theme[1]})` }
    : { background: p.banner_color || hashColor(userId) };
  const cardStyle = theme ? ({ '--pt1': theme[0], '--pt2': theme[1] } as CSSProperties) : undefined;
  const self = me === userId;
  const custom = p.custom_status && (!p.custom_status_expires_at || new Date(p.custom_status_expires_at) > new Date());

  async function quickMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!msg.trim()) return;
    const id = await openDM(userId);
    await sendMessage(id, { content: msg.trim() });
    setMsg('');
    onClose?.();
  }

  return (
    <div className={cn('profile-card', `pc-${variant}`, theme && 'themed')} style={cardStyle}>
      {neon && p.profile_effect && <ProfileEffect id={p.profile_effect} />}
      <div className="pc-banner" style={bannerStyle}>
        {variant !== 'modal' && !self && (
          <button className="pc-more icon-btn sm" onClick={(e) => openMenu(e, memberMenu(userId, serverId))}><MoreHorizontal /></button>
        )}
      </div>
      <div className="pc-avatar-row">
        <Tip label={status}><span><Avatar userId={userId} serverId={serverId} size={variant === 'modal' ? 120 : 84} status={status} showStatus ring="var(--pc-bg, var(--bg-float))" {...(override ? { url: p.avatar_url, decoration: neon ? p.avatar_decoration : null } : {})} /></span></Tip>
        <div className="pc-badges">
          {p.neon && <Tip label={`${p.neon === 'neon' ? 'Neon' : 'Neon Lite'} member${neonSince ? ` since ${formatShortDate(neonSince)}` : ''}`}><span className="pc-badge neon"><Gem size={14} /></span></Tip>}
          {isOwner && <Tip label="Server Owner"><span className="pc-badge gold"><Crown size={14} /></span></Tip>}
          {new Date(p.created_at) < new Date(Date.now() - 365 * 86400000) && <Tip label="Cityline veteran (1+ year)"><span className="pc-badge">🏙️</span></Tip>}
        </div>
      </div>
      <div className="pc-body">
        <div className="pc-names">
          <h2 className="pc-name"><NameTag userId={userId} serverId={serverId} nameOverride={override ? p.display_name || p.username : undefined} effectOverride={override ? (neon ? p.name_effect : null) : undefined} /></h2>
          <div className="pc-username">{p.username}{p.pronouns && <span className="pc-pronouns"> • {p.pronouns}</span>}</div>
        </div>
        {custom && <div className="pc-status-bubble">{p.custom_status_emoji} {p.custom_status}</div>}
        {self && variant === 'popout' && (
          <button className="btn sm secondary pc-edit" onClick={() => { onClose?.(); openModal({ kind: 'userSettings', tab: 'profile' }); }}><Pencil size={14} /> Edit Profile</button>
        )}
        {!self && variant === 'modal' && (
          <div className="row gap-8 pc-actions">
            <button className="btn sm" onClick={() => { onClose?.(); void openDM(userId); }}><MessageSquare size={15} /> Send Message</button>
            {rel === 'friend' ? <button className="btn sm secondary" disabled><Check size={15} /> Friends</button>
              : rel === 'outgoing' ? <button className="btn sm secondary" disabled>Request Sent</button>
              : rel === 'incoming' ? <button className="btn sm success" onClick={() => void acceptFriend(userId)}>Accept Request</button>
              : rel === 'blocked' ? <button className="btn sm secondary" disabled>Blocked</button>
              : <button className="btn sm secondary" onClick={() => void sendFriendRequestTo(userId).catch((e: Error) => toast(e.message, 'error'))}><UserPlus size={15} /> Add Friend</button>}
          </div>
        )}
        <div className="pc-section">
          {p.bio && (
            <>
              <div className="pc-label">About Me</div>
              <div className="pc-bio md">{renderMarkdown(p.bio)}</div>
            </>
          )}
          <div className="pc-label">Member Since</div>
          <div className="pc-since">
            <Tip label="Cityline"><span className="row gap-6"><LogoMark size={16} /> {formatShortDate(p.created_at)}</span></Tip>
            {server && member && (
              <>
                <span className="pc-dot" />
                <Tip label={server.name}><span className="row gap-6"><ServerIcon name={server.name} url={server.icon_url} size={16} /> {formatShortDate(member.joined_at)}</span></Tip>
              </>
            )}
          </div>
          {serverId && member && (
            <>
              <div className="pc-label">{myRoles.length ? `Roles` : 'No Roles'}</div>
              <div className="pc-roles">
                {myRoles.map((r) => (
                  <span key={r.id} className="role-chip">
                    <button className="role-chip-dot" style={{ background: r.color || 'var(--text-3)' }} disabled={!canRoles} onClick={() => void removeRole(serverId, userId, r.id).catch((e: Error) => toast(e.message, 'error'))} title={canRoles ? 'Remove role' : undefined}>
                      {canRoles && <X size={9} strokeWidth={4} />}
                    </button>
                    {r.icon && <span>{r.icon}</span>}
                    {r.name}
                  </span>
                ))}
                {canRoles && (
                  <span className="role-add-wrap">
                    <button className="role-chip add" onClick={() => setAddingRole(!addingRole)}><Plus size={12} /></button>
                    {addingRole && <RolePicker serverId={serverId} userId={userId} onDone={() => setAddingRole(false)} />}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {variant === 'popout' && !self && (
          <form onSubmit={quickMessage}>
            <input className="input pc-message" placeholder={`Message @${p.username}`} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </form>
        )}
        {variant === 'popout' && (
          <button className="btn link pc-full" onClick={() => { onClose?.(); openModal({ kind: 'profile', userId, serverId }); }}>View Full Profile</button>
        )}
      </div>
    </div>
  );
}

function RolePicker({ serverId, userId, onDone }: { serverId: string; userId: string; onDone: () => void }) {
  const [q, setQ] = useState('');
  const member = useData((s) => s.members[serverId]?.[userId]);
  const me = useData((s) => s.me!);
  const roles = serverRoles(serverId).filter((r) => !r.is_default && !member?.roles.includes(r.id) && r.name.toLowerCase().includes(q.toLowerCase()));
  const top = getData().servers[serverId]?.owner_id === me ? Infinity : Math.max(0, ...memberRoles(me, serverId).map((r) => r.position));
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.role-picker')) onDone(); };
    setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => window.removeEventListener('mousedown', close);
  }, [onDone]);
  return (
    <motion.div className="role-picker" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <input className="input" autoFocus placeholder="Role" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="scroll thin" style={{ maxHeight: 200 }}>
        {roles.map((r) => (
          <button key={r.id} className="menu-item" disabled={r.position >= top} onClick={() => { void addRole(serverId, userId, r.id).catch((e: Error) => toast(e.message, 'error')); onDone(); }}>
            <span className="role-dot" style={{ background: r.color || 'var(--text-3)' }} /> <span className="mi-label">{r.name}</span>
          </button>
        ))}
        {!roles.length && <div className="muted small center" style={{ padding: 10 }}>No roles</div>}
      </div>
    </motion.div>
  );
}

export function closePopout() { setUI({ popout: null }); }
