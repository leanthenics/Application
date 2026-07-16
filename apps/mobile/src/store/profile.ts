import { create } from 'zustand';

/**
 * The current user's profile row (public.profiles), fetched once per session by
 * use-profile and mirrored here for the UI (Settings screen, top bar). Kept
 * separate from useAuthStore because the session comes from Supabase auth while
 * this comes from the profiles table — different sources, different lifecycles.
 */
export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  /** Generation credits (source of truth is the DB; read-only here — never mutated client-side). */
  credits: number;
};

type ProfileState = {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
};

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  loading: false,
  error: null,
  setProfile: (profile) => set({ profile, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  // Called on logout so one user's profile never lingers into the next session.
  reset: () => set({ profile: null, loading: false, error: null }),
}));
