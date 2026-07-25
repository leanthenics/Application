import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/theme';

/**
 * Shared header for the auth screens: a subtle garden motif (two faint leaves that
 * fade into the cream canvas), a circular leaf badge, and the title/subtitle. Kept
 * on-theme and pure-JS (no gradient/native dep) so it hot-reloads. Decorative layers
 * are pointerEvents="none" and clipped-friendly (negative offsets), so they never
 * intercept touches or push the form.
 */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      {/* garden motif — faint, decorative only */}
      <Ionicons name="leaf" size={190} color={colors.primary} style={styles.motifOne} />
      <Ionicons name="leaf-outline" size={120} color={colors.accent} style={styles.motifTwo} />

      <View style={styles.badge}>
        <Ionicons name="leaf" size={32} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    overflow: 'visible',
  },
  motifOne: {
    position: 'absolute',
    top: -56,
    right: -48,
    opacity: 0.06,
    transform: [{ rotate: '18deg' }],
  },
  motifTwo: {
    position: 'absolute',
    top: -8,
    left: -40,
    opacity: 0.08,
    transform: [{ rotate: '-24deg' }],
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { ...type.title, fontSize: 28, color: colors.text, textAlign: 'center' },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
