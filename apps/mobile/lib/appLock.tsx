import * as Crypto from "expo-crypto";
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

export const PIN_LENGTH = 6;

const PIN_KEY = "money.app-pin"; // "salt:sha256(salt:pin)"
const BIO_KEY = "money.app-pin-bio"; // "1" when fingerprint may unlock
const DELAY_KEY = "money.app-lock-delay";
const FAILS_KEY = "money.app-pin-fails"; // "count:lockedUntilMs"

/** Wrong PINs allowed before a wait is enforced. */
const FREE_TRIES = 5;

/** How long the app may sit in the background before it locks again. */
export const LOCK_DELAYS = [
  { ms: 0, label: "Immediately" },
  { ms: 60_000, label: "After 1 min" },
  { ms: 5 * 60_000, label: "After 5 min" },
] as const;

export type Result = { ok: true } | { ok: false; message: string };

interface AppLock {
  /** False until the saved settings are read, so a locked app never flashes its contents. */
  ready: boolean;
  /** Whether this platform can lock at all (not the web preview). */
  supported: boolean;
  enabled: boolean;
  locked: boolean;
  delayMs: number;
  /** The phone has a fingerprint (or face) set up that we could use. */
  biometricsAvailable: boolean;
  /** The user chose to allow fingerprint unlock. */
  biometricsEnabled: boolean;
  /** While set (ms timestamp), PIN entry is paused after too many wrong tries. */
  lockedUntil: number | null;
  /** Checks a PIN, counting wrong tries. Unlocks the app on success. */
  checkPin: (pin: string) => Promise<Result>;
  unlockWithBiometrics: () => Promise<Result>;
  /** Turns the lock on with this PIN, or replaces the PIN if it is already on. */
  savePin: (pin: string) => Promise<void>;
  disable: () => Promise<void>;
  setBiometricsEnabled: (on: boolean) => Promise<Result>;
  setDelay: (ms: number) => Promise<void>;
}

const AppLockContext = createContext<AppLock | null>(null);

export function useAppLock(): AppLock {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error("useAppLock must be used inside <AppLockProvider>");
  return ctx;
}

const supported = Platform.OS !== "web";

async function hash(salt: string, pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** After the free tries: 30 s, then doubling each time, capped at 15 minutes. */
function waitFor(fails: number): number {
  if (fails < FREE_TRIES) return 0;
  return Math.min(30_000 * 2 ** (fails - FREE_TRIES), 15 * 60_000);
}

async function hasEnrolledBiometrics(): Promise<boolean> {
  if (!supported) return false;
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

/**
 * Locks the app behind a 6-digit PIN of its own, with fingerprint as an optional shortcut.
 * The PIN is stored only as a salted hash in the phone's secure storage. It locks on launch,
 * and again when the app comes back after the chosen delay.
 */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supported);
  const [pinRecord, setPinRecord] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [delayMs, setDelayMs] = useState(0);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [fails, setFails] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const enabled = pinRecord !== null;
  // The fingerprint prompt can send the app to the background on Android; don't relock for it.
  const prompting = useRef(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    if (!supported) return;
    void (async () => {
      const [pin, bio, delay, failRecord, bioOk] = await Promise.all([
        storage.get(PIN_KEY),
        storage.get(BIO_KEY),
        storage.get(DELAY_KEY),
        storage.get(FAILS_KEY),
        hasEnrolledBiometrics(),
      ]);
      const [count, until] = (failRecord ?? "0:0").split(":").map(Number);
      setPinRecord(pin);
      setLocked(pin !== null);
      setBioEnabled(bio === "1");
      setBioAvailable(bioOk);
      setDelayMs(Number(delay) || 0);
      setFails(count || 0);
      setLockedUntil(until && until > Date.now() ? until : null);
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
      } else if (state === "active") {
        // Fingerprints may have been added or removed in the phone's settings meanwhile.
        void hasEnrolledBiometrics().then(setBioAvailable);
        if (leftAt.current !== null && Date.now() - leftAt.current >= delayMs) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled, delayMs]);

  const recordFails = useCallback(async (count: number) => {
    const wait = waitFor(count);
    const until = wait ? Date.now() + wait : 0;
    setFails(count);
    setLockedUntil(until || null);
    await storage.set(FAILS_KEY, `${count}:${until}`);
  }, []);

  const checkPin = useCallback(
    async (pin: string): Promise<Result> => {
      if (!pinRecord) return { ok: true };
      if (lockedUntil && lockedUntil > Date.now()) {
        return { ok: false, message: "Too many tries. Wait a moment." };
      }
      const [salt, expected] = pinRecord.split(":");
      if (salt && (await hash(salt, pin)) === expected) {
        if (fails) await recordFails(0);
        setLocked(false);
        return { ok: true };
      }
      const count = fails + 1;
      await recordFails(count);
      const left = FREE_TRIES - count;
      return {
        ok: false,
        message:
          left > 0
            ? `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`
            : "Wrong PIN. Wait a moment before trying again.",
      };
    },
    [pinRecord, lockedUntil, fails, recordFails],
  );

  const unlockWithBiometrics = useCallback(async (): Promise<Result> => {
    if (prompting.current) return { ok: false, message: "" };
    prompting.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Money",
        cancelLabel: "Use PIN",
        // The app's own PIN is the fallback, not the phone's.
        disableDeviceFallback: true,
      });
      if (result.success) {
        if (fails) await recordFails(0);
        setLocked(false);
        return { ok: true };
      }
      return { ok: false, message: "" };
    } finally {
      prompting.current = false;
      leftAt.current = null;
    }
  }, [fails, recordFails]);

  const savePin = useCallback(
    async (pin: string) => {
      const salt = Crypto.randomUUID();
      const record = `${salt}:${await hash(salt, pin)}`;
      await storage.set(PIN_KEY, record);
      await recordFails(0);
      setPinRecord(record);
      setLocked(false);
    },
    [recordFails],
  );

  const disable = useCallback(async () => {
    await Promise.all([
      storage.remove(PIN_KEY),
      storage.remove(BIO_KEY),
      storage.remove(FAILS_KEY),
    ]);
    setPinRecord(null);
    setBioEnabled(false);
    setFails(0);
    setLockedUntil(null);
    setLocked(false);
  }, []);

  const setBiometricsEnabled = useCallback(async (on: boolean): Promise<Result> => {
    if (on) {
      // Confirm the fingerprint works before relying on it.
      prompting.current = true;
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Use fingerprint to unlock",
          cancelLabel: "Cancel",
          disableDeviceFallback: true,
        });
        if (!result.success) return { ok: false, message: "" };
      } finally {
        prompting.current = false;
        leftAt.current = null;
      }
      await storage.set(BIO_KEY, "1");
    } else {
      await storage.remove(BIO_KEY);
    }
    setBioEnabled(on);
    return { ok: true };
  }, []);

  const setDelay = useCallback(async (ms: number) => {
    setDelayMs(ms);
    await storage.set(DELAY_KEY, String(ms));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      supported,
      enabled,
      locked: enabled && locked,
      delayMs,
      biometricsAvailable: bioAvailable,
      biometricsEnabled: bioEnabled && bioAvailable,
      lockedUntil,
      checkPin,
      unlockWithBiometrics,
      savePin,
      disable,
      setBiometricsEnabled,
      setDelay,
    }),
    [
      ready,
      enabled,
      locked,
      delayMs,
      bioAvailable,
      bioEnabled,
      lockedUntil,
      checkPin,
      unlockWithBiometrics,
      savePin,
      disable,
      setBiometricsEnabled,
      setDelay,
    ],
  );

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}
