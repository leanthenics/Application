import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { router } from 'expo-router';
import { forwardRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileStore } from '@/store/profile';
import { colors, radius, spacing, type } from '@/theme';

/**
 * App shell: an app-wide top bar (brand + Settings gear) over a BOTTOM tab bar
 * (Home | Create | Results | History), both built with expo-router/ui.
 *
 * SDK 56+ dropped React Navigation compat, so the old material-top-tabs pattern
 * is gone; expo-router/ui is the sanctioned way to build custom bars. Per the v57
 * docs, placing <TabSlot> BEFORE <TabList> positions the bar at the BOTTOM.
 */
type TabButtonProps = TabTriggerSlotProps & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const TabButton = forwardRef(function TabButton(
  { label, icon, iconActive, isFocused, ...props }: TabButtonProps,
  ref: Ref<View>,
) {
  const color = isFocused ? colors.primary : colors.textMuted;
  return (
    <Pressable ref={ref} {...props} style={styles.trigger}>
      <Ionicons name={isFocused ? iconActive : icon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
});

/**
 * Available-credits pill (tap → Buy credits). Reads the balance from the profile
 * store (kept in sync by use-profile); the DB is the source of truth. Sits beside
 * the Settings gear in the app-wide top bar.
 */
function CreditsPill() {
  const credits = useProfileStore((s) => s.profile?.credits ?? 0);
  return (
    <Pressable
      style={styles.pill}
      onPress={() => router.push('/buy-credits')}
      hitSlop={8}
      accessibilityLabel={`${credits} credits available, buy more`}>
      <Ionicons name="leaf" size={14} color={colors.primary} />
      <Text style={styles.pillText}>{credits}</Text>
      <Ionicons name="add" size={15} color={colors.primary} />
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* App-wide top bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>ClickRetina</Text>
        <View style={styles.topRight}>
          <CreditsPill />
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={23} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <Tabs>
        <TabSlot />
        <TabList style={styles.tabList}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home" icon="home-outline" iconActive="home" />
          </TabTrigger>
          <TabTrigger name="create" href="/create" asChild>
            <TabButton label="Create" icon="add-circle-outline" iconActive="add-circle" />
          </TabTrigger>
          <TabTrigger name="results" href="/results" asChild>
            <TabButton label="Results" icon="grid-outline" iconActive="grid" />
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton label="History" icon="time-outline" iconActive="time" />
          </TabTrigger>
        </TabList>
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: 54,
    backgroundColor: colors.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  brand: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillText: { ...type.label, fontWeight: '700', color: colors.text },
  tabList: {
    flexDirection: 'row',
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  trigger: { flex: 1, alignItems: 'center', gap: 3, paddingBottom: spacing.sm },
  label: { fontSize: 11, fontWeight: '600' },
});
