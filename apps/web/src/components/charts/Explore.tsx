// The exploratory charts: every expense as a bubble, the month as a treemap, the year as a
// calendar, how categories rank over time, and the savings-rate gauge.
import {
  type AnalyticsRow,
  type CategoryRank,
  daysInMonth,
  heatLevels,
  monthOf,
  type Ranked,
  shortDate,
} from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { alpha, axis, C, catColor, EChart, esc, FONT, type Option, tipHtml } from "./echarts";
import { compactMoney, shortMonth } from "./kit";

type ById = Map<string, Category>;
const nameOf = (c: Category | undefined) => (c ? `${c.emoji} ${c.name}` : "Unknown");

// ── Every expense as a bubble ───────────────────────────────────────────────

/**
 * Each expense this month as a bubble: day across, amount up (log scale, so a ₹50 coffee
 * and a ₹17,000 rent both fit), sized by amount, coloured by category. Big one-offs jump
 * out. Hovering a bubble lights up its category.
 */
export function ExpenseBubbles({
  rows,
  month,
  byId,
  height = 300,
}: {
  rows: AnalyticsRow[];
  month: string;
  byId: ById;
  height?: number;
}) {
  const money = useMoney();
  const expenses = useMemo(
    () => rows.filter((r) => r.type === "expense" && monthOf(r.date) === month && r.amount > 0),
    [rows, month],
  );

  const option = useMemo<Option>(() => {
    const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
    const max = Math.max(1, ...expenses.map((r) => r.amount));
    const groups = new Map<string, AnalyticsRow[]>();
    for (const r of expenses) groups.set(r.categoryId, [...(groups.get(r.categoryId) ?? []), r]);
    const size = (amount: number) => 8 + Math.sqrt(amount / max) * 34;

    return {
      grid: { left: 4, right: 12, top: 16, bottom: 44, containLabel: true },
      legend: {
        bottom: 0,
        left: 0,
        type: "scroll",
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        textStyle: { color: C.textMuted, fontFamily: FONT, fontSize: 12 },
        inactiveColor: C.surfaceStrong,
        pageTextStyle: { color: C.textMuted },
        pageIconColor: C.text,
        pageIconInactiveColor: C.textFaint,
      },
      xAxis: {
        type: "value",
        min: 0,
        max: days + 1,
        interval: 7,
        axisLine: { lineStyle: { color: alpha(C.borderStrong, 0.25) } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: C.textFaint,
          fontSize: 11,
          fontFamily: FONT,
          formatter: (v: number) => (v === 0 || v > days ? "" : String(v)),
        },
      },
      yAxis: {
        ...axis.value,
        type: "log",
        logBase: 10,
        min: (v: { min: number }) => Math.max(100, 10 ** Math.floor(Math.log10(v.min))),
        axisLabel: { ...axis.value.axisLabel, formatter: (v: number) => compactMoney(v) },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [number, number, string, string | null] }) => {
          const [day, amount, key, note] = p.data;
          const c = byId.get(key);
          const head = shortDate(`${month}-${String(day).padStart(2, "0")}`);
          return (
            tipHtml(head, [{ color: catColor(c?.color), value: money(amount), name: nameOf(c) }]) +
            (note
              ? `<div style="color:${C.textMuted};max-width:240px;white-space:normal;margin-top:4px">${esc(note)}</div>`
              : "")
          );
        },
      },
      series: [...groups].map(([key, list]) => {
        const c = byId.get(key);
        const color = catColor(c?.color);
        return {
          type: "scatter",
          name: nameOf(c),
          data: list.map((r) => [Number(r.date.slice(8, 10)), r.amount, key, r.note]),
          symbolSize: (d: [number, number]) => size(d[1]),
          itemStyle: { color: alpha(color, 0.7), borderColor: color, borderWidth: 1.5 },
          emphasis: { focus: "series", itemStyle: { color } },
          blur: { itemStyle: { opacity: 0.12 } },
        };
      }),
    };
  }, [expenses, month, byId, money]);

  return (
    <EChart
      option={option}
      height={height}
      label={`${expenses.length} expenses this month, each a bubble by day and amount.`}
    />
  );
}

// ── Treemap ─────────────────────────────────────────────────────────────────

/** The month's spending as blocks sized by amount, fixed costs grouped apart from flexible. */
export function SpendTreemap({
  split,
  byId,
  height = 300,
}: {
  split: { fixed: Ranked[]; flexible: Ranked[] };
  byId: ById;
  height?: number;
}) {
  const money = useMoney();
  const option = useMemo<Option>(() => {
    const total = [...split.fixed, ...split.flexible].reduce((t, r) => t + r.amount, 0) || 1;
    const leaf = (r: Ranked) => {
      const c = byId.get(r.key);
      const color = catColor(c?.color);
      return {
        name: nameOf(c),
        value: r.amount,
        itemStyle: { color: alpha(color, 0.3), borderColor: alpha(color, 0.7) },
        emphasis: { itemStyle: { color: alpha(color, 0.5) } },
      };
    };
    const groups = [
      { name: "Flexible", list: split.flexible },
      { name: "Fixed", list: split.fixed },
    ].filter((g) => g.list.length > 0);
    const data =
      groups.length > 1
        ? groups.map((g) => ({ name: g.name, children: g.list.map(leaf) }))
        : (groups[0]?.list ?? []).map(leaf);

    return {
      tooltip: {
        trigger: "item",
        formatter: (p: { name: string; value: number; data: { children?: unknown } }) =>
          tipHtml(p.name, [
            { value: money(p.value), name: `${Math.round((p.value / total) * 100)}% of spending` },
          ]),
      },
      series: [
        {
          type: "treemap",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          squareRatio: 1.2,
          label: {
            show: true,
            position: "insideTopLeft",
            padding: [8, 10],
            overflow: "truncate",
            formatter: (p: { name: string; value: number }) =>
              `{n|${esc(p.name)}}\n{v|${compactMoney(p.value)}}  {p|${Math.round((p.value / total) * 100)}%}`,
            rich: {
              n: { color: C.text, fontSize: 13, fontWeight: 700, fontFamily: FONT, lineHeight: 20 },
              v: { color: C.text, fontSize: 12, fontFamily: FONT },
              p: { color: C.textMuted, fontSize: 12, fontFamily: FONT },
            },
          },
          upperLabel: {
            show: groups.length > 1,
            height: 24,
            color: C.textMuted,
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 700,
            formatter: (p: { name: string }) => p.name.toUpperCase(),
          },
          itemStyle: { borderColor: C.bg, borderWidth: 2, gapWidth: 2, borderRadius: 8 },
          levels:
            groups.length > 1
              ? [
                  {
                    itemStyle: {
                      borderColor: C.bg,
                      borderWidth: 0,
                      gapWidth: 6,
                      color: "transparent",
                    },
                  },
                  { itemStyle: { borderWidth: 1.5, gapWidth: 4, borderRadius: 8 } },
                ]
              : [{ itemStyle: { borderWidth: 1.5, gapWidth: 4, borderRadius: 8 } }],
          data,
        },
      ],
    };
  }, [split, byId, money]);

  return (
    <EChart
      option={option}
      height={height}
      label="This month's spending by category, as blocks sized by amount."
    />
  );
}

// ── Year calendar ───────────────────────────────────────────────────────────

/** Twelve months of days, shaded by what was spent: one hue, more spent, more lime. */
export function YearCalendar({
  daily,
  from,
  to,
}: {
  daily: Map<string, number>;
  /** First and last date shown. */
  from: string;
  to: string;
}) {
  const money = useMoney();
  const option = useMemo<Option>(() => {
    const data = [...daily].filter(([d]) => d >= from && d <= to);
    const cuts = heatLevels(data.map(([, v]) => v));
    const steps = [0.22, 0.42, 0.7, 1];
    return {
      tooltip: {
        trigger: "item",
        formatter: (p: { data: [string, number] }) =>
          tipHtml(shortDate(p.data[0]), [
            { color: C.accent, value: money(p.data[1]), name: "spent" },
          ]),
      },
      visualMap: {
        show: false,
        type: "piecewise",
        pieces: [
          { lte: cuts[0], color: alpha(C.accent, steps[0] ?? 0.2) },
          { gt: cuts[0], lte: cuts[1], color: alpha(C.accent, steps[1] ?? 0.4) },
          { gt: cuts[1], lte: cuts[2], color: alpha(C.accent, steps[2] ?? 0.7) },
          { gt: cuts[2], color: C.accent },
        ],
      },
      calendar: {
        range: [from, to],
        left: 28,
        right: 4,
        top: 22,
        bottom: 4,
        cellSize: ["auto", 15],
        splitLine: { show: false },
        itemStyle: { color: C.surface, borderColor: C.bg, borderWidth: 3 },
        dayLabel: {
          firstDay: 1,
          nameMap: ["S", "M", "T", "W", "T", "F", "S"],
          color: C.textFaint,
          fontFamily: FONT,
          fontSize: 10,
        },
        monthLabel: { color: C.textMuted, fontFamily: FONT, fontSize: 11, fontWeight: 600 },
        yearLabel: { show: false },
      },
      series: [
        {
          type: "heatmap",
          coordinateSystem: "calendar",
          data,
          itemStyle: { borderColor: C.bg, borderWidth: 3, borderRadius: 3 },
          emphasis: { itemStyle: { borderColor: C.text, borderWidth: 1.5 } },
        },
      ],
    };
  }, [daily, from, to, money]);

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div className="min-w-[760px]">
        <EChart
          option={option}
          height={160}
          label="Spending per day over the last twelve months."
        />
      </div>
    </div>
  );
}

// ── Category ranking over time ─────────────────────────────────────────────

/** How the biggest categories climb and fall in rank, month by month. */
export function CategoryBump({
  ranks,
  months,
  byId,
  height = 280,
}: {
  ranks: CategoryRank[];
  months: string[];
  byId: ById;
  height?: number;
}) {
  const money = useMoney();
  const option = useMemo<Option>(() => {
    const deepest = Math.max(
      ranks.length,
      ...ranks.flatMap((r) => r.ranks.filter((x): x is number => x !== null)),
    );
    return {
      grid: { left: 4, right: 132, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        ...axis.category,
        boundaryGap: false,
        data: months.map(shortMonth),
        axisLine: { show: false },
      },
      yAxis: {
        type: "value",
        inverse: true,
        min: 1,
        max: deepest,
        interval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: C.border } },
        axisLabel: { color: C.textFaint, fontSize: 11, fontFamily: FONT, formatter: "#{value}" },
      },
      tooltip: {
        trigger: "item",
        formatter: (p: { seriesIndex: number; dataIndex: number }) => {
          const r = ranks[p.seriesIndex];
          const c = byId.get(r?.key ?? "");
          return tipHtml(`${nameOf(c)} · ${shortMonth(months[p.dataIndex] ?? "")}`, [
            { color: catColor(c?.color), value: `#${r?.ranks[p.dataIndex]}`, name: "rank" },
            { value: money(r?.totals[p.dataIndex] ?? 0), name: "spent" },
          ]);
        },
      },
      series: ranks.map((r) => {
        const c = byId.get(r.key);
        const color = catColor(c?.color);
        return {
          type: "line",
          name: nameOf(c),
          data: r.ranks,
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 11,
          lineStyle: { width: 3, color, cap: "round" },
          itemStyle: { color, borderColor: C.bg, borderWidth: 2 },
          emphasis: { focus: "series", lineStyle: { width: 4 } },
          blur: { lineStyle: { opacity: 0.12 }, itemStyle: { opacity: 0.12 } },
          endLabel: {
            show: true,
            formatter: nameOf(c),
            color: C.text,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            distance: 10,
          },
          labelLayout: { hideOverlap: true },
        };
      }),
    };
  }, [ranks, months, byId, money]);

  return (
    <EChart
      option={option}
      height={height}
      label="How your biggest categories ranked each month."
    />
  );
}

// ── Savings-rate gauge ──────────────────────────────────────────────────────

/** This month's share of income invested as a bold arc, with a tick at your usual share. */
export function RateGauge({ rate, usual }: { rate: number; usual: number | null }) {
  const option = useMemo<Option>(() => {
    const top = Math.max(0.5, Math.ceil(Math.max(rate, usual ?? 0) * 10) / 10 + 0.1);
    const ring = {
      type: "gauge",
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: top * 100,
      radius: "92%",
      center: ["50%", "58%"],
      splitLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
    };
    return {
      series: [
        {
          ...ring,
          progress: { show: true, width: 16, roundCap: true, itemStyle: { color: C.accent } },
          axisLine: { roundCap: true, lineStyle: { width: 16, color: [[1, C.surfaceStrong]] } },
          pointer: { show: false },
          anchor: { show: false },
          title: {
            offsetCenter: [0, "34%"],
            color: C.textMuted,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
          },
          detail: {
            offsetCenter: [0, "2%"],
            valueAnimation: true,
            formatter: (v: number) => `${Math.round(v)}%`,
            color: C.text,
            fontFamily: FONT,
            fontSize: 34,
            fontWeight: 700,
          },
          data: [{ value: Math.round(rate * 100), name: "of income" }],
        },
        ...(usual !== null
          ? [
              {
                ...ring,
                silent: true,
                axisLine: { show: false },
                progress: { show: false },
                anchor: { show: false },
                title: { show: false },
                detail: { show: false },
                pointer: {
                  icon: "rect",
                  width: 3,
                  length: 26,
                  offsetCenter: [0, "-82%"],
                  itemStyle: { color: C.text },
                },
                data: [{ value: Math.round(usual * 100) }],
              },
            ]
          : []),
      ],
    };
  }, [rate, usual]);

  return (
    <EChart
      option={option}
      height={190}
      label={`${Math.round(rate * 100)}% of income invested${usual !== null ? `, usually ${Math.round(usual * 100)}%` : ""}.`}
    />
  );
}
