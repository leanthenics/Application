import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  /** Wrap the content in a ScrollView (for pages taller than the viewport). */
  scroll?: boolean;
  /** Vertically center the content — for empty / loading / error states. */
  center?: boolean;
  /** Apply the default page gutter (horizontal padding). Default true. */
  padded?: boolean;
  /** Safe-area edges to inset. Default none (screens usually sit under a header/top bar). */
  edges?: Edge[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  /** Passed through to the ScrollView when `scroll` is set. */
  refreshControl?: ScrollViewProps['refreshControl'];
};

/**
 * Page shell shared by every screen: paints the app canvas, applies the standard
 * gutter, and centers the content in a capped-width column so the layout stays
 * comfortable on tablets / large or rotated screens (responsiveness) instead of
 * stretching edge-to-edge. Purely presentational — no navigation or data behavior.
 */
export function Screen({
  children,
  scroll = false,
  center = false,
  padded = true,
  edges = [],
  contentContainerStyle,
  style,
  refreshControl,
}: ScreenProps) {
  const column: StyleProp<ViewStyle> = [
    styles.column,
    padded && styles.padded,
    center && styles.center,
    contentContainerStyle,
  ];

  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, center && styles.grow]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}>
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.scrollContent, center && styles.grow]}>
          <View style={[column, center && styles.flex]}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  scrollContent: { alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxContentWidth },
  padded: { paddingHorizontal: spacing.lg },
  center: { justifyContent: 'center', alignItems: 'center' },
});
