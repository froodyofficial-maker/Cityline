import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { ServerIcon } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Controls';
import { plural } from '../../lib/utils';
import { getInvite, joinByInvite } from '../../store/actions/servers';
import { navigate, toastError } from '../../store/ui';
import { firstTextChannel } from '../../store/selectors';
import { Skyline } from '../auth/Skyline';

type Invite = Awaited<ReturnType<typeof getInvite>>;

export function InviteView({ code }: { code: string }) {
  const [inv, setInv] = useState<Invite | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getInvite(code).then(setInv).catch(() => setInv(null)); }, [code]);
  return (
    <div className="invite-page">
      <Skyline />
      <motion.div className="auth-card invite-card" initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
        {inv === undefined ? <Spinner lg /> : inv === null ? (
          <>
            <div className="auth-mail-art">🔗</div>
            <h1 className="auth-title">Invite Invalid</h1>
            <p className="auth-sub">This invite may be expired, or you might not have permission to join.</p>
            <button className="btn lg block" onClick={() => navigate({ kind: 'friends' })}>Continue to Cityline</button>
          </>
        ) : (
          <>
            <ServerIcon name={inv.server.name} url={inv.server.icon_url} size={84} />
            <p className="auth-sub">{inv.inviter ? <><b>{inv.inviter.display_name || inv.inviter.username}</b> invited you to join</> : 'You’ve been invited to join'}</p>
            <h1 className="auth-title">{inv.server.name}</h1>
            {inv.server.description && <p className="muted small">{inv.server.description}</p>}
            <div className="invite-stats"><span><i className="dot online" /> {plural(inv.server.member_count, 'Member')}</span>{inv.channel && <span>#{inv.channel.name}</span>}</div>
            {inv.is_member ? (
              <button className="btn lg block" onClick={() => navigate({ kind: 'server', serverId: inv.server.id, channelId: firstTextChannel(inv.server.id) })}>Go to Server</button>
            ) : (
              <button className="btn lg block" disabled={busy} onClick={async () => { setBusy(true); try { await joinByInvite(code); } catch (e) { toastError(e); } setBusy(false); }}>{busy ? <Spinner /> : 'Accept Invite'}</button>
            )}
            <button className="btn link" style={{ marginTop: 10 }} onClick={() => navigate({ kind: 'friends' })}>No thanks</button>
          </>
        )}
      </motion.div>
    </div>
  );
}
