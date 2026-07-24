import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CompareSlider } from '@/components/compare-slider';
import { ProductRow } from '@/components/product-row';
import { WATERMARK_ENABLED } from '@/components/watermark';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { saveImageToGallery } from '@/lib/download';
import { fetchGeneration, type Generation } from '@/lib/history';
import { useHistoryStore } from '@/store/history';

/**
 * A single saved design from history. Reads the row from the history store (put
 * there by the list screen); if opened cold — e.g. after an app restart with no
 * list fetch yet — it fetches the row by id. Both the "before" (input) and
 * "after" (output) images live in private Storage, so each path is resolved to a
 * signed URL for rendering.
 */
export default function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const fromStore = useHistoryStore((s) => (id ? s.items[id] : undefined));
  const upsert = useHistoryStore((s) => s.upsert);
  const [gen, setGen] = useState<Generation | null>(fromStore ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (fromStore) {
      setGen(fromStore);
      return;
    }
    if (!id) return;
    let active = true;
    fetchGeneration(id)
      .then((g) => {
        if (!active) return;
        if (g) {
          setGen(g);
          upsert(g);
        } else {
          setLoadError('This design is no longer available.');
        }
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : 'Could not load this design.'));
    return () => {
      active = false;
    };
  }, [id, fromStore, upsert]);

  // Resolve both Storage paths to signed URLs. Hooks must run before any early
  // return, hence the optional chaining on a possibly-null generation.
  const beforeUrl = useSignedUrl(gen?.inputPath);
  const afterUrl = useSignedUrl(gen?.outputPath);

  if (loadError) {
    return (
      <View style={styles.center}>
        <Ionicons name="help-circle-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>{loadError}</Text>
      </View>
    );
  }

  // The edited ("after") image is the essential one; wait for it before rendering.
  if (!gen || !afterUrl) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#208AEF" />
        <Text style={styles.muted}>Loading your design…</Text>
      </View>
    );
  }

  const showWatermark = WATERMARK_ENABLED; // TODO(premium): && !profile?.isPremium
  const dateLabel = new Date(gen.createdAt).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Save the generated ("after") image to the device photo library.
  async function onDownload() {
    if (!afterUrl || !gen) return;
    setSaving(true);
    const res = await saveImageToGallery(afterUrl, { id: gen.id, mimeType: gen.mimeType });
    setSaving(false);
    if (res.ok) {
      Alert.alert('Saved', 'The design was saved to your photos.');
    } else if (res.reason === 'permission') {
      Alert.alert('Photo access needed', 'Allow photo access to save designs to your device.');
    } else {
      Alert.alert('Download failed', 'Could not save the image. Please try again.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* If the "before" URL is still resolving (or unavailable), fall back to the
          plain "after" image rather than blocking on the comparison. */}
      {beforeUrl ? (
        <CompareSlider beforeUri={beforeUrl} afterUri={afterUrl} watermark={showWatermark} />
      ) : (
        <Image source={{ uri: afterUrl }} style={styles.singleImage} contentFit="cover" />
      )}
      {beforeUrl ? (
        <Text style={styles.compareHint}>Drag the divider to compare before / after</Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.styleLabel}>
          {gen.styleLabel ? `${gen.styleLabel} garden` : 'Garden design'}
        </Text>
        {gen.night ? (
          <View style={styles.nightPill}>
            <Ionicons name="moon" size={12} color="#fff" />
            <Text style={styles.nightPillText}>Night</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.date}>{dateLabel}</Text>

      <Pressable
        style={[styles.downloadButton, saving && styles.downloadButtonDisabled]}
        onPress={onDownload}
        disabled={saving}
        accessibilityLabel="Download design to your photos">
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.downloadButtonText}>Download</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>Shop the look</Text>
      {gen.productGroups.map((g) => (
        <View key={g.group} style={styles.group}>
          <Text style={styles.groupTitle}>{g.group}</Text>
          {g.items.map((p, i) => (
            <ProductRow key={`${p.keyterm}-${i}`} product={p} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  singleImage: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#F0F0F3' },
  compareHint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  styleLabel: { fontSize: 15, fontWeight: '600', color: '#208AEF', textAlign: 'center' },
  nightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#1C1C4E',
  },
  nightPillText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  date: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#208AEF',
  },
  downloadButtonDisabled: { backgroundColor: '#B7D6F7' },
  downloadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginTop: 4 },
  group: { gap: 8, marginTop: 4 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#3C3C43', marginTop: 4 },
});
