import { monthTitle, type Ranked } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import {
  alpha,
  axis,
  C,
  catColor,
  EChart,
  FONT,
  type Option,
  type TipLine,
  tipHtml,
} from "./echarts";
import { compactMoney, shortMonth } from "./kit";

/**
 * Invested per month as bold stacked columns, one colour per type of investment (the same
 * colours as everywhere else), the month total printed on top. Months other than the one
 * being viewed are dimmed a little. Below, every type with its all-time total and share,
 * so the chart also answers "where is my money" without a separate pie.
 */
export function InvestBars({
  months,
  allTime,
  byId,
  current,
  onPick,
  height = 320,
}: {
  /** Oldest first; each month's parts are categories with what went into them. */
  months: { month: string; parts: Ranked[] }[];
  /** Every category's total up to now, for the legend. */
  allTime: Ranked[];
  byId: Map<string, Category>;
  current: string;
  onPick?: (month: string) => void;
  height?: number;
}) {
  const money = useMoney();
  // Stack in all-time order, biggest at the bottom, so the colours sit the same way every month.
  const order = useMemo(() => {
    const keys = allTime.map((r) => r.key);
    for (const m of months) for (const p of m.parts) if (!keys.includes(p.key)) keys.push(p.key);
    return keys;
  }, [allTime, months]);
  const name = (key: string) => {
    const c = byId.get(key);
    return c ? `${c.emoji} ${c.name}` : "Unknown";
  };
  const color = (key: string) => catColor(byId.get(key)?.color);

  const option = useMemo<Option>(() => {
    const amount = (m: (typeof months)[number], key: string) =>
      m.parts.find((p) => p.key === key)?.amount ?? 0;
    const total = (m: (typeof months)[number]) => m.parts.reduce((t, p) => t + p.amount, 0);
    const max = Math.max(1, ...months.map(total));
    // The rounded top goes on the highest piece each month actually has.
    const topKey = months.map((m) => [...order].reverse().find((k) => amount(m, k) > 0));

    return {
      grid: { left: 4, right: 4, top: 34, bottom: 4, containLabel: true },
      xAxis: {
        ...axis.category,
        data: months.map((m) => m.month),
        axisLabel: {
          ...axis.category.axisLabel,
          interval: 0,
          formatter: (m: string) => `{${m === current ? "cur" : "m"}|${shortMonth(m)}}`,
          rich: {
            m: { color: C.textMuted, fontWeight: 600, fontSize: 12, fontFamily: FONT },
            cur: { color: C.text, fontWeight: 700, fontSize: 12, fontFamily: FONT },
          },
        },
      },
      yAxis: {
        ...axis.value,
        max: max * 1.12,
        axisLabel: {
          ...axis.value.axisLabel,
          formatter: (v: number) => (v ? compactMoney(v) : ""),
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: alpha(C.text, 0.05) } },
        formatter: (ps: { dataIndex: number }[]) => {
          const m = months[ps[0]?.dataIndex ?? 0];
          if (!m) return "";
          const lines: TipLine[] = m.parts.length
            ? [
                { value: money(total(m)), name: "invested" },
                ...[...m.parts]
                  .sort((a, b) => b.amount - a.amount)
                  .map((p) => ({ color: color(p.key), value: money(p.amount), name: name(p.key) })),
              ]
            : [{ value: "Nothing", name: "invested" }];
          return tipHtml(monthTitle(m.month), lines);
        },
      },
      series: [
        ...order.map((key) => ({
          type: "bar",
          stack: "inv",
          name: name(key),
          barMaxWidth: 44,
          emphasis: { disabled: true },
          data: months.map((m, i) => {
            const v = amount(m, key);
            return {
              value: v,
              itemStyle: {
                color: color(key),
                opacity: m.month === current ? 1 : 0.7,
                borderRadius: topKey[i] === key ? [8, 8, 0, 0] : 0,
                // A hairline in the page colour between stacked pieces.
                borderColor: C.bg,
                borderWidth: v > 0 ? 1 : 0,
              },
            };
          }),
        })),
        // Each month's total on top, on an invisible point at the column's height.
        {
          type: "scatter",
          symbolSize: 0,
          silent: true,
          z: 5,
          data: months.map((m) => (total(m) > 0 ? total(m) : null)),
          label: {
            show: true,
            position: "top",
            distance: 8,
            formatter: (p: { dataIndex: number }) => {
              const m = months[p.dataIndex];
              return m ? compactMoney(total(m)) : "";
            },
            color: C.text,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
          },
        },
      ],
    };
  }, [months, order, current, money, byId]);

  const allTotal = allTime.reduce((t, r) => t + r.amount, 0) || 1;
  const sum = months.reduce((t, m) => t + m.parts.reduce((a, p) => a + p.amount, 0), 0);

  return (
    <figure className="m-0 flex flex-col gap-5">
      <EChart
        option={option}
        height={height}
        label={`Invested by month and type: ${money(sum)} over ${months.length} months.`}
        onClick={
          onPick
            ? (p) => {
                const m = months[p.dataIndex];
                if (m) onPick(m.month);
              }
            : undefined
        }
      />
      <figcaption className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
          All time, by type
        </span>
        <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {allTime.map((r) => (
            <li
              key={r.key}
              className="grid grid-cols-[auto_1fr_auto_3rem] items-center gap-3 border-b border-line py-2.5 text-sm"
            >
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ background: color(r.key) }}
              />
              <span className="truncate font-semibold">{name(r.key)}</span>
              <span className="tabular-nums">{money(r.amount)}</span>
              <span className="text-right tabular-nums text-muted">
                {Math.round((r.amount / allTotal) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
