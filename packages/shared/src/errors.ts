/** Shown when the request never reached the server (offline, DNS, server down). */
export const OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";

/** Shown for any 5xx: the server's own text ("Internal server error") helps no one. */
export const SERVER_MESSAGE = "Something went wrong on our side. Try again in a moment.";

/** A user-facing message for a failed response, given its status and the API's `error` text. */
export function messageForStatus(status: number, apiMessage?: string): string {
  if (status >= 500) return SERVER_MESSAGE;
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  return apiMessage || `Request failed (${status})`;
}
