import { Stack } from 'expo-router';

/**
 * Auth stack (shown only when there is no session — gated by the root layout).
 * sign-in is the anchor; sign-up is pushed on top.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
