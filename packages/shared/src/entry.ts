/**
 * "Describe it" entries: turn a sentence like "spent 500 on dinner yesterday" into a
 * transaction. The model only extracts fields; everything it returns is checked here
 * with the same rules as a manual entry, so a confused reply can't save nonsense.
 */
import { z } from "zod";
import { addDays, isValidDate, weekday } from "./dates";
import { parseAmount } from "./money";
import { dateSchema, idSchema, type TransactionInput } from "./schemas";

export const ENTRY_TEXT_MAX = 200;

/** POST /api/ai/entry. `today` is the client's local date, since the server runs in UTC. */
export const entryRequestSchema = z.object({
  id: idSchema,
  text: z.string().trim().min(1, "Type something first").max(ENTRY_TEXT_MAX),
  today: dateSchema,
});
export type EntryRequest = z.infer<typeof entryRequestSchema>;

export interface EntryCategory {
  id: string;
  name: string;
  kind: "expense" | "income" | "investment";
}

// Indexed like weekday(): Monday = 0.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Chat messages for the model. Categories are numbered (models copy small numbers far more
 * reliably than 26-character ids), and recent dates are spelled out so the model looks
 * "yesterday" or "last Friday" up instead of doing date arithmetic.
 */
export function buildEntryPrompt(text: string, today: string, categories: EntryCategory[]) {
  const list = categories.map((c, i) => `${i + 1}. ${c.name} (${c.kind})`).join("\n");
  const days = Array.from({ length: 8 }, (_, n) => {
    const d = addDays(today, -n);
    const name = n === 0 ? "today" : n === 1 ? "yesterday" : `last ${WEEKDAYS[weekday(d)]}`;
    return `${d} = ${name} (${WEEKDAYS[weekday(d)]})`;
  }).join("\n");

  const system = `You turn a short note about money into one transaction for a personal finance app in India. Amounts are in rupees.

Categories (kind in brackets):
${list}

Dates:
${days}

Reply with JSON only:
- amount: the rupee amount as a number ("1.5k" = 1500, "2 lakh" = 200000), or null if the note has no amount.
- category: the number of the best-fitting category. "spent"/"paid"/"bought" means an expense category; "got"/"received"/"salary" means income; "invested"/"SIP"/"bought shares" means investment.
- date: YYYY-MM-DD. Use the Dates list. A date written in the note wins. No date mentioned means today.
- note: a short description of what it was for, in a few words (e.g. "Dinner"), or null.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: text },
  ];
}

/** Passed to the model as its response format, so it answers in exactly this shape. */
export const ENTRY_JSON_SCHEMA = {
  type: "object",
  properties: {
    amount: { type: ["number", "null"] },
    category: { type: "integer" },
    date: { type: "string" },
    note: { type: ["string", "null"] },
  },
  required: ["amount", "category", "date", "note"],
} as const;

const UNCLEAR = "Couldn't understand that. Try “500 dinner yesterday”.";

export type EntryResult = { ok: true; input: TransactionInput } | { ok: false; error: string };

/**
 * Checks the model's reply against the numbered categories and today's date.
 * `raw` is whatever came back: an object (JSON mode) or a string containing JSON.
 */
export function interpretEntryReply(
  raw: unknown,
  categories: EntryCategory[],
  today: string,
): EntryResult {
  const reply = asObject(raw);
  if (!reply) return { ok: false, error: UNCLEAR };

  const amount = toMinor(reply.amount);
  if (!amount) return { ok: false, error: "Couldn't find an amount in that." };

  const index = Number(reply.category);
  const category = Number.isInteger(index) ? categories[index - 1] : undefined;
  if (!category) return { ok: false, error: "Couldn't tell which category that is." };

  let date = typeof reply.date === "string" ? reply.date.trim() : "";
  if (!isValidDate(date)) date = today;
  if (date > today) return { ok: false, error: "That date is in the future." };

  const noteText = typeof reply.note === "string" ? reply.note.trim() : "";
  const note = noteText ? noteText.slice(0, 100) : null;

  return {
    ok: true,
    input: { type: category.kind, amount, categoryId: category.id, date, note },
  };
}

function asObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return null;
  // Models sometimes wrap JSON in prose or code fences; take the outermost {...}.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return asObject(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return null;
  }
}

/** Rupees (number or numeric string) → minor units, through the same parser as typed input. */
function toMinor(value: unknown): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    return parseAmount(value.toFixed(2));
  }
  if (typeof value === "string") {
    const minor = parseAmount(value);
    return minor && minor > 0 ? minor : null;
  }
  return null;
}
