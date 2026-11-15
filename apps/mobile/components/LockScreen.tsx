import { Feather } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLock } from "../lib/appLock";
import { warn } from "../lib/haptics";
import { useSession } from "../lib/session";
import { c, radius } from "../lib/theme";
import { duration } from "./motion";
import { T } from "./T";
import { Button } from "./ui";

/**
 * Covers the whole app while it is locked. Asks for the fingerprint as soon as it shows
 * (and whenever the app comes back to the front), with a button to try again.
 */
export function LockScreen() {
  const { locked, unlock } = useAppLock();
  const { signedIn } = useSession();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const asked = useRef(false);

  const show = locked && signedIn;

  const tryUnlock = async () => {
    setMessage("");
    const result = await unlock();
    if (!result.ok && result.message) {
      warn();
      setMessage(result.message);
    }
  };

  // Prompt once when the lock appears, and again each time the app returns while locked.
  useEffect(() => {
    if (!show) {
      asked.current = false;
      return;
    }
    if (!asked.current && AppState.currentState === "active") {
      asked.current = true;
      void tryUnlock();
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void tryUnlock();
    });
    return () => sub.remove();
  }, [show]);

  if (!show) return null;

  return (
    <Animated.View
      exiting={FadeOut.duration(duration.base)}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 24,
          justifyContent: "space-between",
        },
      ]}
      accessibilityViewIsModal
    >
      <View />
      <View style={{ alignItems: "center", gap: 16 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.xl,
            backgroundColor: c.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="lock" size={30} color={c.onAccent} />
        </View>
        <T variant="title" size={32} accessibilityRole="header">
          Money is locked
        </T>
        <T variant="body" color={c.textMuted} style={{ textAlign: "center", fontWeight: "400" }}>
          Use your fingerprint or phone PIN to open it.
        </T>
        {message ? (
          <T variant="small" color={c.danger} accessibilityLiveRegion="polite">
            {message}
          </T>
        ) : null}
      </View>
      <Button title="Unlock" onPress={() => void tryUnlock()} />
    </Animated.View>
  );
}
