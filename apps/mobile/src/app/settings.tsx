import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { signOut } from '@/lib/auth';
import { useAuthStore } from '@/store/auth';
import { useProfileStore } from '@/store/profile';

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
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        {loading && !profile ? (
          <ActivityIndicator style={{ marginTop: 12 }} color="#208AEF" />
        ) : (
          <>
            <Text style={styles.name}>{fullName}</Text>
            <Text style={styles.email}>{email}</Text>
            {error ? <Text style={styles.error}>Couldn’t load profile: {error}</Text> : null}
          </>
        )}
      </View>

      <View style={styles.creditsCard}>
        <View style={styles.creditsRow}>
          <View style={styles.creditsLabelWrap}>
            <Ionicons name="flash" size={20} color="#F5A623" />
            <Text style={styles.creditsLabel}>Available credits</Text>
          </View>
          <Text style={styles.creditsValue}>{profile?.credits ?? 0}</Text>
        </View>
        <Pressable style={styles.buyBtn} onPress={() => router.push('/buy-credits')}>
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.buyBtnText}>Buy more credits</Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.logout, signingOut && styles.logoutDisabled]}
        onPress={onLogout}
        disabled={signingOut}>
        {signingOut ? (
          <ActivityIndicator color="#FF3B30" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
            <Text style={styles.logoutText}>Log out</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7', padding: 20, gap: 20 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700', color: '#000' },
  email: { fontSize: 15, color: '#8E8E93' },
  error: { fontSize: 13, color: '#FF3B30', marginTop: 8, textAlign: 'center' },
  creditsCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 16 },
  creditsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  creditsLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditsLabel: { fontSize: 16, color: '#000', fontWeight: '600' },
  creditsValue: { fontSize: 22, fontWeight: '800', color: '#1C1C1E' },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#208AEF',
  },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  logoutDisabled: { opacity: 0.6 },
  logoutText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
});
