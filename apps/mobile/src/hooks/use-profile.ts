import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useProfileStore, type Profile } from '@/store/profile';

/** Columns fetched for the profile (incl. the read-only credits balance). */
const PROFILE_COLUMNS = 'id, full_name, email, credits';

/**
 * Re-fetch the current user's profiles row and mirror it into the store. Callable
 * from anywhere (not a hook) — used to re-sync the credit balance after a generate
 * or a purchase. No-ops when logged out. RLS (auth.uid() = id) returns only the
 * caller's own row.
 */
export async function refreshProfile(): Promise<void> {
  const userId = useAuthStore.getState().session?.user?.id ?? null;
  if (!userId) return;
  const { setProfile, setError } = useProfileStore.getState();
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) setError(error.message);
  else if (data) setProfile(data as Profile);
}

/**
 * Mounts once (root layout). Fetches the current user's profiles row whenever the
 * logged-in user changes, and clears it on logout.
 */
export function useProfile() {
  const userId = useAuthStore((s) => s.session?.user?.id ?? null);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setLoading = useProfileStore((s) => s.setLoading);
  const setError = useProfileStore((s) => s.setError);
  const reset = useProfileStore((s) => s.reset);

  useEffect(() => {
    // No user (logged out) → drop any previous profile and stop.
    if (!userId) {
      reset();
      return;
    }

    let active = true;
    setLoading(true);

    supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message);
        } else {
          setProfile(data as Profile);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, setProfile, setLoading, setError, reset]);
}
