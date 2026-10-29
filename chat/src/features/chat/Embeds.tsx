import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { extractUrls, localEmbed, youtubeId } from '../../lib/embeds';
import type { Embed, Message } from '../../lib/types';
import { setUI } from '../../store/ui';

export function Embeds({ message }: { message: Message }) {
  const list = useMemo(() => {
    const local = extractUrls(message.content).map(localEmbed).filter(Boolean) as Embed[];
    const stored = (message.embeds ?? []).filter((e) => !local.some((l) => l.url === e.url));
    return [...local, ...stored].slice(0, 5);
  }, [message.content, message.embeds]);
  if (!list.length) return null;
  return <div className="embeds">{list.map((e, i) => <EmbedView key={e.url + i} e={e} />)}</div>;
}

function EmbedView({ e }: { e: Embed }) {
  if (e.type === 'youtube') return <YouTube e={e} />;
  if (e.type === 'gif' || e.type === 'image') {
    return (
      <div className="embed-media" onClick={() => setUI({ lightbox: { items: [{ url: e.image!, type: 'image/gif' }], index: 0 } })}>
        <img src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
        {e.type === 'gif' && <span className="gif-tag">GIF</span>}
      </div>
    );
  }
  if (e.type === 'video' && e.video && !e.title) return <div className="embed-media"><video src={e.video} controls preload="metadata" /></div>;
  let host = '';
  try { host = new URL(e.url).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
  return (
    <div className="embed-card" style={e.color ? { borderLeftColor: e.color } : undefined}>
      <div className="embed-text">
        <div className="embed-site">{e.site_name || host}</div>
        {e.title && <a className="embed-title" href={e.url} target="_blank" rel="noreferrer">{e.title}</a>}
        {e.description && <div className="embed-desc">{e.description.slice(0, 350)}</div>}
      </div>
      {e.image && <img className="embed-thumb" src={e.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => ((ev.target as HTMLElement).style.display = 'none')} />}
    </div>
  );
}

function YouTube({ e }: { e: Embed }) {
  const [play, setPlay] = useState(false);
  const id = youtubeId(e.url);
  return (
    <div className="embed-card video">
      <div className="embed-text">
        <div className="embed-site">YouTube</div>
        <a className="embed-title" href={e.url} target="_blank" rel="noreferrer">{e.title || 'Watch on YouTube'}</a>
      </div>
      <div className="yt-frame">
        {play && id ? (
          <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        ) : (
          <button className="yt-thumb" onClick={() => setPlay(true)} style={{ backgroundImage: `url(${e.image})` }} aria-label="Play video">
            <span className="yt-play"><Play size={26} fill="currentColor" /></span>
          </button>
        )}
      </div>
    </div>
  );
}
