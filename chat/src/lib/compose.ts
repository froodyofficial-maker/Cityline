// Converts between what you type (@name, #channel, :emoji:) and what is
// stored (<@id>, <#id>, <:name:id>, unicode).
import { getData } from '../store/data';
import { emojiByName } from './emoji';

export interface TokenMap { [display: string]: string }

export function toTokens(text: string, serverId: string | null, map: TokenMap = {}): string {
  const s = getData();
  let out = text;
  // explicit picks from autocomplete first (longest first so "@Mod Team" beats "@Mod")
  for (const display of Object.keys(map).sort((a, b) => b.length - a.length)) {
    out = out.split(display).join(map[display]);
  }
  // code spans are left alone
  const parts = out.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts.map((part, i) => {
    if (i % 2 === 1) return part;
    let p = part;
    // @username → <@id>
    p = p.replace(/(^|[\s(])@([a-z0-9_.]{2,32})\b/g, (m, pre: string, name: string) => {
      if (name === 'everyone' || name === 'here') return m;
      const prof = Object.values(s.profiles).find((x) => x.username === name);
      return prof ? `${pre}<@${prof.id}>` : m;
    });
    // #channel-name → <#id> (same server first)
    p = p.replace(/(^|[\s(])#([a-z0-9\-_À-￿]{1,100})/g, (m, pre: string, name: string) => {
      const chans = Object.values(s.channels).filter((c) => c.name === name && c.type !== 'dm' && c.type !== 'group_dm');
      const ch = chans.find((c) => c.server_id === serverId) ?? chans[0];
      return ch ? `${pre}<#${ch.id}>` : m;
    });
    // :custom_emoji: or :shortcode:
    p = p.replace(/:([A-Za-z0-9_+\-]{2,32}):/g, (m, name: string) => {
      const custom = Object.values(s.emojis).find((e) => e.name === name && (e.server_id === serverId)) ?? Object.values(s.emojis).find((e) => e.name === name);
      if (custom) return `<${custom.animated ? 'a' : ''}:${custom.name}:${custom.id}>`;
      const uni = emojiByName(name);
      return uni ? uni.emoji : m;
    });
    return p;
  }).join('');
}

/** Stored content → editable text, plus the map needed to turn it back. */
export function fromTokens(content: string): { text: string; map: TokenMap } {
  const s = getData();
  const map: TokenMap = {};
  let text = content.replace(/<@&([0-9a-f-]{36})>/g, (m, id: string) => {
    const r = s.roles[id];
    if (!r) return m;
    map[`@${r.name}`] = m;
    return `@${r.name}`;
  });
  text = text.replace(/<@!?([0-9a-f-]{36})>/g, (m, id: string) => {
    const p = s.profiles[id];
    return p ? `@${p.username}` : m;
  });
  text = text.replace(/<#([0-9a-f-]{36})>/g, (m, id: string) => {
    const c = s.channels[id];
    return c ? `#${c.name}` : m;
  });
  text = text.replace(/<a?:([A-Za-z0-9_]{2,32}):([0-9a-f-]{36})>/g, (m, name: string) => {
    map[`:${name}:`] = m;
    return `:${name}:`;
  });
  return { text, map };
}
