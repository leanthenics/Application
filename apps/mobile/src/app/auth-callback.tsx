import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { colors, spacing, type } from '@/theme';

/**
 * Landing route for the email-confirmation deep link (`<scheme>://auth-callback`).
 * The actual code→session exchange happens in the global useAuthDeepLink hook; this
 * screen just shows progress. Once the session lands we route into the app (the
 * root guard now allows it). If nothing arrives, we fall back to the login screen.
 *
 * Declared OUTSIDE the auth guards in the root layout so it's reachable in either
 * auth state (the link arrives before the session exists).
 */
export default function AuthCallbackScreen() {
  const session = useAuthStore((s) => s.session);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (session) router.replace('/'); // guard now allows the app group
  }, [session]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut && !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Couldn&apos;t confirm automatically</Text>
        <Text style={styles.text}>Your email may already be confirmed — try logging in.</Text>
        <Button label="Go to log in" fullWidth={false} onPress={() => router.replace('/sign-in')} />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.text}>Confirming your email…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  title: { ...type.subheading, fontSize: 18, color: colors.text, textAlign: 'center' },
  text: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
});
