import { addMonths, currentMonth, monthTitle } from "@money/shared";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { isTyping, useMonth } from "../lib/hooks";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { IconButton } from "./ui";

/** Previous / label / next. Left and right arrow keys change month when nothing is being typed. */
export function MonthSwitcher() {
  const { month, setMonth } = useMonth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowLeft") setMonth(addMonths(month, -1));
      if (e.key === "ArrowRight") setMonth(addMonths(month, 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [month, setMonth]);

  const isCurrent = month === currentMonth();
  // Which way we moved, so the new title slides in from that side.
  const prev = useRef(month);
  const dir = month > prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = month;
  }, [month]);

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous month"
        onClick={() => setMonth(addMonths(month, -1))}
        className="border-2 border-line-strong/25"
      >
        <ChevronLeftIcon />
      </IconButton>
      <h1 className="relative min-w-[10.5rem] overflow-hidden px-2 text-center text-sm font-bold uppercase tracking-[0.12em]">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={month}
            custom={dir}
            className="block"
            variants={{
              enter: (d: number) => ({ x: d * 28, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (d: number) => ({ x: d * -28, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
          >
            {monthTitle(month)}
          </motion.span>
        </AnimatePresence>
      </h1>
      <IconButton
        label="Next month"
        onClick={() => setMonth(addMonths(month, 1))}
        className="border-2 border-line-strong/25"
      >
        <ChevronRightIcon />
      </IconButton>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => setMonth(currentMonth())}
          className="ml-1 min-h-11 cursor-pointer rounded-lg px-3 text-sm font-bold uppercase tracking-wider text-accent"
        >
          Today
        </button>
      )}
    </div>
  );
}
