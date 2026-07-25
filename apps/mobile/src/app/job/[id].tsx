import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, createJob } from '@/api/client';
import { CompareSlider } from '@/components/compare-slider';
import { ProductRow } from '@/components/product-row';
import { Button } from '@/components/ui/button';
import { WATERMARK_ENABLED } from '@/components/watermark';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { saveImageToGallery } from '@/lib/download';
import { prepareForUpload } from '@/lib/image';
import { useJobsStore } from '@/store/jobs';
import { colors, layout, radius, spacing, type } from '@/theme';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJobsStore((s) => (id ? s.jobs[id] : undefined));
  const addJob = useJobsStore((s) => s.addJob);
  const removeJob = useJobsStore((s) => s.removeJob);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The edited image lives in private Storage; resolve its path to a signed URL.
  // Hook must run before the early returns below, hence the optional chain.
  const afterUrl = useSignedUrl(job?.result?.outputImagePath);

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
        night: job.night,
        ...(job.prompt ? { prompt: job.prompt } : {}),
      });
      addJob({
        jobId: newId,
        inputThumbUri: job.inputThumbUri,
        style: job.style,
        styleLabel: job.styleLabel,
        prompt: job.prompt,
        night: job.night,
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

  // Save the generated ("after") image to the device photo library.
  async function onDownload() {
    if (!job?.result || !afterUrl) return;
    setSaving(true);
    const res = await saveImageToGallery(afterUrl, {
      id: job.jobId,
      mimeType: job.result.mimeType,
    });
    setSaving(false);
    if (res.ok) {
      Alert.alert('Saved', 'The design was saved to your photos.');
    } else if (res.reason === 'permission') {
      Alert.alert('Photo access needed', 'Allow photo access to save designs to your device.');
    } else {
      Alert.alert('Download failed', 'Could not save the image. Please try again.');
    }
  }

  if (!job) {
    return (
      <View style={styles.center}>
        <Ionicons name="help-circle-outline" size={44} color={colors.textMuted} />
        <Text style={styles.muted}>This job is no longer available.</Text>
      </View>
    );
  }

  // In-progress
  if (job.status === 'queued' || job.status === 'processing') {
    return (
      <View style={styles.center}>
        <Image source={{ uri: job.inputThumbUri }} style={styles.progressImage} contentFit="cover" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
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
        <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
        <Text style={styles.errorTitle}>Generation failed</Text>
        <Text style={styles.muted}>{job.error ?? 'Something went wrong.'}</Text>
        <Button
          label="Try again"
          icon="refresh"
          loading={retrying}
          fullWidth={false}
          onPress={onRetry}
        />
        {retryError ? <Text style={styles.retryError}>{retryError}</Text> : null}
      </View>
    );
  }

  // Completed. The edited ("after") image comes from a signed Storage URL; while
  // it resolves, show a spinner rather than a broken/black image.
  const { productGroups } = job.result;
  // Single gate for the watermark. TODO(premium): && !profile?.isPremium
  const showWatermark = WATERMARK_ENABLED;

  if (!afterUrl) {
    return (
      <View style={styles.center}>
        <Image source={{ uri: job.inputThumbUri }} style={styles.progressImage} contentFit="cover" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        <Text style={styles.muted}>Loading your design…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <CompareSlider beforeUri={job.inputThumbUri} afterUri={afterUrl} watermark={showWatermark} />
        <Text style={styles.compareHint}>Drag the divider to compare before / after</Text>
        {job.styleLabel ? <Text style={styles.styleLabel}>{job.styleLabel} garden</Text> : null}

        <Button label="Download" icon="download-outline" loading={saving} onPress={onDownload} />

        <Text style={styles.sectionTitle}>Shop the look</Text>
        {productGroups.map((g) => (
          <View key={g.group} style={styles.group}>
            <Text style={styles.groupTitle}>{g.group}</Text>
            {g.items.map((p, i) => (
              <ProductRow key={`${p.keyterm}-${i}`} product={p} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  scroll: { alignItems: 'center' },
  container: { width: '100%', maxWidth: layout.maxContentWidth, padding: spacing.lg, gap: spacing.md },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
  muted: { ...type.body, color: colors.textSecondary, textAlign: 'center' },
  errorTitle: { ...type.subheading, fontSize: 18, color: colors.text },
  progressImage: { width: 200, height: 200, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  compareHint: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  styleLabel: { ...type.bodyStrong, color: colors.primary, textAlign: 'center' },
  sectionTitle: { ...type.heading, color: colors.text, marginTop: spacing.xs },
  group: { gap: spacing.sm, marginTop: spacing.xs },
  groupTitle: { ...type.bodyStrong, color: colors.textSecondary, marginTop: spacing.xs },
  retryError: { ...type.body, color: colors.danger, textAlign: 'center' },
});
