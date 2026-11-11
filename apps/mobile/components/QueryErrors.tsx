import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { ApiError } from "../lib/api";
import { useToast } from "./Toast";

/**
 * When data fails to load and there's nothing cached to show, say so with a
 * Retry, instead of leaving a skeleton up forever. Background refreshes that
 * fail while old data is on screen stay quiet. At most one toast every few seconds.
 */
export function QueryErrorToasts() {
  const qc = useQueryClient();
  const toast = useToast();
  const last = useRef(0);

  useEffect(
    () =>
      qc.getQueryCache().subscribe((event) => {
        if (event.type !== "updated" || event.action.type !== "error") return;
        const { error } = event.action;
        if (error instanceof ApiError && error.status === 401) return; // already redirecting
        if (event.query.state.data !== undefined) return;
        const now = Date.now();
        if (now - last.current < 4000) return;
        last.current = now;
        toast.show(error.message || "Couldn't load your data.", {
          tone: "error",
          action: {
            label: "Retry",
            onClick: () => void qc.refetchQueries({ type: "active" }),
          },
        });
      }),
    [qc, toast],
  );

  return null;
}
