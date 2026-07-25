import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { colors, radius, shadow, spacing } from '@/theme';

type CardProps = {
  children: ReactNode;
  /** Makes the card tappable (renders a Pressable with a subtle pressed state). */
  onPress?: () => void;
  /** Add the soft card elevation. Default true. */
  elevated?: boolean;
  /** Apply the default inner padding. Default true. */
  padded?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Standard surface container — white card, hairline border, soft radius and an
 * optional gentle elevation. When `onPress` is set it becomes a pressable row/
 * tile with a minimal pressed tint (no motion). Presentational only.
 */
export function Card({
  children,
  onPress,
  elevated = true,
  padded = true,
  accessibilityLabel,
  style,
}: CardProps) {
  const base: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.padded,
    elevated && shadow.card,
    style,
  ];

  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        haptic
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: colors.ripple }}
        style={({ pressed }) => [base, pressed && styles.pressed]}>
        {children}
      </PressableScale>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
  pressed: { backgroundColor: colors.surfaceAlt },
});
