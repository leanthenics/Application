import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { googleSignInEnabled, signInWithGoogle } from '@/lib/auth';
import { colors, radius, spacing, type } from '@/theme';

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
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
        onPress={onPress}
        disabled={loading}
        android_ripple={{ color: colors.ripple }}>
        {loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Ionicons name="logo-google" size={18} color={colors.text} style={styles.icon} />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.xs, gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  or: { ...type.label, color: colors.textMuted },
  button: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonPressed: { backgroundColor: colors.surfaceAlt },
  buttonDisabled: { opacity: 0.55 },
  icon: { marginRight: 2 },
  buttonText: { ...type.bodyStrong, fontSize: 16, color: colors.text },
});
