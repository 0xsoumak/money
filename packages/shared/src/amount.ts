const MAX_INT_DIGITS = 9;

/**
 * Applies one key press to the amount being typed in quick add.
 * Keeps the string a valid money input: digits, at most one ".", at most 2 decimals,
 * no stray leading zeros. Returns the new string.
 */
export function pressKey(current: string, key: string): string {
  if (key === "Backspace") return current.slice(0, -1);

  if (key === "." || key === ",") {
    if (current.includes(".")) return current;
    return current === "" ? "0." : `${current}.`;
  }

  if (!/^\d$/.test(key)) return current;

  const [whole = "", frac] = current.split(".");
  if (frac !== undefined) {
    return frac.length >= 2 ? current : current + key;
  }
  if (whole === "0") return key === "0" ? current : key; // no leading zeros: "0" then "5" is "5"
  if (whole.length >= MAX_INT_DIGITS) return current;
  return whole + key;
}
