import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * One motion language for the whole app: short, eased, no overshoot.
 * Same curve as the web app (cubic-bezier(0.2, 0, 0, 1)).
 */
export const ease = Easing.bezier(0.2, 0, 0, 1);
export const duration = { fast: 120, base: 200, slow: 320 } as const;
export const timing = {
  fast: { duration: duration.fast, easing: ease },
  base: { duration: duration.base, easing: ease },
  slow: { duration: duration.slow, easing: ease },
} as const;

/**
 * Counts from the previous value to the new one, so a total rolls when it
 * changes. The first render shows the final value.
 */
export function useCountUp(value: number, ms = 600): number {
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
        const p = Math.min(1, (Date.now() - t0) / ms);
        const eased = 1 - (1 - p) ** 3;
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
  }, [value, ms]);

  return shown;
}

/** A quick fade when a screen's content first appears. No lift, no stagger. */
export function Reveal({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeIn.duration(duration.base).easing(ease)} style={style}>
      {children}
    </Animated.View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A Pressable that eases down slightly while held and back on release. */
export function PressableScale({
  scaleTo = 0.97,
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
        scale.value = withTiming(scaleTo, timing.fast);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, timing.base);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    />
  );
}
