import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, Hash, UserPlus, Pencil, MessagesSquare, Megaphone } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, ServerIcon } from '../../components/ui/Avatar';
import { formatDay, formatMessageTime, sameDay } from '../../lib/utils';
import type { Message as Msg } from '../../lib/types';
import { getData, useData } from '../../store/data';
import { dmName, dmOther } from '../../store/selectors';
import { openModal, setUI, useUI } from '../../store/ui';
import { jumpToPresent, loadMessages, loadNewer, markRead } from '../../store/actions/messages';
import { Message } from './Message';
import { TypingIndicator } from './TypingIndicator';
import { sendFriendRequestTo, blockUser } from '../../store/actions/users';
import { NameTag } from '../../components/ui/NameTag';

const GROUP_MS = 7 * 60_000;

export function MessageList({ channelId, compactTop }: { channelId: string; compactTop?: boolean }) {
  const cm = useData((s) => s.channelMsgs[channelId]);
  const messages = useData((s) => s.messages);
  const me = useData((s) => s.me);
  const jumpTo = useUI((s) => s.jumpTo);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const prevFirst = useRef<string | null>(null);
  const prevHeight = useRef(0);
  const [showJump, setShowJump] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  // remember where "new" starts when the channel is opened
  const [unreadFrom] = useState(() => getData().readStates[channelId]?.last_read_at ?? null);
  const [unreadDismissed, setUnreadDismissed] = useState(false);

  const ids = cm?.ids ?? [];
  const list = useMemo(() => ids.map((id) => messages[id]).filter(Boolean) as Msg[], [ids, messages]);

  const firstUnread = useMemo(() => {
    if (!unreadFrom) return null;
    const t = new Date(unreadFrom).getTime();
    return list.find((m) => new Date(m.created_at).getTime() > t && m.author_id !== me && !m.pending)?.id ?? null;
  }, [list, unreadFrom, me]);
  const unreadCount = useMemo(() => (firstUnread ? list.length - list.findIndex((m) => m.id === firstUnread) : 0), [list, firstUnread]);

  // keep scroll position stable when older messages are prepended, stick to bottom otherwise
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = ids[0] ?? null;
    if (prevFirst.current && first !== prevFirst.current && ids.includes(prevFirst.current)) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevFirst.current = first;
    prevHeight.current = el.scrollHeight;
  }, [ids]);

  // images load after layout — keep pinned to bottom while they do
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
      prevHeight.current = el.scrollHeight;
    });
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => ro.disconnect();
  }, [cm?.loaded]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = dist < 60;
    setShowJump(dist > 1200 || !!getData().channelMsgs[channelId]?.hasNewer);
    const st = getData().channelMsgs[channelId];
    if (el.scrollTop < 400 && st?.hasMore && !st.loading && st.loaded && st.ids.length) {
      const oldest = getData().messages[st.ids[0]];
      if (oldest) void loadMessages(channelId, { before: oldest.created_at });
    }
    if (dist < 300 && st?.hasNewer && !st.loading) void loadNewer(channelId);
    if (atBottom.current && document.hasFocus()) markRead(channelId);
  }, [channelId]);

  // jump to a specific message (search results, replies, pins, links)
  useEffect(() => {
    if (!jumpTo || jumpTo.channelId !== channelId) return;
    const target = jumpTo.messageId;
    const go = () => {
      const node = scroller.current?.querySelector(`[data-mid="${target}"]`);
      if (node) {
        atBottom.current = false;
        node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        setHighlight(target);
        setTimeout(() => setHighlight(null), 2200);
        setUI({ jumpTo: null });
        return true;
      }
      return false;
    };
    if (!go()) void loadMessages(channelId, { around: target }).then(() => requestAnimationFrame(() => go()));
  }, [jumpTo, channelId]);

  // new message while scrolled to the bottom → mark read
  useEffect(() => {
    if (atBottom.current && document.hasFocus()) markRead(channelId);
  }, [ids.length, channelId]);

  const loading = !cm?.loaded;
  return (
    <div className="messages-wrap">
      <AnimatePresence>
        {firstUnread && !unreadDismissed && unreadCount > 0 && (
          <motion.div className="unread-bar" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}>
            <button className="grow" onClick={() => setUI({ jumpTo: { channelId, messageId: firstUnread, at: Date.now() } })}>
              {unreadCount >= 50 ? '50+' : unreadCount} new message{unreadCount === 1 ? '' : 's'} since {formatMessageTime(messages[firstUnread].created_at)}
            </button>
            <button onClick={() => { setUnreadDismissed(true); markRead(channelId); }}>Mark As Read ✓</button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="messages scroll" ref={scroller} onScroll={onScroll}>
        <div className="messages-inner">
          {loading ? <Skeleton /> : (
            <>
              {!cm?.hasMore && !compactTop && <ChannelWelcome channelId={channelId} />}
              {cm?.hasMore && list.length > 0 && <div className="history-loading"><span className="spinner" /></div>}
              {list.map((m, i) => {
                const prev = list[i - 1];
                const day = !prev || !sameDay(new Date(prev.created_at), new Date(m.created_at));
                const grouped = !!prev && !day && prev.author_id === m.author_id && prev.type === 'default' && m.type === 'default'
                  && !m.reply_to_id && !m.forwarded && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_MS && !(firstUnread === m.id);
                return (
                  <Fragment key={m.id}>
                    {day && <div className="day-divider"><span>{formatDay(m.created_at)}</span></div>}
                    {firstUnread === m.id && !unreadDismissed && <div className="new-divider"><span>NEW</span></div>}
                    <Message id={m.id} grouped={grouped} highlighted={highlight === m.id} />
                  </Fragment>
                );
              })}
              {cm?.hasNewer && <div className="history-loading"><span className="spinner" /></div>}
            </>
          )}
          <div className="messages-end" />
        </div>
      </div>
      <TypingIndicator channelId={channelId} />
      <AnimatePresence>
        {showJump && (
          <motion.button
            className="jump-present"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={async () => {
              if (getData().channelMsgs[channelId]?.hasNewer) await jumpToPresent(channelId);
              atBottom.current = true;
              const el = scroller.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              setShowJump(false);
            }}
          >
            Jump to present <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function Skeleton() {
  const rows = [70, 40, 85, 55, 30, 65, 45, 75];
  return (
    <div className="msg-skeletons">
      {rows.map((w, i) => (
        <div key={i} className="msg-skel" style={{ opacity: 1 - i * 0.1 }}>
          <div className="skeleton circle" />
          <div className="grow">
            <div className="skeleton" style={{ width: `${20 + (w % 20)}%`, height: 12, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: `${w}%`, height: 12, marginBottom: 6 }} />
            {w > 60 && <div className="skeleton" style={{ width: `${w - 30}%`, height: 12 }} />}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChannelWelcome({ channelId }: { channelId: string }) {
  const ch = useData((s) => s.channels[channelId]);
  const server = useData((s) => (ch?.server_id ? s.servers[ch.server_id] : undefined));
  const isOwner = useData((s) => server?.owner_id === s.me);
  const name = useData((s) => (ch && !ch.server_id ? dmName(ch, s) : ''));
  const other = useData((s) => (ch && ch.type === 'dm' ? dmOther(ch, s) : undefined));
  const rel = useData((s) => (other ? s.relationships[other.id]?.type : undefined));
  if (!ch) return null;

  if (ch.type === 'dm' && other) {
    return (
      <motion.div className="welcome dm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Avatar userId={other.id} size={84} />
        <h1><NameTag userId={other.id} /></h1>
        <div className="welcome-user">{other.username}</div>
        <p>This is the beginning of your direct message history with <b>{other.display_name || other.username}</b>.</p>
        <div className="row gap-8 welcome-actions">
          {rel === 'friend' ? <button className="btn sm secondary" disabled>Friends ✓</button>
            : rel === 'outgoing' ? <button className="btn sm secondary" disabled>Friend Request Sent</button>
            : rel === 'blocked' ? null
            : <button className="btn sm" onClick={() => void sendFriendRequestTo(other.id)}>Add Friend</button>}
          {rel !== 'blocked' && <button className="btn sm secondary" onClick={() => void blockUser(other.id)}>Block</button>}
        </div>
      </motion.div>
    );
  }
  if (ch.type === 'group_dm') {
    return (
      <motion.div className="welcome dm" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <ServerIcon name={name} url={ch.icon_url} size={84} />
        <h1>{name}</h1>
        <p>Welcome to the beginning of the <b>{name}</b> group.</p>
      </motion.div>
    );
  }
  if (ch.type === 'thread') {
    return (
      <motion.div className="welcome thread" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="welcome-icon"><MessagesSquare size={36} /></div>
        <h1>{ch.name}</h1>
        <p>Started by <NameTag userId={ch.owner_id} serverId={ch.server_id} /></p>
      </motion.div>
    );
  }
  const isGeneral = server?.system_channel_id === ch.id;
  return (
    <motion.div className="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="welcome-icon">{ch.type === 'announcement' ? <Megaphone size={40} /> : <Hash size={44} />}</div>
      <h1>Welcome to #{ch.name}!</h1>
      <p>This is the start of the #{ch.name} channel.{ch.topic ? ` ${ch.topic}` : ''}</p>
      {isGeneral && isOwner && (
        <div className="welcome-cards">
          <button className="welcome-card" onClick={() => openModal({ kind: 'invite', serverId: ch.server_id! })}>
            <span className="wc-icon"><UserPlus /></span>
            <span><b>Invite your friends</b><br /><span className="muted small">Servers are better together</span></span>
          </button>
          <button className="welcome-card" onClick={() => openModal({ kind: 'serverSettings', serverId: ch.server_id! })}>
            <span className="wc-icon"><Pencil /></span>
            <span><b>Personalize your server</b><br /><span className="muted small">Add an icon, banner and roles</span></span>
          </button>
          <button className="welcome-card" onClick={() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus()}>
            <span className="wc-icon">👋</span>
            <span><b>Send your first message</b><br /><span className="muted small">Say hello to your server</span></span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

