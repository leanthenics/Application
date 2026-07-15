import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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
import { sendPasswordReset } from '@/lib/auth';

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
        <Ionicons name="mail-unread-outline" size={56} color="#208AEF" />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          If an account exists for {email.trim()}, we sent a link to reset your password. Open it on
          this device to continue.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.buttonText}>Back to log in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we&apos;ll send you a link to set a new password.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, styles.buttonFull, !canSubmit && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send reset link</Text>
          )}
        </Pressable>

        <Pressable style={styles.footer} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.link}>Back to log in</Text>
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
  footer: { alignItems: 'center', marginTop: 8 },
  link: { color: '#208AEF', fontSize: 15, fontWeight: '600' },
});
