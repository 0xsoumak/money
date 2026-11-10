import { SELF } from "cloudflare:test";

export const TEST_USER = {
  id: "01KQTESTUSER0000000000000",
  email: "me@example.com",
  password: "a-long-test-password",
};

export const FOOD = "01M71R9BSCRVNRH5VKJ2GRD1FJ"; // seeded expense category
export const SALARY = "01M71R9BSHX0JP16RPJRBDDJRZ"; // seeded income category

const BASE = "http://localhost";

export async function signIn(
  email = TEST_USER.email,
  password = TEST_USER.password,
  ip = "10.0.0.1",
): Promise<Response> {
  return SELF.fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, "cf-connecting-ip": ip },
    body: JSON.stringify({ email, password }),
  });
}

/** Signs in and returns a fetch helper that sends the bearer token. */
export async function authed() {
  const res = await signIn();
  const token = res.headers.get("set-auth-token");
  if (!token) throw new Error(`Sign-in failed: ${res.status} ${await res.text()}`);
  return (path: string, init: RequestInit & { json?: unknown } = {}) => {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("authorization", `Bearer ${token}`);
    if (json !== undefined) headers.set("content-type", "application/json");
    return SELF.fetch(`${BASE}${path}`, {
      ...rest,
      headers,
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
  };
}
