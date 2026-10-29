import { check, rpc, supabase } from '../../lib/supabase';
import type { Attachment, Channel, Message, Poll, Profile, ReactionAgg } from '../../lib/types';
import { buildEmbeds } from '../../lib/embeds';
import { checkSize, uploadFile } from '../../lib/upload';
import { uuid } from '../../lib/utils';
import { emptyChannelMsgs, getData, patchMessage, removeMessage, setData, upsertChannel, upsertMessages, upsertProfiles } from '../data';
import { playEffect, setUI, toast, toastError } from '../ui';

interface Page { messages: Message[]; profiles: Profile[]; has_more: boolean }

function setMeta(channelId: string, meta: Partial<ReturnType<typeof emptyChannelMsgs>>) {
  setData((s) => ({ channelMsgs: { ...s.channelMsgs, [channelId]: { ...(s.channelMsgs[channelId] ?? emptyChannelMsgs()), ...meta } } }));
}

export async function loadMessages(channelId: string, opts: { before?: string; around?: string; force?: boolean } = {}) {
  const cm = getData().channelMsgs[channelId];
  if (cm?.loading) return;
  if (!opts.before && !opts.around && cm?.loaded && !opts.force && !cm.hasNewer) return;
  setMeta(channelId, { loading: true });
  try {
    const res = await rpc<Page>('get_messages', { p_channel: channelId, p_before: opts.before ?? null, p_around: opts.around ?? null, p_limit: 50 });
    upsertProfiles(res.profiles);
    if (opts.before) upsertMessages(channelId, res.messages, 'prepend', { loading: false, hasMore: res.has_more });
    else if (opts.around) {
      const last = res.messages[res.messages.length - 1];
      const ch = getData().channels[channelId];
      const newer = !!(last && ch?.last_message_at && new Date(ch.last_message_at) > new Date(last.created_at));
      upsertMessages(channelId, res.messages, 'replace', { loading: false, loaded: true, hasMore: true, hasNewer: newer });
    } else upsertMessages(channelId, res.messages, 'replace', { loading: false, loaded: true, hasMore: res.has_more, hasNewer: false });
  } catch (e) {
    setMeta(channelId, { loading: false, loaded: true });
    toastError(e);
  }
}

export async function loadNewer(channelId: string) {
  const s = getData();
  const cm = s.channelMsgs[channelId];
  if (!cm || cm.loading || !cm.hasNewer) return;
  const last = s.messages[cm.ids[cm.ids.length - 1]];
  setMeta(channelId, { loading: true });
  try {
    const res = await rpc<Page>('get_messages', { p_channel: channelId, p_after: last?.created_at ?? null, p_limit: 50 });
    upsertProfiles(res.profiles);
    upsertMessages(channelId, res.messages, 'append', { loading: false, hasNewer: res.messages.length >= 50 });
  } catch (e) {
    setMeta(channelId, { loading: false });
    toastError(e);
  }
}

export async function jumpToPresent(channelId: string) {
  await loadMessages(channelId, { force: true });
}

export interface SendInput {
  content: string;
  files?: File[];
  replyTo?: { id: string; ping: boolean } | null;
  poll?: Poll | null;
  sticker?: Message['sticker'];
  effect?: string | null;
  silent?: boolean;
  voice?: { blob: Blob; duration: number; waveform: number[] } | null;
  forwarded?: Message['forwarded'];
}

export async function sendMessage(channelId: string, input: SendInput) {
  const s = getData();
  const me = s.me!;
  const id = uuid();
  const files = input.files ?? [];
  const tier = s.profiles[me]?.neon ?? null;
  try {
    files.forEach((f) => checkSize(f, tier));
  } catch (e) { toastError(e); return false; }

  const reply = input.replyTo ? s.messages[input.replyTo.id] : null;
  let flags = 0;
  if (input.silent) flags |= 1;
  if (input.voice) flags |= 4;
  if (input.replyTo && !input.replyTo.ping) flags |= 16;
  const preview: Attachment[] = files.map((f) => ({ url: URL.createObjectURL(f), name: f.name, size: f.size, type: f.type || 'application/octet-stream' }));
  if (input.voice) preview.push({ url: URL.createObjectURL(input.voice.blob), name: 'voice-message.webm', size: input.voice.blob.size, type: input.voice.blob.type || 'audio/webm', duration: input.voice.duration, waveform: input.voice.waveform });
  const temp: Message = {
    id, channel_id: channelId, server_id: s.channels[channelId]?.server_id ?? null, author_id: me, type: 'default',
    content: input.content, attachments: preview, embeds: [], sticker: input.sticker ?? null, poll: input.poll ?? null,
    forwarded: input.forwarded ?? null, effect: input.effect ?? null, reply_to_id: reply?.id ?? null, thread_id: null,
    mentions: [], mention_roles: [], mention_everyone: false, pinned: false, pinned_at: null, flags, nonce: id,
    edited_at: null, created_at: new Date().toISOString(), reactions: [], pending: true,
    reply: reply ? { id: reply.id, author_id: reply.author_id, content: reply.content.slice(0, 200), attachments: reply.attachments.length, type: reply.type } : null,
  };
  upsertMessages(channelId, [temp], 'append');
  if (input.effect) playEffect(input.effect);

  try {
    const progress = new Array(Math.max(files.length, 1)).fill(0);
    const report = () => setUI((u) => ({ uploads: { ...u.uploads, [id]: progress.reduce((a, b) => a + b, 0) / progress.length } }));
    const uploads: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      uploads.push(await uploadFile(files[i], 'attachments', (p) => { progress[i] = p; report(); }));
    }
    if (input.voice) {
      const a = await uploadFile(input.voice.blob, 'voice', undefined, 'voice-message.webm');
      uploads.push({ ...a, duration: input.voice.duration, waveform: input.voice.waveform });
    }
    const row = {
      id, channel_id: channelId, author_id: me, content: input.content, attachments: uploads,
      reply_to_id: reply?.id ?? null, poll: input.poll ?? null, sticker: input.sticker ?? null,
      effect: input.effect ?? null, flags, nonce: id, forwarded: input.forwarded ?? null,
    };
    const saved = check(await supabase.from('messages').insert(row).select().single()) as Message;
    preview.forEach((a) => URL.revokeObjectURL(a.url));
    setUI((u) => { const uploads = { ...u.uploads }; delete uploads[id]; return { uploads }; });
    patchMessage(id, { ...saved, pending: false, failed: undefined });
    setData((st) => {
      const ch = st.channels[channelId];
      return ch ? { channels: { ...st.channels, [channelId]: { ...ch, last_message_at: saved.created_at } } } : {};
    });
    if (input.content) {
      void buildEmbeds(input.content).then(async (embeds) => {
        if (!embeds.length) return;
        patchMessage(id, { embeds });
        await supabase.from('messages').update({ embeds }).eq('id', id);
      });
    }
    return true;
  } catch (e) {
    patchMessage(id, { pending: false, failed: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export async function retryMessage(m: Message) {
  removeMessage(m.id);
  if (m.attachments.some((a) => a.url.startsWith('blob:'))) {
    toast('Attachments need to be added again', 'info');
  }
  await sendMessage(m.channel_id, { content: m.content, poll: m.poll, sticker: m.sticker, effect: m.effect, replyTo: m.reply_to_id ? { id: m.reply_to_id, ping: true } : null });
}

export async function editMessage(id: string, content: string) {
  const old = getData().messages[id];
  if (!old || old.content === content) return;
  patchMessage(id, { content, edited_at: new Date().toISOString() });
  const { data, error } = await supabase.from('messages').update({ content }).eq('id', id).select().single();
  if (error) {
    patchMessage(id, { content: old.content, edited_at: old.edited_at });
    toastError(new Error(error.message));
    return;
  }
  patchMessage(id, data as Message);
  void buildEmbeds(content).then(async (embeds) => {
    patchMessage(id, { embeds });
    if (JSON.stringify(embeds) !== JSON.stringify(old.embeds)) await supabase.from('messages').update({ embeds }).eq('id', id);
  });
}

export async function deleteMessage(id: string) {
  const old = getData().messages[id];
  if (!old) return;
  if (old.failed || old.pending) { removeMessage(id); return; }
  removeMessage(id);
  const { error } = await supabase.from('messages').delete().eq('id', id);
  if (error) {
    upsertMessages(old.channel_id, [old], 'append');
    toastError(new Error(error.message));
  }
}

export async function suppressEmbeds(m: Message) {
  patchMessage(m.id, { flags: m.flags | 2 });
  await supabase.from('messages').update({ flags: m.flags | 2 }).eq('id', m.id);
}

function bumpReaction(list: ReactionAgg[], emoji: string, isSuper: boolean, delta: 1 | -1, mine: boolean): ReactionAgg[] {
  const out = list.map((r) => ({ ...r }));
  let r = out.find((x) => x.emoji === emoji);
  if (!r) {
    if (delta < 0) return out;
    r = { emoji, count: 0, super_count: 0, me: false, me_super: false };
    out.push(r);
  }
  if (isSuper) { r.super_count = Math.max(0, r.super_count + delta); if (mine) r.me_super = delta > 0; }
  else { r.count = Math.max(0, r.count + delta); if (mine) r.me = delta > 0; }
  return out.filter((x) => x.count + x.super_count > 0);
}

export function applyReactionEvent(kind: 'add' | 'remove', row: { message_id: string; user_id: string; emoji: string; is_super: boolean }) {
  const s = getData();
  const m = s.messages[row.message_id];
  if (!m) return;
  const mine = row.user_id === s.me;
  const agg = (m.reactions ?? []).find((r) => r.emoji === row.emoji);
  if (mine) {
    const already = row.is_super ? !!agg?.me_super : !!agg?.me;
    if (kind === 'add' && already) return;
    if (kind === 'remove' && !already) return;
  }
  patchMessage(row.message_id, { reactions: bumpReaction(m.reactions ?? [], row.emoji, row.is_super, kind === 'add' ? 1 : -1, mine) });
}

export async function toggleReaction(messageId: string, emoji: string, isSuper = false) {
  const s = getData();
  const m = s.messages[messageId];
  if (!m || m.pending) return;
  const agg = (m.reactions ?? []).find((r) => r.emoji === emoji);
  const mine = isSuper ? !!agg?.me_super : !!agg?.me;
  const before = m.reactions ?? [];
  patchMessage(messageId, { reactions: bumpReaction(before, emoji, isSuper, mine ? -1 : 1, true) });
  const q = mine
    ? supabase.from('reactions').delete().match({ message_id: messageId, user_id: s.me, emoji, is_super: isSuper })
    : supabase.from('reactions').insert({ message_id: messageId, user_id: s.me, emoji, is_super: isSuper });
  const { error } = await q;
  if (error) {
    patchMessage(messageId, { reactions: before });
    toastError(new Error(error.message));
  }
}

export async function reactors(messageId: string, emoji: string) {
  const { data } = await supabase.from('reactions').select('user_id,is_super').eq('message_id', messageId).eq('emoji', emoji).limit(100);
  return (data ?? []) as { user_id: string; is_super: boolean }[];
}

export async function togglePin(m: Message) {
  patchMessage(m.id, { pinned: !m.pinned });
  const { error } = await supabase.from('messages').update({ pinned: !m.pinned }).eq('id', m.id);
  if (error) { patchMessage(m.id, { pinned: m.pinned }); toastError(new Error(error.message)); }
  else toast(m.pinned ? 'Message unpinned' : 'Message pinned', 'success', '📌');
}

const readTimers = new Map<string, ReturnType<typeof setTimeout>>();
export function markRead(channelId: string) {
  const s = getData();
  const rs = s.readStates[channelId];
  const ch = s.channels[channelId];
  if (!ch) return;
  const unread = !rs || (ch.last_message_at && new Date(ch.last_message_at) > new Date(rs.last_read_at)) || rs.mention_count > 0;
  if (!unread) return;
  const now = new Date().toISOString();
  setData((st) => ({ readStates: { ...st.readStates, [channelId]: { user_id: st.me!, channel_id: channelId, last_read_at: now, mention_count: 0 } } }));
  clearTimeout(readTimers.get(channelId));
  readTimers.set(channelId, setTimeout(() => { void rpc('mark_read', { p_channel: channelId }).catch(() => {}); }, 600));
}

export async function markServerRead(serverId: string) {
  const s = getData();
  const now = new Date().toISOString();
  const readStates = { ...s.readStates };
  for (const c of Object.values(s.channels)) if (c.server_id === serverId) readStates[c.id] = { user_id: s.me!, channel_id: c.id, last_read_at: now, mention_count: 0 };
  setData({ readStates });
  await rpc('mark_server_read', { p_server: serverId }).catch(toastError);
}

export async function markUnread(m: Message) {
  const s = getData();
  const at = new Date(new Date(m.created_at).getTime() - 1).toISOString();
  setData((st) => ({ readStates: { ...st.readStates, [m.channel_id]: { user_id: st.me!, channel_id: m.channel_id, last_read_at: at, mention_count: 0 } } }));
  await supabase.from('read_states').upsert({ user_id: s.me, channel_id: m.channel_id, last_read_at: at, mention_count: 0 });
}

export async function loadPins(channelId: string) {
  const res = await rpc<Page>('get_pins', { p_channel: channelId });
  upsertProfiles(res.profiles);
  return res.messages;
}

export interface SearchParams {
  query: string; serverId?: string | null; channelId?: string | null; author?: string | null; has?: string | null;
  mentions?: string | null; before?: string | null; after?: string | null; pinned?: boolean | null; offset?: number;
}

export async function searchMessages(p: SearchParams) {
  const res = await rpc<{ total: number; messages: Message[]; profiles: Profile[] }>('search_messages', {
    p_query: p.query, p_server: p.serverId ?? null, p_channel: p.channelId ?? null, p_author: p.author ?? null,
    p_has: p.has ?? null, p_mentions: p.mentions ?? null, p_before: p.before ?? null, p_after: p.after ?? null,
    p_pinned: p.pinned ?? null, p_limit: 25, p_offset: p.offset ?? 0,
  });
  upsertProfiles(res.profiles);
  return res;
}

export async function loadMentions(before?: string) {
  const res = await rpc<Page>('get_mentions', { p_limit: 30, p_before: before ?? null });
  upsertProfiles(res.profiles);
  return res.messages;
}

export async function loadCatchUp(serverId: string) {
  const res = await rpc<{ messages: Message[]; profiles: Profile[]; unread_messages: number; channels: number }>('get_catch_up', { p_server: serverId });
  upsertProfiles(res.profiles);
  return res;
}

export async function fetchMessage(id: string) {
  const m = await rpc<Message | null>('get_message', { p_id: id });
  if (m) setData((s) => ({ messages: { ...s.messages, [m.id]: { ...s.messages[m.id], ...m } } }));
  return m;
}

// ---------- threads & forums ---------------------------------------------------

export async function createThread(parentId: string, name: string, opts: { messageId?: string; content?: string; tags?: string[]; files?: File[] } = {}) {
  const attachments: Attachment[] = [];
  for (const f of opts.files ?? []) attachments.push(await uploadFile(f, 'attachments'));
  const id = await rpc<string>('create_thread', {
    p_parent: parentId, p_name: name, p_message: opts.messageId ?? null, p_content: opts.content ?? null,
    p_tags: opts.tags ?? [], p_attachments: attachments,
  });
  const ch = check(await supabase.from('channels').select('*').eq('id', id).single()) as Channel;
  upsertChannel(ch);
  if (opts.messageId) patchMessage(opts.messageId, { thread_id: id, thread: { id, name: ch.name, message_count: ch.message_count, last_message_at: ch.last_message_at, archived: false } });
  return ch;
}

export async function loadThreads(parentId: string, archived = false) {
  const res = await rpc<{ threads: (Channel & { starter: Message | null; last_read_at: string | null })[]; profiles: Profile[] }>('get_threads', { p_parent: parentId, p_archived: archived });
  upsertProfiles(res.profiles);
  for (const t of res.threads) {
    const { starter, last_read_at: _lr, ...ch } = t;
    upsertChannel(ch);
    if (starter) setData((s) => ({ messages: { ...s.messages, [starter.id]: { ...s.messages[starter.id], ...starter } } }));
  }
  return res.threads;
}

export async function updateThread(id: string, patch: Partial<Channel>) {
  const ch = check(await supabase.from('channels').update(patch).eq('id', id).select().single()) as Channel;
  upsertChannel(ch);
}

// ---------- polls -------------------------------------------------------------------

export async function votePoll(messageId: string, options: string[]) {
  await rpc('vote_poll', { p_message: messageId, p_options: options });
  await fetchMessage(messageId);
}

// ---------- forwarding, bookmarks, reminders, scheduling ----------------------

export async function forwardMessage(messageId: string, targetChannelId: string, note = '') {
  const m = getData().messages[messageId];
  if (!m) return;
  const ok = await sendMessage(targetChannelId, {
    content: note,
    forwarded: { author_id: m.author_id, content: m.content, attachments: m.attachments, channel_id: m.channel_id, created_at: m.created_at },
  });
  if (ok) toast('Message forwarded', 'success', '↪️');
}

export async function toggleBookmark(m: Message) {
  const me = getData().me!;
  const { data } = await supabase.from('bookmarks').select('message_id').eq('user_id', me).eq('message_id', m.id);
  if (data && data.length) {
    await supabase.from('bookmarks').delete().match({ user_id: me, message_id: m.id });
    toast('Removed from saved messages', 'info', '🔖');
  } else {
    check(await supabase.from('bookmarks').insert({ user_id: me, message_id: m.id }));
    toast('Saved for later — find it in your Inbox', 'success', '🔖');
  }
}

export async function loadBookmarks() {
  const me = getData().me!;
  const rows = (check(await supabase.from('bookmarks').select('*').eq('user_id', me).order('created_at', { ascending: false }).limit(50)) ?? []) as { message_id: string }[];
  const msgs = await Promise.all(rows.map((r) => fetchMessage(r.message_id).catch(() => null)));
  const list = msgs.filter(Boolean) as Message[];
  const authors = list.map((m) => m.author_id).filter(Boolean) as string[];
  if (authors.length) upsertProfiles(await rpc<Profile[]>('get_profiles', { p_ids: [...new Set(authors)] }));
  return list;
}

export async function addReminder(opts: { messageId: string | null; channelId: string | null; at: Date; note?: string }) {
  const me = getData().me!;
  const row = check(await supabase.from('reminders').insert({ user_id: me, message_id: opts.messageId, channel_id: opts.channelId, remind_at: opts.at.toISOString(), note: opts.note ?? '' }).select().single());
  setData((s) => ({ reminders: [...s.reminders, row as never] }));
  toast(`I’ll remind you ${opts.at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success', '⏰');
}

export async function loadReminders() {
  const me = getData().me!;
  const rows = check(await supabase.from('reminders').select('*').eq('user_id', me).eq('done', false).order('remind_at'));
  setData({ reminders: (rows ?? []) as never });
}

export async function completeReminder(id: string) {
  setData((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
  await supabase.from('reminders').update({ done: true }).eq('id', id);
}

export async function scheduleMessage(channelId: string, content: string, at: Date) {
  const me = getData().me!;
  check(await supabase.from('scheduled_messages').insert({ user_id: me, channel_id: channelId, content, send_at: at.toISOString() }));
  toast(`Scheduled for ${at.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`, 'success', '🕒');
}

export async function loadScheduled(channelId: string) {
  return (check(await supabase.from('scheduled_messages').select('*').eq('channel_id', channelId).order('send_at')) ?? []) as { id: string; content: string; send_at: string }[];
}

export async function cancelScheduled(id: string) {
  check(await supabase.from('scheduled_messages').delete().eq('id', id));
}
