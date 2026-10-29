import { motion } from 'motion/react';
import { ArrowRight, Crown, CornerUpRight, Gem, MessagesSquare, Pencil, Phone, Pin, Reply, Rocket, SmilePlus, Sparkles, MoreHorizontal, RotateCw, Trash2, Hash, UserPlus } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { Tip } from '../../components/ui/Tooltip';
import { isEmojiOnly } from '../../lib/emoji';
import { renderMarkdown } from '../../lib/markdown';
import { has, P } from '../../lib/permissions';
import type { Message as Msg } from '../../lib/types';
import { cn, formatFull, formatMessageTime, timeOnly } from '../../lib/utils';
import { extractUrls, localEmbed } from '../../lib/embeds';
import { getData, useData } from '../../store/data';
import { usePerms } from '../../store/selectors';
import { openMenu, openModal, openProfile, setUI, useUI } from '../../store/ui';
import { deleteMessage, retryMessage, toggleReaction } from '../../store/actions/messages';
import { Attachments } from './Attachments';
import { Embeds } from './Embeds';
import { Reactions } from './Reactions';
import { PollCard } from './Poll';
import { EditBox } from './EditBox';
import { messageMenu, quickReactions } from './messageMenu';
import { ExpressionPicker } from '../expressions/ExpressionPicker';
import { sendMessage } from '../../store/actions/messages';
import { useShallow } from 'zustand/react/shallow';

const JOIN_LINES = [
  '{u} joined the party.', '{u} is here.', 'Welcome, {u}. We hope you brought pizza.', 'A wild {u} appeared.', '{u} just landed.',
  '{u} just slid into the server.', '{u} just showed up!', 'Welcome {u}. Say hi!', '{u} hopped into the server.', 'Everyone welcome {u}!',
  'Glad you’re here, {u}.', 'Good to see you, {u}.', 'Yay you made it, {u}!', '{u} took the express elevator up.', 'The city lights got brighter — {u} is here.',
];

function hashIdx(id: string, n: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % n;
}

export const Message = memo(function Message({ id, grouped, highlighted, inPanel }: { id: string; grouped: boolean; highlighted?: boolean; inPanel?: boolean }) {
  const m = useData((s) => s.messages[id]);
  const me = useData((s) => s.me);
  const editing = useUI((s) => s.editing === id);
  const replyingHere = useUI((s) => (m ? s.replyTo[m.channel_id]?.id === id : false));
  const perms = usePerms(m?.channel_id);
  const [picker, setPicker] = useState<null | { superR: boolean }>(null);
  const myRoles = useData(useShallow((s) => (m?.server_id ? s.memberships[m.server_id]?.roles ?? [] : [])));
  const isOwner = useData((s) => !!m?.server_id && s.servers[m.server_id]?.owner_id === m.author_id);
  const authorNeon = useData((s) => (m?.author_id ? s.profiles[m.author_id]?.neon : null));
  const compact = useData((s) => !!s.settings.compact);
  const h24 = useData((s) => !!s.settings.timestamps24h);
  const upload = useUI((s) => s.uploads[id]);

  const content = useMemo(() => {
    if (!m || !m.content) return null;
    const urls = extractUrls(m.content);
    // a message that is just a GIF/image link shows only the media
    if (urls.length === 1 && m.content.trim() === urls[0] && localEmbed(urls[0]) && (m.flags & 2) === 0) {
      const e = localEmbed(urls[0]);
      if (e?.type === 'gif' || e?.type === 'image') return null;
    }
    return renderMarkdown(m.content, { serverId: m.server_id, jumbo: isEmojiOnly(m.content) });
  }, [m?.content, m?.server_id, m?.flags]);

  if (!m) return null;
  if (m.type !== 'default') return <SystemMessage m={m} />;

  const mentioned = m.author_id !== me && (m.mentions.includes(me!) || m.mention_everyone || m.mention_roles.some((r) => myRoles.includes(r)));
  const own = m.author_id === me;
  const jumbo = isEmojiOnly(m.content);

  const profileAt = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    openProfile(m.author_id!, m.server_id, { x: r.right + 10, y: r.top });
  };

  return (
    <div
      data-mid={m.id}
      className={cn('msg', grouped && 'grouped', mentioned && 'mentioned', highlighted && 'highlight', m.pending && 'pending', m.failed && 'failed', replyingHere && 'replying', editing && 'editing', compact && 'compact')}
      onContextMenu={(e) => { if (!m.pending && (e.target as HTMLElement).tagName !== 'A') openMenu(e, messageMenu(m, () => setPicker({ superR: false }))); }}
      onDoubleClick={(e) => { if (own && !m.pending && !(e.target as HTMLElement).closest('a,button,video,audio,img')) setUI({ editing: m.id }); }}
    >
      {m.reply && !grouped && <ReplyBar m={m} />}
      {m.reply_to_id && !m.reply && !grouped && <div className="reply-bar"><span className="reply-spine" /><span className="muted small">Original message was deleted</span></div>}
      <div className="msg-row">
        <div className="msg-gutter">
          {grouped ? (
            <Tip label={formatFull(m.created_at)}><span className="msg-hover-time">{timeOnly(new Date(m.created_at), h24)}</span></Tip>
          ) : (
            <Avatar userId={m.author_id} serverId={m.server_id} size={40} onClick={profileAt} className="msg-avatar" />
          )}
        </div>
        <div className="msg-main">
          {!grouped && (
            <div className="msg-head">
              <NameTag userId={m.author_id} serverId={m.server_id} className="msg-author" onClick={profileAt} />
              {isOwner && <Tip label="Server Owner"><Crown className="owner-crown" size={14} /></Tip>}
              {authorNeon && <Tip label={authorNeon === 'neon' ? 'Neon member' : 'Neon Lite member'}><Gem className="neon-gem" size={13} /></Tip>}
              <Tip label={formatFull(m.created_at)}><time className="msg-time">{formatMessageTime(m.created_at, h24)}</time></Tip>
            </div>
          )}
          {editing ? (
            <EditBox message={m} />
          ) : (
            <>
              {m.forwarded && <Forwarded m={m} />}
              {content && (
                <div className={cn('msg-content md', jumbo && 'jumbo')}>
                  {content}
                  {m.edited_at && <Tip label={formatFull(m.edited_at)}><span className="edited">(edited)</span></Tip>}
                  {m.effect && <Tip label={`Sent with ${m.effect}`}><span className="effect-tag"><Sparkles size={11} /></span></Tip>}
                </div>
              )}
              {!content && m.edited_at && <span className="edited">(edited)</span>}
            </>
          )}
          {m.attachments.length > 0 && <Attachments message={m} />}
          {m.pending && upload !== undefined && upload < 1 && (
            <div className="upload-progress"><div className="progress"><i style={{ width: `${Math.round(upload * 100)}%` }} /></div><span className="tiny muted">Uploading… {Math.round(upload * 100)}%</span></div>
          )}
          {m.sticker && (
            <Tip label={m.sticker.name}><img className="sticker" src={m.sticker.url} alt={m.sticker.name} draggable={false} /></Tip>
          )}
          {m.poll && <PollCard message={m} />}
          {(m.flags & 2) === 0 && <Embeds message={m} />}
          {m.thread && <ThreadChip m={m} />}
          {m.failed && (
            <div className="msg-failed">
              <span>Message failed to send — {m.failed}</span>
              <button className="btn link" onClick={() => void retryMessage(m)}><RotateCw size={13} /> Retry</button>
              <button className="btn link" onClick={() => void deleteMessage(m.id)}><Trash2 size={13} /> Delete</button>
            </div>
          )}
          {(m.reactions?.length ?? 0) > 0 && <Reactions message={m} canReact={has(perms, P.ADD_REACTIONS)} onAdd={() => setPicker({ superR: false })} />}
        </div>
      </div>
      {!m.pending && !editing && (
        <Toolbar m={m} perms={perms} own={own} inPanel={inPanel} onReact={(superR) => setPicker({ superR })} />
      )}
      {picker && (
        <ExpressionPicker
          mode="reaction"
          superReaction={picker.superR}
          anchor="message"
          onClose={() => setPicker(null)}
          onPick={(token, opts) => { void toggleReaction(m.id, token, opts?.superR ?? picker.superR); }}
        />
      )}
    </div>
  );
});

function Toolbar({ m, perms, own, onReact, inPanel }: { m: Msg; perms: bigint; own: boolean; onReact: (superR: boolean) => void; inPanel?: boolean }) {
  const neon = useData((s) => !!(s.me && s.profiles[s.me]?.neon));
  const quick = quickReactions().slice(0, inPanel ? 2 : 3);
  const canThread = !!m.server_id && has(perms, P.CREATE_THREADS) && !m.thread_id && getData().channels[m.channel_id]?.type !== 'thread';
  return (
    <div className="msg-toolbar">
      {has(perms, P.ADD_REACTIONS) && quick.map((e) => (
        <button key={e} className="tb-btn emoji" onClick={() => void toggleReaction(m.id, e)}>{e}</button>
      ))}
      {has(perms, P.ADD_REACTIONS) && quick.length > 0 && <span className="tb-sep" />}
      <Tip label="Add Reaction"><button className="tb-btn" onClick={() => onReact(false)}><SmilePlus /></button></Tip>
      {neon && <Tip label="Super Reaction"><button className="tb-btn super" onClick={() => onReact(true)}><Sparkles /></button></Tip>}
      {own ? (
        <Tip label="Edit"><button className="tb-btn" onClick={() => setUI({ editing: m.id })}><Pencil /></button></Tip>
      ) : (
        has(perms, P.SEND_MESSAGES) && <Tip label="Reply"><button className="tb-btn" onClick={() => setUI((s) => ({ replyTo: { ...s.replyTo, [m.channel_id]: { id: m.id, ping: true } } }))}><Reply /></button></Tip>
      )}
      {canThread && <Tip label="Create Thread"><button className="tb-btn" onClick={() => openModal({ kind: 'createThread', channelId: m.channel_id, messageId: m.id })}><MessagesSquare /></button></Tip>}
      <Tip label="More"><button className="tb-btn" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenu({ clientX: r.left, clientY: r.bottom + 4 }, messageMenu(m, () => onReact(false))); }}><MoreHorizontal /></button></Tip>
    </div>
  );
}

function ReplyBar({ m }: { m: Msg }) {
  const r = m.reply!;
  return (
    <div className="reply-bar" onClick={() => setUI({ jumpTo: { channelId: m.channel_id, messageId: r.id, at: Date.now() } })} role="button">
      <span className="reply-spine" />
      <Avatar userId={r.author_id} size={16} serverId={m.server_id} />
      <NameTag userId={r.author_id} serverId={m.server_id} className="reply-author" />
      <span className="reply-text ellipsis">
        {r.content ? renderMarkdown(r.content, { inline: true, serverId: m.server_id, noLinks: true }) : <i className="muted">{r.attachments ? 'Click to see attachment 🖼️' : 'Click to see message'}</i>}
      </span>
    </div>
  );
}

function Forwarded({ m }: { m: Msg }) {
  const f = m.forwarded!;
  const ch = useData((s) => s.channels[f.channel_id]);
  return (
    <div className="forwarded">
      <div className="fw-label"><CornerUpRight size={14} /> Forwarded</div>
      {f.content && <div className="md">{renderMarkdown(f.content, { serverId: ch?.server_id })}</div>}
      {f.attachments?.length > 0 && <Attachments message={{ ...m, attachments: f.attachments }} />}
      <div className="fw-meta tiny muted">
        {ch?.server_id ? <><Hash size={11} /> {ch.name} · </> : null}{formatMessageTime(f.created_at)}
      </div>
    </div>
  );
}

function ThreadChip({ m }: { m: Msg }) {
  const t = m.thread!;
  const live = useData((s) => s.channels[t.id]);
  return (
    <motion.button className="thread-chip" onClick={() => setUI({ threadId: t.id, rightPanel: 'thread' })} whileHover={{ y: -1 }}>
      <MessagesSquare size={16} />
      <span className="bold">{live?.name ?? t.name}</span>
      <span className="link-ish">{live?.message_count ?? t.message_count} Messages <ArrowRight size={13} /></span>
      {(live?.last_message_at ?? t.last_message_at) && <span className="tiny muted">{formatMessageTime((live?.last_message_at ?? t.last_message_at)!)}</span>}
    </motion.button>
  );
}

function SystemMessage({ m }: { m: Msg }) {
  const h24 = useData((s) => !!s.settings.timestamps24h);
  const time = <Tip label={formatFull(m.created_at)}><time className="msg-time">{formatMessageTime(m.created_at, h24)}</time></Tip>;
  const who = <NameTag userId={m.author_id} serverId={m.server_id} className="sys-name" onClick={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openProfile(m.author_id!, m.server_id, { x: r.right + 8, y: r.top }); }} />;
  let icon: React.ReactNode = <ArrowRight />;
  let body: React.ReactNode = null;
  let cls = '';
  switch (m.type) {
    case 'join': {
      const line = JOIN_LINES[hashIdx(m.id, JOIN_LINES.length)];
      const [a, b] = line.split('{u}');
      icon = <ArrowRight className="green" />;
      cls = 'join';
      body = (
        <>
          {a}{who}{b} {time}
          <button className="wave-btn" onClick={() => void sendMessage(m.channel_id, { content: '', sticker: { id: 'wave', name: 'Hi there', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f44b/512.webp' }, replyTo: { id: m.id, ping: true } })}>
            <span className="wave">👋</span> Wave to say hi!
          </button>
        </>
      );
      break;
    }
    case 'pin':
      icon = <Pin />;
      body = <>{who} pinned <button className="btn link" onClick={() => m.reply_to_id && setUI({ jumpTo: { channelId: m.channel_id, messageId: m.reply_to_id, at: Date.now() } })}>a message</button> to this channel. See all <button className="btn link" onClick={() => setUI({ rightPanel: 'pins' })}>pinned messages</button>. {time}</>;
      break;
    case 'boost':
      icon = <Rocket className="pink" />;
      cls = 'boost';
      body = <>{who} just boosted the server! 🚀 {time}</>;
      break;
    case 'call':
      icon = <Phone className="green" />;
      body = <>{who} started a call. {time}</>;
      break;
    case 'thread':
      icon = <MessagesSquare />;
      body = <>{who} started a thread: <button className="btn link bold" onClick={() => { const t = m.reply_to_id ? getData().messages[m.reply_to_id]?.thread_id : null; if (t) setUI({ threadId: t, rightPanel: 'thread' }); }}>{m.content}</button>. See all <button className="btn link" onClick={() => setUI({ rightPanel: 'threads' })}>threads</button>. {time}</>;
      break;
    default:
      icon = /added/.test(m.content) ? <UserPlus className="green" /> : <ArrowRight className="red" />;
      body = <>{who} {renderMarkdown(m.content, { inline: true, serverId: m.server_id })} {time}</>;
  }
  return (
    <div className={cn('msg system', cls)} data-mid={m.id} onContextMenu={(e) => openMenu(e, messageMenu(m, () => {}))}>
      <div className="msg-row">
        <div className="msg-gutter sys-icon">{icon}</div>
        <div className="msg-main sys-body">{body}</div>
      </div>
      {m.reactions && m.reactions.length > 0 && <div className="sys-reactions"><Reactions message={m} canReact onAdd={() => {}} /></div>}
    </div>
  );
}
