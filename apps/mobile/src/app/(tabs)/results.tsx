import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSignedUrl } from '@/hooks/use-signed-url';
import type { Job } from '@/store/jobs';
import { useJobsStore } from '@/store/jobs';

const GAP = 12;
const PAD = 12;

export default function ResultsScreen() {
  const jobsMap = useJobsStore((s) => s.jobs);
  const jobs = useMemo(
    () => Object.values(jobsMap).sort((a, b) => b.createdAt - a.createdAt),
    [jobsMap],
  );
  const { width } = useWindowDimensions();
  const tileSize = (width - PAD * 2 - GAP) / 2;

  if (jobs.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="images-outline" size={48} color="#C7C7CC" />
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
    <Pressable style={[styles.tile, { width: size, height: size }]} onPress={onPress}>
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
          <Ionicons name="checkmark-circle" size={22} color="#34C759" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { padding: PAD, gap: GAP },
  row: { gap: GAP },
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F0F0F3',
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
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayFailed: { backgroundColor: 'rgba(255,59,48,0.55)' },
  overlayText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  doneBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  emptyText: { fontSize: 17, fontWeight: '600', color: '#3A3A3C' },
  emptySub: { fontSize: 14, color: '#8E8E93' },
});
