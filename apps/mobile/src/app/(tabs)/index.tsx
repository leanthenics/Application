import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getShowcase, type ShowcaseItem } from '@/api/client';
import { CompareSlider } from '@/components/compare-slider';
import { ProductRow } from '@/components/product-row';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSignedUrl } from '@/hooks/use-signed-url';
import { fetchHistory, type Generation } from '@/lib/history';
import { useHistoryStore } from '@/store/history';
import { useProfileStore } from '@/store/profile';
import { colors, radius, shadow, spacing, type } from '@/theme';

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

/** Greeting text + a matching sun/moon icon for the current time of day. */
function timeOfDay(): { greeting: string; icon: keyof typeof Ionicons.glyphMap } {
  const h = new Date().getHours();
  if (h < 12) return { greeting: 'Good morning', icon: 'sunny' };
  if (h < 17) return { greeting: 'Good afternoon', icon: 'partly-sunny' };
  if (h < 21) return { greeting: 'Good evening', icon: 'moon' };
  return { greeting: 'Good night', icon: 'moon' };
}

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export default function LandingScreen() {
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fullName = useProfileStore((s) => s.profile?.full_name ?? null);
  const firstName = fullName?.trim().split(/\s+/)[0] || null;
  const { greeting, icon } = timeOfDay();

  // Recents = today's latest 3 designs, pulled from the persistent history.
  const historyItems = useHistoryStore((s) => s.items);
  const setAll = useHistoryStore((s) => s.setAll);
  const recents = useMemo(() => {
    const since = startOfToday();
    return Object.values(historyItems)
      .filter((g) => new Date(g.createdAt).getTime() >= since)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [historyItems]);

  // Refresh recents whenever Home regains focus (best-effort).
  useFocusEffect(
    useCallback(() => {
      fetchHistory().then(setAll).catch(() => {});
    }, [setAll]),
  );

  const loadShowcase = useCallback(async () => {
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
    loadShowcase();
  }, [loadShowcase]);

  // Subtle entrance: fade + rise the content in on mount.
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 4 }),
    ]).start();
  }, [fade, rise]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
        {/* Greeting */}
        <View style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text style={styles.greetingHi}>{greeting}{firstName ? ',' : ''}</Text>
            {firstName ? <Text style={styles.greetingName}>{firstName} 🌱</Text> : null}
          </View>
          <View style={styles.greetingIcon}>
            <Ionicons name={icon} size={20} color={colors.accent} />
          </View>
        </View>

        {/* Start a design — the hero CTA */}
        <PressableScale
          haptic
          style={styles.hero}
          onPress={() => router.navigate('/create')}
          accessibilityLabel="Start a design">
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>Design your dream garden</Text>
            <Text style={styles.heroSub}>
              Snap a photo and redesign your outdoor space with AI.
            </Text>
            <View style={styles.heroCta}>
              <Ionicons name="camera" size={16} color={colors.primary} />
              <Text style={styles.heroCtaText}>Start a design</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </View>
          <Ionicons name="leaf" size={150} color="rgba(255,255,255,0.10)" style={styles.heroLeaf} />
        </PressableScale>

        {/* Recent designs (today) */}
        {recents.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionHeading}>Recent designs</Text>
              <Pressable onPress={() => router.navigate('/history')} hitSlop={8}>
                <Text style={styles.seeAll}>See all</Text>
              </Pressable>
            </View>
            {recents.map((g) => (
              <RecentRow key={g.id} gen={g} />
            ))}
          </View>
        ) : null}

        {/* Showcase */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>See it in action</Text>
          {loading ? (
            <View style={styles.skeletonWrap}>
              <ShowcaseSkeleton />
              <ShowcaseSkeleton />
            </View>
          ) : error ? (
            <View style={styles.stateBox}>
              <Text style={styles.muted}>{error}</Text>
              <Pressable style={styles.retry} onPress={loadShowcase} hitSlop={8}>
                <Ionicons name="refresh" size={16} color={colors.primary} />
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
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>How it works</Text>
          <View style={styles.timeline}>
            {STEPS.map((step, i) => (
              <Fragment key={step.title}>
                <View style={styles.step}>
                  <View style={styles.stepBadge}>
                    <Ionicons name={step.icon} size={30} color={colors.primary} />
                  </View>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
                {i < STEPS.length - 1 ? <DottedConnector /> : null}
              </Fragment>
            ))}
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

/** A compact "today's design" row — mirrors the History list style. */
function RecentRow({ gen }: { gen: Generation }) {
  const thumbUrl = useSignedUrl(gen.outputPath);
  const time = new Date(gen.createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <PressableScale
      haptic
      style={({ pressed }) => [styles.recentRow, pressed && styles.recentRowPressed]}
      onPress={() => router.push(`/history/${gen.id}`)}
      android_ripple={{ color: colors.ripple }}>
      <View style={styles.recentThumbWrap}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.recentThumb} contentFit="cover" />
        ) : (
          <View style={[styles.recentThumb, styles.recentThumbPlaceholder]}>
            <Ionicons name="image-outline" size={20} color={colors.textMuted} />
          </View>
        )}
        {gen.night ? (
          <View style={styles.nightBadge}>
            <Ionicons name="moon" size={10} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.recentBody}>
        <Text style={styles.recentTitle} numberOfLines={1}>
          {gen.styleLabel ? `${gen.styleLabel} garden` : 'Garden design'}
        </Text>
        <Text style={styles.recentTime}>{time}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
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
    <Card style={styles.showcaseCard}>
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
    </Card>
  );
}

/** Pulsing placeholder while the showcase loads. */
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
    <Card style={styles.showcaseCard}>
      <Animated.View style={[styles.skeletonImage, { opacity }]} />
      <Animated.View style={[styles.skeletonLineWide, { opacity }]} />
      <Animated.View style={[styles.skeletonLine, { opacity }]} />
    </Card>
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
  flex: { flex: 1, backgroundColor: colors.canvas },
  container: { padding: spacing.lg },
  content: { gap: spacing.xl },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  greetingText: { gap: 2 },
  greetingHi: { ...type.body, color: colors.textSecondary },
  greetingName: { ...type.title, fontSize: 26, color: colors.text },
  greetingIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hero: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    ...shadow.card,
  },
  heroTextWrap: { gap: spacing.sm },
  heroTitle: { ...type.title, color: colors.onPrimary, maxWidth: '80%' },
  heroSub: { ...type.body, color: 'rgba(255,255,255,0.85)', maxWidth: '82%' },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.md,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  heroCtaText: { ...type.bodyStrong, color: colors.primary },
  heroLeaf: { position: 'absolute', right: -18, bottom: -24, transform: [{ rotate: '-18deg' }] },

  section: { gap: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionHeading: { ...type.heading, color: colors.text },
  seeAll: { ...type.bodyStrong, color: colors.primary },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  recentRowPressed: { backgroundColor: colors.surfaceAlt },
  recentThumbWrap: { width: 56, height: 56 },
  recentThumb: { width: 56, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  recentThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nightBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  recentBody: { flex: 1, gap: 2 },
  recentTitle: { ...type.bodyStrong, color: colors.text },
  recentTime: { ...type.caption, color: colors.textMuted },

  stateBox: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  muted: { ...type.body, color: colors.textMuted, textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  retryText: { ...type.bodyStrong, color: colors.primary },
  skeletonWrap: { gap: spacing.md },
  showcaseCard: { gap: spacing.sm, padding: spacing.md },
  skeletonImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  skeletonLineWide: {
    height: 14,
    width: '70%',
    borderRadius: 7,
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'center',
    marginTop: spacing.xs,
  },
  skeletonLine: {
    height: 12,
    width: '45%',
    borderRadius: 6,
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'center',
  },
  showcaseTitle: { ...type.subheading, color: colors.text, textAlign: 'center' },
  showcaseHint: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  showcaseProducts: { gap: spacing.md, marginTop: spacing.xs },
  shopLabel: { ...type.subheading, color: colors.text, textAlign: 'center' },
  timeline: { alignItems: 'center', marginTop: spacing.xs },
  step: { alignItems: 'center', gap: spacing.sm, maxWidth: 300 },
  stepBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { ...type.subheading, color: colors.text, textAlign: 'center' },
  stepBody: { ...type.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center' },
  connector: { alignItems: 'center', gap: 5, paddingVertical: spacing.md },
  connectorDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
});
