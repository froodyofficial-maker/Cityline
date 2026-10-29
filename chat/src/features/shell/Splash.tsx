import { motion } from 'motion/react';
import { LogoMark } from '../../components/Logo';

const TIPS = [
  'Press Ctrl + K to jump to any channel or friend.',
  'Neon members can send messages with confetti — try /confetti!',
  'Right-click almost anything for more options.',
  'Catch Up shows the best messages you missed in a server.',
  'Schedule a message to send later from the + menu.',
  'Hold Shift while hovering a message for quick actions.',
];

export function Splash({ label }: { label?: string }) {
  const tip = TIPS[Math.floor(Date.now() / 10000) % TIPS.length];
  return (
    <div className="splash">
      <motion.div className="splash-logo" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        <LogoMark size={84} />
        <div className="splash-ring" />
      </motion.div>
      <motion.div className="splash-label" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        {label ?? 'Connecting to Cityline…'}
      </motion.div>
      <motion.div className="splash-tip" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <b>Did you know?</b> {tip}
      </motion.div>
    </div>
  );
}
