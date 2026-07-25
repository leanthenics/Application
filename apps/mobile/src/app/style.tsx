import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, createJob, getStyles, type Style } from '@/api/client';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { tapSelection } from '@/lib/haptics';
import { refreshProfile } from '@/hooks/use-profile';
import { prepareForUpload } from '@/lib/image';
import { useDraftStore } from '@/store/draft';
import { useJobsStore } from '@/store/jobs';
import { useProfileStore } from '@/store/profile';
import { colors, layout, radius, spacing, type } from '@/theme';

const GAP = spacing.md;
const PAD = spacing.lg;

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
  const gridWidth = Math.min(width, layout.maxContentWidth);
  const cardW = (gridWidth - PAD * 2 - GAP) / 2;

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
        night: draft.night,
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
        night: draft.night,
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
        <Ionicons name="image-outline" size={44} color={colors.textMuted} />
        <Text style={styles.muted}>Pick a photo first.</Text>
        <Button label="Go to Create" fullWidth={false} onPress={() => router.replace('/create')} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading styles…</Text>
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
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <FlatList
        data={styles_}
        keyExtractor={(s) => s.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <Text style={styles.heading}>Pick a garden style</Text>
            <Text style={styles.subheading}>Tap a style, then generate your design.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <StyleCard
            style={item}
            width={cardW}
            selected={item.id === selectedId}
            onPress={() => {
              tapSelection();
              setSelectedId(item.id);
            }}
          />
        )}
      />

      <View style={styles.footer}>
        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
        <Button
          label="Generate"
          icon="sparkles"
          size="lg"
          loading={submitting}
          disabled={!selectedId}
          onPress={onGenerate}
        />
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
  // Pop the check badge in/out when selection changes.
  const badge = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(badge, {
      toValue: selected ? 1 : 0,
      useNativeDriver: true,
      speed: 40,
      bounciness: 8,
    }).start();
  }, [selected, badge]);

  return (
    <PressableScale
      style={[styles.card, { width }, selected && styles.cardSelected]}
      onPress={onPress}
      accessibilityLabel={`Select ${style.label}`}>
      {style.imageUrl ? (
        <Image source={{ uri: style.imageUrl }} style={styles.cardImage} contentFit="cover" />
      ) : (
        <View style={[styles.cardImage, styles.cardPlaceholder]}>
          <Ionicons name="leaf-outline" size={34} color={colors.primary} />
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
      <Animated.View
        style={[styles.checkBadge, { opacity: badge, transform: [{ scale: badge }] }]}
        pointerEvents="none">
        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  grid: { padding: PAD, gap: GAP, alignSelf: 'center', width: '100%', maxWidth: layout.maxContentWidth },
  row: { gap: GAP },
  headerWrap: { marginBottom: spacing.md, gap: spacing.xs },
  heading: { ...type.title, fontSize: 24, color: colors.text },
  subheading: { ...type.body, color: colors.textSecondary },
  card: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  cardSelected: { borderColor: colors.primary },
  cardImage: { width: '100%', aspectRatio: 1 },
  cardPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  cardBody: { padding: spacing.md, gap: 2 },
  cardLabel: { ...type.bodyStrong, color: colors.text },
  cardBlurb: { ...type.caption, color: colors.textSecondary },
  checkBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.canvas,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  muted: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  error: { ...type.body, color: colors.danger, textAlign: 'center' },
});
