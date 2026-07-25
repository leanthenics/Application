import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type TextFieldProps = TextInputProps & {
  /** Optional icon rendered inside the field, before the text (e.g. "mail-outline"). */
  leadingIcon?: IoniconName;
  /**
   * Render a show/hide eye toggle and manage `secureTextEntry` internally (starts hidden).
   * When set, don't also pass `secureTextEntry` — this owns it.
   */
  passwordToggle?: boolean;
};

/**
 * Themed text input. Without `leadingIcon`/`passwordToggle` it's the original thin
 * TextInput wrapper (unchanged for existing callers). With either, it renders a
 * bordered row that can hold a leading icon, the input, and a trailing show/hide
 * eye — and gains a green focus ring. Callers can still override via `style`.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    style,
    multiline,
    placeholderTextColor,
    leadingIcon,
    passwordToggle,
    secureTextEntry,
    onFocus,
    onBlur,
    ...rest
  },
  ref,
) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const decorated = leadingIcon != null || passwordToggle === true;
  const secure = passwordToggle ? hidden : secureTextEntry;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (e) => {
    setFocused(true);
    onFocus?.(e);
  };
  const handleBlur: NonNullable<TextInputProps['onBlur']> = (e) => {
    setFocused(false);
    onBlur?.(e);
  };

  const input = (
    <TextInput
      ref={ref}
      multiline={multiline}
      secureTextEntry={secure}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholderTextColor={placeholderTextColor ?? colors.textMuted}
      style={[decorated ? styles.bareInput : styles.input, !decorated && multiline && styles.multiline, style]}
      {...rest}
    />
  );

  if (!decorated) return input;

  return (
    <View style={[styles.field, focused && styles.fieldFocused]}>
      {leadingIcon ? (
        <Ionicons
          name={leadingIcon}
          size={20}
          color={focused ? colors.primary : colors.textMuted}
          style={styles.leading}
        />
      ) : null}
      {input}
      {passwordToggle ? (
        <Pressable
          onPress={() => setHidden((h) => !h)}
          hitSlop={10}
          style={styles.trailing}
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
          <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  // Plain path — unchanged from the original TextField.
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
  // Decorated path — border lives on the row so it can hold icons.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  bareInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    ...type.body,
    fontSize: 16,
    color: colors.text,
  },
  leading: { marginRight: spacing.sm },
  trailing: { marginLeft: spacing.sm, padding: spacing.xs },
});
