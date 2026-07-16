import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, getCreditPackages, purchaseCredits, type CreditPackage } from '@/api/client';
import { refreshProfile } from '@/hooks/use-profile';
import { useProfileStore } from '@/store/profile';

/**
 * Buy-credits screen (pushed from the top-bar pill or Settings). Lists the server
 * credit packs (GET /credits/packages) and "buys" one (POST /credits/purchase).
 *
 * No payment gateway yet — a purchase grants the credits immediately; the backend
 * route is the seam where a real provider slots in later. After a grant we
 * refreshProfile() so the balance (pill + Settings) updates from the DB.
 */
export default function BuyCreditsScreen() {
  const credits = useProfileStore((s) => s.profile?.credits ?? 0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPackages(await getCreditPackages());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load packages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onBuy(pkg: CreditPackage) {
    setBuyingId(pkg.id);
    try {
      const newBalance = await purchaseCredits(pkg.id);
      await refreshProfile();
      Alert.alert('Credits added', `${pkg.credits} credits added. You now have ${newBalance}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert(
        'Purchase failed',
        e instanceof ApiError || e instanceof Error ? e.message : 'Please try again.',
      );
    } finally {
      setBuyingId(null);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#208AEF" />
        <Text style={styles.muted}>Loading packages…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>{loadError}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.balanceCard}>
        <Ionicons name="flash" size={22} color="#F5A623" />
        <Text style={styles.balanceText}>{credits} credits available</Text>
      </View>

      {packages.map((pkg) => {
        const busy = buyingId === pkg.id;
        return (
          <View key={pkg.id} style={styles.pkgCard}>
            <View style={styles.pkgInfo}>
              <Text style={styles.pkgCredits}>{pkg.credits} credits</Text>
              <Text style={styles.pkgLabel}>{pkg.label}</Text>
            </View>
            <Pressable
              style={[styles.buyBtn, (busy || buyingId !== null) && styles.buyBtnDisabled]}
              onPress={() => onBuy(pkg)}
              disabled={buyingId !== null}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buyText}>
                  {pkg.price > 0 ? `${pkg.currency} ${pkg.price}` : 'Add'}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}

      {packages.length === 0 ? (
        <Text style={styles.muted}>No packages available right now.</Text>
      ) : null}

      <Text style={styles.note}>
        Payments are coming soon — for now, tapping a pack adds the credits instantly.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: 20, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#F2F2F7' },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  balanceText: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  pkgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  pkgInfo: { gap: 2 },
  pkgCredits: { fontSize: 18, fontWeight: '700', color: '#000' },
  pkgLabel: { fontSize: 13, color: '#8E8E93' },
  buyBtn: {
    minWidth: 96,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#208AEF',
  },
  buyBtnDisabled: { opacity: 0.5 },
  buyText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: '#208AEF',
  },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, color: '#8E8E93', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
