import { ulid } from "ulidx";

export * from "./amount";
export * from "./budget";
export * from "./dates";
export * from "./errors";
export * from "./group";
export * from "./insights";
export * from "./money";
export * from "./schemas";
export * from "./tokens";

/** New sortable unique id. Generated on the client for transactions so retries are idempotent. */
export function newId(): string {
  return ulid();
}
