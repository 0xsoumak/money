import { Feather } from "@expo/vector-icons";
import { type ReactNode, useRef } from "react";
import { StyleSheet } from "react-native";
import Swipeable, {
  type SwipeableMethods,
  SwipeDirection,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { select, tap } from "../lib/haptics";
import { c } from "../lib/theme";
import { timing } from "./motion";

/** How far (px) a row has to travel before letting go runs the action. */
const TRIGGER = 96;

/**
 * A row you can drag sideways: drag left to delete, right to edit.
 * Past the trigger point the icon grows and the phone ticks, so you know letting go will act.
 */
export function SwipeRow({
  children,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<SwipeableMethods>(null);
  return (
    <Swipeable
      ref={ref}
      friction={1.4}
      leftThreshold={TRIGGER}
      rightThreshold={TRIGGER}
      overshootFriction={6}
      dragOffsetFromLeft={14}
      dragOffsetFromRight={-14}
      renderLeftActions={(_p, translation) => (
        <Action translation={translation} side="left" icon="edit-2" color={c.accent} />
      )}
      renderRightActions={(_p, translation) => (
        <Action translation={translation} side="right" icon="trash-2" color={c.danger} />
      )}
      onSwipeableWillOpen={(direction) => {
        tap();
        if (direction === SwipeDirection.RIGHT) {
          // The row moved right, revealing the left action: edit.
          ref.current?.close();
          onEdit();
        } else {
          // Deleting removes the row (optimistically), and the toast offers Undo.
          onDelete();
        }
      }}
    >
      {children}
    </Swipeable>
  );
}

function Action({
  translation,
  side,
  icon,
  color,
}: {
  translation: SharedValue<number>;
  side: "left" | "right";
  icon: "edit-2" | "trash-2";
  color: string;
}) {
  // Tick once each time the drag crosses the trigger point, either way.
  useAnimatedReaction(
    () => Math.abs(translation.value) >= TRIGGER,
    (past, wasPast) => {
      if (wasPast !== null && past !== wasPast) scheduleOnRN(select);
    },
  );

  const bg = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(translation.value), [0, 24, TRIGGER], [0, 0.5, 1], "clamp"),
  }));
  const glyph = useAnimatedStyle(() => {
    const past = Math.abs(translation.value) >= TRIGGER;
    return {
      opacity: interpolate(Math.abs(translation.value), [16, 56], [0, 1], "clamp"),
      transform: [{ scale: withTiming(past ? 1.15 : 0.9, timing.fast) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.action,
        { backgroundColor: color, alignItems: side === "left" ? "flex-start" : "flex-end" },
        bg,
      ]}
    >
      <Animated.View style={glyph}>
        <Feather name={icon} size={20} color={c.onAccent} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  action: {
    width: "100%",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});
