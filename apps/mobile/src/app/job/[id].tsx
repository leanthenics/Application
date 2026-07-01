import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Product } from '@clickretina/contract';
import { useJobsStore } from '@/store/jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const job = useJobsStore((s) => (id ? s.jobs[id] : undefined));

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

  // Failed → client-safe message
  if (job.status === 'failed' || !job.result) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={44} color="#FF3B30" />
        <Text style={styles.errorTitle}>Generation failed</Text>
        <Text style={styles.muted}>{job.error ?? 'Something went wrong.'}</Text>
      </View>
    );
  }

  // Completed
  const { mimeType, outputImage, products } = job.result;
  const uri = `data:${mimeType};base64,${outputImage}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri }} style={styles.output} contentFit="contain" />
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
    backgroundColor: '#000',
  },
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
});
