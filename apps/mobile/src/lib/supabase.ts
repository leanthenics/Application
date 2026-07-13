import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client (auth + data), used app-side. The URL + publishable key come
 * from `apps/mobile/.env` (EXPO_PUBLIC_* → readable by the Expo app). The
 * publishable key is client-safe by design; Row-Level Security protects data.
 *
 * Session storage = AsyncStorage for now (simplest). Hardening step later can swap
 * this for an encrypted expo-secure-store adapter without touching callers.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase env — set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY in apps/mobile/.env',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // URL-based session detection is for web OAuth redirects; off on native.
    detectSessionInUrl: false,
    // PKCE: email-confirmation / OAuth links come back with a `?code=` we exchange
    // via exchangeCodeForSession (see use-auth-deep-link). More secure than the
    // implicit token-in-URL flow, and the code arrives as a clean query param.
    flowType: 'pkce',
  },
});

// Keep the access token fresh while the app is foregrounded; pause refresh when
// backgrounded. Native only — AppState 'active' isn't meaningful on web.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
