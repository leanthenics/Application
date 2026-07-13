import * as Linking from 'expo-linking';
import { supabase } from './supabase';

/**
 * Thin wrappers over Supabase auth for the email/password flow. Screens call these
 * and just render loading/error; the actual session update propagates through
 * onAuthStateChange → the auth store → route gating (no manual navigation needed).
 *
 * Google OAuth is added later (Step 6). The backend never sees these calls — the
 * app talks to Supabase directly with the publishable key.
 */

/**
 * Where the confirmation email link should send the user back to. Resolves to
 * `clickretina://auth-callback` in a dev/prod build, or `exp://<host>/--/auth-callback`
 * inside Expo Go. This exact value must be in the Supabase Redirect URLs allow-list.
 */
export const emailRedirectTo = Linking.createURL('auth-callback');

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

/**
 * Sign up with email/password. With "Confirm email" ON, Supabase returns no session
 * (the user must click the emailed link first) — we surface that as
 * `needsConfirmation` so the UI can show a "check your email" state.
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
): Promise<{ needsConfirmation: boolean }> {
  // Log the redirect so it's easy to copy into the Supabase allow-list (esp. the
  // dynamic exp:// URL in Expo Go).
  console.log('[auth] confirmation redirect URL (allow-list in Supabase):', emailRedirectTo);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // `data` is written to auth.users.raw_user_meta_data; the handle_new_user
    // trigger copies `full_name` from there into public.profiles on signup.
    options: { emailRedirectTo, data: { full_name: fullName } },
  });
  if (error) throw new Error(error.message);
  return { needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
