import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/** Same personality as the web app: quick and a little bouncy. */
export const springs = {
  snappy: { damping: 18, stiffness: 420, mass: 0.7 },
  soft: { damping: 20, stiffness: 180 },
} as const;

/**
 * Counts from the previous value to the new one, so a total rolls when it
 * changes. The first render shows the final value.
 */
export function useCountUp(value: number, duration = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const start = from.current;
    from.current = value;
    if (start === value) return;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        setShown(value);
        return;
      }
      const t0 = Date.now();
      const step = () => {
        const p = Math.min(1, (Date.now() - t0) / duration);
        const eased = 1 - (1 - p) ** 4;
        // Whole currency units while rolling so paise don't flicker; exact at the end.
        setShown(p < 1 ? Math.round((start + (value - start) * eased) / 100) * 100 : value);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return shown;
}

/** Fades and lifts a section in when it mounts. `i` staggers siblings. */
export function Reveal({
  i = 0,
  children,
  style,
}: {
  i?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.springify()
        .damping(18)
        .delay(i * 70)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that squishes slightly while held and springs back on release. */
export function PressableScale({
  scaleTo = 0.95,
  style,
  onPressIn,
  onPressOut,
  ...props
}: PressableProps & { scaleTo?: number; style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...props}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, springs.snappy);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, springs.snappy);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}
