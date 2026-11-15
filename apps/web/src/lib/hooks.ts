import { currentMonth, formatMoney, isValidMonth } from "@money/shared";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/** Formats minor units as rupees, Indian style (₹1,00,000). The app is INR-only. */
export function useMoney() {
  return useCallback(
    (minor: number) => formatMoney(minor, { currency: "INR", locale: "en-IN" }),
    [],
  );
}

/** The month shown across pages, kept in the URL (?month=2026-11) so it survives reloads and links. */
export function useMonth() {
  const search = useSearch({ strict: false }) as { month?: string };
  const navigate = useNavigate();
  const month = search.month && isValidMonth(search.month) ? search.month : currentMonth();
  const setMonth = useCallback(
    (next: string) => {
      void navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          month: next === currentMonth() ? undefined : next,
        }),
        replace: true,
      });
    },
    [navigate],
  );
  return { month, setMonth };
}

/** True when the keyboard focus is somewhere the user is typing. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.("input, textarea, select, [contenteditable='true']");
}
