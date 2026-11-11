import type { TransactionType } from "./schemas";

/** Every transaction type, in the order the apps show them. */
export const TRANSACTION_TYPES = ["expense", "income", "investment"] as const;

/** Short label for a type toggle: "Expense", "Income", "Invest". */
export const TYPE_LABEL: Record<TransactionType, string> = {
  expense: "Expense",
  income: "Income",
  investment: "Invest",
};

/** Heading for a group of categories or a filter: "Expenses", "Income", "Investments". */
export const TYPE_PLURAL: Record<TransactionType, string> = {
  expense: "Expenses",
  income: "Income",
  investment: "Investments",
};
