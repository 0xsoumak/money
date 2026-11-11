import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "./ui";

/** Shown instead of a blank page when a screen crashes or its loader fails. */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  console.error(error);
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-danger">Something broke</p>
      <h1 className="text-4xl font-bold tracking-[-0.03em]">This page hit a snag.</h1>
      <p className="text-muted">
        {error instanceof Error && error.message ? error.message : "An unexpected error happened."}{" "}
        Your data is safe.
      </p>
      <div className="mt-2 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => location.reload()}>
          Reload
        </Button>
      </div>
    </main>
  );
}
