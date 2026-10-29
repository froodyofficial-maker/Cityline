import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isVideo } from '../../lib/utils';
import { setUI, useUI } from '../../store/ui';

export function Lightbox() {
  const lb = useUI((s) => s.lightbox);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    if (!lb) return;
    setZoom(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ lightbox: null });
      if (e.key === 'ArrowRight') setUI((s) => (s.lightbox ? { lightbox: { ...s.lightbox, index: (s.lightbox.index + 1) % s.lightbox.items.length } } : {}));
      if (e.key === 'ArrowLeft') setUI((s) => (s.lightbox ? { lightbox: { ...s.lightbox, index: (s.lightbox.index - 1 + s.lightbox.items.length) % s.lightbox.items.length } } : {}));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb]);
  const item = lb?.items[lb.index];
  return createPortal(
    <AnimatePresence>
      {lb && item && (
        <motion.div className="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setUI({ lightbox: null })}>
          <div className="lb-top" onClick={(e) => e.stopPropagation()}>
            <span className="ellipsis">{item.name}</span>
            <span className="spacer" />
            <a className="icon-btn" href={item.url} download target="_blank" rel="noreferrer"><Download /></a>
            <a className="icon-btn" href={item.url} target="_blank" rel="noreferrer"><ExternalLink /></a>
            <button className="icon-btn" onClick={() => setUI({ lightbox: null })}><X /></button>
          </div>
          <motion.div key={item.url} className="lb-stage" initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            {item.type && isVideo(item.type) ? (
              <video src={item.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={item.url} alt="" className={zoom ? 'zoom' : ''} onClick={(e) => { e.stopPropagation(); setZoom(!zoom); }} />
            )}
          </motion.div>
          {lb.items.length > 1 && (
            <>
              <button className="lb-nav left" onClick={(e) => { e.stopPropagation(); setUI({ lightbox: { ...lb, index: (lb.index - 1 + lb.items.length) % lb.items.length } }); }}><ChevronLeft /></button>
              <button className="lb-nav right" onClick={(e) => { e.stopPropagation(); setUI({ lightbox: { ...lb, index: (lb.index + 1) % lb.items.length } }); }}><ChevronRight /></button>
              <div className="lb-count">{lb.index + 1} / {lb.items.length}</div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
