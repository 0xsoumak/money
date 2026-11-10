import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Where the sign-in token lives. On the phone that's the Android keystore via SecureStore.
 * SecureStore doesn't exist on the web build (only used here for previewing screens),
 * so fall back to localStorage there.
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === "web") globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      // nothing stored; fine
    }
  },
};
