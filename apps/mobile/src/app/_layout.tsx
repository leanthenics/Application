import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useJobPoller } from '@/hooks/use-job-poller';

/**
 * Root navigator: a Stack holding the top-tabs group ((tabs): Home | Create |
 * Results) plus the pushed style-picker (style) and job detail (job/[id]) screens.
 * The single job poller is mounted here so it runs app-wide regardless of tab.
 */
export default function RootLayout() {
  useJobPoller();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="style" options={{ title: 'Choose a style' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Result' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
