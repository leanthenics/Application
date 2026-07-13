import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '@clickretina/contract';

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
    <Pressable style={styles.productRow} onPress={open} android_ripple={{ color: '#E5E5EA' }}>
      <Ionicons name="cart-outline" size={20} color="#208AEF" />
      <View style={styles.productBody}>
        <Text style={styles.productText} numberOfLines={2}>
          {product.keyterm}
        </Text>
        {price ? <Text style={styles.productPrice}>{price}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={18} color="#8E8E93" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  productBody: { flex: 1, gap: 2 },
  productText: { fontSize: 16, color: '#000' },
  productPrice: { fontSize: 14, fontWeight: '600', color: '#34A853' },
});
