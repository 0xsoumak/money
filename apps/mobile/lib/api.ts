import type { AppType } from "@money/api";
import { messageForStatus, OFFLINE_MESSAGE } from "@money/shared";
import { QueryClient } from "@tanstack/react-query";
import { hc } from "hono/client";
import { API_URL } from "./config";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// The session token lives here (set by the session provider) so API calls can read it synchronously.
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setApiToken = (value: string | null) => {
  token = value;
};
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

/** Typed client for the Hono API. Sends the bearer token; never sends cookies. */
export const api = hc<AppType>(API_URL, {
  headers: () => (token ? { authorization: `Bearer ${token}` } : ({} as Record<string, string>)),
  fetch: (input: RequestInfo | URL, init?: RequestInit) =>
    safeFetch(input, { ...init, credentials: "omit" }),
}).api;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** fetch, but a request that never reaches the server throws a readable ApiError (status 0). */
async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    throw new ApiError(0, OFFLINE_MESSAGE);
  }
}

/** The success JSON body of a Hono client response, with each route's `{ error }` branch removed. */
type Body<R> = R extends { json(): Promise<infer T> }
  ? T extends { error: string }
    ? never
    : T
  : never;

type AnyResponse = {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  clone(): { json(): Promise<unknown> };
};

/** Returns the JSON body on success; throws ApiError otherwise. A 401 signs the user out. */
export async function unwrap<R extends AnyResponse>(res: R): Promise<Body<R>> {
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, "Please sign in again");
  }
  if (!res.ok) {
    let apiMessage: string | undefined;
    try {
      apiMessage = ((await res.clone().json()) as { error?: string }).error;
    } catch {
      // not JSON; use the generic message
    }
    throw new ApiError(res.status, messageForStatus(res.status, apiMessage));
  }
  if (res.status === 204) return undefined as Body<R>;
  return (await res.json()) as Body<R>;
}
