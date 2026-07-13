import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

/**
 * Completes email-confirmation (and later OAuth) when the user returns to the app
 * via the deep link. The link comes back as `<scheme>://auth-callback?code=...`
 * (PKCE); we exchange that code for a session. On success the session update flows
 * through onAuthStateChange → the auth store → route gating drops the user into the
 * app. `Linking.useURL()` covers both a cold start (app launched by the link) and a
 * warm resume (app already open).
 *
 * Mounted once in the root layout.
 */
export function useAuthDeepLink() {
  const url = Linking.useURL();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!url || handled.current === url) return;

    const { queryParams } = Linking.parse(url);
    const code = queryParams?.code;
    const errorDescription = queryParams?.error_description;

    if (typeof code === 'string' && code.length > 0) {
      handled.current = url;
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.warn('[auth] exchangeCodeForSession failed:', error.message);
      });
    } else if (typeof errorDescription === 'string') {
      // e.g. an expired/invalid confirmation link — leave the user on the auth screen.
      console.warn('[auth] deep-link error:', errorDescription);
    }
  }, [url]);
}
