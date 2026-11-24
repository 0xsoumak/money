import { type PaceDay, type Range, shortDate } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import { alpha, axis, C, EChart, FONT, type Option, type TipLine, tipHtml } from "./echarts";
import { compactMoney, Key, Legend } from "./kit";

/**
 * The spend curve: the month so far as a running total, over the shaded range earlier
 * months had reached by each day. A dashed line carries it on to where the month is
 * likely to end (with a faint fan for how far it could go), and a line marks the budget.
 */
export function PaceChart({
  month,
  current,
  days,
  usual,
  projected,
  budget,
  height = 280,
}: {
  month: string;
  /** Running total, day 1 to today. */
  current: number[];
  days: number;
  /** The usual running total for every day; null without history. */
  usual: PaceDay[] | null;
  /** Where a running month is likely to land; null once it's over. */
  projected: Range | null;
  budget: number | null;
  height?: number;
}) {
  const money = useMoney();
  const elapsed = current.length;
  const last = current.at(-1) ?? 0;
  const showProjection = projected !== null && elapsed > 0 && elapsed < days;

  const option = useMemo<Option>(() => {
    const dayList = Array.from({ length: days }, (_, i) => i + 1);
    const date = (d: number) => shortDate(`${month}-${String(d).padStart(2, "0")}`);
    // From today to month end: straight lines from today's total to the likely low, mid, high.
    const toward = (end: number) =>
      dayList.map((d) =>
        !showProjection || d < elapsed
          ? null
          : Math.round(last + ((end - last) * (d - elapsed)) / (days - elapsed)),
      );
    const likely = toward(projected?.mid ?? 0);
    const fanLow = toward(projected?.low ?? 0);
    const fanHigh = toward(projected?.high ?? 0);
    const quiet = { symbol: "none", silent: true, lineStyle: { opacity: 0 } } as const;
    const endLabel = (text: string, color: string) => ({
      show: true,
      formatter: text,
      color,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 600,
      distance: 8,
    });

    return {
      grid: { left: 4, right: 92, top: 28, bottom: 8, containLabel: true },
      xAxis: {
        ...axis.category,
        data: dayList,
        boundaryGap: false,
        axisLabel: {
          ...axis.category.axisLabel,
          color: C.textFaint,
          fontSize: 11,
          fontWeight: 500,
          interval: (i: number) => [0, 7, 14, 21, days - 1].includes(i),
        },
      },
      yAxis: {
        ...axis.value,
        axisLabel: {
          ...axis.value.axisLabel,
          formatter: (v: number) => (v ? compactMoney(v) : ""),
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: alpha(C.text, 0.4), width: 1 } },
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0]?.dataIndex ?? 0;
          const d = i + 1;
          const u = usual?.[i];
          const lines: TipLine[] = [];
          if (d <= elapsed)
            lines.push({ color: C.accent, value: money(current[i] ?? 0), name: "spent" });
          if (showProjection && d > elapsed)
            lines.push({
              color: alpha(C.accent, 0.6),
              value: money(likely[i] ?? 0),
              name: "likely",
            });
          if (u)
            lines.push({
              color: alpha(C.text, 0.3),
              value: `${compactMoney(u.low)}–${compactMoney(u.high)}`,
              name: "usual",
            });
          if (budget !== null)
            lines.push({ color: alpha(C.text, 0.6), value: money(budget), name: "budget" });
          return tipHtml(date(d), lines);
        },
      },
      series: [
        // The usual range: an invisible base line with the range stacked on top of it.
        ...(usual
          ? [
              { type: "line", stack: "usual", data: usual.map((u) => u.low), ...quiet },
              {
                type: "line",
                stack: "usual",
                data: usual.map((u) => u.high - u.low),
                ...quiet,
                areaStyle: { color: alpha(C.text, 0.08) },
                smooth: 0.3,
              },
              {
                type: "line",
                name: "Usual",
                data: usual.map((u) => u.mid),
                symbol: "none",
                silent: true,
                smooth: 0.3,
                lineStyle: { color: alpha(C.text, 0.25), width: 1 },
                endLabel: endLabel(`Usual ${compactMoney(usual.at(-1)?.mid ?? 0)}`, C.textFaint),
              },
            ]
          : []),
        ...(showProjection
          ? [
              { type: "line", stack: "fan", data: fanLow, ...quiet },
              {
                type: "line",
                stack: "fan",
                data: fanHigh.map((h, i) => (h === null ? null : h - (fanLow[i] ?? 0))),
                ...quiet,
                areaStyle: { color: alpha(C.accent, 0.08) },
              },
              {
                type: "line",
                name: "Likely",
                data: likely,
                symbol: "none",
                silent: true,
                lineStyle: { color: alpha(C.accent, 0.7), width: 2, type: [4, 5], cap: "round" },
                endLabel: endLabel(`Likely ${compactMoney(projected?.mid ?? 0)}`, C.textMuted),
              },
            ]
          : []),
        {
          type: "line",
          name: "This month",
          data: current,
          symbol: "circle",
          symbolSize: (_: number, p: { dataIndex: number }) =>
            p.dataIndex === elapsed - 1 ? 11 : 0,
          showSymbol: true,
          itemStyle: { color: C.accent, borderColor: C.bg, borderWidth: 2 },
          smooth: 0.3,
          z: 5,
          lineStyle: { color: C.accent, width: 2.5, cap: "round", join: "round" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: alpha(C.accent, 0.22) },
                { offset: 1, color: alpha(C.accent, 0) },
              ],
            },
          },
          label: {
            show: true,
            position: "top",
            distance: 10,
            formatter: (p: { dataIndex: number }) =>
              p.dataIndex === elapsed - 1 ? compactMoney(last) : "",
            color: C.text,
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 700,
            textBorderColor: C.bg,
            textBorderWidth: 4,
          },
          markLine:
            budget !== null
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: alpha(C.text, 0.6), width: 1, type: "solid" },
                  label: {
                    position: "end",
                    formatter: `Budget ${compactMoney(budget)}`,
                    color: C.text,
                    fontFamily: FONT,
                    fontSize: 12,
                    fontWeight: 600,
                  },
                  data: [{ yAxis: budget }],
                }
              : undefined,
        },
      ],
    };
  }, [month, current, days, usual, projected, budget, money, elapsed, last, showProjection]);

  const summary = [
    `Spent ${money(last)} so far.`,
    usual && elapsed > 0
      ? `Usually ${money(usual[elapsed - 1]?.low ?? 0)} to ${money(usual[elapsed - 1]?.high ?? 0)} by this day.`
      : "",
    showProjection ? `Likely ${money(projected.mid)} by month end.` : "",
    budget !== null ? `Budget ${money(budget)}.` : "",
  ].join(" ");

  return (
    <figure className="m-0 flex flex-col gap-3">
      <EChart option={option} height={height} label={summary} />
      <Legend>
        <Key shape="line" className="bg-accent">
          This month
        </Key>
        {usual && (
          <Key shape="band" className="bg-ink/15">
            Your usual range
          </Key>
        )}
        {showProjection && (
          <Key shape="dash" className="border-accent/70">
            Likely
          </Key>
        )}
        {budget !== null && (
          <Key shape="line" className="bg-ink/60">
            Budget
          </Key>
        )}
      </Legend>
    </figure>
  );
}
