import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, getCreditPackages, purchaseCredits, type CreditPackage } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { refreshProfile } from '@/hooks/use-profile';
import { useProfileStore } from '@/store/profile';
import { colors, layout, radius, spacing, type } from '@/theme';

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
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading packages…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
        <Text style={styles.muted}>{loadError}</Text>
        <Button label="Retry" icon="refresh" fullWidth={false} onPress={load} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.column}>
        <Card style={styles.balanceCard} elevated={false}>
          <View style={styles.balanceIcon}>
            <Ionicons name="leaf" size={20} color={colors.primary} />
          </View>
          <Text style={styles.balanceText}>{credits} credits available</Text>
        </Card>

        {packages.map((pkg) => {
          const busy = buyingId === pkg.id;
          return (
            <Card key={pkg.id} style={styles.pkgCard}>
              <View style={styles.pkgInfo}>
                <Text style={styles.pkgCredits}>{pkg.credits} credits</Text>
                <Text style={styles.pkgLabel}>{pkg.label}</Text>
              </View>
              <Button
                label={pkg.price > 0 ? `${pkg.currency} ${pkg.price}` : 'Add'}
                size="sm"
                fullWidth={false}
                loading={busy}
                disabled={buyingId !== null}
                onPress={() => onBuy(pkg)}
                style={styles.buyBtn}
              />
            </Card>
          );
        })}

        {packages.length === 0 ? (
          <Text style={styles.muted}>No packages available right now.</Text>
        ) : null}

        <Text style={styles.note}>
          Payments are coming soon — for now, tapping a pack adds the credits instantly.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  content: { alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth, padding: spacing.lg, gap: spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  muted: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderColor: 'transparent',
  },
  balanceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: { ...type.subheading, fontSize: 18, color: colors.text },
  pkgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  pkgInfo: { gap: 2 },
  pkgCredits: { ...type.subheading, fontSize: 18, color: colors.text },
  pkgLabel: { ...type.caption, fontSize: 13, color: colors.textSecondary },
  buyBtn: { minWidth: 96 },
  note: { ...type.caption, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
