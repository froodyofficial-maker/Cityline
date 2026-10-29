import { AlarmClock, Bookmark, Copy, CornerUpRight, EyeOff, Link, Mail, MessagesSquare, Pencil, Pin, Reply, SmilePlus, Trash2, Volume2, Hash } from 'lucide-react';
import { DEFAULT_QUICK_REACTIONS } from '../../lib/emoji';
import { has, P } from '../../lib/permissions';
import type { Message } from '../../lib/types';
import { copyText } from '../../lib/utils';
import { stripMarkdown } from '../../lib/markdown';
import { getData } from '../../store/data';
import { permsFor } from '../../store/selectors';
import { openModal, setUI, toast, type MenuItem } from '../../store/ui';
import { addReminder, deleteMessage, markUnread, suppressEmbeds, toggleBookmark, togglePin, toggleReaction } from '../../store/actions/messages';

export function quickReactions() {
  return getData().settings.quickReactions?.length ? getData().settings.quickReactions! : DEFAULT_QUICK_REACTIONS;
}

export function messageLink(m: Message) {
  const base = window.location.href.split('#')[0];
  return m.server_id ? `${base}#/channels/${m.server_id}/${m.channel_id}?m=${m.id}` : `${base}#/channels/@me/${m.channel_id}?m=${m.id}`;
}

export function confirmDelete(m: Message) {
  openModal({
    kind: 'confirm', title: 'Delete Message', danger: true, confirm: 'Delete',
    body: <>Are you sure you want to delete this message?<div className="confirm-quote">{m.content.slice(0, 300) || (m.attachments.length ? `${m.attachments.length} attachment(s)` : 'No text')}</div><span className="tiny muted">Tip: hold Shift while clicking the trash icon to skip this.</span></>,
    onConfirm: () => deleteMessage(m.id),
  });
}

function speak(text: string) {
  try {
    const u = new SpeechSynthesisUtterance(stripMarkdown(text));
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    toast('Your browser cannot read messages aloud', 'error');
  }
}

export function messageMenu(m: Message, openReactionPicker: () => void): MenuItem[] {
  const s = getData();
  const me = s.me!;
  const perms = permsFor(m.channel_id, s);
  const own = m.author_id === me;
  const isDM = !m.server_id;
  const canManage = isDM ? false : has(perms, P.MANAGE_MESSAGES);
  const canPin = isDM || canManage;
  const items: MenuItem[] = [];
  if (m.type === 'default') {
    if (has(perms, P.ADD_REACTIONS)) {
      items.push({
        label: 'Add Reaction', icon: <SmilePlus />, submenu: [
          ...quickReactions().map((e) => ({ label: e, onClick: () => void toggleReaction(m.id, e) })),
          { divider: true },
          { label: 'View More', onClick: openReactionPicker },
        ],
      });
    }
    if (own) items.push({ label: 'Edit Message', icon: <Pencil />, onClick: () => setUI({ editing: m.id }) });
    if (has(perms, P.SEND_MESSAGES)) items.push({ label: 'Reply', icon: <Reply />, onClick: () => setUI((u) => ({ replyTo: { ...u.replyTo, [m.channel_id]: { id: m.id, ping: true } } })) });
    items.push({ label: 'Forward', icon: <CornerUpRight />, onClick: () => openModal({ kind: 'forward', messageId: m.id }) });
    if (m.server_id && has(perms, P.CREATE_THREADS) && !m.thread_id && s.channels[m.channel_id]?.type !== 'thread') {
      items.push({ label: 'Create Thread', icon: <MessagesSquare />, onClick: () => openModal({ kind: 'createThread', channelId: m.channel_id, messageId: m.id }) });
    }
    items.push({ divider: true });
    if (m.content) items.push({ label: 'Copy Text', icon: <Copy />, onClick: () => { void copyText(m.content); toast('Copied to clipboard', 'success'); } });
    if (canPin) items.push({ label: m.pinned ? 'Unpin Message' : 'Pin Message', icon: <Pin />, onClick: () => void togglePin(m) });
    items.push({ label: 'Mark Unread', icon: <Mail />, onClick: () => void markUnread(m) });
    items.push({ label: 'Copy Message Link', icon: <Link />, onClick: () => { void copyText(messageLink(m)); toast('Link copied', 'success', '🔗'); } });
    items.push({ label: 'Save for Later', icon: <Bookmark />, onClick: () => void toggleBookmark(m) });
    items.push({
      label: 'Remind Me', icon: <AlarmClock />, submenu: [
        { label: 'In 20 minutes', onClick: () => void addReminder({ messageId: m.id, channelId: m.channel_id, at: new Date(Date.now() + 20 * 60_000) }) },
        { label: 'In 1 hour', onClick: () => void addReminder({ messageId: m.id, channelId: m.channel_id, at: new Date(Date.now() + 3600_000) }) },
        { label: 'In 3 hours', onClick: () => void addReminder({ messageId: m.id, channelId: m.channel_id, at: new Date(Date.now() + 3 * 3600_000) }) },
        { label: 'Tomorrow morning', onClick: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); void addReminder({ messageId: m.id, channelId: m.channel_id, at: d }); } },
        { label: 'Custom…', onClick: () => openModal({ kind: 'reminder', messageId: m.id, channelId: m.channel_id }) },
      ],
    });
    if (m.content) items.push({ label: 'Speak Message', icon: <Volume2 />, onClick: () => speak(m.content) });
    if (own && (m.embeds.length > 0) && (m.flags & 2) === 0) items.push({ label: 'Remove Embeds', icon: <EyeOff />, onClick: () => void suppressEmbeds(m) });
  }
  if ((own && (m.type === 'default' || m.type === 'call')) || canManage) {
    items.push({ divider: true });
    items.push({ label: 'Delete Message', icon: <Trash2 />, danger: true, onClick: () => confirmDelete(m) });
  }
  if (s.settings.developerMode) {
    items.push({ divider: true });
    items.push({ label: 'Copy Message ID', icon: <Hash />, onClick: () => void copyText(m.id) });
  }
  return items;
}
