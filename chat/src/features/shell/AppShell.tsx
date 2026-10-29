import { AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { ContextMenuHost } from '../../components/ui/Menu';
import { rpc } from '../../lib/supabase';
import { startPresence, stopPresence } from '../../lib/presence';
import { toggleDeafen, toggleMute } from '../../lib/voice';
import { setTitleBadge, desktopNotify } from '../../lib/notify';
import { playUi } from '../../lib/sounds';
import { cn } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { loadBootstrap } from '../../store/actions/bootstrap';
import { joinByInvite, takePendingInvite } from '../../store/actions/servers';
import { completeReminder, loadReminders, markRead } from '../../store/actions/messages';
import { setCustomStatus } from '../../store/actions/users';
import { startRealtime, stopRealtime } from '../../store/realtime';
import { firstTextChannel, isUnread, mentionCount, permsFor, serverChannels } from '../../store/selectors';
import { navigate, openModal, setUI, toast, toastError, ui, useUI } from '../../store/ui';
import { ServerRail } from '../rail/ServerRail';
import { Sidebar } from '../sidebar/Sidebar';
import { ChatView } from '../chat/ChatView';
import { FriendsView } from '../friends/FriendsView';
import { DiscoverView } from '../discover/DiscoverView';
import { NeonView } from '../neon/NeonView';
import { InviteView } from '../invite/InviteView';
import { VoiceView } from '../voice/VoiceView';
import { ForumView } from '../chat/ForumView';
import { ModalHost } from '../modals/ModalHost';
import { ProfilePopoutHost } from '../profile/ProfilePopout';
import { QuickSwitcher } from '../switcher/QuickSwitcher';
import { EffectsOverlay } from '../effects/EffectsOverlay';
import { IncomingCall } from '../voice/IncomingCall';
import { Lightbox } from '../chat/Lightbox';
import { Splash } from './Splash';
import { SetupError } from './SetupError';
import { useVoice } from '../../store/voice';

export function AppShell() {
  const ready = useData((s) => s.ready);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const b = await loadBootstrap();
        if (!alive) return;
        startPresence(b.me.id, b.me.status);
        startRealtime();
        void loadReminders().catch(() => {});
        const invite = takePendingInvite();
        if (invite) void joinByInvite(invite).catch((e: unknown) => { toastError(e); navigate({ kind: 'invite', code: invite }); });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      stopRealtime();
      stopPresence();
    };
  }, []);

  useBackgroundJobs(ready);
  useShortcuts(ready);

  if (error) return <SetupError message={error} />;
  if (!ready) return <Splash />;
  return <Layout />;
}

function Layout() {
  const route = useUI((s) => s.route);
  const mobileNav = useUI((s) => s.mobileNav);
  const voiceView = useUI((s) => s.voiceView);
  const channel = useData((s) => (route.kind === 'server' && route.channelId ? s.channels[route.channelId] : route.kind === 'dm' ? s.channels[route.channelId] : undefined));
  const serverExists = useData((s) => (route.kind === 'server' ? !!s.servers[route.serverId] : true));

  // keep the route valid: unknown server → home, server without channel → first channel
  useEffect(() => {
    if (route.kind === 'server') {
      if (!serverExists) { navigate({ kind: 'friends' }, { replace: true }); return; }
      if (!route.channelId || (!getData().channels[route.channelId])) {
        const first = firstTextChannel(route.serverId);
        if (first !== route.channelId) navigate({ kind: 'server', serverId: route.serverId, channelId: first }, { replace: true });
      }
    }
    if (route.kind === 'dm' && !getData().channels[route.channelId]) navigate({ kind: 'friends' }, { replace: true });
  }, [route, serverExists]);

  let main: React.ReactNode;
  if (route.kind === 'friends') main = <FriendsView />;
  else if (route.kind === 'discover') main = <DiscoverView />;
  else if (route.kind === 'neon') main = <NeonView />;
  else if (route.kind === 'invite') main = <InviteView code={route.code} />;
  else if (route.kind === 'dm') main = channel ? <ChatView key={channel.id} channelId={channel.id} /> : null;
  else if (route.kind === 'server') {
    if (voiceView && getData().channels[voiceView]?.server_id === route.serverId) main = <VoiceView key={voiceView} channelId={voiceView} />;
    else if (channel?.type === 'forum') main = <ForumView key={channel.id} channelId={channel.id} />;
    else if (channel) main = <ChatView key={channel.id} channelId={channel.id} />;
    else main = <NoChannels serverId={route.serverId} />;
  }

  return (
    <div className={cn('app', mobileNav && 'nav-open')}>
      <div className="nav-scrim" onClick={() => setUI({ mobileNav: false })} />
      <nav className="nav">
        <ServerRail />
        <Sidebar />
      </nav>
      <main className="main">{main}</main>
      <ModalHost />
      <ProfilePopoutHost />
      <ContextMenuHost />
      <QuickSwitcher />
      <EffectsOverlay />
      <CallHost />
      <Lightbox />
      <ConnectionBanner />
    </div>
  );
}

function CallHost() {
  const call = useUI((s) => s.incomingCall);
  return <AnimatePresence>{call && <IncomingCall key={call.messageId} call={call} />}</AnimatePresence>;
}

function NoChannels({ serverId }: { serverId: string }) {
  const name = useData((s) => s.servers[serverId]?.name);
  return (
    <div className="empty full">
      <div className="art">🏙️</div>
      <h3>No text channels in {name}</h3>
      <p>You may not have access to any channels yet, or they’re all voice channels.</p>
      <button className="btn" onClick={() => openModal({ kind: 'createChannel', serverId })}>Create a channel</button>
    </div>
  );
}

function ConnectionBanner() {
  const conn = useData((s) => s.connection);
  if (conn !== 'offline') return null;
  return <div className="conn-banner"><span className="spinner" /> Reconnecting to Cityline…</div>;
}

// ---------------------------------------------------------------- background jobs

function useBackgroundJobs(ready: boolean) {
  // unread badge in the tab title
  const counts = useData((s) => {
    if (!s.ready) return 0;
    let n = 0;
    for (const c of Object.values(s.channels)) n += mentionCount(c.id, s);
    return n;
  });
  useEffect(() => { setTitleBadge(counts); }, [counts]);

  useEffect(() => {
    if (!ready) return;
    // scheduled messages: any client publishes what is due (no cron needed)
    const pub = setInterval(() => { void rpc('publish_due_messages').catch(() => {}); }, 60_000);
    void rpc('publish_due_messages').catch(() => {});
    // reminders
    const rem = setInterval(() => {
      const now = Date.now();
      for (const r of getData().reminders) {
        if (new Date(r.remind_at).getTime() <= now) {
          void completeReminder(r.id);
          playUi('mention');
          const m = r.message_id ? getData().messages[r.message_id] : null;
          toast(`⏰ Reminder${r.note ? ': ' + r.note : m ? ': ' + m.content.slice(0, 80) : ''}`, 'info', '⏰');
          desktopNotify('Cityline reminder', r.note || m?.content || 'You asked me to remind you about a message', null, () => {
            const ch = r.channel_id ? getData().channels[r.channel_id] : null;
            if (ch?.server_id) navigate({ kind: 'server', serverId: ch.server_id, channelId: ch.id });
            else if (ch) navigate({ kind: 'dm', channelId: ch.id });
            if (r.message_id && r.channel_id) setUI({ jumpTo: { channelId: r.channel_id, messageId: r.message_id, at: Date.now() } });
          });
        }
      }
    }, 15_000);
    // custom status expiry
    const st = setInterval(() => {
      const me = getData().me;
      const p = me ? getData().profiles[me] : null;
      if (p?.custom_status_expires_at && new Date(p.custom_status_expires_at) < new Date()) {
        void setCustomStatus(null, null, null);
      }
      const focus = ui().focusMode;
      if (focus && focus < Date.now()) { setUI({ focusMode: null }); toast('Focus mode ended — welcome back!', 'info', '🎯'); }
    }, 30_000);
    return () => { clearInterval(pub); clearInterval(rem); clearInterval(st); };
  }, [ready]);
}

// ---------------------------------------------------------------- keyboard shortcuts

function useShortcuts(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setUI((s) => ({ quickSwitcher: !s.quickSwitcher })); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); if (useVoice.getState().channelId) toggleMute(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); if (useVoice.getState().channelId) toggleDeafen(); return; }
      if (mod && e.key === '/') { e.preventDefault(); openModal({ kind: 'shortcuts' }); return; }
      if (mod && e.key === ',') { e.preventDefault(); openModal({ kind: 'userSettings' }); return; }
      if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); setUI((s) => ({ inbox: !s.inbox })); return; }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveChannel(e.key === 'ArrowUp' ? -1 : 1, e.shiftKey);
        return;
      }
      if (!typing && e.key === 'Escape' && !ui().modals.length) {
        const r = ui().route;
        const id = r.kind === 'server' ? r.channelId : r.kind === 'dm' ? r.channelId : null;
        if (id) void markRead(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);
}

function moveChannel(dir: number, unreadOnly: boolean) {
  const r = ui().route;
  if (r.kind !== 'server') return;
  const s = getData();
  const all = serverChannels(r.serverId, s);
  const cats = all.filter((c) => c.type === 'category');
  const ordered = all
    .filter((c) => c.type !== 'category' && permsFor(c.id, s) !== 0n && c.type !== 'voice' && c.type !== 'stage')
    .sort((a, b) => {
      const ca = cats.findIndex((x) => x.id === a.parent_id), cb = cats.findIndex((x) => x.id === b.parent_id);
      return ca - cb || a.position - b.position;
    })
    .filter((c) => !unreadOnly || isUnread(c.id, s) || c.id === r.channelId);
  const i = ordered.findIndex((c) => c.id === r.channelId);
  const next = ordered[(i + dir + ordered.length) % ordered.length];
  if (next) navigate({ kind: 'server', serverId: r.serverId, channelId: next.id });
}
