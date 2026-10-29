import { useEffect, useRef, useState } from 'react';
import { fromTokens, toTokens } from '../../lib/compose';
import type { Message } from '../../lib/types';
import { setUI } from '../../store/ui';
import { editMessage } from '../../store/actions/messages';
import { confirmDelete } from './messageMenu';

export function EditBox({ message }: { message: Message }) {
  const initial = useRef(fromTokens(message.content));
  const [text, setText] = useState(initial.current.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autosize(el);
  }, []);
  const cancel = () => setUI({ editing: null });
  const save = async () => {
    const t = text.trim();
    if (!t && !message.attachments.length) { cancel(); confirmDelete(message); return; }
    setUI({ editing: null });
    await editMessage(message.id, toTokens(t, message.server_id, initial.current.map));
  };
  return (
    <div className="edit-box">
      <textarea
        ref={ref}
        className="edit-input"
        value={text}
        onChange={(e) => { setText(e.target.value); autosize(e.target); }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); }
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save(); }
        }}
      />
      <div className="edit-hint tiny">escape to <button className="btn link" onClick={cancel}>cancel</button> • enter to <button className="btn link" onClick={() => void save()}>save</button></div>
    </div>
  );
}

export function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.5)}px`;
}
