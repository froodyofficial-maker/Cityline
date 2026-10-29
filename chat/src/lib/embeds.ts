// Link previews. Images, videos, GIFs and YouTube links render straight from
// the URL. Other links get a preview card from the optional "link-preview"
// Edge Function (supabase/functions/link-preview) when it is deployed.
import type { Embed } from './types';
import { supabase } from './supabase';

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,!?;:'"]/gi;

export function extractUrls(text: string): string[] {
  const out: string[] = [];
  const cleaned = text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '').replace(/<https?:\/\/[^>]+>/g, '');
  for (const m of cleaned.matchAll(URL_RE)) if (!out.includes(m[0])) out.push(m[0]);
  return out.slice(0, 5);
}

export function youtubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

export function localEmbed(url: string): Embed | null {
  const u = url.toLowerCase().split('?')[0];
  const yt = youtubeId(url);
  if (yt) return { url, type: 'youtube', image: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`, site_name: 'YouTube' };
  if (/\.(gif)$/.test(u) || /media\d*\.giphy\.com\//.test(u) || /tenor\.com\/.*\.gif/.test(u)) return { url, type: 'gif', image: url };
  if (/\.(png|jpe?g|webp|avif|bmp|svg)$/.test(u)) return { url, type: 'image', image: url };
  if (/\.(mp4|webm|mov|m4v)$/.test(u)) return { url, type: 'video', video: url };
  return null;
}

let unavailable = false;
const cache = new Map<string, Promise<Embed | null>>();

export function fetchPreview(url: string): Promise<Embed | null> {
  if (unavailable) return Promise.resolve(null);
  if (!cache.has(url)) {
    cache.set(url, (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
        if (error) {
          if (/404|not found|Failed to send/i.test(String(error.message ?? error))) unavailable = true;
          return null;
        }
        const d = data as Embed | null;
        if (!d || (!d.title && !d.description && !d.image)) return null;
        return { ...d, url, type: d.video ? 'video' : 'link' };
      } catch {
        unavailable = true;
        return null;
      }
    })());
  }
  return cache.get(url)!;
}

/** Previews to store on a message after sending (generic links only). */
export async function buildEmbeds(content: string): Promise<Embed[]> {
  const urls = extractUrls(content).filter((u) => !localEmbed(u));
  if (!urls.length) return [];
  const results = await Promise.all(urls.slice(0, 3).map(fetchPreview));
  return results.filter(Boolean) as Embed[];
}
