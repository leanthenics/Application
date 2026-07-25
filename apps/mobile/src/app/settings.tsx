import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';
import { colors, radius, spacing, type } from '@/theme';

/**
 * Settings screen (pushed from the top-bar gear). Shows the signed-in user's
 * profile and a logout button. Logout doesn't navigate manually — clearing the
 * session flips the root Stack.Protected guard back to the (auth) group.
 */
export default function SettingsScreen() {
  const session = useAuthStore((s) => s.session);
  const profile = useProfileStore((s) => s.profile);
  const loading = useProfileStore((s) => s.loading);
  const error = useProfileStore((s) => s.error);
  const [signingOut, setSigningOut] = useState(false);

  // Email is on the session even before the profiles fetch resolves; use it as a
  // fallback so the row is never blank.
  const email = profile?.email ?? session?.user?.email ?? '—';
  const fullName = profile?.full_name?.trim() || 'No name set';
  const initial = (profile?.full_name?.trim()?.[0] ?? email[0] ?? '?').toUpperCase();

  async function onLogout() {
    setSigningOut(true);
    try {
      await signOut();
      // No router call needed — the auth guard reacts to the cleared session.
    } catch (e) {
      setSigningOut(false);
      Alert.alert('Could not log out', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {loading && !profile ? (
          <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} />
        ) : (
          <>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email}>{email}</Text>
            {error ? <Text style={styles.error}>Couldn’t load profile: {error}</Text> : null}
          </>
        )}
      </Card>

      <Card style={styles.creditsCard}>
        <View style={styles.creditsRow}>
          <View style={styles.creditsLabelWrap}>
            <View style={styles.creditsIcon}>
              <Ionicons name="leaf" size={18} color={colors.primary} />
            </View>
            <Text style={styles.creditsLabel}>Available credits</Text>
          </View>
          <Text style={styles.creditsValue}>{profile?.credits ?? 0}</Text>
        </View>
        <Button
          label="Buy more credits"
          icon="add-circle-outline"
          onPress={() => router.push('/buy-credits')}
        />
      </Card>

      <Pressable
        style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed, signingOut && styles.logoutDisabled]}
        onPress={onLogout}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Log out">
        {signingOut ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.logoutText}>Log out</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas, padding: spacing.lg, gap: spacing.lg },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  avatarText: { color: colors.onPrimary, fontSize: 30, fontWeight: '700' },
  name: { ...type.heading, color: colors.text },
  email: { ...type.body, color: colors.textSecondary },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.sm, textAlign: 'center' },
  creditsCard: { gap: spacing.lg },
  creditsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditsLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creditsIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditsLabel: { ...type.bodyStrong, fontSize: 16, color: colors.text },
  creditsValue: { ...type.title, fontSize: 24, color: colors.text },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  logoutPressed: { backgroundColor: colors.surfaceAlt },
  logoutDisabled: { opacity: 0.6 },
  logoutText: { ...type.bodyStrong, fontSize: 16, color: colors.danger },
});
