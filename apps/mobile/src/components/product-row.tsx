import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import type { Product } from '@clickretina/contract';

/**
 * A single "shop the look" row: the product key-term + an open-in-Amazon affordance.
 * Tapping opens the affiliate search URL. Shared by the job detail screen and the
 * landing-page showcase cards.
 */
export function ProductRow({ product }: { product: Product }) {
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
      <Text style={styles.productText} numberOfLines={2}>
        {product.keyterm}
      </Text>
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
  productText: { flex: 1, fontSize: 16, color: '#000' },
});
