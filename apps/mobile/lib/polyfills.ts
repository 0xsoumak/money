import * as ExpoCrypto from "expo-crypto";

/**
 * The shared package makes transaction ids with `ulidx`, which needs
 * `crypto.getRandomValues`. React Native doesn't reliably provide it, so fill it
 * in from expo-crypto. Import this file before anything that creates an id.
 */
const g = globalThis as unknown as { crypto?: { getRandomValues?: unknown } };
if (typeof g.crypto?.getRandomValues !== "function") {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues: ExpoCrypto.getRandomValues };
}
