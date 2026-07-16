import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useJobPoller } from '@/hooks/use-job-poller';
import { useAuthListener } from '@/hooks/use-auth-listener';
import { useAuthDeepLink } from '@/hooks/use-auth-deep-link';
import { useProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/store/auth';

/**
 * Root navigator. Auth-gated via Stack.Protected: with a session, the app group
 * ((tabs) + pushed style/job screens) is reachable; without one, only the (auth)
 * group is. Because "Confirm email" is ON, a session appears only after the user
 * confirms and signs in — so unconfirmed users stay on the auth screens.
 *
 * The splash is held until the persisted session has been read (initialized), to
 * avoid a flash of the login screen for already-signed-in users.
 */
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useAuthListener();
  useAuthDeepLink();
  useProfile();
  useJobPoller();
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (initialized) SplashScreen.hideAsync();
  }, [initialized]);

  if (!initialized) return null; // keep the splash up until we know the auth state

  const isAuthed = !!session;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Protected guard={isAuthed}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="style" options={{ title: 'Choose a style' }} />
          <Stack.Screen name="job/[id]" options={{ title: 'Result' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="buy-credits" options={{ title: 'Buy credits' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isAuthed}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Always reachable — the email-confirmation link lands here before a
            session exists, so it can't sit behind either auth guard. */}
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
        {/* Always reachable — the password-reset link lands here. The recovery
            session it creates flips isAuthed true, so this screen must stay
            outside the guards (else the app group would swallow it). */}
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
