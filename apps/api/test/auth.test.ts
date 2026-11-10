import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { signIn, TEST_USER } from "./helpers";

describe("auth", () => {
  it("serves health without auth", async () => {
    const res = await SELF.fetch("http://localhost/api/health");
    expect(res.status).toBe(200);
  });

  it.each([
    "/api/categories",
    "/api/transactions?month=2026-11",
    "/api/summary?month=2026-11",
    "/api/settings",
  ])("rejects unauthenticated %s", async (path) => {
    const res = await SELF.fetch(`http://localhost${path}`);
    expect(res.status).toBe(401);
  });

  it("rejects a bogus bearer token", async () => {
    const res = await SELF.fetch("http://localhost/api/categories", {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(401);
  });

  it("blocks sign-up", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({
        email: "intruder@example.com",
        password: "long-enough-password",
        name: "x",
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ code: string }>();
    expect(body.code).toBe("EMAIL_PASSWORD_SIGN_UP_DISABLED");
  });

  it("signs in with the right password and returns a bearer token", async () => {
    const res = await signIn();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-auth-token")).toBeTruthy();
  });

  it("rejects a wrong password", async () => {
    const res = await signIn(TEST_USER.email, "definitely-wrong-password", "10.0.0.2");
    expect(res.status).toBe(401);
  });

  it("rate limits repeated sign-in attempts from one IP", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await signIn(TEST_USER.email, "wrong-password-xyz", "10.0.0.99")).status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
