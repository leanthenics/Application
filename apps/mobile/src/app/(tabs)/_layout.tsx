import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { forwardRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * TOP tab bar (Home | Results) built with expo-router/ui.
 *
 * NOTE: As of SDK 56, Expo Router dropped React Navigation compatibility, so the
 * old `withLayoutContext(createMaterialTopTabNavigator())` pattern no longer works.
 * expo-router/ui is the sanctioned way to build custom tab bars; putting <TabList>
 * BEFORE <TabSlot> positions the bar at the top.
 */
type TabButtonProps = TabTriggerSlotProps & { label: string };

const TabButton = forwardRef(function TabButton(
  { label, isFocused, ...props }: TabButtonProps,
  ref: Ref<View>,
) {
  return (
    <Pressable ref={ref} {...props} style={styles.trigger}>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{label}</Text>
      <View style={[styles.indicator, isFocused && styles.indicatorActive]} />
    </Pressable>
  );
});

export default function TabsLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Tabs>
        <TabList style={styles.tabList}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton label="Home" />
          </TabTrigger>
          <TabTrigger name="create" href="/create" asChild>
            <TabButton label="Create" />
          </TabTrigger>
          <TabTrigger name="results" href="/results" asChild>
            <TabButton label="Results" />
          </TabTrigger>
        </TabList>
        <TabSlot />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  tabList: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  trigger: { flex: 1, alignItems: 'center', paddingTop: 12 },
  label: { fontSize: 15, fontWeight: '600', color: '#8E8E93', paddingBottom: 10 },
  labelActive: { color: '#208AEF' },
  indicator: { height: 3, width: '60%', borderRadius: 2, backgroundColor: 'transparent' },
  indicatorActive: { backgroundColor: '#208AEF' },
});
