import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useJobPoller } from '@/hooks/use-job-poller';

/**
 * Root navigator: a Stack holding the top-tabs group ((tabs): Home | Results)
 * plus the pushed job detail screen (job/[id]). The single job poller is
 * mounted here so it runs app-wide regardless of the active tab.
 */
export default function RootLayout() {
  useJobPoller();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Result' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
