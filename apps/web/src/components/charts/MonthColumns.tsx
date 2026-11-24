import { monthTitle } from "@money/shared";
import { useMemo } from "react";
import { alpha, axis, C, EChart, FONT, type Option, type TipLine, tipHtml } from "./echarts";
import { compactMoney, shortMonth } from "./kit";

/** One stacked piece of a column, drawn bottom to top. */
export interface ColumnPart {
  value: number;
  color: string;
}

export interface Column {
  month: string;
  parts: ColumnPart[];
  current?: boolean;
  /** A dashed outline above the column, up to this total: where a running month may end. */
  ghost?: number;
  /** A short bar across the column at this value, e.g. income. */
  marker?: number;
  /** An empty dashed slot: nothing happened, and that matters (a missed investment). */
  missing?: boolean;
  /** Printed above the column. Use sparingly: the current month, an extreme. */
  label?: string;
  /** A second line under the month name. */
  sub?: { text: string; tone?: "danger" };
  tip: TipLine[];
}

/**
 * Months as columns on one baseline. Optional extras: a shaded band (the usual range),
 * a limit line (the budget), a marker per column (income), a dashed ghost (projection).
 * Hovering a month reads out all of it; clicking opens that month.
 */
export function MonthColumns({
  columns,
  band,
  limit,
  height = 240,
  label,
  onPick,
}: {
  columns: Column[];
  band?: { low: number; high: number } | null;
  limit?: { value: number; label: string } | null;
  height?: number;
  label: string;
  onPick?: (month: string) => void;
}) {
  const option = useMemo<Option>(() => {
    const total = (c: Column) => c.parts.reduce((t, p) => t + p.value, 0);
    const max = Math.max(
      1,
      ...columns.map((c) => Math.max(total(c), c.ghost ?? 0, c.marker ?? 0)),
      band?.high ?? 0,
      limit?.value ?? 0,
    );
    const pieces = Math.max(...columns.map((c) => c.parts.length), 1);
    // Only the topmost non-empty piece of each column gets the rounded data end.
    const topIndex = columns.map((c) => {
      for (let k = c.parts.length - 1; k >= 0; k--) if ((c.parts[k]?.value ?? 0) > 0) return k;
      return -1;
    });
    const bar = { type: "bar", stack: "col", barMaxWidth: 24, barMinHeight: 0 } as const;

    const partSeries = Array.from({ length: pieces }, (_, k) => ({
      ...bar,
      name: `part${k}`,
      data: columns.map((c, i) => {
        const p = c.parts[k];
        if (!p || p.value <= 0) return { value: 0, itemStyle: { opacity: 0 } };
        return {
          value: p.value,
          itemStyle: {
            color: p.color,
            borderRadius: topIndex[i] === k && !(c.ghost && c.ghost > total(c)) ? [4, 4, 0, 0] : 0,
            // A hairline in the page colour separates stacked pieces.
            borderColor: C.bg,
            borderWidth: k > 0 ? 1 : 0,
          },
        };
      }),
      emphasis: { disabled: true },
      ...(k === 0
        ? {
            markArea:
              band && band.high > 0
                ? {
                    silent: true,
                    itemStyle: { color: alpha(C.text, 0.07) },
                    data: [[{ yAxis: band.low }, { yAxis: band.high }]],
                  }
                : undefined,
            markLine: limit
              ? {
                  silent: true,
                  symbol: "none",
                  lineStyle: { color: alpha(C.text, 0.6), width: 1, type: "solid" },
                  label: {
                    position: "insideEndTop",
                    formatter: limit.label,
                    color: C.text,
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 600,
                  },
                  data: [{ yAxis: limit.value }],
                }
              : undefined,
          }
        : {}),
    }));

    const outline = {
      color: "transparent",
      borderColor: alpha(C.borderStrong, 0.4),
      borderWidth: 1.5,
      borderType: [3, 3],
      borderRadius: [4, 4, 0, 0],
    };

    return {
      grid: { left: 4, right: 8, top: 30, bottom: 4, containLabel: true },
      xAxis: {
        ...axis.category,
        data: columns.map((c) => c.month),
        axisLabel: {
          ...axis.category.axisLabel,
          interval: 0,
          lineHeight: 16,
          formatter: (m: string, i: number) => {
            const c = columns[i];
            const name = `{${c?.current ? "cur" : "m"}|${shortMonth(m)}}`;
            return c?.sub
              ? `${name}\n{${c.sub.tone === "danger" ? "neg" : "s"}|${c.sub.text}}`
              : name;
          },
          rich: {
            m: { color: C.textMuted, fontWeight: 600, fontSize: 12, fontFamily: FONT },
            cur: { color: C.text, fontWeight: 700, fontSize: 12, fontFamily: FONT },
            s: { color: C.textMuted, fontSize: 11, fontFamily: FONT },
            neg: { color: C.danger, fontSize: 11, fontWeight: 600, fontFamily: FONT },
          },
        },
      },
      yAxis: {
        ...axis.value,
        max: (v: { max: number }) => Math.max(v.max, max * 1.08),
        axisLabel: {
          ...axis.value.axisLabel,
          formatter: (v: number) => (v ? compactMoney(v) : ""),
        },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: alpha(C.text, 0.05) } },
        formatter: (ps: { dataIndex: number }[]) => {
          const c = columns[ps[0]?.dataIndex ?? 0];
          return c ? tipHtml(monthTitle(c.month), c.tip) : "";
        },
      },
      series: [
        ...partSeries,
        // Where a running month may end: a dashed outline stacked on top.
        {
          ...bar,
          name: "ghost",
          data: columns.map((c) =>
            c.ghost && c.ghost > total(c)
              ? { value: c.ghost - total(c), itemStyle: outline }
              : { value: 0, itemStyle: { opacity: 0 } },
          ),
          emphasis: { disabled: true },
        },
        // A month where nothing happened, drawn as an empty dashed slot.
        {
          ...bar,
          name: "missing",
          data: columns.map((c) =>
            c.missing
              ? { value: max * 0.3, itemStyle: outline }
              : { value: 0, itemStyle: { opacity: 0 } },
          ),
          emphasis: { disabled: true },
        },
        // Markers (income) and labels ride on a scatter series so they sit at exact values.
        {
          type: "scatter",
          name: "marker",
          symbol: "roundRect",
          symbolSize: [34, 3.5],
          itemStyle: { color: C.text },
          z: 4,
          data: columns.map((c) => (c.marker && c.marker > 0 ? c.marker : null)),
          emphasis: { disabled: true },
        },
        {
          type: "scatter",
          name: "label",
          symbolSize: 0,
          silent: true,
          z: 5,
          data: columns.map((c) =>
            c.label
              ? Math.max(total(c), c.ghost ?? 0, c.marker ?? 0, c.missing ? max * 0.3 : 0)
              : null,
          ),
          label: {
            show: true,
            position: "top",
            distance: 8,
            formatter: (p: { dataIndex: number }) => columns[p.dataIndex]?.label ?? "",
            color: C.text,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            textBorderColor: C.bg,
            textBorderWidth: 4,
          },
        },
      ],
    };
  }, [columns, band, limit]);

  return (
    <EChart
      option={option}
      height={height}
      label={label}
      onClick={
        onPick
          ? (p) => {
              const c = columns[p.dataIndex];
              if (c) onPick(c.month);
            }
          : undefined
      }
    />
  );
}
