import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Repeating diagonal "ClickRetina" watermark, rendered as a display-only overlay on
 * top of the generated (output) image — it is NOT baked into the image bytes. The
 * backend keeps returning a clean image, so hiding this (e.g. for a future premium
 * tier) is a one-line render gate: see WATERMARK_ENABLED below and its use in the
 * job detail screen. Drop it into any container that has `overflow: 'hidden'` (the
 * parent clips the oversized rotated grid to the frame).
 *
 * Pure React Native (Views + Text + a rotate transform) — no native dependency, so
 * this ships as a JS-only Metro reload, no rebuild. `pointerEvents="none"` so it never
 * steals touches from an underlying control (e.g. the CompareSlider drag).
 */

/** Master on/off for the watermark. TODO(premium): gate on the user's tier/profile. */
export const WATERMARK_ENABLED = true;

// Look & feel — all one-line tweakable. ANGLE sign flips the diagonal direction.
const ANGLE = -30; // degrees; negative leans the text up toward the right
const OPACITY = 0.12;
const FONT_SIZE = 18;
const ROW_GAP = 40; // vertical spacing between repeated rows
const WORD = 'ClickRetina';
const GAP = '  '; // em-spaces between repeats
// One row's text: repeat the word enough to overflow the widest frame; the parent clips it.
const ROW_TEXT = (WORD + GAP).repeat(12);
const ROW_COUNT = 22; // enough rows to cover a tall frame once rotated
// Fallback rotor size before the parent's onLayout resolves (px). Real size becomes
// ~the frame diagonal so the rotated grid still covers the corners.
const FALLBACK_SIZE = 1200;

export function Watermark({
  angle = ANGLE,
  opacity = OPACITY,
}: {
  angle?: number;
  opacity?: number;
}) {
  const [size, setSize] = useState(FALLBACK_SIZE);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    // Square that fully covers the frame after rotation = its diagonal, padded a touch.
    setSize(Math.ceil(Math.hypot(width, height)) + FONT_SIZE * 2);
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <View style={styles.center}>
        <View
          style={[
            styles.rotor,
            { width: size, height: size, transform: [{ rotate: `${angle}deg` }] },
          ]}>
          {Array.from({ length: ROW_COUNT }).map((_, r) => (
            <Text
              key={r}
              numberOfLines={1}
              style={[
                styles.text,
                { opacity, marginBottom: ROW_GAP, marginLeft: r % 2 === 0 ? 0 : -60 },
              ]}>
              {ROW_TEXT}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Center the oversized rotor inside the frame so rotation stays symmetric.
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotor: { alignItems: 'center', justifyContent: 'center' },
  text: {
    color: '#FFFFFF',
    fontSize: FONT_SIZE,
    fontWeight: '700',
    letterSpacing: 1,
    // Faint dark halo so the wordmark reads on both light and dark garden photos.
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
