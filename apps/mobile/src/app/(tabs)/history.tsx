import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { fetchHistory, HISTORY_RETENTION_DAYS, type Generation } from '@/lib/history';
import { useHistoryStore } from '@/store/history';

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
      <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
      <Text style={styles.disclaimerText}>
        Showing your designs from the last {HISTORY_RETENTION_DAYS} days. Older designs are
        deleted automatically.
      </Text>
    </View>
  );

  if (loading && sections.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#208AEF" />
      </View>
    );
  }

  if (error && sections.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => load('initial')}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.centerPad}>
        {disclaimer}
        <View style={styles.center}>
          <Ionicons name="time-outline" size={48} color="#C7C7CC" />
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
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} />
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
    <Pressable style={styles.row} onPress={onPress} android_ripple={{ color: '#E5E5EA' }}>
      <View style={styles.thumbWrap}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={22} color="#C7C7CC" />
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
      <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 10 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
  },
  disclaimerText: { flex: 1, fontSize: 12, color: '#8E8E93', lineHeight: 16 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  thumbWrap: { width: 64, height: 64 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: '#F0F0F3' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nightBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1C1C4E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E' },
  rowPrompt: { fontSize: 13, color: '#8E8E93' },
  rowTime: { fontSize: 12, color: '#C7C7CC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  centerPad: { flex: 1, padding: 12 },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#3A3A3C' },
  emptySub: { fontSize: 14, color: '#8E8E93' },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
