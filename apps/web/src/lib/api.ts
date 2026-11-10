import type { AppType } from "@money/api";
import { QueryClient } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { hc } from "hono/client";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

/** Typed client for the Hono API. Same origin, so the session cookie is sent automatically. */
export const api = hc<AppType>(window.location.origin).api;

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});

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

/** Returns the JSON body on success; throws ApiError otherwise. 401 sends you to the login page. */
export async function unwrap<R extends AnyResponse>(res: R): Promise<Body<R>> {
  if (res.status === 401) {
    queryClient.clear();
    if (!location.pathname.startsWith("/login")) location.assign("/login");
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
