import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useJobsStore } from '@/store/jobs';

/**
 * Mounts once (root layout): reads the persisted session on boot, then keeps the
 * auth store in sync with Supabase via onAuthStateChange (login, logout, token
 * refresh, email confirmation). Session presence drives route gating.
 */
export function useAuthListener() {
  const setSession = useAuthStore((s) => s.setSession);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitialized(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setInitialized(true);
      // Clear user-scoped client state on logout so it can't leak to the next
      // user signing in on the same device (the profile store already resets
      // reactively via use-profile).
      if (event === 'SIGNED_OUT') {
        useJobsStore.getState().reset();
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [setSession, setInitialized]);
}
