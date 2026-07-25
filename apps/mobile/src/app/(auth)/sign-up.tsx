import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { signUpWithEmail } from '@/lib/auth';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, layout, radius, spacing, type } from '@/theme';

export default function SignUpScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Supabase enforces a 6-char minimum by default; mirror it client-side for a
  // friendlier message before the round-trip. Name is required so the profile
  // (and Settings screen) isn't blank.
  const canSubmit =
    fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && !loading;

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const { needsConfirmation } = await signUpWithEmail(email.trim(), password, fullName.trim());
      if (needsConfirmation) {
        setSent(true); // show "check your email" — session arrives only after they confirm
      }
      // If confirmation were OFF, a session would arrive and the guard would swap.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign up. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Post-signup: email confirmation pending.
  if (sent) {
    return (
      <View style={styles.centered}>
        <View style={styles.mailBadge}>
          <Ionicons name="mail-unread-outline" size={44} color={colors.primary} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email.trim()}. Tap it to activate your account, then log in.
        </Text>
        <Button
          label="Back to log in"
          fullWidth={false}
          onPress={() => router.replace('/sign-in')}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.column}>
          <Text style={[styles.title, styles.titleCenter]}>Create your account</Text>
          <Text style={[styles.subtitle, styles.subtitleCenter]}>
            Sign up to start designing gardens.
          </Text>

          <TextField
            placeholder="Full name"
            autoCapitalize="words"
            autoComplete="name"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextField
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            placeholder="Password (min 6 characters)"
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Sign up" loading={loading} disabled={!canSubmit} onPress={onSubmit} />

          <GoogleAuthButton onError={setError} />

          <View style={styles.footer}>
            <Text style={styles.muted}>Already have an account? </Text>
            <Link href="/sign-in" style={styles.link}>
              Log in
            </Link>
          </View>
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
  titleCenter: { textAlign: 'center' },
  subtitle: { ...type.body, color: colors.textSecondary, marginBottom: spacing.sm },
  subtitleCenter: { textAlign: 'center' },
  error: { ...type.body, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  muted: { ...type.body, color: colors.textSecondary },
  link: { ...type.bodyStrong, color: colors.primary },
});
