import { useEffect, useRef, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppLock } from "../lib/appLock";
import { warn } from "../lib/haptics";
import { useSession } from "../lib/session";
import { c } from "../lib/theme";
import { duration } from "./motion";
import { PinPad } from "./PinPad";
import { T } from "./T";

/**
 * Covers the whole app while it is locked. Offers the fingerprint first when allowed,
 * with the PIN pad underneath. "Forgot PIN?" signs out; the password gets you back in.
 */
export function LockScreen() {
  const lock = useAppLock();
  const { signedIn, signOut } = useSession();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);
  const now = useNow(lock.lockedUntil);
  const asked = useRef(false);

  const show = lock.locked && signedIn;
  const waiting = lock.lockedUntil !== null && lock.lockedUntil > now;
  const bio = lock.biometricsEnabled;
  const { unlockWithBiometrics } = lock;

  // Offer the fingerprint as soon as the lock shows, and each time the app returns locked.
  useEffect(() => {
    if (!show) {
      asked.current = false;
      setPin("");
      setMessage("");
      return;
    }
    if (!bio) return;
    if (!asked.current && AppState.currentState === "active") {
      asked.current = true;
      void unlockWithBiometrics();
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void unlockWithBiometrics();
    });
    return () => sub.remove();
  }, [show, bio, unlockWithBiometrics]);

  if (!show) return null;

  const submit = async (entered: string) => {
    const result = await lock.checkPin(entered);
    if (result.ok) return;
    warn();
    setShake((n) => n + 1);
    setMessage(result.message);
    setPin("");
  };

  const forgot = () =>
    Alert.alert(
      "Forgot your PIN?",
      "Sign out to reset it. You'll need your email and password to sign back in. Your data stays safe on the server.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => void lock.disable().then(signOut),
        },
      ],
    );

  return (
    <Animated.View
      exiting={FadeOut.duration(duration.base)}
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: c.bg,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 24,
          alignItems: "center",
          justifyContent: "space-between",
        },
      ]}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <T variant="title" size={28} accessibilityRole="header">
          Enter PIN
        </T>
        <T
          variant="small"
          color={message || waiting ? c.danger : c.textMuted}
          accessibilityLiveRegion="polite"
          style={{ minHeight: 20 }}
        >
          {waiting
            ? `Too many tries. Try again in ${Math.ceil(((lock.lockedUntil ?? now) - now) / 1000)}s.`
            : message || "to open Money"}
        </T>
      </View>

      <PinPad
        value={pin}
        onChange={(next) => {
          setMessage("");
          setPin(next);
        }}
        onComplete={(entered) => void submit(entered)}
        shake={shake}
        disabled={waiting}
        onBiometrics={bio ? () => void unlockWithBiometrics() : undefined}
      />

      <Pressable
        accessibilityRole="button"
        onPress={forgot}
        hitSlop={8}
        style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}
      >
        <T variant="label" size={13} color={c.textMuted}>
          Forgot PIN?
        </T>
      </Pressable>
    </Animated.View>
  );
}

/** The current time, ticking each second while a wait is running. */
function useNow(until: number | null): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!until || until <= Date.now()) return;
    setNow(Date.now());
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);
  return now;
}
