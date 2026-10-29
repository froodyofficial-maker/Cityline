import { motion } from 'motion/react';
import { Clock, Gem, Lock, Search, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ServerIcon } from '../../components/ui/Avatar';
import { Switch } from '../../components/ui/Controls';
import { Tip } from '../../components/ui/Tooltip';
import { config } from '../../lib/config';
import { BUILTIN_STICKERS, customEmojiToken, EMOJI_GROUPS, emojiSync, loadEmoji, notoAnimatedUrl, searchEmoji, SKIN_TONES, withSkin, type EmojiEntry } from '../../lib/emoji';
import type { CustomEmoji, Message } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useData } from '../../store/data';
import { navigate, toast } from '../../store/ui';
import { updateSettings } from '../../store/actions/bootstrap';
import { useShallow } from 'zustand/react/shallow';

type Tab = 'emoji' | 'gif' | 'sticker';
export interface PickOpts { superR?: boolean; sticker?: Message['sticker']; gif?: string; display?: string; keepOpen?: boolean }

interface Props {
  mode: 'composer' | 'reaction';
  tab?: Tab;
  superReaction?: boolean;
  serverId?: string | null;
  anchor: 'composer' | 'message';
  onPick: (token: string, opts?: PickOpts) => void;
  onClose: () => void;
  onTab?: (t: Tab) => void;
}

export function ExpressionPicker({ mode, tab = 'emoji', superReaction, serverId, anchor, onPick, onClose, onTab }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [current, setCurrent] = useState<Tab>(mode === 'reaction' ? 'emoji' : tab);
  const [superR, setSuperR] = useState(!!superReaction);
  const neon = useData((s) => s.profiles[s.me!]?.neon ?? null);

  useEffect(() => setCurrent(mode === 'reaction' ? 'emoji' : tab), [tab, mode]);

  useLayoutEffect(() => {
    const parent = holder.current?.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    const W = Math.min(440, window.innerWidth - 16), H = Math.min(460, window.innerHeight - 80);
    let left: number, top: number;
    if (anchor === 'composer') { left = r.right - W - 8; top = r.top - H - 8; }
    else { left = r.right - W - 60; top = r.top - 10; if (top + H > window.innerHeight - 10) top = window.innerHeight - H - 10; }
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8));
    top = Math.max(8, top);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      const t = e.target as HTMLElement;
      if (t.closest('.ct-btn') && anchor === 'composer') return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey, true); };
  }, [onClose, anchor]);

  const setTab = (t: Tab) => { setCurrent(t); onTab?.(t); };

  return (
    <span ref={holder} className="picker-holder">
      {pos && createPortal(
        <motion.div
          ref={ref}
          className="picker"
          style={{ left: pos.left, top: pos.top }}
          initial={{ opacity: 0, y: anchor === 'composer' ? 12 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 520, damping: 34 }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {mode === 'composer' && (
            <div className="picker-tabs">
              {(['gif', 'sticker', 'emoji'] as Tab[]).map((t) => (
                <button key={t} className={cn(current === t && 'on')} onClick={() => setTab(t)}>{t === 'gif' ? 'GIFs' : t === 'sticker' ? 'Stickers' : 'Emoji'}</button>
              ))}
            </div>
          )}
          {mode === 'reaction' && (
            <div className="picker-super">
              <Sparkles size={15} className={superR ? 'neon-icon' : ''} />
              <span className="grow">Super Reaction</span>
              {!neon && <span className="tag-new">NEON</span>}
              <Switch on={superR} onChange={(v) => { if (!neon) { toast('Super Reactions are part of Neon', 'neon', '💎'); return; } setSuperR(v); }} />
            </div>
          )}
          {current === 'emoji' && <EmojiTab serverId={serverId ?? null} mode={mode} onPick={(t, o) => onPick(t, { ...o, superR })} onClose={onClose} />}
          {current === 'gif' && <GifTab onPick={(url) => onPick('', { gif: url })} />}
          {current === 'sticker' && <StickerTab onPick={(st) => onPick('', { sticker: st })} />}
        </motion.div>,
        document.body,
      )}
    </span>
  );
}

// ---------------------------------------------------------------- emoji

function EmojiTab({ serverId, mode, onPick, onClose }: { serverId: string | null; mode: 'composer' | 'reaction'; onPick: (token: string, opts?: PickOpts) => void; onClose: () => void }) {
  const [list, setList] = useState<EmojiEntry[] | null>(emojiSync());
  const [q, setQ] = useState('');
  const [hover, setHover] = useState<{ label: string; glyph: React.ReactNode } | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const tone = useData((s) => s.settings.skinTone ?? 0);
  const recent = useData(useShallow((s) => s.settings.recentEmoji ?? []));
  const emojis = useData((s) => s.emojis);
  const servers = useData((s) => s.servers);
  const neon = useData((s) => !!s.profiles[s.me!]?.neon);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!list) void loadEmoji().then(setList); }, [list]);

  const byServer = useMemo(() => {
    const map = new Map<string, CustomEmoji[]>();
    for (const e of Object.values(emojis)) {
      if (!servers[e.server_id]) continue;
      if (!map.has(e.server_id)) map.set(e.server_id, []);
      map.get(e.server_id)!.push(e);
    }
    const entries = [...map.entries()].sort(([a], [b]) => Number(b === serverId) - Number(a === serverId));
    return entries;
  }, [emojis, servers, serverId]);

  const results = useMemo(() => (q ? searchEmoji(q, 120) : []), [q, list]);
  const customResults = useMemo(() => (q ? Object.values(emojis).filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).slice(0, 40) : []), [q, emojis]);

  function pickUnicode(e: EmojiEntry, ev: React.MouseEvent) {
    const glyph = withSkin(e, tone);
    remember(glyph);
    onPick(glyph, { keepOpen: ev.shiftKey });
    if (!ev.shiftKey && mode === 'reaction') onClose();
  }
  function pickCustom(e: CustomEmoji, ev: React.MouseEvent) {
    const external = e.server_id !== serverId;
    if (external && !neon) { toast(`Using emoji from other servers is a Neon perk`, 'neon', '💎'); return; }
    const token = customEmojiToken(e);
    remember(token);
    if (mode === 'reaction') { onPick(token, { keepOpen: ev.shiftKey }); if (!ev.shiftKey) onClose(); }
    else onPick(token, { display: `:${e.name}:`, keepOpen: ev.shiftKey });
  }
  function remember(token: string) {
    const next = [token, ...recent.filter((x) => x !== token)].slice(0, 27);
    updateSettings({ recentEmoji: next });
  }
  const jump = (id: string) => body.current?.querySelector(`[data-sec="${id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  const renderToken = (t: string) => {
    const m = t.match(/^<a?:([A-Za-z0-9_]+):([0-9a-f-]{36})>$/);
    if (m) {
      const e = emojis[m[2]];
      return e ? <button key={t} className="ep-cell" onClick={(ev) => pickCustom(e, ev)} onMouseEnter={() => setHover({ label: `:${e.name}:`, glyph: <img src={e.url} alt="" /> })}><img src={e.url} alt={e.name} /></button> : null;
    }
    return <button key={t} className="ep-cell" onClick={(ev) => { remember(t); onPick(t, { keepOpen: ev.shiftKey }); if (!ev.shiftKey && mode === 'reaction') onClose(); }} onMouseEnter={() => setHover({ label: t, glyph: t })}>{t}</button>;
  };

  return (
    <div className="ep">
      <div className="ep-top">
        <div className="input-wrap grow">
          <Search />
          <input className="input" autoFocus placeholder="Find the perfect emoji" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="tone-wrap">
          <button className="tone-btn" onClick={() => setToneOpen(!toneOpen)}>{SKIN_TONES[tone]}</button>
          {toneOpen && (
            <div className="tone-menu">
              {SKIN_TONES.map((t, i) => <button key={i} onClick={() => { updateSettings({ skinTone: i }); setToneOpen(false); }}>{t}</button>)}
            </div>
          )}
        </div>
      </div>
      <div className="ep-main">
        {!q && (
          <div className="ep-side scroll hidden-bar">
            {recent.length > 0 && <Tip label="Frequently Used" side="right"><button onClick={() => jump('recent')}><Clock size={18} /></button></Tip>}
            {byServer.map(([sid]) => <Tip key={sid} label={servers[sid]?.name} side="right"><button onClick={() => jump(sid)}><ServerIcon name={servers[sid]?.name ?? '?'} url={servers[sid]?.icon_url} size={24} /></button></Tip>)}
            {EMOJI_GROUPS.map((g) => <Tip key={g.id} label={g.label} side="right"><button onClick={() => jump('g' + g.id)} className="ep-side-emoji">{g.icon}</button></Tip>)}
          </div>
        )}
        <div className="ep-body scroll thin" ref={body}>
          {!list && <div className="empty"><span className="spinner" /></div>}
          {q ? (
            <>
              {customResults.length > 0 && (
                <Section title="Custom">
                  {customResults.map((e) => <CustomCell key={e.id} e={e} locked={e.server_id !== serverId && !neon} onPick={pickCustom} onHover={setHover} />)}
                </Section>
              )}
              <Section title={`Search results for “${q}”`}>
                {results.map((e) => <button key={e.emoji} className="ep-cell" onClick={(ev) => pickUnicode(e, ev)} onMouseEnter={() => setHover({ label: `:${e.names[0]}:`, glyph: withSkin(e, tone) })}>{withSkin(e, tone)}</button>)}
              </Section>
              {!results.length && !customResults.length && <div className="empty"><div className="art">🔍</div>No emoji found</div>}
            </>
          ) : list && (
            <>
              {recent.length > 0 && <Section id="recent" title="Frequently Used">{recent.map(renderToken)}</Section>}
              {byServer.map(([sid, list2]) => (
                <Section key={sid} id={sid} title={servers[sid]?.name ?? 'Server'} icon={<ServerIcon name={servers[sid]?.name ?? '?'} url={servers[sid]?.icon_url} size={16} />}>
                  {list2.map((e) => <CustomCell key={e.id} e={e} locked={sid !== serverId && !neon} onPick={pickCustom} onHover={setHover} />)}
                </Section>
              ))}
              {EMOJI_GROUPS.map((g) => (
                <Section key={g.id} id={'g' + g.id} title={g.label}>
                  {list.filter((e) => e.group === g.id).map((e) => (
                    <button key={e.emoji} className="ep-cell" onClick={(ev) => pickUnicode(e, ev)} onMouseEnter={() => setHover({ label: `:${e.names[0]}:`, glyph: withSkin(e, tone) })}>{withSkin(e, tone)}</button>
                  ))}
                </Section>
              ))}
            </>
          )}
        </div>
      </div>
      <div className="ep-foot">
        {hover ? (
          <>
            <span className="ep-foot-glyph">{hover.glyph}</span>
            <span className="ellipsis bold">{hover.label}</span>
          </>
        ) : !neon ? (
          <button className="ep-upsell" onClick={() => navigate({ kind: 'neon' })}><Gem size={14} /> Unlock custom emoji everywhere with <b className="grad-text">Neon</b></button>
        ) : <span className="muted small">Hold Shift to pick several</span>}
      </div>
    </div>
  );
}

function Section({ id, title, icon, children }: { id?: string; title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ep-sec" data-sec={id}>
      <div className="ep-sec-title">{icon}{title}</div>
      <div className="ep-grid">{children}</div>
    </div>
  );
}

function CustomCell({ e, locked, onPick, onHover }: { e: CustomEmoji; locked: boolean; onPick: (e: CustomEmoji, ev: React.MouseEvent) => void; onHover: (h: { label: string; glyph: React.ReactNode }) => void }) {
  return (
    <button className={cn('ep-cell', locked && 'locked')} onClick={(ev) => onPick(e, ev)} onMouseEnter={() => onHover({ label: `:${e.name}:`, glyph: <img src={e.url} alt="" /> })}>
      <img src={e.url} alt={e.name} loading="lazy" />
      {locked && <Lock className="ep-lock" size={10} />}
    </button>
  );
}

// ---------------------------------------------------------------- gifs

interface Gif { id: string; url: string; preview: string; w: number; h: number; title: string }

async function giphy(q: string): Promise<Gif[]> {
  const key = config.giphyApiKey;
  const url = q
    ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=30&rating=pg-13`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=30&rating=pg-13`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.data ?? []).map((g: { id: string; title: string; images: Record<string, { url: string; width: string; height: string; webp?: string }> }) => ({
    id: g.id, title: g.title,
    url: g.images.original?.url ?? g.images.downsized?.url,
    preview: g.images.fixed_width?.webp ?? g.images.fixed_width?.url,
    w: Number(g.images.fixed_width?.width ?? 200), h: Number(g.images.fixed_width?.height ?? 150),
  }));
}

const GIF_CATEGORIES = ['Trending', 'Happy', 'LOL', 'Wow', 'Dance', 'Thumbs up', 'Facepalm', 'Love', 'Cat', 'Hype'];

function GifTab({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [loading, setLoading] = useState(false);
  const enabled = !!config.giphyApiKey;
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    const t = setTimeout(() => void giphy(q === 'Trending' ? '' : q).then(setGifs).catch(() => setGifs([])).finally(() => setLoading(false)), 300);
    return () => clearTimeout(t);
  }, [q, enabled]);
  if (!enabled) {
    return (
      <div className="empty" style={{ height: 380 }}>
        <div className="art">🎞️</div>
        <h3>GIFs are almost ready</h3>
        <p>Add a free GIPHY API key as <code>giphyApiKey</code> in <code>public/config.js</code> (or <code>VITE_GIPHY_API_KEY</code>) to search millions of GIFs.</p>
        <p className="small">You can still paste any GIF link into a message.</p>
      </div>
    );
  }
  const cols: Gif[][] = [[], []];
  const heights = [0, 0];
  for (const g of gifs) { const i = heights[0] <= heights[1] ? 0 : 1; cols[i].push(g); heights[i] += g.h / g.w; }
  return (
    <div className="gif-tab">
      <div className="ep-top">
        <div className="input-wrap grow"><Search /><input className="input" autoFocus placeholder="Search GIPHY" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="gif-cats scroll hidden-bar">
        {GIF_CATEGORIES.map((c) => <button key={c} className={cn('chip', (q || 'Trending') === c && 'on')} onClick={() => setQ(c === 'Trending' ? '' : c)}>{c}</button>)}
      </div>
      <div className="gif-grid scroll thin">
        {loading && !gifs.length && <div className="empty"><span className="spinner" /></div>}
        {cols.map((col, i) => (
          <div key={i} className="gif-col">
            {col.map((g) => (
              <button key={g.id} className="gif-item" onClick={() => onPick(g.url)} style={{ aspectRatio: `${g.w} / ${g.h}` }}>
                <img src={g.preview} alt={g.title} loading="lazy" />
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="gif-credit">Powered by GIPHY</div>
    </div>
  );
}

// ---------------------------------------------------------------- stickers

function StickerTab({ onPick }: { onPick: (s: NonNullable<Message['sticker']>) => void }) {
  const stickers = useData((s) => s.stickers);
  const servers = useData((s) => s.servers);
  const groups = useMemo(() => {
    const map = new Map<string, typeof stickers[string][]>();
    for (const st of Object.values(stickers)) {
      if (!map.has(st.server_id)) map.set(st.server_id, []);
      map.get(st.server_id)!.push(st);
    }
    return [...map.entries()];
  }, [stickers]);
  return (
    <div className="ep-body scroll thin sticker-body">
      <div className="ep-sec">
        <div className="ep-sec-title">✨ Cityline Critters <span className="tag-new">ANIMATED</span></div>
        <div className="sticker-grid">
          {BUILTIN_STICKERS.map((s) => (
            <Tip key={s.id} label={s.name}>
              <button className="sticker-cell" onClick={() => onPick({ id: s.id, name: s.name, url: notoAnimatedUrl(s.emoji) })}>
                <img src={notoAnimatedUrl(s.emoji)} alt={s.name} loading="lazy" />
              </button>
            </Tip>
          ))}
        </div>
      </div>
      {groups.map(([sid, list]) => (
        <div key={sid} className="ep-sec">
          <div className="ep-sec-title"><ServerIcon name={servers[sid]?.name ?? '?'} url={servers[sid]?.icon_url} size={16} /> {servers[sid]?.name}</div>
          <div className="sticker-grid">
            {list.map((s) => (
              <Tip key={s.id} label={s.name}>
                <button className="sticker-cell" onClick={() => onPick({ id: s.id, name: s.name, url: s.url })}><img src={s.url} alt={s.name} loading="lazy" /></button>
              </Tip>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
