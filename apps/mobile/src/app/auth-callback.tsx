import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/store/auth';

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
        <Pressable style={styles.button} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.buttonText}>Go to log in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color="#208AEF" />
      <Text style={styles.text}>Confirming your email…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#000', textAlign: 'center' },
  text: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  button: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
