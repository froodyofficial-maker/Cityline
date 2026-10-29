import { motion } from 'motion/react';
import { SendHorizontal, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { audioContext } from '../../lib/sounds';
import { duration } from '../../lib/utils';
import { toast } from '../../store/ui';

const MAX_SECONDS = 300;

/** Records a voice message with a live waveform. */
export function VoiceRecorder({ onCancel, onSend }: { onCancel: () => void; onSend: (v: { blob: Blob; duration: number; waveform: number[] }) => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const samples = useRef<number[]>([]);
  const started = useRef(0);
  const stream = useRef<MediaStream | null>(null);
  const finish = useRef<'send' | 'cancel'>('cancel');

  useEffect(() => {
    let raf = 0;
    let alive = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
        const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
        r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
        r.onstop = () => {
          s.getTracks().forEach((t) => t.stop());
          if (finish.current !== 'send') return;
          const blob = new Blob(chunks.current, { type: r.mimeType || 'audio/webm' });
          const all = samples.current;
          const bars = 48;
          const step = Math.max(1, all.length / bars);
          const wave = Array.from({ length: bars }, (_, i) => {
            const slice = all.slice(Math.floor(i * step), Math.floor((i + 1) * step));
            return slice.length ? Math.min(1, Math.max(...slice) * 2.2) : 0.05;
          });
          onSend({ blob, duration: (Date.now() - started.current) / 1000, waveform: wave.map((v) => Math.round(v * 100) / 100) });
        };
        r.start(250);
        rec.current = r;
        started.current = Date.now();
        const c = audioContext();
        const src = c.createMediaStreamSource(s);
        const an = c.createAnalyser();
        an.fftSize = 512;
        src.connect(an);
        const data = new Uint8Array(an.fftSize);
        let last = 0;
        const loop = (t: number) => {
          raf = requestAnimationFrame(loop);
          if (t - last < 80) return;
          last = t;
          an.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
          samples.current.push(peak);
          setLevels((l) => [...l.slice(-59), peak]);
          const secs = (Date.now() - started.current) / 1000;
          setElapsed(secs);
          if (secs >= MAX_SECONDS) stop('send');
        };
        raf = requestAnimationFrame(loop);
      } catch {
        toast('Microphone access is needed for voice messages', 'error');
        onCancel();
      }
    })();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (rec.current?.state === 'recording') { finish.current = 'cancel'; rec.current.stop(); }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop(how: 'send' | 'cancel') {
    finish.current = how;
    if (rec.current?.state === 'recording') rec.current.stop();
    if (how === 'cancel') onCancel();
  }

  return (
    <div className="recorder">
      <button className="icon-btn danger" onClick={() => stop('cancel')} aria-label="Discard"><Trash2 /></button>
      <span className="rec-dot" />
      <span className="rec-time">{duration(elapsed)}</span>
      <div className="rec-wave">
        {levels.map((v, i) => <motion.i key={i} initial={{ scaleY: 0.2 }} animate={{ scaleY: Math.max(0.12, Math.min(1, v * 2.4)) }} transition={{ duration: 0.08 }} />)}
      </div>
      <button className="send-btn" onClick={() => stop('send')} aria-label="Send voice message"><SendHorizontal size={18} /></button>
    </div>
  );
}
