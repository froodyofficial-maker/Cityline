import { motion } from 'motion/react';
import { AudioLines, Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BUILTIN_SOUNDS } from '../../lib/sounds';
import { playSoundboard } from '../../lib/voice';
import { useData } from '../../store/data';
import { openModal } from '../../store/ui';
import { useVoice } from '../../store/voice';
import { has, P } from '../../lib/permissions';
import { serverPermsFor } from '../../store/selectors';
import { useShallow } from 'zustand/react/shallow';

export function Soundboard({ onClose, serverId, anchor }: { onClose: () => void; serverId: string | null; anchor: 'panel' | 'controls' }) {
  const sounds = useData(useShallow((s) => Object.values(s.sounds).filter((x) => x.server_id === serverId)));
  const connected = useVoice((s) => !!s.channelId);
  const ref = useRef<HTMLDivElement>(null);
  const canManage = useData((s) => !!serverId && has(serverPermsFor(serverId, s), P.MANAGE_EXPRESSIONS));
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.cc-board, .vp-btn')) onClose(); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [onClose]);
  return (
    <motion.div ref={ref} className={`soundboard ${anchor}`} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }} transition={{ duration: 0.16 }}>
      <div className="sb-title"><AudioLines size={16} /> Soundboard</div>
      {!connected && <div className="muted small">Join a voice channel to play sounds for everyone.</div>}
      <div className="sb-section">Cityline Classics</div>
      <div className="sb-grid">
        {BUILTIN_SOUNDS.map((s) => (
          <motion.button key={s.id} className="sb-btn" whileTap={{ scale: 0.9 }} onClick={() => playSoundboard({ id: s.id })} disabled={!connected}>
            <span className="sb-emoji">{s.emoji}</span>{s.name}
          </motion.button>
        ))}
      </div>
      {serverId && (
        <>
          <div className="sb-section">This server</div>
          <div className="sb-grid">
            {sounds.map((s) => (
              <motion.button key={s.id} className="sb-btn" whileTap={{ scale: 0.9 }} onClick={() => playSoundboard({ url: s.url, volume: s.volume })} disabled={!connected}>
                <span className="sb-emoji">{s.emoji || '🔊'}</span>{s.name}
              </motion.button>
            ))}
            {canManage && <button className="sb-btn add" onClick={() => { onClose(); openModal({ kind: 'serverSettings', serverId, tab: 'soundboard' }); }}><Plus size={16} /> Add sound</button>}
            {!sounds.length && !canManage && <div className="muted small">No custom sounds yet.</div>}
          </div>
        </>
      )}
    </motion.div>
  );
}
