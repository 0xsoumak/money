import { Feather } from "@expo/vector-icons";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { PIN_LENGTH } from "../lib/appLock";
import { tap } from "../lib/haptics";
import { c } from "../lib/theme";
import { ease, timing } from "./motion";
import { T } from "./T";

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["bio", "0", "del"],
] as const;

/**
 * Six dots and a keypad for entering a PIN. Calls `onComplete` once all digits are in.
 * Bump `shake` (e.g. a counter) to shake the dots after a wrong PIN.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  shake = 0,
  disabled,
  onBiometrics,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete: (pin: string) => void;
  shake?: number;
  disabled?: boolean;
  /** Shows a fingerprint key in the bottom-left corner when given. */
  onBiometrics?: () => void;
}) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!shake) return;
    // A short, damped side-to-side: clear without being cartoonish.
    const step = (to: number) => withTiming(to, { duration: 55, easing: ease });
    x.value = withSequence(step(-10), step(9), step(-6), step(4), step(0));
  }, [shake, x]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const press = (key: (typeof ROWS)[number][number]) => {
    if (disabled) return;
    tap();
    if (key === "bio") return onBiometrics?.();
    if (key === "del") return onChange(value.slice(0, -1));
    if (value.length >= PIN_LENGTH) return;
    const next = value + key;
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete(next);
  };

  return (
    <View style={{ gap: 36, alignItems: "center" }}>
      <Animated.View
        accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}
        accessibilityLiveRegion="polite"
        style={[{ flexDirection: "row", gap: 16 }, shakeStyle]}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <Dot key={i} filled={i < value.length} />
        ))}
      </Animated.View>

      <View style={{ gap: 12, opacity: disabled ? 0.35 : 1 }}>
        {ROWS.map((row) => (
          <View key={row.join()} style={{ flexDirection: "row", gap: 20 }}>
            {row.map((key) => {
              if (key === "bio" && !onBiometrics) return <View key={key} style={KEY} />;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={
                    key === "del" ? "Delete" : key === "bio" ? "Unlock with fingerprint" : key
                  }
                  disabled={disabled}
                  onPress={() => press(key)}
                  style={({ pressed }) => [
                    KEY,
                    {
                      backgroundColor:
                        pressed && key !== "del" && key !== "bio" ? c.surfaceStrong : "transparent",
                    },
                    key !== "del" && key !== "bio" && { borderWidth: 2, borderColor: c.border },
                  ]}
                >
                  {key === "del" ? (
                    <Feather name="delete" size={24} color={c.text} />
                  ) : key === "bio" ? (
                    <Feather name="unlock" size={24} color={c.accent} />
                  ) : (
                    <T variant="title" size={28}>
                      {key}
                    </T>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const KEY = {
  width: 76,
  height: 76,
  borderRadius: 38,
  alignItems: "center",
  justifyContent: "center",
} as const;

function Dot({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, timing.fast);
  }, [filled, fill]);
  const style = useAnimatedStyle(() => ({
    backgroundColor: fill.value > 0.5 ? c.accent : "transparent",
    transform: [{ scale: 0.85 + fill.value * 0.15 }],
  }));
  return (
    <Animated.View
      style={[
        { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: c.accent },
        style,
      ]}
    />
  );
}
