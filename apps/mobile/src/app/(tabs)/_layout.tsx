import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { router } from 'expo-router';
import { forwardRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * App shell: an app-wide top bar (brand + Settings gear) over a BOTTOM tab bar
 * (Home | Create | Results), both built with expo-router/ui.
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
  const color = isFocused ? '#208AEF' : '#8E8E93';
  return (
    <Pressable ref={ref} {...props} style={styles.trigger}>
      <Ionicons name={isFocused ? iconActive : icon} size={24} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
});

export default function TabsLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* App-wide top bar */}
      <View style={styles.topBar}>
        <Text style={styles.brand}>ClickRetina</Text>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={24} color="#1C1C1E" />
        </Pressable>
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
        </TabList>
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  brand: { fontSize: 20, fontWeight: '800', color: '#000' },
  tabList: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
  },
  trigger: { flex: 1, alignItems: 'center', gap: 3, paddingBottom: 6 },
  label: { fontSize: 11, fontWeight: '600' },
});
