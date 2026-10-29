import { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Field, Spinner } from '../../components/ui/Controls';
import { changePassword } from '../../store/actions/users';
import { toast } from '../../store/ui';

export function ResetPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title="Choose a new password" subtitle="You followed a reset link — pick something you’ll remember." onClose={onDone}
      footer={<button className="btn" disabled={busy || pw.length < 8} onClick={async () => {
        setBusy(true);
        try { await changePassword(pw); toast('Password updated', 'success'); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
        setBusy(false);
      }}>{busy ? <Spinner /> : 'Save password'}</button>}>
      <Field label="New password" error={err} help="At least 8 characters.">
        <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
