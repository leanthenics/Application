import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

/**
 * Auth/session state, mirrored from Supabase. `session` is the source of truth for
 * route gating (see the root layout's Stack.Protected guards). `initialized` flips
 * true once we've read the persisted session on boot, so the UI can hold the splash
 * until we know whether the user is logged in (avoids an auth-screen flash).
 */
type AuthState = {
  session: Session | null;
  initialized: boolean;
  setSession: (session: Session | null) => void;
  setInitialized: (initialized: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  setSession: (session) => set({ session }),
  setInitialized: (initialized) => set({ initialized }),
}));
