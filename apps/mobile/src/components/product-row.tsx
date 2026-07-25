import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@clickretina/contract';
import { PressableScale } from '@/components/ui/pressable-scale';
import { colors, radius, spacing, type } from '@/theme';

/** Approximate INR price range, e.g. "₹1,000–3,000". Returns null when unpriced. */
function formatPrice(product: Product): string | null {
  const { priceMin, priceMax } = product;
  if (priceMin === undefined && priceMax === undefined) return null;
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  if (priceMin !== undefined && priceMax !== undefined) {
    return priceMin === priceMax ? inr(priceMin) : `${inr(priceMin)}–${inr(priceMax)}`;
  }
  return inr((priceMin ?? priceMax) as number);
}

/**
 * A single "shop the look" row: the product key-term + an approximate INR price
 * range + an open-in-Amazon affordance. Tapping opens the affiliate search URL.
 * Shared by the job detail screen and the landing-page showcase cards (showcase
 * items are unpriced, so the price line is hidden there).
 */
export function ProductRow({ product }: { product: Product }) {
  const price = formatPrice(product);
  async function open() {
    try {
      await Linking.openURL(product.amazonUrl);
    } catch {
      // no handler / bad url — silently ignore
    }
  }
  return (
    <PressableScale
      haptic
      style={({ pressed }) => [styles.productRow, pressed && styles.productRowPressed]}
      onPress={open}
      android_ripple={{ color: colors.ripple }}>
      <View style={styles.productIcon}>
        <Ionicons name="cart-outline" size={18} color={colors.primary} />
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productText} numberOfLines={2}>
          {product.keyterm}
        </Text>
        {price ? <Text style={styles.productPrice}>{price}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  productRowPressed: { backgroundColor: colors.surfaceAlt },
  productIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productBody: { flex: 1, gap: 2 },
  productText: { ...type.body, fontSize: 16, color: colors.text },
  productPrice: { ...type.label, color: colors.success },
});
