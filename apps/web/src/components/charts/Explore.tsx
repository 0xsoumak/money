// A donut of where spending usually goes, and the savings-rate gauge.
import { OTHER, type Ranked } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { C, catColor, EChart, FONT, type Option, tipHtml } from "./echarts";
import { compactMoney } from "./kit";

type ById = Map<string, Category>;
const nameOf = (c: Category | undefined) => (c ? `${c.emoji} ${c.name}` : "Unknown");

// ── Category share ──────────────────────────────────────────────────────────

/**
 * Where spending usually goes, as a donut with gaps between slices: the total in the
 * middle, and each category's amount and share listed under it.
 */
export function CategoryDonut({ share, byId }: { share: Ranked[]; byId: ById }) {
  const money = useMoney();
  const total = share.reduce((t, r) => t + r.amount, 0) || 1;
  const slices = useMemo(
    () =>
      share.map((r) => {
        const c = byId.get(r.key);
        return {
          key: r.key,
          name: r.key === OTHER ? "The rest" : nameOf(c),
          value: r.amount,
          color: catColor(r.key === OTHER ? "slate" : c?.color),
        };
      }),
    [share, byId],
  );

  const option = useMemo<Option>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: (p: { name: string; value: number; color: string }) =>
          tipHtml(p.name, [
            {
              color: p.color,
              value: money(p.value),
              name: `${Math.round((p.value / total) * 100)}%`,
            },
          ]),
      },
      series: [
        {
          type: "pie",
          radius: ["62%", "90%"],
          center: ["50%", "50%"],
          padAngle: 3,
          minAngle: 3,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderRadius: 6 },
          emphasis: { scale: true, scaleSize: 6 },
          data: slices.map((s) => ({
            name: s.name,
            value: s.value,
            itemStyle: { color: s.color },
          })),
        },
      ],
    }),
    [slices, total, money],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <EChart
          option={option}
          height={300}
          label={`Spending by category: ${slices.map((s) => `${s.name} ${Math.round((s.value / total) * 100)}%`).join(", ")}.`}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[13px] font-semibold text-muted">Spent</span>
          <span className="text-3xl font-bold tracking-[-0.02em]">{compactMoney(total)}</span>
        </div>
      </div>
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {slices.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[auto_1fr_auto_3rem] items-center gap-3 border-b border-line py-2.5 text-sm"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="truncate font-semibold">{s.name}</span>
            <span className="tabular-nums">{money(s.value)}</span>
            <span className="text-right tabular-nums text-muted">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
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
