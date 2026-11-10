import { formatMoney } from "@money/shared";
import { useCallback } from "react";
import { useSettings } from "./queries";

/** Formats minor units using the saved currency and locale. */
export function useMoney() {
  const { currency, locale } = useSettings();
  return useCallback(
    (minor: number) => formatMoney(minor, { currency, locale }),
    [currency, locale],
  );
}
