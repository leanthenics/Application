import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, createJob } from '@/api/client';
import { CompareSlider } from '@/components/compare-slider';
import { ProductRow } from '@/components/product-row';
import { WATERMARK_ENABLED } from '@/components/watermark';
import { prepareForUpload } from '@/lib/image';
import { useJobsStore } from '@/store/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJobsStore((s) => (id ? s.jobs[id] : undefined));
  const addJob = useJobsStore((s) => s.addJob);
  const removeJob = useJobsStore((s) => s.removeJob);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Re-run identical (same photo + style + prompt) and replace the old failed
  // entry. Re-submitting returns a new jobId; the app-wide poller picks up the new
  // queued job automatically.
  async function onRetry() {
    if (!job) return;
    setRetryError(null);
    setRetrying(true);
    try {
      const { base64, mimeType } = await prepareForUpload(job.inputThumbUri);
      const { jobId: newId } = await createJob({
        image: base64,
        mimeType,
        style: job.style,
        ...(job.prompt ? { prompt: job.prompt } : {}),
      });
      addJob({
        jobId: newId,
        inputThumbUri: job.inputThumbUri,
        style: job.style,
        styleLabel: job.styleLabel,
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
          {job.status === 'queued' ? 'Queued…' : 'Designing your garden…'}
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
  const { mimeType, outputImage, productGroups } = job.result;
  const uri = `data:${mimeType};base64,${outputImage}`;
  // Single gate for the watermark. TODO(premium): && !profile?.isPremium
  const showWatermark = WATERMARK_ENABLED;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <CompareSlider beforeUri={job.inputThumbUri} afterUri={uri} watermark={showWatermark} />
      <Text style={styles.compareHint}>Drag the divider to compare before / after</Text>
      {job.styleLabel ? <Text style={styles.styleLabel}>{job.styleLabel} garden</Text> : null}
      <Text style={styles.sectionTitle}>Shop the look</Text>
      {productGroups.map((g) => (
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
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
  progressImage: { width: 200, height: 200, borderRadius: 16, backgroundColor: '#F0F0F3' },
  compareHint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  styleLabel: { fontSize: 15, fontWeight: '600', color: '#208AEF', textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#000', marginTop: 4 },
  group: { gap: 8, marginTop: 4 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#3C3C43', marginTop: 4 },
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
