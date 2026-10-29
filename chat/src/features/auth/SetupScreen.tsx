import { motion } from 'motion/react';
import { Database, KeyRound, Link2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Logo } from '../../components/Logo';
import { Spinner } from '../../components/ui/Controls';
import { saveLocalConfig } from '../../lib/config';
import { Skyline } from './Skyline';

/** Shown when no Supabase URL/key is configured yet. */
export function SetupScreen() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function test(e: React.FormEvent) {
    e.preventDefault();
    const u = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//.test(u)) { setStatus('error'); setMsg('The URL should start with https://'); return; }
    setStatus('testing');
    try {
      const res = await fetch(`${u}/rest/v1/rpc/username_available`, {
        method: 'POST',
        headers: { apikey: key.trim(), authorization: `Bearer ${key.trim()}`, 'content-type': 'application/json' },
        body: JSON.stringify({ p_username: 'setup_check' }),
      });
      if (res.status === 401 || res.status === 403) throw new Error('Supabase rejected that key. Copy the “anon” / “publishable” key.');
      if (res.status === 404) throw new Error('Connected, but the database is not set up yet. Run supabase/schema.sql in the SQL Editor first (see SUPABASE_SETUP.md).');
      if (!res.ok) throw new Error(`Supabase answered with ${res.status}.`);
      setStatus('ok');
      saveLocalConfig({ supabaseUrl: u, supabaseAnonKey: key.trim() });
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      setStatus('error');
      setMsg(err instanceof Error ? (err.message === 'Failed to fetch' ? 'Could not reach that URL. Check it and your connection.' : err.message) : String(err));
    }
  }

  return (
    <div className="auth-page">
      <Skyline />
      <div className="auth-brand"><Logo size={30} /></div>
      <motion.form className="auth-card setup" onSubmit={test} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>
        <div className="setup-icon"><Database size={28} /></div>
        <h1 className="auth-title">Connect your Supabase project</h1>
        <p className="auth-sub">Cityline stores everything in your own Supabase project. Paste its details once — they’re saved in this browser. (Or set them in <code>.env</code> / <code>public/config.js</code> before building.)</p>
        <ol className="setup-steps">
          <li>Create a free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">supabase.com <ExternalLink size={12} /></a></li>
          <li>Open <b>SQL Editor</b>, paste <code>supabase/schema.sql</code> and press <b>Run</b></li>
          <li>Copy the <b>Project URL</b> and <b>anon key</b> from <b>Project Settings → API</b></li>
        </ol>
        <label className="label">Project URL</label>
        <div className="input-wrap"><Link2 /><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcdefghijklm.supabase.co" required /></div>
        <label className="label" style={{ marginTop: 12 }}>Anon / publishable key</label>
        <div className="input-wrap"><KeyRound /><input className="input" value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi… or sb_publishable_…" required /></div>
        {status === 'error' && <div className="auth-error">{msg}</div>}
        {status === 'ok' && <div className="auth-ok">Connected! Loading Cityline…</div>}
        <button className="btn lg block auth-submit" disabled={status === 'testing'}>{status === 'testing' ? <Spinner /> : 'Connect'}</button>
        <p className="auth-legal">Never paste the <b>service_role</b> key here — it bypasses all security.</p>
      </motion.form>
    </div>
  );
}
