// Emoji data is loaded on first use (keeps the first page load small).
export type EmojiRow = [string, string[], string, number, string[]?];

export interface EmojiEntry { emoji: string; names: string[]; keywords: string; group: number; skins?: string[] }

export const EMOJI_GROUPS: { id: number; label: string; icon: string }[] = [
  { id: 0, label: 'Smileys & Emotion', icon: '😀' },
  { id: 1, label: 'People & Body', icon: '👋' },
  { id: 3, label: 'Animals & Nature', icon: '🐻' },
  { id: 4, label: 'Food & Drink', icon: '🍔' },
  { id: 5, label: 'Travel & Places', icon: '🚗' },
  { id: 6, label: 'Activities', icon: '⚽' },
  { id: 7, label: 'Objects', icon: '💡' },
  { id: 8, label: 'Symbols', icon: '💜' },
  { id: 9, label: 'Flags', icon: '🏁' },
];

let cache: EmojiEntry[] | null = null;
let byName: Map<string, EmojiEntry> | null = null;
let loading: Promise<EmojiEntry[]> | null = null;

export function loadEmoji(): Promise<EmojiEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = import('../data/emoji.json').then((mod) => {
      const rows = (mod.default ?? mod) as unknown as EmojiRow[];
      cache = rows.map(([emoji, names, keywords, group, skins]) => ({ emoji, names, keywords, group, skins }));
      byName = new Map();
      for (const e of cache) for (const n of e.names) if (!byName.has(n)) byName.set(n, e);
      return cache;
    });
  }
  return loading;
}

export function emojiSync() { return cache; }
export function emojiByName(name: string) { return byName?.get(name.toLowerCase()); }

export function searchEmoji(q: string, limit = 60): EmojiEntry[] {
  if (!cache) return [];
  const s = q.toLowerCase().replace(/^:/, '').replace(/:$/, '');
  if (!s) return cache.slice(0, limit);
  const starts: EmojiEntry[] = [], contains: EmojiEntry[] = [], tags: EmojiEntry[] = [];
  for (const e of cache) {
    if (e.names.some((n) => n.startsWith(s))) starts.push(e);
    else if (e.names.some((n) => n.includes(s))) contains.push(e);
    else if (e.keywords.includes(s)) tags.push(e);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains, ...tags].slice(0, limit);
}

export function withSkin(e: EmojiEntry, tone: number) {
  if (!tone || !e.skins || !e.skins[tone - 1]) return e.emoji;
  return e.skins[tone - 1];
}

export const SKIN_TONES = ['✋', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'];

// Custom emoji tokens look like <:name:uuid> or <a:name:uuid> (animated)
export const CUSTOM_EMOJI_RE = /<(a?):([A-Za-z0-9_]{2,32}):([0-9a-f-]{36})>/;
export function customEmojiToken(e: { id: string; name: string; animated: boolean }) {
  return `<${e.animated ? 'a' : ''}:${e.name}:${e.id}>`;
}
export function parseCustomEmoji(token: string) {
  const m = token.match(CUSTOM_EMOJI_RE);
  return m ? { animated: !!m[1], name: m[2], id: m[3] } : null;
}

// Google's animated Noto emoji (CC BY 4.0) — used for stickers and super reactions.
export function notoAnimatedUrl(emoji: string, size: 512 = 512) {
  const cps = [...emoji].map((c) => c.codePointAt(0)!.toString(16)).filter((h) => h !== 'fe0f');
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${cps.join('_')}/${size}.webp`;
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*|\p{Regional_Indicator}{2}|<a?:[A-Za-z0-9_]{2,32}:[0-9a-f-]{36}>|\s)+$/u;
/** true when a message is only emoji (Discord shows those "jumbo") */
export function isEmojiOnly(text: string) {
  const t = text.trim();
  if (!t || t.length > 200) return false;
  if (!EMOJI_ONLY.test(t)) return false;
  const count = [...t.matchAll(/\p{Extended_Pictographic}|<a?:[A-Za-z0-9_]{2,32}:[0-9a-f-]{36}>/gu)].length;
  return count > 0 && count <= 27;
}

export const DEFAULT_QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '🎉'];

// Built-in animated sticker pack ("Cityline Critters")
export const BUILTIN_STICKERS: { id: string; name: string; emoji: string }[] = [
  { id: 'wave', name: 'Hi there', emoji: '👋' },
  { id: 'party', name: 'Party time', emoji: '🥳' },
  { id: 'love', name: 'Love it', emoji: '😍' },
  { id: 'lol', name: 'LOL', emoji: '😂' },
  { id: 'cool', name: 'Too cool', emoji: '😎' },
  { id: 'think', name: 'Hmm…', emoji: '🤔' },
  { id: 'wow', name: 'Whoa', emoji: '🤯' },
  { id: 'cry', name: 'So sad', emoji: '😭' },
  { id: 'fire', name: 'On fire', emoji: '🔥' },
  { id: 'heart', name: 'Heart', emoji: '❤️' },
  { id: 'clap', name: 'Applause', emoji: '👏' },
  { id: 'rocket', name: 'To the moon', emoji: '🚀' },
  { id: 'ghost', name: 'Boo!', emoji: '👻' },
  { id: 'sparkles', name: 'Sparkle', emoji: '✨' },
  { id: 'cat', name: 'Cat vibes', emoji: '😺' },
  { id: 'hundred', name: '100', emoji: '💯' },
  { id: 'sleep', name: 'Sleepy', emoji: '😴' },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈' },
];
