import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import type { Product } from '@clickretina/contract';
import { ApiError, createJob } from '@/api/client';
import { prepareForUpload } from '@/lib/image';
import { useJobsStore } from '@/store/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJobsStore((s) => (id ? s.jobs[id] : undefined));
  const addJob = useJobsStore((s) => s.addJob);
  const removeJob = useJobsStore((s) => s.removeJob);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Re-run identical (same photo + prompt) and replace the old failed entry.
  // Re-submitting returns a new jobId; the app-wide poller picks up the new
  // queued job automatically.
  async function onRetry() {
    if (!job) return;
    setRetryError(null);
    setRetrying(true);
    try {
      const { base64, mimeType } = await prepareForUpload(job.inputThumbUri);
      const { jobId: newId } = await createJob({ image: base64, mimeType, prompt: job.prompt });
      addJob({
        jobId: newId,
        inputThumbUri: job.inputThumbUri,
        prompt: job.prompt,
        status: 'queued',
        result: null,
        error: null,
        createdAt: Date.now(),
      });
      // Navigate to the new job BEFORE dropping the old id, so this screen
      // re-selects the new (queued) job rather than briefly rendering "not available".
      router.replace(`/job/${newId}`);
      removeJob(job.jobId);
    } catch (e) {
      setRetryError(
        e instanceof ApiError || e instanceof Error
          ? e.message
          : 'Could not retry. Check your connection and try again.',
      );
      setRetrying(false);
    }
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Ionicons name="help-circle-outline" size={44} color="#C7C7CC" />
        <Text style={styles.muted}>This job is no longer available.</Text>
      </View>
    );
  }

  // In-progress
  if (job.status === 'queued' || job.status === 'processing') {
    return (
      <View style={styles.center}>
        <Image source={{ uri: job.inputThumbUri }} style={styles.progressImage} contentFit="cover" />
        <ActivityIndicator color="#208AEF" style={{ marginTop: 20 }} />
        <Text style={styles.muted}>
          {job.status === 'queued' ? 'Queued…' : 'Restyling your space…'}
        </Text>
      </View>
    );
  }

  // Failed → client-safe message + retry
  if (job.status === 'failed' || !job.result) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={44} color="#FF3B30" />
        <Text style={styles.errorTitle}>Generation failed</Text>
        <Text style={styles.muted}>{job.error ?? 'Something went wrong.'}</Text>
        <Pressable
          style={[styles.retryButton, retrying && styles.retryButtonDisabled]}
          onPress={onRetry}
          disabled={retrying}
          accessibilityLabel="Try again">
          {retrying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={styles.retryButtonText}>Try again</Text>
            </>
          )}
        </Pressable>
        {retryError ? <Text style={styles.retryError}>{retryError}</Text> : null}
      </View>
    );
  }

  // Completed
  const { mimeType, outputImage, products } = job.result;
  const uri = `data:${mimeType};base64,${outputImage}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CompareSlider beforeUri={job.inputThumbUri} afterUri={uri} />
      <Text style={styles.compareHint}>Drag the divider to compare before / after</Text>
      <Text style={styles.sectionTitle}>Shop the look</Text>
      {products.map((p, i) => (
        <ProductRow key={`${p.keyterm}-${i}`} product={p} />
      ))}
    </ScrollView>
  );
}

function ProductRow({ product }: { product: Product }) {
  async function open() {
    try {
      await Linking.openURL(product.amazonUrl);
    } catch {
      // no handler / bad url — silently ignore (polished in F3)
    }
  }
  return (
    <Pressable style={styles.productRow} onPress={open} android_ripple={{ color: '#E5E5EA' }}>
      <Ionicons name="cart-outline" size={20} color="#208AEF" />
      <Text style={styles.productText} numberOfLines={2}>
        {product.keyterm}
      </Text>
      <Ionicons name="open-outline" size={18} color="#8E8E93" />
    </Pressable>
  );
}

/**
 * Before/after wipe comparison. The result (after) fills the frame; the original
 * (before) is drawn on top, clipped from the left to a draggable divider. Both use
 * contentFit="contain" in the same square frame so they overlay pixel-aligned
 * (Kontext preserves the input aspect ratio). Uses RN's core PanResponder — the
 * gesture is only claimed for clearly-horizontal drags so vertical swipes still
 * scroll the surrounding ScrollView.
 */
function CompareSlider({ beforeUri, afterUri }: { beforeUri: string; afterUri: string }) {
  const [width, setWidth] = useState(0);
  const [sliderX, setSliderX] = useState(0);
  const widthRef = useRef(0);
  const sliderXRef = useRef(0);
  const startX = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        startX.current = sliderXRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const w = widthRef.current;
        const x = Math.max(0, Math.min(w, startX.current + g.dx));
        sliderXRef.current = x;
        setSliderX(x);
      },
    }),
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    if (width === 0) {
      const mid = w / 2; // start the divider centered
      sliderXRef.current = mid;
      setSliderX(mid);
    }
    setWidth(w);
  }

  return (
    <View style={styles.output} onLayout={onLayout} {...pan.panHandlers}>
      {/* Base layer: the result (after). */}
      <Image source={{ uri: afterUri }} style={StyleSheet.absoluteFill} contentFit="contain" />

      {/* Overlay: the original (before), revealed left of the divider. */}
      {width > 0 ? (
        <View style={[styles.beforeClip, { width: sliderX }]} pointerEvents="none">
          <Image source={{ uri: beforeUri }} style={{ width, height: '100%' }} contentFit="contain" />
        </View>
      ) : null}

      {/* Divider line + drag handle. */}
      {width > 0 ? (
        <View style={[styles.divider, { left: sliderX }]} pointerEvents="none">
          <View style={styles.handle}>
            <Ionicons name="swap-horizontal" size={18} color="#208AEF" />
          </View>
        </View>
      ) : null}

      {/* Static orientation labels. */}
      <View style={[styles.compareLabel, styles.beforeLabel]} pointerEvents="none">
        <Text style={styles.compareLabelText}>Before</Text>
      </View>
      <View style={[styles.compareLabel, styles.afterLabel]} pointerEvents="none">
        <Text style={styles.compareLabelText}>After</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  progressImage: { width: 200, height: 200, borderRadius: 16, backgroundColor: '#F0F0F3' },
  output: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  beforeClip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  compareLabel: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  beforeLabel: { left: 10 },
  afterLabel: { right: 10 },
  compareLabelText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  compareHint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginTop: 4 },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
  },
  productText: { flex: 1, fontSize: 16, color: '#000' },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    minWidth: 160,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#208AEF',
  },
  retryButtonDisabled: { backgroundColor: '#B7D6F7' },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  retryError: { color: '#FF3B30', fontSize: 14, textAlign: 'center' },
});
