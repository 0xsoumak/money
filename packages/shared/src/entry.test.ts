import { describe, expect, it } from "vitest";
import { buildEntryPrompt, type EntryCategory, interpretEntryReply, mentionsAmount } from "./entry";

const CATS: EntryCategory[] = [
  { id: "01M71R9BSCRVNRH5VKJ2GRD1FJ", name: "Food", kind: "expense" },
  { id: "01M71R9BSHX0JP16RPJRBDDJRZ", name: "Salary", kind: "income" },
  { id: "01M7R71HFE865V215DE1CTEWH0", name: "Mutual funds", kind: "investment" },
];
const TODAY = "2026-11-15"; // a Sunday

describe("buildEntryPrompt", () => {
  it("numbers categories and spells out recent dates", () => {
    const [system, user] = buildEntryPrompt("500 dinner yesterday", TODAY, CATS);
    expect(system?.content).toContain("1. Food (expense)");
    expect(system?.content).toContain("3. Mutual funds (investment)");
    expect(system?.content).toContain("2026-11-15 = today (Sunday)");
    expect(system?.content).toContain("2026-11-14 = yesterday (Saturday)");
    expect(system?.content).toContain("2026-11-13 = last Friday (Friday)");
    expect(user).toEqual({ role: "user", content: "500 dinner yesterday" });
  });
});

describe("interpretEntryReply", () => {
  it("maps a JSON-mode object to a transaction", () => {
    const r = interpretEntryReply(
      { amount: 500, category: 1, date: "2026-11-14", note: "Dinner" },
      CATS,
      TODAY,
    );
    expect(r).toEqual({
      ok: true,
      input: {
        type: "expense",
        amount: 50000,
        categoryId: CATS[0]?.id,
        date: "2026-11-14",
        note: "Dinner",
      },
    });
  });

  it("takes the type from the category, not the model", () => {
    const reply = { amount: 90000, category: 2, date: TODAY, note: null };
    const r = interpretEntryReply(reply, CATS, TODAY);
    expect(r.ok && r.input.type).toBe("income");
  });

  it("reads JSON wrapped in prose or fences, and string amounts", () => {
    const r = interpretEntryReply(
      'Sure!\n```json\n{"amount":"1250.5","category":3,"date":"2026-11-10","note":"SIP"}\n```',
      CATS,
      TODAY,
    );
    expect(r.ok && r.input).toMatchObject({ amount: 125050, type: "investment", note: "SIP" });
  });

  it("falls back to today for a missing or bad date", () => {
    const reply = { amount: 10, category: 1, date: "yesterday", note: "" };
    const r = interpretEntryReply(reply, CATS, TODAY);
    expect(r.ok && r.input).toMatchObject({ date: TODAY, note: null });
  });

  it.each([
    [{ amount: null, category: 1, date: TODAY }, "amount"],
    [{ amount: 0, category: 1, date: TODAY }, "amount"],
    [{ amount: -5, category: 1, date: TODAY }, "amount"],
    [{ amount: 1.234, category: 1, date: TODAY }, null],
    [{ amount: 5, category: 0, date: TODAY }, "category"],
    [{ amount: 5, category: 9, date: TODAY }, "category"],
    [{ amount: 5, category: 1, date: "2026-11-16" }, "future"],
    ["not json", "understand"],
    [null, "understand"],
  ])("rejects or rounds %j", (raw, error) => {
    const r = interpretEntryReply(raw, CATS, TODAY);
    if (error === null) expect(r.ok && r.input.amount).toBe(123);
    else expect(!r.ok && r.error.toLowerCase()).toContain(error);
  });
});

describe("mentionsAmount", () => {
  it.each(["500 dinner", "spent ₹1.5k", "five hundred on cab", "rent 2 lakh", "SIP 5k"])(
    "accepts %j",
    (text) => expect(mentionsAmount(text)).toBe(true),
  );
  it.each(["dinner with friends", "groceries yesterday", "kebab"])("rejects %j", (text) =>
    expect(mentionsAmount(text)).toBe(false),
  );
});
