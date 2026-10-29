import { AnimatePresence, motion } from 'motion/react';
import { AtSign, Lock, Mail, User, ArrowLeft, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Logo } from '../../components/Logo';
import { Spinner } from '../../components/ui/Controls';
import { ServerIcon } from '../../components/ui/Avatar';
import { plural } from '../../lib/utils';
import { getInvite, rememberInvite } from '../../store/actions/servers';
import { sendReset, signIn, signInWithProvider, signUp, usernameAvailable } from '../../store/actions/users';
import { useUI } from '../../store/ui';
import { Skyline } from './Skyline';

type Mode = 'login' | 'register' | 'forgot' | 'check-email';
type InvitePreview = Awaited<ReturnType<typeof getInvite>>;

const providers: { id: 'github' | 'google' | 'discord'; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
];

export function AuthScreen() {
  const route = useUI((s) => s.route);
  const [mode, setMode] = useState<Mode>(route.kind === 'invite' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [display, setDisplay] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [invite, setInvite] = useState<InvitePreview>(null);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (route.kind === 'invite') void getInvite(route.code).then(setInvite).catch(() => setInvite(null));
  }, [route]);

  useEffect(() => {
    if (mode !== 'register' || username.length < 2) { setAvailable(null); return; }
    const t = setTimeout(() => void usernameAvailable(username).then(setAvailable).catch(() => setAvailable(null)), 350);
    return () => clearTimeout(t);
  }, [username, mode]);

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setShake((n) => n + 1);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    if (route.kind === 'invite' && mode !== 'forgot') rememberInvite(route.code);
    try {
      if (mode === 'login') await signIn(email, password);
      else if (mode === 'register') {
        if (!/^[a-z0-9_.]{2,32}$/.test(username)) throw new Error('Usernames are 2–32 characters: letters, numbers, _ and .');
        if (password.length < 8) throw new Error('Use at least 8 characters for your password.');
        const r = await signUp(email, password, username, display);
        if (r.needsConfirm) setMode('check-email');
      } else if (mode === 'forgot') {
        await sendReset(email);
        setMode('check-email');
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  const title = { login: 'Welcome back!', register: 'Create an account', forgot: 'Reset your password', 'check-email': 'Check your inbox' }[mode];
  const subtitle = {
    login: 'We’re so excited to see you again!',
    register: 'Your city of communities is waiting.',
    forgot: 'We’ll email you a link to choose a new one.',
    'check-email': `We sent a link to ${email || 'your email'}. Open it to continue — you can close this tab.`,
  }[mode];

  return (
    <div className="auth-page">
      <Skyline />
      <div className="auth-brand"><Logo size={30} /></div>
      <motion.div
        key={shake}
        className="auth-card"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={shake ? { opacity: 1, y: 0, scale: 1, x: [0, -10, 10, -6, 6, 0] } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      >
        {invite && (
          <div className="auth-invite">
            <ServerIcon name={invite.server.name} url={invite.server.icon_url} size={64} />
            <div className="muted small">{invite.inviter ? `${invite.inviter.display_name || invite.inviter.username} invited you to join` : 'You’ve been invited to join'}</div>
            <div className="auth-invite-name">{invite.server.name}</div>
            <div className="muted tiny"><span className="dot online" /> {plural(invite.server.member_count, 'Member')}</div>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={mode} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
            {(mode === 'forgot' || mode === 'check-email') && (
              <button className="btn link auth-back" onClick={() => { setMode('login'); setError(null); }}><ArrowLeft size={16} /> Back to login</button>
            )}
            <h1 className="auth-title">{title}</h1>
            <p className="auth-sub">{subtitle}</p>
            {mode === 'check-email' ? (
              <div className="auth-mail-art">📬</div>
            ) : (
              <form onSubmit={submit} className="auth-form">
                <label className="label">Email<span className="req">*</span></label>
                <div className="input-wrap">
                  <Mail />
                  <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
                </div>
                {mode === 'register' && (
                  <>
                    <label className="label">Display name</label>
                    <div className="input-wrap">
                      <User />
                      <input className="input" value={display} maxLength={32} onChange={(e) => setDisplay(e.target.value)} placeholder="What everyone sees" />
                    </div>
                    <label className="label">Username<span className="req">*</span></label>
                    <div className="input-wrap">
                      <AtSign />
                      <input className="input" required value={username} maxLength={32} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} placeholder="unique_name" autoComplete="username" />
                      {available !== null && (
                        <span className={available ? 'suffix ok' : 'suffix bad'}>{available ? <Check size={16} /> : <X size={16} />}</span>
                      )}
                    </div>
                    {available === false && <div className="field-error">That username is taken — try another.</div>}
                  </>
                )}
                {mode !== 'forgot' && (
                  <>
                    <label className="label">Password<span className="req">*</span></label>
                    <div className="input-wrap">
                      <Lock />
                      <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} />
                    </div>
                    {mode === 'register' && <PasswordMeter value={password} />}
                  </>
                )}
                {mode === 'login' && <button type="button" className="btn link forgot" onClick={() => { setMode('forgot'); setError(null); }}>Forgot your password?</button>}
                {error && <motion.div className="auth-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}
                <button type="submit" className="btn lg block auth-submit" disabled={busy}>
                  {busy ? <Spinner /> : mode === 'login' ? 'Log In' : mode === 'register' ? (invite ? 'Create account & join' : 'Create account') : 'Send reset link'}
                </button>
                {mode !== 'forgot' && (
                  <>
                    <div className="divider-text">or continue with</div>
                    <div className="auth-providers">
                      {providers.map((p) => (
                        <button key={p.id} type="button" className="btn secondary" onClick={() => { if (route.kind === 'invite') rememberInvite(route.code); signInWithProvider(p.id).catch(fail); }}>
                          <ProviderIcon id={p.id} /> {p.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="auth-switch">
                  {mode === 'login' ? (
                    <>Need an account? <button type="button" className="btn link" onClick={() => { setMode('register'); setError(null); }}>Register</button></>
                  ) : mode === 'register' ? (
                    <>Already have an account? <button type="button" className="btn link" onClick={() => { setMode('login'); setError(null); }}>Log in</button></>
                  ) : null}
                </div>
                {mode === 'register' && <p className="auth-legal">By registering you agree to be excellent to each other.</p>}
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function PasswordMeter({ value }: { value: string }) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const labels = ['Too short', 'Weak', 'Okay', 'Good', 'Strong', 'Excellent'];
  const colors = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--warning)', 'var(--success)', 'var(--success)'];
  if (!value) return null;
  return (
    <div className="pw-meter">
      <div className="pw-bars">{[0, 1, 2, 3, 4].map((i) => <i key={i} style={{ background: i < score ? colors[score] : undefined }} />)}</div>
      <span style={{ color: colors[score] }}>{labels[score]}</span>
    </div>
  );
}

function ProviderIcon({ id }: { id: string }) {
  if (id === 'github') return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z" /></svg>;
  return <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>;
}
