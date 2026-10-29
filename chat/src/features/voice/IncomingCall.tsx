import { motion } from 'motion/react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from '../../components/ui/Avatar';
import { NameTag } from '../../components/ui/NameTag';
import { stopRinging } from '../../lib/sounds';
import { joinVoice, toggleCamera } from '../../lib/voice';
import { navigate, setUI, type UIState } from '../../store/ui';

// `call` is a prop so the exit animation survives the store clearing it.
export function IncomingCall({ call }: { call: NonNullable<UIState['incomingCall']> }) {
  useEffect(() => {
    const t = setTimeout(() => { stopRinging(); setUI({ incomingCall: null }); }, 30_000);
    return () => { clearTimeout(t); stopRinging(); };
  }, []);
  const decline = () => { stopRinging(); setUI({ incomingCall: null }); };
  const accept = async (video: boolean) => {
    stopRinging();
    setUI({ incomingCall: null });
    navigate({ kind: 'dm', channelId: call.channelId });
    await joinVoice(call.channelId, null);
    if (video) await toggleCamera();
  };
  return createPortal(
    <motion.div className="incoming-call" initial={{ opacity: 0, scale: 0.8, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }}>
      <div className="ic-avatar">
        <span className="ic-ring r1" /><span className="ic-ring r2" /><span className="ic-ring r3" />
        <Avatar userId={call.from} size={88} />
      </div>
      <NameTag userId={call.from} className="ic-name" />
      <div className="muted small">Incoming call…</div>
      <div className="ic-actions">
        <button className="ic-btn no" onClick={decline} aria-label="Decline"><PhoneOff /></button>
        <button className="ic-btn video" onClick={() => void accept(true)} aria-label="Accept with video"><Video /></button>
        <button className="ic-btn yes" onClick={() => void accept(false)} aria-label="Accept"><Phone /></button>
      </div>
    </motion.div>,
    document.body,
  );
}
