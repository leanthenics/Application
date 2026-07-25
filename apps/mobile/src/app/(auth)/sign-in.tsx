import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { signInWithEmail } from '@/lib/auth';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { AuthHeader } from '@/components/ui/auth-header';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { colors, layout, spacing, type } from '@/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      // On success the session updates → the root guard swaps to the app; this
      // screen unmounts, so no manual navigation is needed.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Please try again.');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.column}>
          <AuthHeader title="Welcome back" subtitle="Log in to design your garden." />

          <TextField
            leadingIcon="mail-outline"
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            leadingIcon="lock-closed-outline"
            passwordToggle
            placeholder="Password"
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button label="Log in" loading={loading} disabled={!canSubmit} onPress={onSubmit} />

          <Link href="/forgot-password" style={styles.forgot}>
            Forgot password?
          </Link>

          <GoogleAuthButton onError={setError} />

          <View style={styles.footer}>
            <Text style={styles.muted}>New here? </Text>
            <Link href="/sign-up" style={styles.link}>
              Create an account
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
  error: { ...type.body, color: colors.danger },
  forgot: { ...type.bodyStrong, color: colors.primary, textAlign: 'center', marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.sm },
  muted: { ...type.body, color: colors.textSecondary },
  link: { ...type.bodyStrong, color: colors.primary },
});
