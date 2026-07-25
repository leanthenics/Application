/**
 * Best-effort haptics helpers, called from Button / PressableScale / NightToggle.
 *
 * Backed by the native `expo-haptics` module (SDK 57). Requires a dev-client
 * rebuild (`pnpm android:mobile`) after install — a JS-only Metro reload won't
 * pick up the native module.
 *
 * Every call is fire-and-forget (errors swallowed), so callers never need to
 * guard — safe to call on platforms/devices without a haptics engine.
 */

import * as Haptics from 'expo-haptics';

/** Light tap — button presses and confirmations. */
export function tapLight() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Selection change — picking a style, flipping the night toggle. */
export function tapSelection() {
  Haptics.selectionAsync().catch(() => {});
}
