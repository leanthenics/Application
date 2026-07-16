import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, createJob, getStyles, type Style } from '@/api/client';
import { refreshProfile } from '@/hooks/use-profile';
import { prepareForUpload } from '@/lib/image';
import { useDraftStore } from '@/store/draft';
import { useJobsStore } from '@/store/jobs';
import { useProfileStore } from '@/store/profile';

const GAP = 12;
const PAD = 16;

/**
 * Style-picker (step 2). Reads the pending capture from the draft store, lets the
 * user pick one garden style from the server catalog (GET /styles), then submits
 * the job and lands on Results. The photo → style hand-off avoids router params so
 * the local image URI never needs URL-encoding.
 */
export default function StyleScreen() {
  const draft = useDraftStore((s) => s.draft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const addJob = useJobsStore((s) => s.addJob);
  // null = profile not loaded yet (don't block on an unknown balance; the backend
  // enforces credits and we handle its 402 below).
  const credits = useProfileStore((s) => s.profile?.credits ?? null);

  const [styles_, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { width } = useWindowDimensions();
  const cardW = (width - PAD * 2 - GAP) / 2;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setStyles(await getStyles());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load styles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onGenerate() {
    if (!draft || !selectedId) return;
    // Optimistic gate: known-zero balance → straight to Buy (the backend enforces
    // this too, and we handle its 402 below in case this client value is stale).
    if (credits !== null && credits < 1) {
      router.push('/buy-credits');
      return;
    }
    const chosen = styles_.find((s) => s.id === selectedId);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const { base64, mimeType } = await prepareForUpload(draft.imageUri);
      const { jobId } = await createJob({
        image: base64,
        mimeType,
        style: selectedId,
        ...(draft.prompt ? { prompt: draft.prompt } : {}),
      });
      // A credit was just spent — re-sync the balance (pill + Settings) from the DB.
      void refreshProfile();
      addJob({
        jobId,
        inputThumbUri: draft.imageUri,
        style: selectedId,
        styleLabel: chosen?.label ?? selectedId,
        prompt: draft.prompt,
        status: 'queued',
        result: null,
        error: null,
        createdAt: Date.now(),
      });
      clearDraft();
      router.replace('/results');
    } catch (e) {
      // Backend says out of credits (stale client value) → sync + send to Buy.
      if (e instanceof ApiError && e.code === 'insufficient_credits') {
        void refreshProfile();
        setSubmitting(false);
        router.push('/buy-credits');
        return;
      }
      setSubmitError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Could not submit. Check your connection and try again.',
      );
      setSubmitting(false);
    }
  }

  // Guard: reached without a pending capture (e.g. deep link) → send back to Create.
  if (!draft) {
    return (
      <View style={styles.center}>
        <Ionicons name="image-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>Pick a photo first.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/create')}>
          <Text style={styles.primaryBtnText}>Go to Create</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#208AEF" />
        <Text style={styles.muted}>Loading styles…</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>{loadError}</Text>
        <Pressable style={styles.primaryBtn} onPress={load}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <FlatList
        data={styles_}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={<Text style={styles.heading}>Pick a garden style</Text>}
        renderItem={({ item }) => (
          <StyleCard
            style={item}
            width={cardW}
            selected={item.id === selectedId}
            onPress={() => setSelectedId(item.id)}
          />
        )}
      />

      <View style={styles.footer}>
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Pressable
          style={[styles.generateBtn, (!selectedId || submitting) && styles.generateBtnDisabled]}
          onPress={onGenerate}
          disabled={!selectedId || submitting}
          accessibilityLabel="Generate">
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="sparkles" size={18} color="#fff" />
              <Text style={styles.generateText}>Generate</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function StyleCard({
  style,
  width,
  selected,
  onPress,
}: {
  style: Style;
  width: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.card, { width }, selected && styles.cardSelected]}
      onPress={onPress}
      accessibilityLabel={`Select ${style.label}`}>
      {style.imageUrl ? (
        <Image source={{ uri: style.imageUrl }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardPlaceholder]}>
          <Ionicons name="leaf-outline" size={34} color="#7BB37B" />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={styles.cardLabel} numberOfLines={1}>
          {style.label}
        </Text>
        {style.blurb ? (
          <Text style={styles.cardBlurb} numberOfLines={2}>
            {style.blurb}
          </Text>
        ) : null}
      </View>
      {selected ? (
        <View style={styles.checkBadge}>
          <Ionicons name="checkmark-circle" size={24} color="#208AEF" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  grid: { padding: PAD, gap: GAP },
  row: { gap: GAP },
  heading: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 12 },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F0F0F3',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: '#208AEF' },
  cardImage: { width: '100%', aspectRatio: 1 },
  cardPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3EA' },
  cardBody: { padding: 10, gap: 2 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: '#000' },
  cardBlurb: { fontSize: 12, color: '#8E8E93', lineHeight: 16 },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  footer: {
    padding: 16,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#208AEF',
  },
  generateBtnDisabled: { backgroundColor: '#B7D6F7' },
  generateText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: '#fff' },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  error: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: '#208AEF',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
