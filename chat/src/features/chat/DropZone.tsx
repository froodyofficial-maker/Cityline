import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useData } from '../../store/data';
import { dmName, usePerms } from '../../store/selectors';
import { has, P } from '../../lib/permissions';

/** Full-chat overlay that appears when files are dragged over the window. */
export function DropZone({ onFiles, channelId }: { onFiles: (f: File[]) => void; channelId: string }) {
  const [over, setOver] = useState(false);
  const name = useData((s) => { const c = s.channels[channelId]; return c ? (c.server_id ? `#${c.name}` : dmName(c, s)) : ''; });
  const perms = usePerms(channelId);
  const allowed = has(perms, P.ATTACH_FILES) && has(perms, P.SEND_MESSAGES);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; depth++; setOver(true); };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(false); };
    const overFn = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      if (!allowed) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, [onFiles, allowed]);
  return (
    <AnimatePresence>
      {over && (
        <motion.div className="dropzone-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="dropzone-card" initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
            <div className="dz-icons"><span>📄</span><span>🖼️</span><span>🎵</span></div>
            <h2>{allowed ? `Upload to ${name}` : 'You can’t upload files here'}</h2>
            <p>{allowed ? 'You can add comments before uploading. Hold Shift to upload directly.' : 'You need the Attach Files permission.'}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
