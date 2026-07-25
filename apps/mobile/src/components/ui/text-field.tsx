import { forwardRef } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';

/**
 * Themed single-/multi-line text input. A thin wrapper over TextInput that applies
 * the design tokens and a themed placeholder color, then forwards every other prop
 * so behavior is unchanged. Callers can still override via `style`.
 */
export const TextField = forwardRef<TextInput, TextInputProps>(function TextField(
  { style, multiline, placeholderTextColor, ...rest },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      multiline={multiline}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      style={[styles.input, multiline && styles.multiline, style]}
      {...rest}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    ...type.body,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    height: undefined,
    minHeight: 52,
    maxHeight: 140,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    textAlignVertical: 'top',
  },
});
