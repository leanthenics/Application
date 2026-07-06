import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Before/after wipe comparison. The result (after) fills the frame; the original
 * (before) is drawn on top, clipped from the left to a draggable divider. The frame
 * takes the result image's natural aspect ratio (from its onLoad), and both images
 * use contentFit="cover" so they fill that exact frame and stay aligned even when
 * the before/after sources have different shapes. Uses RN's core PanResponder — the
 * drag is only claimed for clearly-horizontal movement so vertical swipes still
 * scroll the surrounding ScrollView.
 *
 * `onInteract` (optional) fires on the first touch (tap or the start of a slide) —
 * the landing uses it to reveal a card's product list. Returning `false` from
 * onStartShouldSetPanResponder means we observe the touch without claiming it, so
 * the existing move-based drag is unaffected.
 */
export function CompareSlider({
  beforeUri,
  afterUri,
  onInteract,
}: {
  beforeUri: string;
  afterUri: string;
  onInteract?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [sliderX, setSliderX] = useState(0);
  // Frame aspect ratio, taken from the result (after) image once it loads, so
  // before + after fill the exact same frame and the wipe stays aligned even
  // when the two source images have different shapes.
  const [ratio, setRatio] = useState(1);
  const widthRef = useRef(0);
  const sliderXRef = useRef(0);
  const startX = useRef(0);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        onInteractRef.current?.();
        return false; // observe only; don't steal the touch
      },
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        startX.current = sliderXRef.current;
      },
      onPanResponderMove: (_e, g) => {
        const w = widthRef.current;
        const x = Math.max(0, Math.min(w, startX.current + g.dx));
        sliderXRef.current = x;
        setSliderX(x);
      },
    }),
  ).current;

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    if (width === 0) {
      const mid = w / 2; // start the divider centered
      sliderXRef.current = mid;
      setSliderX(mid);
    }
    setWidth(w);
  }

  return (
    <View style={[styles.output, { aspectRatio: ratio }]} onLayout={onLayout} {...pan.panHandlers}>
      {/* Base layer: the result (after). Its natural size sets the frame ratio. */}
      <Image
        source={{ uri: afterUri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onLoad={(e) => {
          const { width: w, height: h } = e.source;
          if (w && h) setRatio(w / h);
        }}
      />

      {/* Overlay: the original (before), revealed left of the divider. */}
      {width > 0 ? (
        <View style={[styles.beforeClip, { width: sliderX }]} pointerEvents="none">
          <Image source={{ uri: beforeUri }} style={{ width, height: '100%' }} contentFit="cover" />
        </View>
      ) : null}

      {/* Divider line + drag handle. */}
      {width > 0 ? (
        <View style={[styles.divider, { left: sliderX }]} pointerEvents="none">
          <View style={styles.handle}>
            <Ionicons name="swap-horizontal" size={18} color="#208AEF" />
          </View>
        </View>
      ) : null}

      {/* Static orientation labels. */}
      <View style={[styles.compareLabel, styles.beforeLabel]} pointerEvents="none">
        <Text style={styles.compareLabelText}>Before</Text>
      </View>
      <View style={[styles.compareLabel, styles.afterLabel]} pointerEvents="none">
        <Text style={styles.compareLabelText}>After</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  output: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  beforeClip: { position: 'absolute', top: 0, bottom: 0, left: 0, overflow: 'hidden' },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  compareLabel: {
    position: 'absolute',
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  beforeLabel: { left: 10 },
  afterLabel: { right: 10 },
  compareLabelText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
