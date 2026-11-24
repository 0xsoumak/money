import { monthTitle } from "@money/shared";
import { useMemo } from "react";
import { alpha, axis, C, EChart, FONT, type Option, type TipLine, tipHtml } from "./echarts";
import { compactMoney, shortMonth } from "./kit";

export interface MonthRow {
  month: string;
  /** Stacked left to right, e.g. fixed then flexible. */
  parts: { value: number; color: string }[];
  current?: boolean;
  /** A dashed outline past the bar, up to this total: where a running month may end. */
  ghost?: number;
  /** Printed at the end of the bar. */
  label: string;
  tip: TipLine[];
}

/**
 * Months as horizontal bars, oldest at the top, each with its amount at the end so the
 * page reads like a list. Optional: a shaded band (the usual range) and a budget line.
 * Hovering reads out the month; clicking opens it.
 */
export function MonthRows({
  rows,
  band,
  limit,
  label,
  onPick,
}: {
  rows: MonthRow[];
  band?: { low: number; high: number } | null;
  limit?: number | null;
  label: string;
  onPick?: (month: string) => void;
}) {
  const option = useMemo<Option>(() => {
    const total = (r: MonthRow) => r.parts.reduce((t, p) => t + p.value, 0);
    const pieces = Math.max(1, ...rows.map((r) => r.parts.length));
    const lastPiece = rows.map((r) => {
      for (let k = r.parts.length - 1; k >= 0; k--) if ((r.parts[k]?.value ?? 0) > 0) return k;
      return -1;
    });
    const hasGhost = (r: MonthRow) => r.ghost !== undefined && r.ghost > total(r);
    const bar = { type: "bar", stack: "m", barWidth: 22, emphasis: { disabled: true } } as const;
    const outline = {
      color: "transparent",
      borderColor: alpha(C.borderStrong, 0.45),
      borderWidth: 1.5,
      borderType: [3, 3],
      borderRadius: [0, 5, 5, 0],
    };

    const partSeries = Array.from({ length: pieces }, (_, k) => ({
      ...bar,
      data: rows.map((r, i) => {
        const p = r.parts[k];
        if (!p || p.value <= 0) return { value: 0, itemStyle: { opacity: 0 } };
        const end = lastPiece[i] === k && !hasGhost(r);
        return {
          value: p.value,
          itemStyle: {
            color: p.color,
            borderRadius: end ? [0, 5, 5, 0] : 0,
            borderColor: C.bg,
            borderWidth: k > 0 ? 1 : 0,
          },
        };
      }),
      ...(k === 0
        ? {
            markArea:
              band && band.high > 0
                ? {
                    silent: true,
                    itemStyle: { color: alpha(C.text, 0.06) },
                    data: [[{ xAxis: band.low }, { xAxis: band.high }]],
                  }
                : undefined,
            markLine: limit
              ? {
                  silent: true,
                  symbol: "none",
                  label: { show: false },
                  lineStyle: { color: alpha(C.text, 0.7), width: 1.5, type: [4, 4] },
                  data: [{ xAxis: limit }],
                }
              : undefined,
          }
        : {}),
    }));

    return {
      grid: { left: 4, right: 72, top: 8, bottom: 4, containLabel: true },
      yAxis: {
        ...axis.category,
        inverse: true,
        axisLine: { show: false },
        data: rows.map((r) => r.month),
        axisLabel: {
          ...axis.category.axisLabel,
          margin: 14,
          formatter: (m: string, i: number) =>
            `{${rows[i]?.current ? "cur" : "m"}|${shortMonth(m)}}`,
          rich: {
            m: { color: C.textMuted, fontWeight: 600, fontSize: 13, fontFamily: FONT },
            cur: { color: C.text, fontWeight: 700, fontSize: 13, fontFamily: FONT },
          },
        },
      },
      xAxis: {
        ...axis.value,
        splitNumber: 4,
        axisLabel: {
          ...axis.value.axisLabel,
          formatter: (v: number) => (v ? compactMoney(v) : ""),
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: alpha(C.text, 0.05) } },
        formatter: (ps: { dataIndex: number }[]) => {
          const r = rows[ps[0]?.dataIndex ?? 0];
          return r ? tipHtml(monthTitle(r.month), r.tip) : "";
        },
      },
      series: [
        ...partSeries,
        {
          ...bar,
          data: rows.map((r) =>
            hasGhost(r)
              ? { value: (r.ghost ?? 0) - total(r), itemStyle: outline }
              : { value: 0, itemStyle: { opacity: 0 } },
          ),
        },
        // The amount at the end of each bar, on an invisible scatter at the bar's end.
        {
          type: "scatter",
          symbolSize: 0,
          silent: true,
          z: 5,
          data: rows.map((r) => Math.max(total(r), r.ghost ?? 0)),
          label: {
            show: true,
            position: "right",
            distance: 10,
            formatter: (p: { dataIndex: number }) => rows[p.dataIndex]?.label ?? "",
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
          },
        },
      ],
    };
  }, [rows, band, limit]);

  return (
    <EChart
      option={option}
      height={rows.length * 42 + 36}
      label={label}
      onClick={
        onPick
          ? (p) => {
              const r = rows[p.dataIndex];
              if (r) onPick(r.month);
            }
          : undefined
      }
    />
  );
}
