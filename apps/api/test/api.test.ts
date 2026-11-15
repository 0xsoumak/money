import { newId } from "@money/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { authed, FD, FOOD, MF, SALARY } from "./helpers";

type Api = Awaited<ReturnType<typeof authed>>;
type Json = Record<string, any>;

let api: Api;
beforeAll(async () => {
  api = await authed();
});

const expense = (overrides: Json = {}) => ({
  type: "expense",
  amount: 12550,
  categoryId: FOOD,
  date: "2026-11-10",
  note: "Lunch",
  ...overrides,
});

describe("categories", () => {
  it("lists seeded defaults", async () => {
    const res = await api("/api/categories");
    const { categories } = await res.json<Json>();
    expect(categories.length).toBeGreaterThanOrEqual(12);
    expect(categories.find((c: Json) => c.id === FOOD)).toMatchObject({
      name: "Food & Dining",
      emoji: "🍜",
      kind: "expense",
    });
  });

  it("creates, updates and archives a category (unicode-safe)", async () => {
    const created = await api("/api/categories", {
      method: "POST",
      json: { name: "Coffee", emoji: "☕", color: "amber", kind: "expense" },
    });
    expect(created.status).toBe(201);
    const { category } = await created.json<Json>();
    expect(category.emoji).toBe("☕");

    const patched = await api(`/api/categories/${category.id}`, {
      method: "PATCH",
      json: { name: "Coffee ☕", color: "coral" },
    });
    expect((await patched.json<Json>()).category).toMatchObject({
      name: "Coffee ☕",
      color: "coral",
    });

    const archived = await api(`/api/categories/${category.id}`, { method: "DELETE" });
    expect((await archived.json<Json>()).category.archivedAt).not.toBeNull();

    const unarchived = await api(`/api/categories/${category.id}`, {
      method: "PATCH",
      json: { archived: false },
    });
    expect((await unarchived.json<Json>()).category.archivedAt).toBeNull();
  });

  it("puts a new category at the end of its kind unless an order is given", async () => {
    const make = async (extra: Json = {}) =>
      (
        await (
          await api("/api/categories", {
            method: "POST",
            json: { name: "Order check", emoji: "x", color: "teal", kind: "income", ...extra },
          })
        ).json<Json>()
      ).category;
    const first = await make();
    const second = await make();
    expect(second.sortOrder).toBe(first.sortOrder + 1);
    expect(first.sortOrder).toBeGreaterThanOrEqual(2); // after the two seeded income categories
    const pinned = await make({ sortOrder: 0 });
    expect(pinned.sortOrder).toBe(0);
  });

  it("reorders categories", async () => {
    const list = async () =>
      ((await (await api("/api/categories")).json<Json>()).categories as Json[])
        .filter((c) => c.kind === "investment")
        .map((c) => c.id);
    const before = await list();
    expect(before[0]).toBe(MF);
    const reversed = [...before].reverse();

    const res = await api("/api/categories/order", { method: "PUT", json: { ids: reversed } });
    expect(res.status).toBe(200);
    expect(await list()).toEqual(reversed);

    // Put it back so later tests see the seeded order.
    await api("/api/categories/order", { method: "PUT", json: { ids: before } });
    expect(await list()).toEqual(before);
  });

  it("rejects a reorder with duplicates or bad ids", async () => {
    for (const ids of [[MF, MF], ["nope"], []]) {
      const res = await api("/api/categories/order", { method: "PUT", json: { ids } });
      expect(res.status).toBe(400);
    }
  });

  it("validates input", async () => {
    const res = await api("/api/categories", {
      method: "POST",
      json: { name: "", emoji: "x", color: "neon", kind: "expense" },
    });
    expect(res.status).toBe(400);
  });

  it("404s on unknown ids", async () => {
    const res = await api(`/api/categories/${newId()}`, { method: "PATCH", json: { name: "x" } });
    expect(res.status).toBe(404);
  });
});

describe("transactions", () => {
  it("PUT creates, and repeating it updates the same row (idempotent)", async () => {
    const id = newId();
    const first = await api(`/api/transactions/${id}`, { method: "PUT", json: expense() });
    expect(first.status).toBe(200);
    expect((await first.json<Json>()).transaction).toMatchObject({
      id,
      amount: 12550,
      note: "Lunch",
    });

    await api(`/api/transactions/${id}`, { method: "PUT", json: expense() }); // retry
    await api(`/api/transactions/${id}`, {
      method: "PUT",
      json: expense({ amount: 9900, note: null }),
    });

    const { transactions } = await (await api("/api/transactions?month=2026-11")).json<Json>();
    const matches = transactions.filter((t: Json) => t.id === id);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ amount: 9900, note: null });
  });

  it("only lists the requested month, newest first", async () => {
    const oct = newId();
    const dec1 = newId();
    const nov30 = newId();
    await api(`/api/transactions/${oct}`, { method: "PUT", json: expense({ date: "2026-10-31" }) });
    await api(`/api/transactions/${dec1}`, {
      method: "PUT",
      json: expense({ date: "2026-12-01" }),
    });
    await api(`/api/transactions/${nov30}`, {
      method: "PUT",
      json: expense({ date: "2026-11-30" }),
    });

    const { transactions } = await (await api("/api/transactions?month=2026-11")).json<Json>();
    const ids = transactions.map((t: Json) => t.id);
    expect(ids).toContain(nov30);
    expect(ids).not.toContain(oct);
    expect(ids).not.toContain(dec1);
    expect(ids[0]).toBe(nov30);
  });

  it("rejects a category of the wrong kind", async () => {
    const res = await api(`/api/transactions/${newId()}`, {
      method: "PUT",
      json: expense({ type: "income" }), // FOOD is an expense category
    });
    expect(res.status).toBe(400);
  });

  it("rejects unknown categories, floats, bad dates and bad ids", async () => {
    const cases: [string, Json][] = [
      [newId(), expense({ categoryId: newId() })],
      [newId(), expense({ amount: 12.5 })],
      [newId(), expense({ amount: -100 })],
      [newId(), expense({ date: "2026-02-30" })],
      ["not-a-ulid", expense()],
    ];
    for (const [id, body] of cases) {
      const res = await api(`/api/transactions/${id}`, { method: "PUT", json: body });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("requires a valid month", async () => {
    expect((await api("/api/transactions")).status).toBe(400);
    expect((await api("/api/transactions?month=2026-13")).status).toBe(400);
  });

  it("soft deletes and restores", async () => {
    const id = newId();
    await api(`/api/transactions/${id}`, { method: "PUT", json: expense({ date: "2026-09-15" }) });

    expect((await api(`/api/transactions/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(`/api/transactions/${id}`, { method: "DELETE" })).status).toBe(204); // idempotent
    let list = (await (await api("/api/transactions?month=2026-09")).json<Json>()).transactions;
    expect(list.map((t: Json) => t.id)).not.toContain(id);

    const restored = await api(`/api/transactions/${id}/restore`, { method: "POST" });
    expect((await restored.json<Json>()).transaction.deletedAt).toBeNull();
    list = (await (await api("/api/transactions?month=2026-09")).json<Json>()).transactions;
    expect(list.map((t: Json) => t.id)).toContain(id);
  });

  it("404s when deleting or restoring an unknown id", async () => {
    expect((await api(`/api/transactions/${newId()}`, { method: "DELETE" })).status).toBe(404);
    expect((await api(`/api/transactions/${newId()}/restore`, { method: "POST" })).status).toBe(
      404,
    );
  });
});

describe("summary", () => {
  it("totals expenses and income for the month, excluding deleted rows", async () => {
    const month = "2025-03";
    const put = (body: Json) => api(`/api/transactions/${newId()}`, { method: "PUT", json: body });
    await put(expense({ date: "2025-03-01", amount: 1000 }));
    await put(expense({ date: "2025-03-31", amount: 2550 }));
    await put({ type: "income", amount: 500000, categoryId: SALARY, date: "2025-03-05" });
    const deleted = newId();
    await api(`/api/transactions/${deleted}`, {
      method: "PUT",
      json: expense({ date: "2025-03-10", amount: 99999 }),
    });
    await api(`/api/transactions/${deleted}`, { method: "DELETE" });

    const summary = await (await api(`/api/summary?month=${month}`)).json<Json>();
    expect(summary).toMatchObject({ month, spent: 3550, income: 500000, net: 496450 });
    expect(summary.byCategory).toContainEqual({
      type: "expense",
      categoryId: FOOD,
      total: 3550,
      count: 2,
    });
  });

  it("returns zeros for an empty month", async () => {
    const summary = await (await api("/api/summary?month=1999-01")).json<Json>();
    expect(summary).toMatchObject({ spent: 0, income: 0, net: 0, byCategory: [] });
  });
});

describe("summary trend", () => {
  it("returns six months oldest first with zeros for empty ones", async () => {
    const put = (body: Json) => api(`/api/transactions/${newId()}`, { method: "PUT", json: body });
    await put(expense({ date: "2020-12-31", amount: 700 }));
    await put(expense({ date: "2021-02-10", amount: 1200 }));
    await put({ type: "income", amount: 9000, categoryId: SALARY, date: "2021-02-11" });
    const { months } = await (await api("/api/summary/trend?month=2021-03")).json<Json>();
    expect(months.map((m: Json) => m.month)).toEqual([
      "2020-10",
      "2020-11",
      "2020-12",
      "2021-01",
      "2021-02",
      "2021-03",
    ]);
    expect(months[2]).toMatchObject({ spent: 700, income: 0 });
    expect(months[4]).toMatchObject({ spent: 1200, income: 9000 });
    expect(months[5]).toMatchObject({ spent: 0, income: 0 });
  });
});

describe("analytics", () => {
  it("returns 13 months of live rows, oldest first", async () => {
    const put = (body: Json) => api(`/api/transactions/${newId()}`, { method: "PUT", json: body });
    await put(expense({ date: "2018-12-31", amount: 111 })); // one day before the window
    await put(expense({ date: "2019-01-01", amount: 222, note: "First" }));
    await put({ type: "income", amount: 9000, categoryId: SALARY, date: "2019-06-01" });
    await put(expense({ date: "2020-01-31", amount: 333 }));
    await put(expense({ date: "2020-02-01", amount: 444 })); // after the window
    const deleted = newId();
    await api(`/api/transactions/${deleted}`, {
      method: "PUT",
      json: expense({ date: "2019-05-05", amount: 999 }),
    });
    await api(`/api/transactions/${deleted}`, { method: "DELETE" });

    const body = await (await api("/api/analytics?month=2020-01")).json<Json>();
    expect(body).toMatchObject({ from: "2019-01", to: "2020-01" });
    expect(body.rows).toEqual([
      { date: "2019-01-01", type: "expense", categoryId: FOOD, amount: 222, note: "First" },
      { date: "2019-06-01", type: "income", categoryId: SALARY, amount: 9000, note: null },
      { date: "2020-01-31", type: "expense", categoryId: FOOD, amount: 333, note: "Lunch" },
    ]);
  });

  it("rejects a bad month", async () => {
    expect((await api("/api/analytics?month=2020-13")).status).toBe(400);
  });
});

describe("investments", () => {
  const put = (body: Json) => api(`/api/transactions/${newId()}`, { method: "PUT", json: body });
  const invest = (categoryId: string, amount: number, date: string) =>
    put({ type: "investment", amount, categoryId, date });

  it("keeps investments out of spending and takes them off net", async () => {
    await put(expense({ date: "2018-03-03", amount: 1000 }));
    await put({ type: "income", amount: 10000, categoryId: SALARY, date: "2018-03-01" });
    await invest(MF, 2500, "2018-03-05");
    const s = await (await api("/api/summary?month=2018-03")).json<Json>();
    expect(s).toMatchObject({ spent: 1000, income: 10000, invested: 2500, net: 6500 });
    const t = await (await api("/api/summary/trend?month=2018-03")).json<Json>();
    expect(t.months[5]).toMatchObject({ spent: 1000, invested: 2500 });
  });

  it("only accepts investment buckets for investments", async () => {
    const bad = await invest(FOOD, 100, "2018-03-06");
    expect(bad.status).toBe(400);
    const alsoBad = await put(expense({ categoryId: MF, date: "2018-03-06", amount: 100 }));
    expect(alsoBad.status).toBe(400);
  });

  it("can't put a budget on an investment bucket", async () => {
    const res = await api(`/api/budgets/${MF}`, { method: "PUT", json: { amount: 5000 } });
    expect(res.status).toBe(400);
  });

  it("totals by bucket, by year and by month up to the given month", async () => {
    await invest(FD, 50000, "2017-06-10");
    await invest(MF, 3000, "2018-01-15");
    await invest(MF, 3000, "2018-02-15");
    await invest(FD, 99999, "2018-07-01"); // after the month asked about: not counted
    const deleted = newId();
    await api(`/api/transactions/${deleted}`, {
      method: "PUT",
      json: { type: "investment", amount: 777, categoryId: MF, date: "2018-02-20" },
    });
    await api(`/api/transactions/${deleted}`, { method: "DELETE" });

    const r = await (await api("/api/summary/investments?month=2018-03")).json<Json>();
    // Includes the 2,500 MF from the previous test (2018-03-05).
    expect(r.total).toBe(50000 + 3000 + 3000 + 2500);
    expect(r.thisYear).toBe(3000 + 3000 + 2500);
    expect(r.lastYear).toBe(50000);
    expect(r.byCategory[0]).toMatchObject({ categoryId: FD, total: 50000, count: 1 });
    expect(r.byCategory[1]).toMatchObject({ categoryId: MF, total: 8500, count: 3 });
    expect(r.months).toHaveLength(12);
    expect(r.months[0].month).toBe("2017-04");
    expect(r.months.at(-1)).toEqual({ month: "2018-03", invested: 2500 });
    expect(r.months.find((m: Json) => m.month === "2017-06").invested).toBe(50000);
  });
});

describe("settings", () => {
  it("returns defaults and applies patches", async () => {
    const initial = (await (await api("/api/settings")).json<Json>()).settings;
    expect(initial).toEqual({ currency: "INR", locale: "en-IN", weekStart: "monday" });

    const patched = await api("/api/settings", { method: "PATCH", json: { currency: "USD" } });
    expect((await patched.json<Json>()).settings).toMatchObject({
      currency: "USD",
      locale: "en-IN",
    });

    const bad = await api("/api/settings", { method: "PATCH", json: { currency: "dollars" } });
    expect(bad.status).toBe(400);
  });
});

describe("export", () => {
  it("downloads everything as one JSON file", async () => {
    const id = newId();
    await api(`/api/transactions/${id}`, {
      method: "PUT",
      json: {
        type: "expense",
        amount: 4200,
        categoryId: FOOD,
        date: "2019-05-05",
        note: "export me",
      },
    });
    const res = await api("/api/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="money-.+\.json"/);
    const body = await res.json<Json>();
    expect(body.version).toBe(1);
    expect(body.categories.length).toBeGreaterThan(0);
    expect(body.transactions.some((t: Json) => t.id === id && t.amount === 4200)).toBe(true);
    expect(body.settings).toBeTypeOf("object");
    expect(body).not.toHaveProperty("user");
  });
});

describe("budgets", () => {
  const put = (key: string, body: Json) =>
    api(`/api/budgets/${key}`, { method: "PUT", json: body });

  it("starts with none, and the summary says so", async () => {
    expect((await (await api("/api/budgets")).json<Json>()).budgets).toEqual([]);
    const summary = await (await api("/api/summary?month=2026-11")).json<Json>();
    expect(summary.budget).toEqual({ overall: null, categories: {} });
  });

  it("sets an overall budget and changes it by repeating the request", async () => {
    expect((await put("overall", { amount: 4000000 })).status).toBe(200);
    const again = await put("overall", { amount: 4500000 });
    expect((await again.json<Json>()).budget).toMatchObject({
      key: "overall",
      categoryId: null,
      amount: 4500000,
    });
    const { budgets } = await (await api("/api/budgets")).json<Json>();
    expect(budgets.filter((b: Json) => b.key === "overall")).toHaveLength(1);
  });

  it("sets a category budget and reports both in the summary", async () => {
    await put(FOOD, { amount: 600000 });
    const summary = await (await api("/api/summary?month=2026-11")).json<Json>();
    expect(summary.budget).toEqual({ overall: 4500000, categories: { [FOOD]: 600000 } });
  });

  it("budgets apply to every month", async () => {
    const other = await (await api("/api/summary?month=2030-01")).json<Json>();
    expect(other.budget.overall).toBe(4500000);
  });

  it("only allows expense categories that exist", async () => {
    expect((await put(SALARY, { amount: 100000 })).status).toBe(400);
    expect((await put(newId(), { amount: 100000 })).status).toBe(404);
  });

  it("rejects bad amounts and bad keys", async () => {
    for (const amount of [0, -1, 1.5, "100"]) {
      expect((await put(FOOD, { amount })).status, `amount ${amount}`).toBe(400);
    }
    expect((await put("everything", { amount: 100 })).status).toBe(400);
  });

  it("removes a budget, and removing a missing one is fine", async () => {
    expect((await api(`/api/budgets/${FOOD}`, { method: "DELETE" })).status).toBe(204);
    expect((await api(`/api/budgets/${FOOD}`, { method: "DELETE" })).status).toBe(204);
    const summary = await (await api("/api/summary?month=2026-11")).json<Json>();
    expect(summary.budget.categories).toEqual({});
    await api("/api/budgets/overall", { method: "DELETE" });
    expect((await (await api("/api/budgets")).json<Json>()).budgets).toEqual([]);
  });
});
