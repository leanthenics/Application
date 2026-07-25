import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { fetchHistory, HISTORY_RETENTION_DAYS, type Generation } from '@/lib/history';
import { useHistoryStore } from '@/store/history';
import { colors, layout, radius, spacing, type } from '@/theme';

type Section = { title: string; data: Generation[] };

/** Midnight-of-day timestamp, for grouping generations by calendar day. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today" / "Yesterday" / "Mon, 21 Jul" for a day's section header. */
function dayLabel(dayStart: number): string {
  const todayStart = startOfDay(new Date());
  const diff = Math.round((todayStart - dayStart) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return new Date(dayStart).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Group a newest-first list into day sections (order preserved). */
function toSections(list: Generation[]): Section[] {
  const sections: Section[] = [];
  let currentKey: number | null = null;
  for (const gen of list) {
    const key = startOfDay(new Date(gen.createdAt));
    if (key !== currentKey) {
      sections.push({ title: dayLabel(key), data: [] });
      currentKey = key;
    }
    sections[sections.length - 1].data.push(gen);
  }
  return sections;
}

export default function HistoryScreen() {
  const itemsMap = useHistoryStore((s) => s.items);
  const setAll = useHistoryStore((s) => s.setAll);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => {
    const list = Object.values(itemsMap).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return toSections(list);
  }, [itemsMap]);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      mode === 'refresh' ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        setAll(await fetchHistory());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load your history.');
      } finally {
        mode === 'refresh' ? setRefreshing(false) : setLoading(false);
      }
    },
    [setAll],
  );

  // Refetch whenever the tab regains focus so freshly-created designs show up.
  useFocusEffect(
    useCallback(() => {
      void load('initial');
    }, [load]),
  );

  const disclaimer = (
    <View style={styles.disclaimer}>
      <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
      <Text style={styles.disclaimerText}>
        Showing your designs from the last {HISTORY_RETENTION_DAYS} days. Older designs are
        deleted automatically.
      </Text>
    </View>
  );

  if (loading && sections.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error && sections.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
        <Text style={styles.muted}>{error}</Text>
        <Button label="Retry" icon="refresh" fullWidth={false} onPress={() => load('initial')} />
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.centerPad}>
        {disclaimer}
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="time-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyText}>No saved designs yet.</Text>
          <Text style={styles.emptySub}>Your completed designs will appear here.</Text>
        </View>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={disclaimer}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <HistoryRow gen={item} onPress={() => router.push(`/history/${item.id}`)} />
      )}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load('refresh')}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    />
  );
}

function HistoryRow({ gen, onPress }: { gen: Generation; onPress: () => void }) {
  const thumbUrl = useSignedUrl(gen.outputPath);
  const time = new Date(gen.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <PressableScale
      haptic
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      android_ripple={{ color: colors.ripple }}>
      <View style={styles.thumbWrap}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={colors.textMuted} />
          </View>
        )}
        {gen.night ? (
          <View style={styles.nightBadge}>
            <Ionicons name="moon" size={11} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {gen.styleLabel ? `${gen.styleLabel} garden` : 'Garden design'}
        </Text>
        {gen.prompt ? (
          <Text style={styles.rowPrompt} numberOfLines={1}>
            {gen.prompt}
          </Text>
        ) : null}
        <Text style={styles.rowTime}>{time}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  disclaimerText: { flex: 1, ...type.caption, color: colors.textSecondary },
  sectionHeader: {
    ...type.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  thumbWrap: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nightBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...type.bodyStrong, fontSize: 16, color: colors.text },
  rowPrompt: { ...type.caption, fontSize: 13, color: colors.textSecondary },
  rowTime: { ...type.caption, color: colors.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  centerPad: { flex: 1, padding: spacing.md },
  muted: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyText: { ...type.subheading, color: colors.text },
  emptySub: { ...type.body, color: colors.textMuted },
});
