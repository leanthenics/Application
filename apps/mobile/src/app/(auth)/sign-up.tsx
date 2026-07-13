import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
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
import { signUpWithEmail } from '@/lib/auth';

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
        <Ionicons name="mail-unread-outline" size={56} color="#208AEF" />
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to {email.trim()}. Tap it to activate your account, then log in.
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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Sign up to start designing gardens.</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#8E8E93"
          autoCapitalize="words"
          autoComplete="name"
          value={fullName}
          onChangeText={setFullName}
        />
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
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#8E8E93"
          autoCapitalize="none"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign up</Text>}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.muted}>Already have an account? </Text>
          <Link href="/sign-in" style={styles.link}>
            Log in
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: '#fff' },
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
  buttonDisabled: { backgroundColor: '#B7D6F7' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  muted: { color: '#8E8E93', fontSize: 15 },
  link: { color: '#208AEF', fontSize: 15, fontWeight: '600' },
});
