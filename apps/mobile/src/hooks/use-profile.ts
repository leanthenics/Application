import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

/**
 * Mounts once (root layout). Fetches the current user's profiles row whenever the
 * logged-in user changes, and clears it on logout. RLS (auth.uid() = id) means the
 * query only ever returns the caller's own row, so requesting by id is safe.
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
      .select('id, full_name, email')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message);
        } else {
          setProfile(data);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, setProfile, setLoading, setError, reset]);
}
