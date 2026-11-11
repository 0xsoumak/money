import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
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

/**
 * While the browser is offline, queries pause instead of failing, so say so.
 * Anything saved meanwhile is queued and goes through when the connection returns.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
  );
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          role="status"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="fixed inset-x-0 top-3 z-[90] mx-auto w-fit rounded-full border-2 border-warning bg-surface px-4 py-2 text-sm font-bold text-warning shadow-xl"
        >
          You're offline. Showing what's saved; changes will sync when you're back.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
