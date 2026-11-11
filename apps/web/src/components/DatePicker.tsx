import { Popover } from "@base-ui/react/popover";
import { addMonths, daysInMonth, monthTitle, today } from "@money/shared";
import { motion } from "motion/react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { cx, fieldClass } from "./ui";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (s: string) => new Date(`${s}T00:00:00`);
const fromDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (s: string, days: number) => {
  const d = toDate(s);
  d.setDate(d.getDate() + days);
  return fromDate(d);
};

/** "Wed, 11 Nov 2026" */
const longDate = (s: string) =>
  toDate(s).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * A dark date picker: a field that opens a month calendar in a Base UI
 * Popover. Weeks start on Monday. Arrow keys move by day and week, Page
 * Up/Down by month, Home/End to the week's ends, Enter picks.
 */
export function DatePicker({
  value,
  onChange,
  label,
  className,
}: {
  /** YYYY-MM-DD */
  value: string;
  onChange: (date: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(value);
  const [dir, setDir] = useState(0);
  const grid = useRef<HTMLDivElement>(null);
  const now = today();

  // Each time it opens, start on the chosen date.
  useEffect(() => {
    if (open) setFocused(value);
  }, [open, value]);

  // Keep keyboard focus on the focused day as it moves.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus(),
    );
    return () => cancelAnimationFrame(id);
  }, [focused, open]);

  const month = focused.slice(0, 7);
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first offset
  const n = daysInMonth(y, m);
  const cells = Array.from({ length: Math.ceil((lead + n) / 7) * 7 }, (_, i) => {
    const day = i - lead + 1;
    return day >= 1 && day <= n ? `${month}-${pad(day)}` : null;
  });

  const goMonth = (delta: number) => {
    setDir(delta);
    const target = addMonths(month, delta);
    const [ty, tm] = target.split("-").map(Number) as [number, number];
    const day = Math.min(Number(focused.slice(8)), daysInMonth(ty, tm));
    setFocused(`${target}-${pad(day)}`);
  };

  const pick = (date: string) => {
    onChange(date);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => setFocused(shift(focused, -1)),
      ArrowRight: () => setFocused(shift(focused, 1)),
      ArrowUp: () => setFocused(shift(focused, -7)),
      ArrowDown: () => setFocused(shift(focused, 7)),
      PageUp: () => goMonth(-1),
      PageDown: () => goMonth(1),
      Home: () => setFocused(shift(focused, -((toDate(focused).getDay() + 6) % 7))),
      End: () => setFocused(shift(focused, 6 - ((toDate(focused).getDay() + 6) % 7))),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      e.stopPropagation();
      move();
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={`${label}: ${longDate(value)}`}
        className={cx(
          fieldClass.replace("w-full", ""),
          "flex cursor-pointer items-center gap-2.5 text-left",
          className,
        )}
      >
        <span className="text-muted">
          <CalendarIcon />
        </span>
        <span className="whitespace-nowrap">{longDate(value)}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="end" className="z-[60]">
          <Popover.Popup className="w-[19.5rem] origin-(--transform-origin) rounded-xl border-2 border-line-strong/30 bg-surface p-3 shadow-2xl outline-none transition duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => goMonth(-1)}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-strong hover:text-ink"
              >
                <ChevronLeftIcon />
              </button>
              <Popover.Title
                aria-live="polite"
                className="text-sm font-bold uppercase tracking-[0.12em]"
              >
                {monthTitle(month)}
              </Popover.Title>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => goMonth(1)}
                className="inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-muted hover:bg-surface-strong hover:text-ink"
              >
                <ChevronRightIcon />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-bold text-muted" aria-hidden>
              {WEEKDAYS.map((d) => (
                <span key={d} className="py-1.5">
                  {d}
                </span>
              ))}
            </div>

            <motion.div
              key={month}
              ref={grid}
              role="grid"
              aria-label={monthTitle(month)}
              onKeyDown={onKeyDown}
              initial={dir ? { x: dir * 16, opacity: 0 } : false}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
              className="grid grid-cols-7 gap-0.5"
            >
              {cells.map((date, i) =>
                date ? (
                  <button
                    role="gridcell"
                    key={date}
                    type="button"
                    data-date={date}
                    tabIndex={date === focused ? 0 : -1}
                    aria-selected={date === value}
                    aria-current={date === now ? "date" : undefined}
                    aria-label={longDate(date)}
                    onClick={() => pick(date)}
                    className={cx(
                      "flex h-10 cursor-pointer items-center justify-center rounded-lg text-[15px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
                      date === value
                        ? "bg-accent text-on-accent"
                        : date === now
                          ? "text-accent ring-2 ring-inset ring-accent/50 hover:bg-surface-strong"
                          : "text-ink hover:bg-surface-strong",
                    )}
                  >
                    {Number(date.slice(8))}
                  </button>
                ) : (
                  <span key={`blank-${i}`} />
                ),
              )}
            </motion.div>

            <div className="mt-2 flex justify-between border-t border-line pt-2">
              <button
                type="button"
                onClick={() => pick(shift(now, -1))}
                className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-bold uppercase tracking-wider text-muted hover:text-ink"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => pick(now)}
                className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-bold uppercase tracking-wider text-accent"
              >
                Today
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
