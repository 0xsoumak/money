import { useSyncExternalStore } from "react";
import { storage } from "./storage";

/**
 * "Hide balances": when on, every money value renders as ₹••••• (see useMoney and
 * compactMoney). Saved on the device, so it stays on across launches.
 */
const KEY = "money.hideBalances";

let hidden = false;
let ready = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

// Read the saved choice once at startup; the splash screen waits on `ready`.
void storage.get(KEY).then((v) => {
  hidden = v === "1";
  ready = true;
  emit();
});

export function isHidden(): boolean {
  return hidden;
}

export function setHidden(next: boolean) {
  hidden = next;
  emit();
  void (next ? storage.set(KEY, "1") : storage.remove(KEY)).catch(() => {});
}

export function toggleHidden() {
  setHidden(!hidden);
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-renders when balances are hidden or shown. */
export function useHidden(): boolean {
  return useSyncExternalStore(subscribe, isHidden);
}

/** True once the saved choice has loaded, so screens never flash real numbers at launch. */
export function usePrivacyReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready);
}
