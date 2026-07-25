import { forwardRef, useRef } from 'react';
import {
  Animated,
  Pressable,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import { tapLight } from '@/lib/haptics';

type Props = PressableProps & {
  /** Fire a light haptic on press. Default false. */
  haptic?: boolean;
  /** Scale to shrink to while pressed. Default 0.97. */
  scaleTo?: number;
};

/**
 * A Pressable that gently scales down while held — the app-wide "this is tappable"
 * feedback, baked in once so tiles, rows and cards all feel alive without each
 * screen re-implementing it. Uses the native driver (transform only), so it's cheap.
 * Optional light haptic on press. Behavior is otherwise a straight pass-through.
 */
export const PressableScale = forwardRef<View, Props>(function PressableScale(
  { haptic = false, scaleTo = 0.97, onPressIn, onPressOut, onPress, children, ...rest },
  ref,
) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        ref={ref}
        onPressIn={(e: GestureResponderEvent) => {
          spring(scaleTo);
          onPressIn?.(e);
        }}
        onPressOut={(e: GestureResponderEvent) => {
          spring(1);
          onPressOut?.(e);
        }}
        onPress={(e: GestureResponderEvent) => {
          if (haptic) tapLight();
          onPress?.(e);
        }}
        {...rest}>
        {children}
      </Pressable>
    </Animated.View>
  );
});
