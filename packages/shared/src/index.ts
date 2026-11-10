import { ulid } from "ulidx";

export * from "./dates";
export * from "./money";
export * from "./schemas";
export * from "./tokens";

/** New sortable unique id. Generated on the client for transactions so retries are idempotent. */
export function newId(): string {
  return ulid();
}
