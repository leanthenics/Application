import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { tapLight } from '@/lib/haptics';
import { colors, radius, spacing, type } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icon side. Default 'left'. */
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the parent width (default true — buttons are usually full-width CTAs). */
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's single button. Variants map to the design tokens; behavior is a thin
 * pass-through (onPress / disabled / loading) so swapping inline Pressables for
 * this never changes what a button does — only how it looks. Minimal-motion: the
 * only feedback is a pressed opacity + surface tint, no scale/spring animation.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={() => {
          if (!isDisabled) tapLight();
          onPress();
        }}
        onPressIn={() => !isDisabled && spring(0.97)}
        onPressOut={() => spring(1)}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        android_ripple={v.ripple ? { color: colors.ripple } : undefined}
        style={({ pressed }) => [
          styles.base,
          { height: s.height, paddingHorizontal: s.padX, borderRadius: radius.pill },
          { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1 : 0 },
          fullWidth && styles.fullWidthInner,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
        ]}>
        {loading ? (
          <ActivityIndicator color={v.fg} />
        ) : (
          <View style={styles.content}>
            {icon && iconPosition === 'left' ? (
              <Ionicons name={icon} size={s.icon} color={v.fg} />
            ) : null}
            <Text style={[styles.label, { fontSize: s.font, color: v.fg }]} numberOfLines={1}>
              {label}
            </Text>
            {icon && iconPosition === 'right' ? (
              <Ionicons name={icon} size={s.icon} color={v.fg} />
            ) : null}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const VARIANTS: Record<
  Variant,
  { bg: string; fg: string; border?: string; ripple?: boolean }
> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, ripple: true },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.borderStrong, ripple: true },
  ghost: { bg: 'transparent', fg: colors.primary },
  danger: { bg: colors.danger, fg: '#FFFFFF', ripple: true },
};

const SIZES: Record<Size, { height: number; padX: number; font: number; icon: number }> = {
  sm: { height: 38, padX: spacing.md, font: 14, icon: 16 },
  md: { height: 48, padX: spacing.lg, font: 16, icon: 18 },
  lg: { height: 54, padX: spacing.xl, font: 17, icon: 20 },
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', overflow: 'hidden' },
  fullWidth: { alignSelf: 'stretch' },
  fullWidthInner: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.bodyStrong, fontWeight: '700' },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.45 },
});
