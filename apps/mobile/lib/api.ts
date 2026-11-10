import type { AppType } from "@money/api";
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
    fetch(input, { ...init, credentials: "omit" }),
}).api;

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.clone().json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // not JSON; keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as Body<R>;
  return (await res.json()) as Body<R>;
}
