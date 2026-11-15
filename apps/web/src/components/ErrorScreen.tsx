import type { ErrorComponentProps } from "@tanstack/react-router";
import { motion } from "motion/react";
import { tween } from "./motion";
import { Button } from "./ui";

/** A broken-link glyph: something came apart, nothing was lost. */
function BrokenIcon() {
  return (
    <svg
      aria-hidden="true"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 4 8" />
      <path d="M8 12h3M2 2l20 20" />
    </svg>
  );
}

/** Shown instead of a blank page when a screen crashes or its loader fails. */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const detail = error instanceof Error && error.message ? error.message.replace(/\.?$/, ".") : "";
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween.base}
        className="flex max-w-md flex-col items-center gap-4 text-center"
      >
        <motion.div className="mb-2 flex size-20 items-center justify-center rounded-2xl border-2 border-danger/40 bg-danger/10 text-danger">
          <BrokenIcon />
        </motion.div>
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-danger">Something broke</p>
        <h1 className="text-4xl font-bold tracking-[-0.03em]">This page hit a snag.</h1>
        <p className="text-muted">{detail ? `${detail} ` : ""}Your data is safe.</p>
        <div className="mt-2 flex gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => location.reload()}>
            Reload
          </Button>
        </div>
      </motion.div>
    </main>
  );
}
