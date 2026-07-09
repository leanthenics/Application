import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { getShowcase, type ShowcaseItem } from '@/api/client';
import { CompareSlider } from '@/components/compare-slider';
import { ProductRow } from '@/components/product-row';

type StepInfo = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const STEPS: StepInfo[] = [
  {
    icon: 'camera-outline',
    title: 'Click it',
    body: 'Snap or upload a photo of your garden, balcony, terrace, or backyard.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Design it',
    body: 'Pick a garden style and our AI redesigns your outdoor space with plants and features.',
  },
  {
    icon: 'cart-outline',
    title: 'Visualize it',
    body: 'See the before / after and shop every product with a single tap.',
  },
];

export default function LandingScreen() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { height } = useWindowDimensions();
  const heroMinHeight = Math.round(height * 0.5);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await getShowcase());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load examples.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      {/* Hero — occupies ~half the first screen */}
      <View style={[styles.hero, { minHeight: heroMinHeight }]}>
        <Text style={styles.title}>ClickRetina</Text>
        <Text style={styles.tagline}>
          Visualize your dream garden — snap a photo, redesign it with AI, and shop the look.
        </Text>

        <Pressable
          style={styles.cta}
          onPress={() => router.navigate('/create')}
          accessibilityLabel="Get started">
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.ctaText}>Get started</Text>
        </Pressable>
      </View>

      {/* Showcase */}
      <Text style={styles.sectionHeading}>See it in action</Text>
      {loading ? (
        <View style={styles.skeletonWrap}>
          <ShowcaseSkeleton />
          <ShowcaseSkeleton />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Ionicons name="refresh" size={16} color="#208AEF" />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.muted}>Examples coming soon.</Text>
        </View>
      ) : (
        items.map((item) => <ShowcaseCard key={item.id} item={item} />)
      )}

      {/* How it works — centered timeline linked by dotted connectors */}
      <Text style={styles.sectionHeading}>How it works</Text>
      <View style={styles.timeline}>
        {STEPS.map((step, i) => (
          <Fragment key={step.title}>
            <View style={styles.step}>
              <View style={styles.stepBadge}>
                <Ionicons name={step.icon} size={34} color="#208AEF" />
              </View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepBody}>{step.body}</Text>
            </View>
            {i < STEPS.length - 1 ? <DottedConnector /> : null}
          </Fragment>
        ))}
      </View>

      {/* Footer bar (intentionally empty for now) */}
      <View style={styles.bottomBar} />
    </ScrollView>
  );
}

/**
 * One showcase example. The product list stays hidden until the user first
 * interacts with the before/after slider (tap or slide), then expands beneath
 * the image — pushing the rest of the page down.
 */
function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.showcaseCard}>
      {item.title ? <Text style={styles.showcaseTitle}>{item.title}</Text> : null}
      <CompareSlider
        beforeUri={item.beforeUrl}
        afterUri={item.afterUrl}
        onInteract={() => setRevealed(true)}
      />
      {revealed ? (
        <View style={styles.showcaseProducts}>
          <Text style={styles.shopLabel}>Shop the look</Text>
          {item.products.map((p, i) => (
            <ProductRow key={`${p.keyterm}-${i}`} product={p} />
          ))}
        </View>
      ) : (
        <Text style={styles.showcaseHint}>Slide or tap to compare and shop the look</Text>
      )}
    </View>
  );
}

/**
 * Placeholder shadow card shown while the showcase loads from the server — a
 * gently pulsing image block + two text lines, so the section has structure
 * instead of a bare spinner on a white screen.
 */
function ShowcaseSkeleton() {
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <View style={styles.showcaseCard}>
      <Animated.View style={[styles.skeletonImage, { opacity }]} />
      <Animated.View style={[styles.skeletonLineWide, { opacity }]} />
      <Animated.View style={[styles.skeletonLine, { opacity }]} />
    </View>
  );
}

/** A short vertical dotted line linking two steps on the timeline. */
function DottedConnector() {
  return (
    <View style={styles.connector}>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={styles.connectorDot} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F5F6F8' },
  container: { padding: 16, gap: 14 },
  hero: {
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    marginHorizontal: -16, // full-bleed despite the container padding
    marginTop: -16,
    backgroundColor: '#EAF3FE',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: { fontSize: 34, fontWeight: '800', color: '#000', textAlign: 'center' },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
    color: '#3A3A3C',
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: 320,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#208AEF',
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionHeading: { fontSize: 20, fontWeight: '700', color: '#000', marginTop: 8, textAlign: 'center' },
  stateBox: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 28 },
  muted: { fontSize: 15, color: '#8E8E93', textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  retryText: { color: '#208AEF', fontSize: 15, fontWeight: '600' },
  skeletonWrap: { gap: 14 },
  showcaseCard: {
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#E3E6EA',
  },
  skeletonLineWide: {
    height: 14,
    width: '70%',
    borderRadius: 7,
    backgroundColor: '#E3E6EA',
    alignSelf: 'center',
    marginTop: 4,
  },
  skeletonLine: {
    height: 12,
    width: '45%',
    borderRadius: 6,
    backgroundColor: '#E3E6EA',
    alignSelf: 'center',
  },
  showcaseTitle: { fontSize: 16, fontWeight: '600', color: '#000', textAlign: 'center' },
  showcaseHint: { fontSize: 13, color: '#8E8E93', textAlign: 'center' },
  showcaseProducts: { gap: 10, marginTop: 2 },
  shopLabel: { fontSize: 16, fontWeight: '700', color: '#000', textAlign: 'center' },
  timeline: { alignItems: 'center', marginTop: 4 },
  step: { alignItems: 'center', gap: 8, maxWidth: 300 },
  stepBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EAF3FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#000', textAlign: 'center' },
  stepBody: { fontSize: 14, lineHeight: 20, color: '#6C6C70', textAlign: 'center' },
  connector: { alignItems: 'center', gap: 5, paddingVertical: 12 },
  connectorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#B7D0EC' },
  bottomBar: {
    height: 64,
    marginTop: 16,
    marginHorizontal: -16, // bleed to screen edges despite the container padding
    marginBottom: -16,
    backgroundColor: '#000',
  },
});
