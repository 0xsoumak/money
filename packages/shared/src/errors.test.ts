import { describe, expect, it } from "vitest";
import { messageForStatus, SERVER_MESSAGE } from "./errors";

describe("messageForStatus", () => {
  it("hides server internals behind a friendly message", () => {
    expect(messageForStatus(500, "Internal server error")).toBe(SERVER_MESSAGE);
    expect(messageForStatus(503)).toBe(SERVER_MESSAGE);
  });
  it("keeps the API's own wording for client errors", () => {
    expect(messageForStatus(400, "Category is for income, not expense")).toBe(
      "Category is for income, not expense",
    );
    expect(messageForStatus(404)).toBe("Request failed (404)");
    expect(messageForStatus(429, "x")).toMatch(/Too many attempts/);
  });
});
