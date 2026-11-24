import { type SpendCurve as Curve, shortDate } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import { alpha, axis, C, EChart, FONT, type Option, type TipLine, tipHtml } from "./echarts";
import { compactMoney } from "./kit";

/**
 * The spend curve: this month's running total against last month, the average of recent
 * months and the budget, each labelled at the right edge. Hover reads out all of them for a day.
 */
export function SpendCurve({
  month,
  curve,
  budget,
  height = 300,
}: {
  month: string;
  curve: Curve;
  budget: number | null;
  height?: number;
}) {
  const money = useMoney();

  const option = useMemo<Option>(() => {
    const span = Math.max(curve.days, curve.previous.length);
    const dayList = Array.from({ length: span }, (_, i) => i + 1);
    const last = curve.current.at(-1);
    const date = (d: number) => shortDate(`${month}-${String(d).padStart(2, "0")}`);
    const endLabel = (text: string, color: string) => ({
      show: true,
      formatter: text,
      color,
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 600,
      distance: 10,
    });

    return {
      grid: { left: 4, right: 118, top: 30, bottom: 4, containLabel: true },
      xAxis: {
        ...axis.category,
        data: dayList,
        boundaryGap: false,
        axisLabel: {
          ...axis.category.axisLabel,
          color: C.textFaint,
          fontSize: 11,
          fontWeight: 500,
          interval: (i: number) => i % 7 === 0,
        },
      },
      yAxis: {
        ...axis.value,
        splitNumber: 4,
        axisLabel: { ...axis.value.axisLabel, formatter: (v: number) => compactMoney(v) },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: alpha(C.text, 0.4), width: 1 } },
        formatter: (ps: { dataIndex: number }[]) => {
          const i = ps[0]?.dataIndex ?? 0;
          const at = (arr: number[] | null) => (arr && i < arr.length ? arr[i] : undefined);
          const lines: TipLine[] = [];
          const now = at(curve.current);
          lines.push({
            color: C.accent,
            value: now !== undefined ? money(now) : "–",
            name: "this month",
          });
          if (curve.previous.length > 0)
            lines.push({
              color: C.textMuted,
              value: money(at(curve.previous) ?? curve.previous.at(-1) ?? 0),
              name: "last month",
            });
          const avg = at(curve.average);
          if (avg !== undefined)
            lines.push({ color: C.textFaint, value: money(avg), name: "usual" });
          if (budget !== null)
            lines.push({ color: alpha(C.text, 0.6), value: money(budget), name: "budget" });
          return tipHtml(date(i + 1), lines);
        },
      },
      series: [
        ...(curve.average
          ? [
              {
                type: "line",
                name: "Usual",
                data: curve.average,
                symbol: "none",
                silent: true,
                lineStyle: { color: C.textFaint, width: 2, type: [5, 4] },
                endLabel: endLabel(`Usual ${compactMoney(curve.average.at(-1) ?? 0)}`, C.textFaint),
              },
            ]
          : []),
        {
          type: "line",
          name: "Last month",
          data: curve.previous,
          symbol: "none",
          silent: true,
          lineStyle: { color: C.textMuted, width: 2 },
          endLabel: endLabel(`Last month ${compactMoney(curve.previous.at(-1) ?? 0)}`, C.textMuted),
        },
        {
          type: "line",
          name: "This month",
          data: curve.current,
          symbol: "circle",
          symbolSize: (_: number, p: { dataIndex: number }) =>
            p.dataIndex === curve.current.length - 1 ? 12 : 0,
          showSymbol: true,
          itemStyle: { color: C.accent, borderColor: C.bg, borderWidth: 2 },
          z: 5,
          lineStyle: { color: C.accent, width: 3, cap: "round", join: "round" },
          label: {
            show: true,
            position: "top",
            distance: 12,
            formatter: (p: { dataIndex: number }) =>
              p.dataIndex === curve.current.length - 1 && last !== undefined ? money(last) : "",
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
                  lineStyle: { color: C.textMuted, width: 1.5, type: [2, 4] },
                  label: {
                    position: "end",
                    distance: 10,
                    formatter: `Budget ${compactMoney(budget)}`,
                    color: C.textMuted,
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
  }, [month, curve, budget, money]);

  const label = `Running total by day. This month ${money(curve.current.at(-1) ?? 0)} after ${curve.elapsed} days; last month ${money(curve.previous.at(-1) ?? 0)}${budget !== null ? `; budget ${money(budget)}` : ""}.`;
  return <EChart option={option} height={height} label={label} />;
}
