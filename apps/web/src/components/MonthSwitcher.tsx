import { addMonths, currentMonth } from "@money/shared";
import { useEffect } from "react";
import { monthTitle } from "../lib/group";
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

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label="Previous month"
        onClick={() => setMonth(addMonths(month, -1))}
        className="border-2 border-line-strong/25"
      >
        <ChevronLeftIcon />
      </IconButton>
      <h1 className="min-w-[10.5rem] px-2 text-center text-sm font-bold uppercase tracking-[0.12em]">
        {monthTitle(month)}
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
