import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { updatePassword } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, layout, spacing, type } from '@/theme';

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
          <Text style={[styles.title, styles.center]}>Reset link expired</Text>
          <Text style={[styles.subtitle, styles.center]}>
            This password reset link is invalid or has expired. Request a new one.
          </Text>
          <Button
            label="Request new link"
            fullWidth={false}
            onPress={() => router.replace('/forgot-password')}
          />
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.subtitle, styles.center]}>Verifying your reset link…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.column}>
          <Text style={[styles.title, styles.center]}>Set a new password</Text>
          <Text style={[styles.subtitle, styles.center]}>Choose a new password for your account.</Text>

          <TextField
            placeholder="New password (min 6 characters)"
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextField
            placeholder="Confirm new password"
            autoCapitalize="none"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Update password" loading={loading} disabled={!canSubmit} onPress={onSubmit} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  column: { width: '100%', maxWidth: layout.maxContentWidth, gap: spacing.md },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.canvas,
  },
  title: { ...type.title, fontSize: 28, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  error: { ...type.body, color: colors.danger },
});
