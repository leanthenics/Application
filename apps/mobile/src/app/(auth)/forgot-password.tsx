import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { sendPasswordReset } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, layout, radius, spacing, type } from '@/theme';

/**
 * Signed-out "forgot password" screen. Sends a reset email; the emailed link comes
 * back into the app as a deep link that lands on app/reset-password.tsx, where the
 * user sets a new password. Same PKCE mechanics as email confirmation.
 */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const canSubmit = email.trim().length > 0 && !loading;

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Reset email sent.
  if (sent) {
    return (
      <View style={styles.centered}>
        <View style={styles.mailBadge}>
          <Ionicons name="mail-unread-outline" size={44} color={colors.primary} />
        </View>
        <Text style={[styles.title, styles.center]}>Check your email</Text>
        <Text style={[styles.subtitle, styles.center]}>
          If an account exists for {email.trim()}, we sent a link to reset your password. Open it on
          this device to continue.
        </Text>
        <Button label="Back to log in" fullWidth={false} onPress={() => router.replace('/sign-in')} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.column}>
          <Text style={[styles.title, styles.center]}>Reset your password</Text>
          <Text style={[styles.subtitle, styles.center]}>
            Enter your email and we&apos;ll send you a link to set a new password.
          </Text>

          <TextField
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Send reset link" loading={loading} disabled={!canSubmit} onPress={onSubmit} />

          <Pressable style={styles.footer} onPress={() => router.replace('/sign-in')}>
            <Text style={styles.link}>Back to log in</Text>
          </Pressable>
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
  mailBadge: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...type.title, fontSize: 28, color: colors.text },
  subtitle: { ...type.body, color: colors.textSecondary, marginBottom: spacing.sm },
  center: { textAlign: 'center' },
  error: { ...type.body, color: colors.danger },
  footer: { alignItems: 'center', marginTop: spacing.sm },
  link: { ...type.bodyStrong, color: colors.primary },
});
