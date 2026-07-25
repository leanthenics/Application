import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSignedUrl } from '@/hooks/use-signed-url';
import type { Job } from '@/store/jobs';
import { useJobsStore } from '@/store/jobs';
import { colors, layout, radius, spacing, type } from '@/theme';

const GAP = spacing.md;
const PAD = spacing.md;

export default function ResultsScreen() {
  const jobsMap = useJobsStore((s) => s.jobs);
  const jobs = useMemo(
    () => Object.values(jobsMap).sort((a, b) => b.createdAt - a.createdAt),
    [jobsMap],
  );
  const { width } = useWindowDimensions();
  const gridWidth = Math.min(width, layout.maxContentWidth);
  const tileSize = (gridWidth - PAD * 2 - GAP) / 2;

  if (jobs.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}>
          <Ionicons name="images-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.emptyText}>No generations yet.</Text>
        <Text style={styles.emptySub}>Create one from the Create tab.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={jobs}
      keyExtractor={(j) => j.jobId}
      numColumns={2}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <JobTile
          job={item}
          size={tileSize}
          onPress={() => router.push(`/job/${item.jobId}`)}
        />
      )}
    />
  );
}

function JobTile({ job, size, onPress }: { job: Job; size: number; onPress: () => void }) {
  const done = job.status === 'completed' && job.result;
  // Completed edited image lives in private Storage → resolve its path to a signed
  // URL; until it's ready (or if it fails) fall back to the local input thumbnail.
  const afterUrl = useSignedUrl(done ? job.result!.outputImagePath : null);
  const uri = done && afterUrl ? afterUrl : job.inputThumbUri;

  return (
    <PressableScale style={[styles.tile, { width: size, height: size }]} onPress={onPress}>
      <Image source={{ uri }} style={styles.tileImage} contentFit="cover" />
      {job.status === 'queued' || job.status === 'processing' ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.overlayText}>
            {job.status === 'queued' ? 'Queued' : 'Processing'}
          </Text>
        </View>
      ) : job.status === 'failed' ? (
        <View style={[styles.overlay, styles.overlayFailed]}>
          <Ionicons name="alert-circle" size={26} color="#fff" />
          <Text style={styles.overlayText}>Failed</Text>
        </View>
      ) : (
        <View style={styles.doneBadge}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: {
    padding: PAD,
    gap: GAP,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  row: { gap: GAP },
  tile: {
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  tileImage: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.overlay,
  },
  overlayFailed: { backgroundColor: 'rgba(192,72,59,0.55)' },
  overlayText: { ...type.label, color: '#fff' },
  doneBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.pill,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: colors.canvas,
  },
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
