// Discord-flavoured markdown → React. Nothing is ever injected as HTML except
// highlight.js output, which escapes its input.
import { memo, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { highlight } from './highlight';
import { copyText, formatFull, formatTimestampToken } from './utils';
import { ChannelMention, CustomEmojiImg, RoleMention, SpecialMention, UserMention } from '../components/chat/Mentions';
import { Tip } from '../components/ui/Tooltip';

export interface MdOptions {
  serverId?: string | null;
  inline?: boolean;       // single-line contexts (reply previews, topics)
  jumbo?: boolean;
  noLinks?: boolean;
}

type Rule = { re: RegExp; render: (m: RegExpExecArray, opts: MdOptions, key: number, depth: number) => ReactNode };

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={open ? 'spoiler open' : 'spoiler'} onClick={(e) => { e.stopPropagation(); setOpen(true); }} role="button" aria-label="Spoiler">
      <span className="spoiler-inner">{children}</span>
    </span>
  );
}

function SafeLink({ href, children }: { href: string; children: ReactNode }) {
  let ok = false;
  try {
    const u = new URL(href);
    ok = u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:';
  } catch { ok = false; }
  if (!ok) return <>{children}</>;
  return <a href={href} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>{children}</a>;
}

function Timestamp({ unix, style }: { unix: number; style: string }) {
  return (
    <Tip label={formatFull(new Date(unix * 1000).toISOString())}>
      <span className="md-time">{formatTimestampToken(unix, style)}</span>
    </Tip>
  );
}

const inlineRules: Rule[] = [
  { re: /\\([*_~`|\\<>#[\]()@:-])/y, render: (m) => m[1] },
  { re: /``([^`]+?)``|`([^`\n]+?)`/y, render: (m, _o, k) => <code key={k} className="md-code">{m[1] ?? m[2]}</code> },
  { re: /\|\|([\s\S]+?)\|\|/y, render: (m, o, k, d) => <Spoiler key={k}>{parseInline(m[1], o, d + 1)}</Spoiler> },
  { re: /\*\*\*([\s\S]+?)\*\*\*(?!\*)/y, render: (m, o, k, d) => <strong key={k}><em>{parseInline(m[1], o, d + 1)}</em></strong> },
  { re: /\*\*([\s\S]+?)\*\*(?!\*)/y, render: (m, o, k, d) => <strong key={k}>{parseInline(m[1], o, d + 1)}</strong> },
  { re: /__([\s\S]+?)__(?!_)/y, render: (m, o, k, d) => <u key={k}>{parseInline(m[1], o, d + 1)}</u> },
  { re: /\*(?=\S)([\s\S]*?\S)\*(?!\*)/y, render: (m, o, k, d) => <em key={k}>{parseInline(m[1], o, d + 1)}</em> },
  { re: /_(?=\S)([\s\S]*?\S)_(?![A-Za-z0-9_])/y, render: (m, o, k, d) => <em key={k}>{parseInline(m[1], o, d + 1)}</em> },
  { re: /~~([\s\S]+?)~~/y, render: (m, o, k, d) => <s key={k}>{parseInline(m[1], o, d + 1)}</s> },
  { re: /\[([^\]\n]{1,200})\]\(<?(https?:\/\/[^\s)>]+)>?\)/y, render: (m, o, k, d) => (o.noLinks ? <span key={k}>{parseInline(m[1], o, d + 1)}</span> : <SafeLink key={k} href={m[2]}>{parseInline(m[1], { ...o, noLinks: true }, d + 1)}</SafeLink>) },
  { re: /<(https?:\/\/[^\s>]+)>/y, render: (m, o, k) => (o.noLinks ? m[1] : <SafeLink key={k} href={m[1]}>{m[1]}</SafeLink>) },
  { re: /https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"*_~|]/y, render: (m, o, k) => (o.noLinks ? m[0] : <SafeLink key={k} href={m[0]}>{m[0]}</SafeLink>) },
  { re: new RegExp(`<@&(${UUID})>`, 'y'), render: (m, o, k) => <RoleMention key={k} id={m[1]} serverId={o.serverId} /> },
  { re: new RegExp(`<@!?(${UUID})>`, 'y'), render: (m, o, k) => <UserMention key={k} id={m[1]} serverId={o.serverId} /> },
  { re: new RegExp(`<#(${UUID})>`, 'y'), render: (m, _o, k) => <ChannelMention key={k} id={m[1]} /> },
  { re: new RegExp(`<(a?):([A-Za-z0-9_]{2,32}):(${UUID})>`, 'y'), render: (m, o, k) => <CustomEmojiImg key={k} id={m[3]} name={m[2]} animated={!!m[1]} jumbo={o.jumbo} /> },
  { re: /<t:(-?\d{1,13})(?::([tTdDfFR]))?>/y, render: (m, _o, k) => <Timestamp key={k} unix={Number(m[1])} style={m[2] ?? 'f'} /> },
  { re: /@(everyone|here)\b/y, render: (m, _o, k) => <SpecialMention key={k} label={`@${m[1]}`} /> },
];

export function parseInline(text: string, opts: MdOptions = {}, depth = 0): ReactNode[] {
  if (depth > 8) return [text];
  const out: ReactNode[] = [];
  let buf = '';
  let i = 0;
  let key = 0;
  outer: while (i < text.length) {
    const ch = text[i];
    // quick reject: only try rules on characters that can start one
    if ('\\`|*_~[<h@'.includes(ch)) {
      for (const rule of inlineRules) {
        rule.re.lastIndex = i;
        const m = rule.re.exec(text);
        if (m && m[0].length) {
          if (buf) { out.push(buf); buf = ''; }
          out.push(rule.render(m, opts, key++, depth));
          i += m[0].length;
          continue outer;
        }
      }
    }
    if (ch === '\n') {
      if (buf) { out.push(buf); buf = ''; }
      out.push(opts.inline ? ' ' : <br key={key++} />);
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf) out.push(buf);
  return out;
}

const CodeBlock = memo(function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="md-pre">
      <div className="md-pre-bar">
        <span>{lang || 'code'}</span>
        <button className="icon-btn sm" onClick={async (e) => { e.stopPropagation(); await copyText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }} aria-label="Copy code">
          {copied ? <Check /> : <Copy />}
        </button>
      </div>
      <pre className="scroll thin"><code className="hljs" dangerouslySetInnerHTML={{ __html: highlight(code, lang) }} /></pre>
    </div>
  );
});

/** Full block-level render (code blocks, quotes, headings, lists). */
export function renderMarkdown(src: string, opts: MdOptions = {}): ReactNode {
  if (opts.inline) return parseInline(src.replace(/```(?:[\w+-]*\n)?([\s\S]*?)```/g, '$1'), opts);
  const blocks: ReactNode[] = [];
  let key = 0;
  // split out fenced code first
  const parts = src.split(/(```[\s\S]*?```)/g);
  for (const part of parts) {
    if (!part) continue;
    const fence = part.match(/^```([\w+-]*)\n?([\s\S]*?)\n?```$/);
    if (fence) {
      const hasLang = fence[1] && part.startsWith('```' + fence[1] + '\n');
      const lang = hasLang ? fence[1] : undefined;
      const code = hasLang ? fence[2] : (fence[1] + (fence[1] ? '\n' : '') + fence[2]).replace(/^\n/, '');
      blocks.push(<CodeBlock key={key++} code={code} lang={lang} />);
      continue;
    }
    renderLines(part, opts, blocks, () => key++);
  }
  return blocks;
}

function renderLines(text: string, opts: MdOptions, out: ReactNode[], nextKey: () => number) {
  const lines = text.split('\n');
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const joined = para.join('\n');
    if (joined.length) out.push(<span key={nextKey()} className="md-p">{parseInline(joined, opts)}</span>);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('>>> ')) {
      flush();
      const rest = [line.slice(4), ...lines.slice(i + 1)].join('\n');
      out.push(<blockquote key={nextKey()} className="md-quote">{parseInline(rest, opts)}</blockquote>);
      return;
    }
    if (/^> ?/.test(line) && line.startsWith('>') && (line.startsWith('> ') || line === '>')) {
      flush();
      const q: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) { q.push(lines[i].replace(/^> ?/, '')); i++; }
      i--;
      out.push(<blockquote key={nextKey()} className="md-quote">{parseInline(q.join('\n'), opts)}</blockquote>);
      continue;
    }
    const h = line.match(/^(#{1,3}) (.+)$/);
    if (h) {
      flush();
      const level = h[1].length;
      const content = parseInline(h[2], opts);
      out.push(level === 1 ? <h1 key={nextKey()} className="md-h1">{content}</h1> : level === 2 ? <h2 key={nextKey()} className="md-h2">{content}</h2> : <h3 key={nextKey()} className="md-h3">{content}</h3>);
      continue;
    }
    const sub = line.match(/^-# (.+)$/);
    if (sub) {
      flush();
      out.push(<small key={nextKey()} className="md-sub">{parseInline(sub[1], opts)}</small>);
      continue;
    }
    if (/^\s{0,4}([-*]|\d{1,3}\.) \S/.test(line)) {
      flush();
      const ordered = /^\s*\d/.test(line);
      const items: { text: string; indent: number; n: number }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^(\s{0,4})([-*]|(\d{1,3})\.) (.*)$/);
        if (!m) break;
        if (/^\d/.test(m[2]) !== ordered) break;
        items.push({ text: m[4], indent: m[1].length >= 2 ? 1 : 0, n: Number(m[3] ?? 0) });
        i++;
      }
      i--;
      const Tag = ordered ? 'ol' : 'ul';
      out.push(
        <Tag key={nextKey()} className="md-list" start={ordered ? items[0].n || 1 : undefined}>
          {items.map((it, j) => <li key={j} className={it.indent ? 'nested' : undefined}>{parseInline(it.text, opts)}</li>)}
        </Tag>,
      );
      continue;
    }
    para.push(line);
  }
  flush();
}

/** Plain text for notifications/previews */
export function stripMarkdown(src: string) {
  return src
    .replace(/```[\s\S]*?```/g, '[code]')
    .replace(/\|\|[\s\S]+?\|\|/g, '▒▒▒▒')
    .replace(/[*_~`]/g, '')
    .replace(/<a?:(\w+):[0-9a-f-]{36}>/g, ':$1:')
    .trim();
}
