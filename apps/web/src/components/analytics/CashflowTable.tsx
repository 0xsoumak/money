import type { MonthTotals } from "@money/shared";
import { useMoney } from "../../lib/hooks";
import { shortMonth } from "../charts/kit";
import { cx } from "../ui";

/** The numbers behind the income chart, behind a "Show numbers" toggle. */
export function CashflowTable({ rows, running }: { rows: MonthTotals[]; running: boolean }) {
  const money = useMoney();
  const last = rows.length - 1;
  const cell = (v: number) => (v ? money(v) : "–");
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        Show numbers
      </summary>
      <div className="-mx-1 mt-2 overflow-x-auto px-1">
        <table className="w-full min-w-[28rem] border-collapse text-right tabular-nums">
          <thead>
            <tr className="border-b-2 border-line-strong text-[13px] uppercase tracking-[0.1em] text-muted">
              <th className="py-2 text-left font-bold">Month</th>
              <th className="py-2 font-bold">Earned</th>
              <th className="py-2 font-bold">Spent</th>
              <th className="py-2 font-bold">Invested</th>
              <th className="py-2 font-bold">Left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.month}
                className={cx("border-b border-line", i === last && "font-semibold")}
              >
                <td className="py-2.5 text-left">
                  {shortMonth(r.month)}
                  {i === last && running && (
                    <span className="ml-1.5 text-xs text-muted">so far</span>
                  )}
                </td>
                <td className="py-2.5">{cell(r.income)}</td>
                <td className="py-2.5">{cell(r.spent)}</td>
                <td className="py-2.5">{cell(r.invested)}</td>
                <td className={cx("py-2.5", r.left < 0 && "text-danger")}>
                  {r.left < 0 ? "−" : ""}
                  {money(Math.abs(r.left))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
