/**
 * The API the app talks to. Defaults to the deployed Worker, so the phone works anywhere.
 * To test against a local API instead, set EXPO_PUBLIC_API_URL (for example in .env.local).
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://money-tracker.soumakkdutta.workers.dev"
).replace(/\/$/, "");
