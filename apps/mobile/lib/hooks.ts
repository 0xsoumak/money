import { formatMoney } from "@money/shared";
import { useCallback } from "react";

/** Formats minor units as rupees, Indian style (₹1,00,000). The app is INR-only. */
export function useMoney() {
  return useCallback(
    (minor: number) => formatMoney(minor, { currency: "INR", locale: "en-IN" }),
    [],
  );
}
