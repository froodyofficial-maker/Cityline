import { Download, FileArchive, FileAudio, FileCode, FileText, File as FileIcon, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Attachment, Message } from '../../lib/types';
import { cn, duration, fileSize, isAudio, isImage, isVideo } from '../../lib/utils';
import { setUI } from '../../store/ui';

export function Attachments({ message }: { message: Message }) {
  const media = message.attachments.filter((a) => isImage(a.type) || isVideo(a.type));
  const others = message.attachments.filter((a) => !isImage(a.type) && !isVideo(a.type));
  const voice = (message.flags & 4) !== 0;
  return (
    <div className="attachments">
      {media.length > 0 && (
        <div className={cn('media-grid', `n${Math.min(media.length, 4)}`)}>
          {media.map((a, i) => <MediaItem key={a.url + i} a={a} single={media.length === 1} onOpen={() => setUI({ lightbox: { items: media.map((x) => ({ url: x.url, name: x.name, type: x.type })), index: i } })} />)}
        </div>
      )}
      {others.map((a, i) => (isAudio(a.type) ? <AudioPlayer key={a.url + i} a={a} voice={voice} /> : <FileCard key={a.url + i} a={a} />))}
    </div>
  );
}

function MediaItem({ a, single, onOpen }: { a: Attachment; single: boolean; onOpen: () => void }) {
  const [revealed, setRevealed] = useState(!a.spoiler);
  const [loaded, setLoaded] = useState(false);
  const ratio = a.width && a.height ? a.width / a.height : undefined;
  const maxW = single ? Math.min(520, a.width ?? 520) : undefined;
  const style = single && ratio ? { width: maxW, aspectRatio: String(ratio), maxHeight: 380 } : undefined;
  return (
    <div className={cn('media', !revealed && 'spoiler-media', !loaded && 'loading')} style={style} onClick={() => (revealed ? onOpen() : setRevealed(true))}>
      {isVideo(a.type) ? (
        <video src={a.url} controls preload="metadata" onLoadedData={() => setLoaded(true)} onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={a.url} alt={a.name} loading="lazy" onLoad={() => setLoaded(true)} draggable={false} />
      )}
      {!revealed && <span className="spoiler-label">SPOILER</span>}
    </div>
  );
}

function fileIcon(a: Attachment) {
  if (/zip|rar|7z|tar|gz/.test(a.type) || /\.(zip|rar|7z|gz)$/i.test(a.name)) return <FileArchive />;
  if (/json|javascript|typescript|xml|html|css|x-python|x-c/.test(a.type) || /\.(js|ts|py|json|css|html|c|cpp|rs|go|java)$/i.test(a.name)) return <FileCode />;
  if (/pdf|text|document|msword/.test(a.type)) return <FileText />;
  if (isAudio(a.type)) return <FileAudio />;
  return <FileIcon />;
}

function FileCard({ a }: { a: Attachment }) {
  return (
    <div className="file-card">
      <span className="file-icon">{fileIcon(a)}</span>
      <div className="grow">
        <a className="file-name ellipsis" href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
        <div className="tiny muted">{fileSize(a.size)}</div>
      </div>
      <a className="icon-btn" href={a.url} download={a.name} target="_blank" rel="noreferrer" aria-label="Download"><Download /></a>
    </div>
  );
}

export function AudioPlayer({ a, voice }: { a: Attachment; voice?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [d, setD] = useState(a.duration ?? 0);
  const bars = a.waveform && a.waveform.length ? a.waveform : Array.from({ length: 48 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => setT(el.currentTime);
    const meta = () => { if (Number.isFinite(el.duration)) setD(el.duration); };
    const end = () => { setPlaying(false); setT(0); };
    el.addEventListener('timeupdate', up);
    el.addEventListener('loadedmetadata', meta);
    el.addEventListener('ended', end);
    return () => { el.removeEventListener('timeupdate', up); el.removeEventListener('loadedmetadata', meta); el.removeEventListener('ended', end); };
  }, []);
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); } else { void el.play(); setPlaying(true); }
  };
  const progress = d ? t / d : 0;
  return (
    <div className={cn('audio-player', voice && 'voice')}>
      <audio ref={ref} src={a.url} preload="metadata" />
      <button className="ap-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
      {voice ? (
        <div className="ap-wave" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const el = ref.current; if (el && d) el.currentTime = ((e.clientX - r.left) / r.width) * d; }}>
          {bars.map((b, i) => <i key={i} className={i / bars.length < progress ? 'on' : ''} style={{ height: `${Math.max(12, b * 100)}%` }} />)}
        </div>
      ) : (
        <div className="grow">
          <div className="ellipsis small bold">{a.name}</div>
          <div className="ap-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const el = ref.current; if (el && d) el.currentTime = ((e.clientX - r.left) / r.width) * d; }}><i style={{ width: `${progress * 100}%` }} /></div>
        </div>
      )}
      <span className="ap-time">{duration(playing || t ? t : d)}</span>
      {!voice && <a className="icon-btn sm" href={a.url} download={a.name} target="_blank" rel="noreferrer"><Download /></a>}
    </div>
  );
}
