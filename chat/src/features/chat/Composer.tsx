import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3, Clock, EyeOff, Eye, FileText, Gift, Mic, MessagesSquare, PlusCircle, SendHorizontal, Smile, Sparkles, Sticker, Trash2, Upload, X, AtSign, Lock, Timer, Ban,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tip } from '../../components/ui/Tooltip';
import { NameTag } from '../../components/ui/NameTag';
import { toTokens, type TokenMap } from '../../lib/compose';
import { emojiSync, loadEmoji, searchEmoji, customEmojiToken } from '../../lib/emoji';
import { MESSAGE_EFFECTS } from '../../lib/neon';
import { has, P } from '../../lib/permissions';
import { cn, fileSize, isImage, uuid } from '../../lib/utils';
import { getData, useData } from '../../store/data';
import { displayName, dmName, isBlocked, serverRoles, usePerms } from '../../store/selectors';
import { navigate, openModal, setUI, toast, useUI } from '../../store/ui';
import { addReminder, sendMessage } from '../../store/actions/messages';
import { setNickname } from '../../store/actions/servers';
import { unblockUser } from '../../store/actions/users';
import { sendTyping, stopTyping } from '../../store/realtime';
import { Autocomplete, type AcItem } from './Autocomplete';
import { COMMANDS, parseDuration, runCommand } from './commands';
import { autosize } from './EditBox';
import { ExpressionPicker } from '../expressions/ExpressionPicker';
import { VoiceRecorder } from './VoiceRecorder';
import { playUi } from '../../lib/sounds';

interface Pending { id: string; file: File; spoiler: boolean; preview: string | null }

const lastSent: Record<string, number> = {};

export function Composer({ channelId, pendingFiles, onFilesTaken, compact }: { channelId: string; pendingFiles?: File[] | null; onFilesTaken?: () => void; compact?: boolean }) {
  const channel = useData((s) => s.channels[channelId]);
  const me = useData((s) => s.me!);
  const neon = useData((s) => s.profiles[s.me!]?.neon ?? null);
  const perms = usePerms(channelId);
  const reply = useUI((s) => s.replyTo[channelId]);
  const draft = useUI((s) => s.drafts[channelId] ?? '');
  const [text, setText] = useState(draft);
  const [files, setFiles] = useState<Pending[]>([]);
  const [picker, setPicker] = useState<null | 'emoji' | 'gif' | 'sticker'>(null);
  const [plus, setPlus] = useState(false);
  const [effect, setEffect] = useState<string | null>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ac, setAc] = useState<{ trigger: string; query: string; start: number; items: AcItem[]; index: number } | null>(null);
  const [, tick] = useState(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const tokenMap = useRef<TokenMap>({});
  const member = useData((s) => (channel?.server_id ? s.memberships[channel.server_id] : undefined));
  const otherId = useData((s) => (channel?.type === 'dm' ? channel.recipients?.find((x) => x !== s.me) : undefined));
  const blocked = useData((s) => (otherId ? isBlocked(otherId, s) : false));

  const limit = neon === 'neon' ? 4000 : 2000;
  const canSend = has(perms, P.SEND_MESSAGES);
  const canAttach = has(perms, P.ATTACH_FILES);
  const timedOut = !!member?.timeout_until && new Date(member.timeout_until) > new Date();
  const slow = channel?.slowmode_seconds ?? 0;
  const bypassSlow = has(perms, P.MANAGE_MESSAGES) || has(perms, P.MANAGE_CHANNELS);
  const slowLeft = slow && !bypassSlow && lastSent[channelId] ? Math.max(0, Math.ceil((lastSent[channelId] + slow * 1000 - Date.now()) / 1000)) : 0;

  useEffect(() => { if (!emojiSync()) void loadEmoji(); }, []);
  useEffect(() => { setText(useUI.getState().drafts[channelId] ?? ''); tokenMap.current = {}; }, [channelId]);
  useEffect(() => { if (ta.current) autosize(ta.current); }, [text]);
  useEffect(() => { if (slowLeft > 0) { const t = setTimeout(() => tick((n) => n + 1), 1000); return () => clearTimeout(t); } }, [slowLeft]);
  useEffect(() => {
    if (pendingFiles?.length) { addFiles(pendingFiles); onFilesTaken?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFiles]);
  // focus on reply / channel change
  useEffect(() => { if (reply) ta.current?.focus(); }, [reply]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (useUI.getState().modals.length || useUI.getState().quickSwitcher) return;
      if (e.key.length === 1 && !compact) ta.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [compact]);

  const saveDraft = useCallback((v: string) => setUI((s) => ({ drafts: { ...s.drafts, [channelId]: v } })), [channelId]);

  function addFiles(list: File[]) {
    if (!canAttach) { toast('You cannot attach files in this channel', 'error'); return; }
    const next = list.slice(0, 10 - files.length).map((f) => ({ id: uuid(), file: f, spoiler: false, preview: isImage(f.type) ? URL.createObjectURL(f) : null }));
    setFiles((cur) => [...cur, ...next]);
  }

  // ------------------------------------------------------------- autocomplete
  const computeAc = useCallback((value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(^|\s)([@#:/])([^\s@#:/]*)$/);
    if (!m || (m[2] === '/' && before.trim() !== `/${m[3]}`) || (m[2] === ':' && m[3].length < 2)) { setAc(null); return; }
    const trigger = m[2], query = m[3].toLowerCase(), start = caret - m[3].length - 1;
    const s = getData();
    let items: AcItem[] = [];
    if (trigger === '@') {
      const ids = channel?.server_id ? Object.keys(s.members[channel.server_id] || {}) : channel?.recipients ?? [];
      items = ids.map((id) => s.profiles[id]).filter(Boolean)
        .filter((p) => p.username.includes(query) || (p.display_name ?? '').toLowerCase().includes(query) || displayName(p.id, channel?.server_id, s).toLowerCase().includes(query))
        .slice(0, 8)
        .map((p) => ({ key: 'u' + p.id, kind: 'user' as const, userId: p.id, label: displayName(p.id, channel?.server_id, s), sub: p.username, insert: `@${p.username} ` }));
      if (channel?.server_id) {
        const canAll = has(perms, P.MENTION_EVERYONE);
        const roles = serverRoles(channel.server_id, s).filter((r) => !r.is_default && (r.mentionable || canAll) && r.name.toLowerCase().includes(query)).slice(0, 5);
        items.push(...roles.map((r) => ({ key: 'r' + r.id, kind: 'role' as const, label: r.name, color: r.color, insert: `@${r.name} `, token: `<@&${r.id}>`, sub: 'Notify users with this role' })));
        if (canAll) for (const sp of ['everyone', 'here']) if (sp.startsWith(query)) items.push({ key: sp, kind: 'special', label: sp, insert: `@${sp} `, sub: sp === 'everyone' ? 'Notify everyone who can see this channel' : 'Notify everyone online' });
      }
    } else if (trigger === '#') {
      items = Object.values(s.channels).filter((c) => c.server_id && c.server_id === channel?.server_id && c.type !== 'category' && c.name.includes(query))
        .slice(0, 10).map((c) => ({ key: 'c' + c.id, kind: 'channel' as const, label: c.name, channelType: c.type, insert: `#${c.name} `, sub: c.parent_id ? s.channels[c.parent_id]?.name : undefined }));
    } else if (trigger === ':') {
      const customs = Object.values(s.emojis).filter((e) => e.name.toLowerCase().includes(query)).sort((a, b) => Number(b.server_id === channel?.server_id) - Number(a.server_id === channel?.server_id)).slice(0, 5);
      items = customs.map((e) => ({ key: 'e' + e.id, kind: 'custom' as const, label: `:${e.name}:`, url: e.url, insert: `:${e.name}: `, token: customEmojiToken(e), sub: s.servers[e.server_id]?.name, neon: e.server_id !== channel?.server_id }));
      items.push(...searchEmoji(query, 10 - items.length).map((e) => ({ key: 'x' + e.emoji, kind: 'emoji' as const, label: `:${e.names[0]}:`, emoji: e.emoji, insert: e.emoji })));
    } else if (trigger === '/') {
      items = COMMANDS.filter((c) => c.name.startsWith(query) && (!c.server || channel?.server_id)).map((c) => ({ key: '/' + c.name, kind: 'command' as const, label: `/${c.name}${c.args ? ' ' + c.args : ''}`, sub: c.description, insert: `/${c.name} `, neon: c.neon }));
    }
    setAc(items.length ? { trigger, query, start, items, index: 0 } : null);
  }, [channel, perms]);

  function pick(it: AcItem) {
    if (!ac || !ta.current) return;
    if (it.kind === 'custom' && it.neon && !neon) { toast('Using emoji from other servers is a Neon perk', 'neon', '💎'); }
    const caret = ta.current.selectionStart;
    const next = text.slice(0, ac.start) + it.insert + text.slice(caret);
    if (it.token) tokenMap.current[it.insert.trim()] = it.token;
    setText(next);
    saveDraft(next);
    setAc(null);
    requestAnimationFrame(() => {
      const pos = ac.start + it.insert.length;
      ta.current?.setSelectionRange(pos, pos);
      ta.current?.focus();
    });
  }

  function insertAtCaret(str: string) {
    const el = ta.current;
    const start = el?.selectionStart ?? text.length, end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + str + text.slice(end);
    setText(next);
    saveDraft(next);
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + str.length, start + str.length); });
  }

  // ------------------------------------------------------------- send
  async function submit() {
    if (!channel) return;
    let content = text.trim();
    let fx = effect;
    let silent = false;
    if (content.startsWith('@silent ')) { silent = true; content = content.slice(8).trim(); }
    if (content.startsWith('/')) {
      const r = runCommand(content);
      if (r?.kind === 'error') { toast(r.message, 'error'); return; }
      if (r?.kind === 'action') {
        clear();
        if (r.action === 'poll') openModal({ kind: 'poll', channelId });
        else if (r.action === 'catchup' && channel.server_id) openModal({ kind: 'catchUp', serverId: channel.server_id });
        else if (r.action === 'schedule') openModal({ kind: 'schedule', channelId, content: r.arg });
        else if (r.action === 'nick' && channel.server_id) await setNickname(channel.server_id, me, r.arg).then(() => toast('Nickname updated', 'success')).catch((e: Error) => toast(e.message, 'error'));
        else if (r.action === 'remind') {
          const [when, ...rest] = r.arg.split(/\s+/);
          const ms = parseDuration(when || '');
          if (!ms) { toast('Usage: /remind 10m take out the pizza', 'error'); return; }
          await addReminder({ messageId: null, channelId, at: new Date(Date.now() + ms), note: rest.join(' ') });
        }
        return;
      }
      if (r?.kind === 'send') {
        content = r.content;
        if (r.effect) fx = r.effect;
        if (r.silent) silent = true;
      }
    }
    if (fx && neon !== 'neon') { toast('Message effects are a Neon perk ✨', 'neon', '💎'); fx = null; }
    if (!content && !files.length) return;
    if (content.length > limit) { toast(`Your message is too long (${content.length}/${limit})`, 'error'); return; }
    if (slowLeft > 0) { toast(`Slowmode — wait ${slowLeft}s`, 'error'); return; }
    const tokens = toTokens(content, channel.server_id, tokenMap.current);
    const sending = files.map((f) => (f.spoiler ? new File([f.file], `SPOILER_${f.file.name}`, { type: f.file.type }) : f.file));
    const replyTo = reply ?? null;
    clear();
    lastSent[channelId] = Date.now();
    stopTyping(channelId);
    const ok = await sendMessage(channelId, { content: tokens, files: sending, replyTo, effect: fx, silent });
    if (ok) playUi('send');
  }

  function clear() {
    setText('');
    saveDraft('');
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setFiles([]);
    setEffect(null);
    tokenMap.current = {};
    setUI((s) => ({ replyTo: { ...s.replyTo, [channelId]: undefined } }));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ac) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setAc({ ...ac, index: (ac.index + 1) % ac.items.length }); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setAc({ ...ac, index: (ac.index - 1 + ac.items.length) % ac.items.length }); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); pick(ac.items[ac.index]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setAc(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
      return;
    }
    if (e.key === 'Escape') {
      if (reply) { e.preventDefault(); setUI((s) => ({ replyTo: { ...s.replyTo, [channelId]: undefined } })); }
      return;
    }
    if (e.key === 'ArrowUp' && !text) {
      const s = getData();
      const ids = s.channelMsgs[channelId]?.ids ?? [];
      for (let i = ids.length - 1; i >= 0; i--) {
        const m = s.messages[ids[i]];
        if (m?.author_id === me && m.type === 'default' && !m.pending) { e.preventDefault(); setUI({ editing: m.id }); break; }
      }
    }
  }

  const placeholder = useMemo(() => {
    if (!channel) return '';
    if (channel.type === 'dm' || channel.type === 'group_dm') return `Message ${channel.type === 'dm' ? '@' : ''}${dmName(channel)}`;
    if (channel.type === 'thread') return `Message ${channel.name}`;
    return `Message #${channel.name}`;
  }, [channel]);

  if (!channel) return null;

  if (blocked) {
    return (
      <div className="composer-locked">
        <Ban size={18} /> You blocked this user. <button className="btn sm secondary" onClick={() => void unblockUser(otherId!)}>Unblock</button>
      </div>
    );
  }
  if (timedOut) {
    return <div className="composer-locked"><Timer size={18} /> You’re timed out until {new Date(member!.timeout_until!).toLocaleTimeString()} and can’t send messages.</div>;
  }
  if (!canSend) {
    return <div className="composer-locked"><Lock size={18} /> You do not have permission to send messages in this channel.</div>;
  }
  if (channel.type === 'thread' && channel.locked && !has(perms, P.MANAGE_THREADS)) {
    return <div className="composer-locked"><Lock size={18} /> This thread is locked.</div>;
  }

  const over = text.length > limit;
  const replyMsg = reply ? getData().messages[reply.id] : null;

  return (
    <div className={cn('composer', compact && 'compact')}>
      <AnimatePresence>
        {ac && <Autocomplete key="ac" trigger={ac.trigger} query={ac.query} items={ac.items} index={ac.index} onPick={pick} onHover={(i) => setAc({ ...ac, index: i })} />}
      </AnimatePresence>
      <div className={cn('composer-box', (reply || files.length) && 'has-top', over && 'over')}>
        <AnimatePresence initial={false}>
          {reply && replyMsg && (
            <motion.div className="composer-reply" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <span>Replying to <NameTag userId={replyMsg.author_id} serverId={channel.server_id} /></span>
              <span className="spacer" />
              {replyMsg.author_id !== me && (
                <Tip label={reply.ping ? 'Click to disable pinging the author' : 'Click to enable pinging the author'}>
                  <button className={cn('ping-toggle', reply.ping && 'on')} onClick={() => setUI((s) => ({ replyTo: { ...s.replyTo, [channelId]: { ...reply, ping: !reply.ping } } }))}>
                    <AtSign size={14} /> {reply.ping ? 'ON' : 'OFF'}
                  </button>
                </Tip>
              )}
              <button className="icon-btn sm" onClick={() => setUI((s) => ({ replyTo: { ...s.replyTo, [channelId]: undefined } }))}><X /></button>
            </motion.div>
          )}
        </AnimatePresence>
        {files.length > 0 && (
          <div className="composer-files scroll thin">
            <AnimatePresence initial={false}>
              {files.map((f) => (
                <motion.div key={f.id} className="cf-item" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                  <div className={cn('cf-preview', f.spoiler && 'spoiler')}>
                    {f.preview ? <img src={f.preview} alt="" /> : <FileText size={36} />}
                  </div>
                  <div className="cf-name ellipsis">{f.file.name}</div>
                  <div className="cf-size tiny muted">{fileSize(f.file.size)}</div>
                  <div className="cf-actions">
                    <Tip label={f.spoiler ? 'Remove spoiler' : 'Mark as spoiler'}>
                      <button className="icon-btn sm" onClick={() => setFiles((cur) => cur.map((x) => (x.id === f.id ? { ...x, spoiler: !x.spoiler } : x)))}>{f.spoiler ? <Eye /> : <EyeOff />}</button>
                    </Tip>
                    <Tip label="Remove">
                      <button className="icon-btn sm danger" onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}><Trash2 /></button>
                    </Tip>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {recording ? (
          <VoiceRecorder
            onCancel={() => setRecording(false)}
            onSend={async (voice) => { setRecording(false); await sendMessage(channelId, { content: '', voice, replyTo: reply ?? null }); clear(); }}
          />
        ) : (
          <div className="composer-row">
            <div className="plus-wrap">
              <button className={cn('composer-plus', plus && 'open')} onClick={() => setPlus(!plus)} aria-label="More options"><PlusCircle /></button>
              <AnimatePresence>
                {plus && (
                  <motion.div className="menu plus-menu" initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ duration: 0.13 }} onMouseLeave={() => setPlus(false)}>
                    {canAttach && <button className="menu-item" onClick={() => { setPlus(false); fileInput.current?.click(); }}><span className="mi-icon"><Upload /></span><span className="mi-label">Upload a File</span><span className="mi-hint">Max {neon === 'neon' ? '50' : neon === 'lite' ? '25' : '10'} MB</span></button>}
                    {channel.server_id && has(perms, P.CREATE_THREADS) && channel.type !== 'thread' && <button className="menu-item" onClick={() => { setPlus(false); openModal({ kind: 'createThread', channelId }); }}><span className="mi-icon"><MessagesSquare /></span><span className="mi-label">Create Thread</span></button>}
                    {has(perms, P.CREATE_POLLS) && <button className="menu-item" onClick={() => { setPlus(false); openModal({ kind: 'poll', channelId }); }}><span className="mi-icon"><BarChart3 /></span><span className="mi-label">Create Poll</span></button>}
                    {has(perms, P.SEND_VOICE_MESSAGES) && <button className="menu-item" onClick={() => { setPlus(false); setRecording(true); }}><span className="mi-icon"><Mic /></span><span className="mi-label">Voice Message</span></button>}
                    <button className="menu-item" onClick={() => { setPlus(false); openModal({ kind: 'schedule', channelId, content: text }); }}><span className="mi-icon"><Clock /></span><span className="mi-label">Schedule Message <span className="tag-new">NEW</span></span></button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
            </div>
            <textarea
              ref={ta}
              className="composer-input"
              rows={1}
              value={text}
              placeholder={slowLeft > 0 ? `Slowmode: wait ${slowLeft}s` : placeholder}
              onChange={(e) => {
                setText(e.target.value);
                saveDraft(e.target.value);
                computeAc(e.target.value, e.target.selectionStart);
                if (e.target.value.trim()) sendTyping(channelId);
              }}
              onKeyDown={onKeyDown}
              onClick={(e) => computeAc(text, (e.target as HTMLTextAreaElement).selectionStart)}
              onBlur={() => setTimeout(() => setAc(null), 120)}
              onPaste={(e) => {
                const items = Array.from(e.clipboardData.files);
                if (items.length) { e.preventDefault(); addFiles(items); }
              }}
              maxLength={limit + 500}
            />
            <div className="composer-tools">
              {effect && (
                <button className="effect-chip" onClick={() => setEffect(null)}>{MESSAGE_EFFECTS.find((x) => x.id === effect)?.emoji} {effect} <X size={12} /></button>
              )}
              <Tip label="Send a gift of Neon"><button className="ct-btn hide-mobile" onClick={() => navigate({ kind: 'neon' })}><Gift /></button></Tip>
              <div className="fx-wrap">
                <Tip label="Message effects (Neon)"><button className={cn('ct-btn fx', effectsOpen && 'on')} onClick={() => setEffectsOpen(!effectsOpen)}><Sparkles /></button></Tip>
                <AnimatePresence>
                  {effectsOpen && (
                    <motion.div className="fx-menu" initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} onMouseLeave={() => setEffectsOpen(false)}>
                      <div className="fx-title"><Sparkles size={14} /> Message effects {neon !== 'neon' && <span className="tag-new">NEON</span>}</div>
                      <div className="fx-grid">
                        {MESSAGE_EFFECTS.map((fx) => (
                          <button key={fx.id} className={cn('fx-opt', effect === fx.id && 'on')} onClick={() => {
                            if (neon !== 'neon') { toast('Message effects are a Neon perk — start a free trial!', 'neon', '💎'); navigate({ kind: 'neon' }); return; }
                            setEffect(effect === fx.id ? null : fx.id); setEffectsOpen(false); ta.current?.focus();
                          }}>
                            <span className="fx-emoji">{fx.emoji}</span>{fx.name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <Tip label="Open GIF picker"><button className={cn('ct-btn gif', picker === 'gif' && 'on')} onClick={() => setPicker(picker === 'gif' ? null : 'gif')}>GIF</button></Tip>
              <Tip label="Open sticker picker"><button className={cn('ct-btn', picker === 'sticker' && 'on')} onClick={() => setPicker(picker === 'sticker' ? null : 'sticker')}><Sticker /></button></Tip>
              <Tip label="Select emoji"><button className={cn('ct-btn emoji-btn', picker === 'emoji' && 'on')} onClick={() => setPicker(picker === 'emoji' ? null : 'emoji')}><Smile /></button></Tip>
              {(text.trim() || files.length) ? (
                <motion.button className="send-btn" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} whileTap={{ scale: 0.9 }} onClick={() => void submit()} aria-label="Send"><SendHorizontal size={18} /></motion.button>
              ) : has(perms, P.SEND_VOICE_MESSAGES) ? (
                <Tip label="Record a voice message"><button className="ct-btn" onClick={() => setRecording(true)}><Mic /></button></Tip>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {text.length > limit - 300 && (
        <div className={cn('char-left', over && 'over')}>
          {limit - text.length}
          {over && neon !== 'neon' && <button className="btn link" onClick={() => navigate({ kind: 'neon' })}>Get Neon for 4,000</button>}
        </div>
      )}
      {slow > 0 && !bypassSlow && <div className="slowmode-note"><Timer size={12} /> Slowmode is on{slowLeft ? ` · ${slowLeft}s` : ''}</div>}
      <AnimatePresence>
        {picker && (
          <ExpressionPicker
            mode="composer"
            tab={picker}
            serverId={channel.server_id}
            anchor="composer"
            onClose={() => setPicker(null)}
            onTab={(t) => setPicker(t)}
            onPick={(token, opts) => {
              if (opts?.sticker) { void sendMessage(channelId, { content: '', sticker: opts.sticker, replyTo: reply ?? null }); clear(); setPicker(null); return; }
              if (opts?.gif) { void sendMessage(channelId, { content: opts.gif, replyTo: reply ?? null }); clear(); setPicker(null); return; }
              if (opts?.display) { tokenMap.current[opts.display] = token; insertAtCaret(opts.display + ' '); } else insertAtCaret(token);
              if (!opts?.keepOpen) setPicker(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
