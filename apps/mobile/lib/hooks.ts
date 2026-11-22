import { formatMoney, MASKED_MONEY } from "@money/shared";
import { useCallback } from "react";
import { useHidden } from "./privacy";

/** Formats minor units as rupees, Indian style (₹1,00,000), or ₹••••• while balances are hidden. The app is INR-only. */
export function useMoney() {
  const hidden = useHidden();
  return useCallback(
    (minor: number) =>
      hidden ? MASKED_MONEY : formatMoney(minor, { currency: "INR", locale: "en-IN" }),
    [hidden],
  );
}
