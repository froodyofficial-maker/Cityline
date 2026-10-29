import { Database, LogOut, RefreshCw } from 'lucide-react';
import { LogoMark } from '../../components/Logo';
import { clearLocalConfig } from '../../lib/config';
import { signOut } from '../../store/actions/users';

/** Shown when the app can reach Supabase but the database isn't ready. */
export function SetupError({ message }: { message: string }) {
  const missing = /function|does not exist|schema cache|get_bootstrap|404/i.test(message);
  return (
    <div className="splash">
      <LogoMark size={64} />
      <div className="setup-error card">
        <div className="row gap-8"><Database size={20} /> <h2>{missing ? 'The database isn’t set up yet' : 'Couldn’t load Cityline'}</h2></div>
        <p className="muted">
          {missing
            ? 'Open your Supabase project → SQL Editor → New query, paste the whole of supabase/schema.sql and press Run. Then reload this page.'
            : message}
        </p>
        {missing && <pre className="mono small">{message}</pre>}
        <div className="row gap-8" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => window.location.reload()}><RefreshCw size={16} /> Try again</button>
          <button className="btn secondary" onClick={() => void signOut()}><LogOut size={16} /> Log out</button>
          <button className="btn ghost" onClick={() => { clearLocalConfig(); window.location.reload(); }}>Change project</button>
        </div>
      </div>
    </div>
  );
}
