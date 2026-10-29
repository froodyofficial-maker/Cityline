// Link preview cards for Cityline messages.
//
// Deploy:  supabase functions deploy link-preview
// The client calls it with supabase.functions.invoke('link-preview', { body: { url } })
// and renders { title, description, image, site_name, video } as an embed.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 6000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' } });
}

// Refuse anything that could reach the function's own network (SSRF).
function isPublicHttpUrl(raw: string) {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224) return false;
  }
  if (host.includes(':')) {
    if (host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80') || host.startsWith('::ffff:')) return false;
  }
  return true;
}

async function readLimited(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => {});
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder().decode(buf);
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function meta(html: string, keys: string[]) {
  for (const key of keys) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
    const tag = html.match(re)?.[0];
    const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
    if (content) return decodeEntities(content.trim());
  }
  return null;
}

function absolute(src: string | null, base: string) {
  if (!src) return null;
  try { const u = new URL(src, base); return isPublicHttpUrl(u.href) ? u.href : null; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let url: string;
  try { ({ url } = await req.json()); } catch { return json({ error: 'Invalid body' }, 400); }
  if (typeof url !== 'string' || !isPublicHttpUrl(url)) return json({ error: 'Invalid url' }, 400);

  try {
    let target = url;
    let res: Response | null = null;
    // follow redirects by hand so every hop is checked
    for (let hop = 0; hop < 4; hop++) {
      res = await fetch(target, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'CitylineBot/1.0 (+link previews)', Accept: 'text/html,application/xhtml+xml' },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = new URL(loc, target).href;
        if (!isPublicHttpUrl(next)) return json({});
        target = next;
        continue;
      }
      break;
    }
    if (!res || !res.ok) return json({});
    const type = res.headers.get('content-type') ?? '';
    if (type.startsWith('image/')) return json({ image: target });
    if (!type.includes('html')) return json({});

    const html = await readLimited(res);
    const title = meta(html, ['og:title', 'twitter:title']) ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decodeEntities(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1].trim()) : null);
    return json({
      title: title?.slice(0, 256) ?? null,
      description: meta(html, ['og:description', 'twitter:description', 'description'])?.slice(0, 350) ?? null,
      image: absolute(meta(html, ['og:image', 'og:image:url', 'twitter:image']), target),
      site_name: meta(html, ['og:site_name', 'application-name']) ?? new URL(target).hostname.replace(/^www\./, ''),
      video: absolute(meta(html, ['og:video:secure_url', 'og:video:url', 'og:video']), target),
      color: meta(html, ['theme-color']),
    });
  } catch {
    return json({});
  }
});
