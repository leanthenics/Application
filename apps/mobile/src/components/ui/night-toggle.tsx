import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { tapSelection } from '@/lib/haptics';
import { colors, radius } from '@/theme';

const TRACK_W = 52;
const TRACK_H = 30;
const THUMB = 24;
const PAD = 3;

/**
 * Animated day/night switch — replaces the stock RN Switch with a themed control
 * that slides its thumb, cross-fades the track color (sand → green), and swaps a
 * sun ↔ moon icon. Gives the night-mode row a deliberate, polished feel. Same
 * value/onValueChange contract as Switch, plus a selection haptic on tap.
 */
export function NightToggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false, // animating backgroundColor
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceAlt, colors.primary],
  });
  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - THUMB - PAD],
  });

  return (
    <Pressable
      onPress={() => {
        tapSelection();
        onValueChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="Night mode"
      hitSlop={8}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]}>
          <Ionicons
            name={value ? 'moon' : 'sunny'}
            size={13}
            color={value ? colors.primary : colors.warning}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.pill,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A2016',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
