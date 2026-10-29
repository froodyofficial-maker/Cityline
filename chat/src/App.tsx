import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isConfigured } from './lib/config';
import { supabase } from './lib/supabase';
import { SetupScreen } from './features/auth/SetupScreen';
import { AuthScreen } from './features/auth/AuthScreen';
import { ResetPassword } from './features/auth/ResetPassword';
import { AppShell } from './features/shell/AppShell';
import { Splash } from './features/shell/Splash';
import { Toasts } from './components/ui/Toasts';

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(isConfigured ? undefined : null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      setSession((prev) => (prev?.user.id === s?.user.id && prev?.access_token && s ? prev : s));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isConfigured) return <SetupScreen />;
  return (
    <>
      {session === undefined ? <Splash /> : session ? <AppShell key={session.user.id} /> : <AuthScreen />}
      {recovering && <ResetPassword onDone={() => setRecovering(false)} />}
      <Toasts />
    </>
  );
}
