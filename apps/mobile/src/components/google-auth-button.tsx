import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { googleSignInEnabled, signInWithGoogle } from '@/lib/auth';

/**
 * "or" divider + "Continue with Google" button, shared by sign-in and sign-up.
 * Manages its own loading; surfaces failures through the screen's error line via
 * onError so the layout stays consistent with the email form. On success the session
 * lands and the root guard swaps to the app — this component just unmounts.
 *
 * Renders nothing when Google isn't configured (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID unset),
 * so the email flow still works before the OAuth credentials are wired up.
 */
export function GoogleAuthButton({ onError }: { onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false);

  if (!googleSignInEnabled) return null;

  async function onPress() {
    onError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onPress}
        disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color="#000" style={styles.icon} />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  or: { color: '#8E8E93', fontSize: 13, fontWeight: '600' },
  button: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  icon: { marginRight: 2 },
  buttonText: { color: '#000', fontSize: 16, fontWeight: '600' },
});
