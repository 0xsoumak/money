import { useSyncExternalStore } from "react";

/**
 * "Hide balances": when on, every money value renders as ₹***** (see useMoney and
 * compactMoney). Remembered per browser, so it stays on across reloads.
 */
const KEY = "money.hideBalances";

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let hidden = load();
const listeners = new Set<() => void>();

export function isHidden(): boolean {
  return hidden;
}

export function setHidden(next: boolean) {
  hidden = next;
  try {
    if (next) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked; still works for this session
  }
  for (const l of listeners) l();
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
