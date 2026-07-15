import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { updatePassword } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';

/**
 * Landing route for the password-reset deep link (`<scheme>://reset-password`).
 * The code→session exchange happens in the global useAuthDeepLink hook (same as
 * email confirmation); this screen waits for that recovery session, then collects a
 * new password and calls updateUser. Declared OUTSIDE the auth guards in the root
 * layout so it stays put once the recovery session lands (which flips isAuthed true)
 * — otherwise the guard would drop the user straight into the app.
 *
 * Because the reset link logs the user in, on success we just route to the app.
 */
export default function ResetPasswordScreen() {
  const session = useAuthStore((s) => s.session);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // If the recovery link never produces a session (expired/invalid, or opened on a
  // different device than requested), fall back to the login screen after a bit.
  useEffect(() => {
    if (session) return;
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [session]);

  // Supabase enforces a 6-char minimum by default; mirror it for a friendlier message.
  const canSubmit = password.length >= 6 && confirm.length > 0 && !loading;

  async function onSubmit() {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      // Session is already valid (the recovery link signed us in); the root guard
      // allows the app group, so drop the user in.
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password. Please try again.');
      setLoading(false);
    }
  }

  // Waiting on the recovery link to be exchanged into a session.
  if (!session) {
    if (timedOut) {
      return (
        <View style={styles.centered}>
          <Text style={styles.title}>Reset link expired</Text>
          <Text style={styles.subtitle}>
            This password reset link is invalid or has expired. Request a new one.
          </Text>
          <Pressable style={styles.button} onPress={() => router.replace('/forgot-password')}>
            <Text style={styles.buttonText}>Request new link</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#208AEF" />
        <Text style={styles.subtitle}>Verifying your reset link…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account.</Text>

        <TextInput
          style={styles.input}
          placeholder="New password (min 6 characters)"
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, styles.buttonFull, !canSubmit && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update password</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 14,
    backgroundColor: '#fff',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#000', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 8, textAlign: 'center' },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
  },
  error: { color: '#FF3B30', fontSize: 14 },
  button: {
    height: 50,
    borderRadius: 25,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
    minWidth: 200,
  },
  buttonFull: { alignSelf: 'stretch' },
  buttonDisabled: { backgroundColor: '#B7D6F7' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
