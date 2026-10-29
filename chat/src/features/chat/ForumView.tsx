import { AnimatePresence, motion } from 'motion/react';
import { MessagesSquare, Plus, Search, SlidersHorizontal, Tag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { renderMarkdown } from '../../lib/markdown';
import { has, P } from '../../lib/permissions';
import type { Channel, Message } from '../../lib/types';
import { cn, formatMessageTime, isImage } from '../../lib/utils';
import { useData } from '../../store/data';
import { isUnread, usePerms } from '../../store/selectors';
import { openModal, setUI, useUI } from '../../store/ui';
import { loadThreads } from '../../store/actions/messages';
import { loadMembers } from '../../store/actions/servers';
import { ChannelHeader } from './ChannelHeader';
import { ThreadPanel } from '../panels/ThreadPanel';

type Post = Channel & { starter: Message | null; last_read_at: string | null };

export function ForumView({ channelId }: { channelId: string }) {
  const channel = useData((s) => s.channels[channelId]);
  const threadId = useUI((s) => s.threadId);
  const rightPanel = useUI((s) => s.rightPanel);
  const perms = usePerms(channelId);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<'activity' | 'created'>('activity');
  const channels = useData((s) => s.channels);
  const threadCount = useMemo(() => Object.values(channels).filter((c) => c.thread_parent_id === channelId).length, [channels, channelId]);

  useEffect(() => {
    void loadThreads(channelId).then(setPosts).catch(() => setPosts([]));
    if (channel?.server_id) void loadMembers(channel.server_id);
  }, [channelId, threadCount, channel?.server_id]);

  const list = useMemo(() => {
    if (!posts) return null;
    return posts
      .filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.starter?.content.toLowerCase().includes(q.toLowerCase())) && (!tag || p.applied_tags.includes(tag)))
      .sort((a, b) => (sort === 'created' ? b.created_at.localeCompare(a.created_at) : (b.last_message_at ?? b.created_at).localeCompare(a.last_message_at ?? a.created_at)));
  }, [posts, q, tag, sort]);

  if (!channel) return null;
  const tags = channel.available_tags ?? [];
  return (
    <div className="chat">
      <ChannelHeader channel={channel} />
      <div className="chat-body">
        <div className="forum scroll">
          <div className="forum-top">
            <div className="input-wrap grow">
              <Search />
              <input className="input" placeholder="Search or create a post…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {has(perms, P.CREATE_THREADS) && <button className="btn" onClick={() => openModal({ kind: 'createThread', channelId, forum: true })}><Plus size={16} /> New Post</button>}
          </div>
          <div className="forum-filters">
            <button className="chip" onClick={() => setSort(sort === 'activity' ? 'created' : 'activity')}><SlidersHorizontal size={14} /> {sort === 'activity' ? 'Recent activity' : 'Date posted'}</button>
            {tags.map((t) => <button key={t.id} className={cn('chip', tag === t.id && 'on')} onClick={() => setTag(tag === t.id ? null : t.id)}>{t.emoji ?? <Tag size={12} />} {t.name}</button>)}
          </div>
          {channel.topic && <div className="forum-guidelines md">{renderMarkdown(channel.topic, { serverId: channel.server_id })}</div>}
          <div className="forum-list">
            {list === null && Array.from({ length: 4 }, (_, i) => <div key={i} className="post-card skeleton" style={{ height: 110 }} />)}
            <AnimatePresence initial={false}>
              {list?.map((p, i) => <PostCard key={p.id} post={p} tags={tags} index={i} />)}
            </AnimatePresence>
            {list?.length === 0 && (
              <div className="empty">
                <div className="art">🗂️</div>
                <h3>{q || tag ? 'No posts match' : 'There are no posts yet'}</h3>
                <p>Forum posts are threads with a title, a first message and optional tags.</p>
                {has(perms, P.CREATE_THREADS) && <button className="btn" onClick={() => openModal({ kind: 'createThread', channelId, forum: true })}>Create the first post</button>}
              </div>
            )}
          </div>
        </div>
        <AnimatePresence>
          {rightPanel === 'thread' && threadId && (
            <motion.aside className="right-panel wide" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
              <ThreadPanel key={threadId} threadId={threadId} />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PostCard({ post, tags, index }: { post: Post; tags: { id: string; name: string; emoji?: string | null }[]; index: number }) {
  const unread = useData((s) => isUnread(post.id, s));
  const live = useData((s) => s.channels[post.id]);
  const img = post.starter?.attachments.find((a) => isImage(a.type));
  return (
    <motion.button
      className={cn('post-card', unread && 'unread')}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.025 }}
      whileHover={{ y: -2 }}
      onClick={() => setUI({ threadId: post.id, rightPanel: 'thread' })}
    >
      <div className="post-main">
        {post.applied_tags.length > 0 && (
          <div className="post-tags">{post.applied_tags.map((t) => { const def = tags.find((x) => x.id === t); return def ? <span key={t} className="chip tiny">{def.emoji} {def.name}</span> : null; })}</div>
        )}
        <div className="post-title">{live?.name ?? post.name}</div>
        <div className="post-preview">
          <NameTag userId={post.owner_id} serverId={post.server_id} className="bold" />: {post.starter?.content ? renderMarkdown(post.starter.content, { inline: true, noLinks: true, serverId: post.server_id }) : <i className="muted">No message</i>}
        </div>
        <div className="post-meta">
          <Avatar userId={post.owner_id} size={18} serverId={post.server_id} />
          <span><MessagesSquare size={13} /> {live?.message_count ?? post.message_count}</span>
          <span>·</span>
          <span>{formatMessageTime(live?.last_message_at ?? post.last_message_at ?? post.created_at)}</span>
        </div>
      </div>
      {img && <img className="post-thumb" src={img.url} alt="" loading="lazy" />}
    </motion.button>
  );
}
