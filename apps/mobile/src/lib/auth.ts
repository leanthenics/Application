import * as Linking from 'expo-linking';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';

/**
 * Thin wrappers over Supabase auth. Screens call these and just render loading/error;
 * the actual session update propagates through onAuthStateChange → the auth store →
 * route gating (no manual navigation needed). The backend never sees these calls — the
 * app talks to Supabase directly with the publishable key.
 *
 * Covers email/password, forgot-password (PKCE), and Google (native id-token, Step 6).
 */

/**
 * Where the confirmation email link should send the user back to. Resolves to
 * `clickretina://auth-callback` in a dev/prod build, or `exp://<host>/--/auth-callback`
 * inside Expo Go. This exact value must be in the Supabase Redirect URLs allow-list.
 */
export const emailRedirectTo = Linking.createURL('auth-callback');

/**
 * Where the password-reset email link should send the user back to. Resolves to
 * `clickretina://reset-password` in a dev/prod build (or `exp://<host>/--/reset-password`
 * in Expo Go). Distinct from `emailRedirectTo` on purpose: the app routes this deep
 * link to the new-password screen (see app/reset-password.tsx) instead of dropping
 * straight into the app. This exact value must be in the Supabase Redirect URLs allow-list.
 */
export const resetRedirectTo = Linking.createURL('reset-password');

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

/**
 * Send a password-reset email. Under PKCE the emailed link comes back as
 * `<scheme>://reset-password?code=...`; useAuthDeepLink exchanges that code for a
 * (recovery) session, and the reset-password screen then collects the new password.
 * Note: PKCE stores the code verifier on THIS device, so the link must be opened on
 * the same device that requested the reset.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  // Log the redirect so it's easy to copy into the Supabase allow-list (esp. the
  // dynamic exp:// URL in Expo Go).
  console.log('[auth] reset redirect URL (allow-list in Supabase):', resetRedirectTo);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirectTo,
  });
  if (error) throw new Error(error.message);
}

/**
 * Set a new password for the currently-authenticated (recovery) session. Called from
 * the reset-password screen after the recovery link has been exchanged for a session.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ── Google OAuth (native id-token flow) ──────────────────────────────────────
// We use the WEB client ID here (not the Android one): Google issues the ID token
// against the web client, and the Android client (package + SHA-1) just authorizes
// this app to request it. Both client IDs must be added to Supabase's Google provider
// "Authorized Client IDs". Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in apps/mobile/.env.
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

let googleConfigured = false;
function configureGoogleOnce(): void {
  if (googleConfigured) return;
  GoogleSignin.configure({ webClientId: googleWebClientId });
  googleConfigured = true;
}

/** Whether Google sign-in is wired up (env present) — screens hide the button if not. */
export const googleSignInEnabled = !!googleWebClientId;

/**
 * Native Google sign-in: shows the Android account picker, gets a Google ID token, and
 * exchanges it with Supabase via signInWithIdToken. On success the session propagates
 * through onAuthStateChange → the guard drops the user into the app (no manual nav).
 *
 * User-cancelled picker resolves quietly (no thrown error) so the UI shows nothing.
 * Requires the native module — run `expo install @react-native-google-signin/google-signin`
 * and rebuild (expo run:android); it does NOT work in a JS-only Metro reload.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!googleWebClientId) {
    throw new Error('Google sign-in is not configured.');
  }
  configureGoogleOnce();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return; // user dismissed the picker
    const idToken = response.data.idToken;
    if (!idToken) throw new Error('No ID token returned from Google.');
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error) throw new Error(error.message);
  } catch (e) {
    if (isErrorWithCode(e)) {
      // Cancels / already-in-progress are not real errors — swallow them.
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services is unavailable or out of date.');
      }
    }
    throw e instanceof Error ? e : new Error('Google sign-in failed. Please try again.');
  }
}
