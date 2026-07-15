import { Link } from 'expo-router';
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
import { signInWithEmail } from '@/lib/auth';
import { GoogleAuthButton } from '@/components/google-auth-button';

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
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to design your garden.</Text>

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
          placeholder="Password"
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
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log in</Text>}
        </Pressable>

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 14 },
  title: { fontSize: 28, fontWeight: '800', color: '#000' },
  subtitle: { fontSize: 15, color: '#8E8E93', marginBottom: 8 },
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
  },
  buttonDisabled: { backgroundColor: '#B7D6F7' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  forgot: { color: '#208AEF', fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  muted: { color: '#8E8E93', fontSize: 15 },
  link: { color: '#208AEF', fontSize: 15, fontWeight: '600' },
});
