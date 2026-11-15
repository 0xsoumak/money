import * as LocalAuthentication from "expo-local-authentication";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import { storage } from "./storage";

const ENABLED_KEY = "money.app-lock";
const DELAY_KEY = "money.app-lock-delay";

/** How long the app may sit in the background before it locks again. */
export const LOCK_DELAYS = [
  { ms: 0, label: "Immediately" },
  { ms: 60_000, label: "After 1 min" },
  { ms: 5 * 60_000, label: "After 5 min" },
] as const;

export type Result = { ok: true } | { ok: false; message: string };

interface AppLock {
  /** False until the saved preference has been read, so nothing flashes before the lock. */
  ready: boolean;
  /** Whether this platform can lock at all (not the web preview). */
  supported: boolean;
  enabled: boolean;
  locked: boolean;
  delayMs: number;
  /** Shows the system prompt (fingerprint, face, or the phone's PIN/pattern). */
  unlock: () => Promise<Result>;
  /** Turning the lock on or off asks for the phone's unlock first. */
  setEnabled: (on: boolean) => Promise<Result>;
  setDelay: (ms: number) => Promise<void>;
}

const AppLockContext = createContext<AppLock | null>(null);

export function useAppLock(): AppLock {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used inside <AppLockProvider>");
  return ctx;
}

const supported = Platform.OS !== "web";

/** Errors that mean the phone no longer has any screen lock, so ours can't work either. */
const NO_DEVICE_LOCK = new Set(["not_enrolled", "passcode_not_set", "not_available"]);

function describe(error: string): string {
  if (error === "lockout") return "Too many attempts. Wait a moment, then try again.";
  if (error === "user_cancel" || error === "system_cancel" || error === "app_cancel")
    return "Cancelled.";
  return "Couldn't verify it's you. Try again.";
}

async function prompt(message: string) {
  return LocalAuthentication.authenticateAsync({
    promptMessage: message,
    cancelLabel: "Cancel",
    // Fingerprint/face if set up, otherwise the phone's own PIN or pattern.
    disableDeviceFallback: false,
  });
}

/**
 * Locks the app behind the phone's own unlock (fingerprint, face, PIN or pattern).
 * It locks on launch, and again when the app comes back after the chosen delay.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supported);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [delayMs, setDelayMs] = useState(0);

  // Opening the PIN screen sends the app to the background on Android; that must not relock it.
  const prompting = useRef(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      const [on, delay] = await Promise.all([storage.get(ENABLED_KEY), storage.get(DELAY_KEY)]);
      setEnabledState(on === "1");
      setLocked(on === "1");
      setDelayMs(Number(delay) || 0);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!supported || !enabled) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (prompting.current) return;
      if (state === "background") {
        leftAt.current = Date.now();
        if (delayMs === 0) setLocked(true);
      } else if (state === "active" && leftAt.current !== null) {
        if (Date.now() - leftAt.current >= delayMs) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, delayMs]);

  const disable = useCallback(async () => {
    await storage.remove(ENABLED_KEY);
    setEnabledState(false);
    setLocked(false);
  }, []);

  const unlock = useCallback(async (): Promise<Result> => {
    if (prompting.current) return { ok: false, message: "" };
    prompting.current = true;
    try {
      const result = await prompt("Unlock Money");
      if (result.success) {
        setLocked(false);
        return { ok: true };
      }
      // The phone's screen lock was removed: there is nothing to check against, so stand down.
      if (NO_DEVICE_LOCK.has(result.error)) {
        await disable();
        return { ok: true };
      }
      return { ok: false, message: describe(result.error) };
    } finally {
      prompting.current = false;
      leftAt.current = null;
    }
  }, [disable]);

  const setEnabled = useCallback(
    async (on: boolean): Promise<Result> => {
      if (!supported) return { ok: false, message: "App lock works on the phone app only." };
      if (on) {
        const level = await LocalAuthentication.getEnrolledLevelAsync();
        if (level === LocalAuthentication.SecurityLevel.NONE) {
          return {
            ok: false,
            message: "Set a screen lock (PIN, pattern or fingerprint) on your phone first.",
          };
        }
      }
      prompting.current = true;
      try {
        const result = await prompt(on ? "Turn on app lock" : "Turn off app lock");
        if (!result.success) {
          if (!on && NO_DEVICE_LOCK.has(result.error)) {
            await disable();
            return { ok: true };
          }
          return { ok: false, message: describe(result.error) };
        }
      } finally {
        prompting.current = false;
        leftAt.current = null;
      }
      if (on) {
        await storage.set(ENABLED_KEY, "1");
        setEnabledState(true);
      } else {
        await disable();
      }
      return { ok: true };
    },
    [disable],
  );

  const setDelay = useCallback(async (ms: number) => {
    setDelayMs(ms);
    await storage.set(DELAY_KEY, String(ms));
  }, []);

  const value = useMemo(
    () => ({ ready, supported, enabled, locked, delayMs, unlock, setEnabled, setDelay }),
    [ready, enabled, locked, delayMs, unlock, setEnabled, setDelay],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}
