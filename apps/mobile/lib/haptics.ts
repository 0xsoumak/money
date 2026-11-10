import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const enabled = Platform.OS !== "web";

/** A light tap, for keypad presses and selections. Never throws. */
export function tap() {
  if (enabled) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A confirmation buzz, for a saved expense. */
export function success() {
  if (enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

/** A warning buzz, for a failed save. */
export function warn() {
  if (enabled) {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }
}
