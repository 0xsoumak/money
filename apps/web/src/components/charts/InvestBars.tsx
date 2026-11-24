import { monthTitle } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import { alpha, axis, C, EChart, FONT, type Option, tipHtml } from "./echarts";
import { compactMoney, shortMonth } from "./kit";

/**
 * Invested per month as bold columns: the month being viewed in lime, the rest in grey,
 * the amount printed on every month that had one. Empty months leave a faint stub on the
 * baseline so the gap reads as "nothing" rather than missing data. Click to open a month.
 */
export function InvestBars({
  months,
  current,
  onPick,
  height = 320,
}: {
  months: { month: string; invested: number }[];
  current: string;
  onPick?: (month: string) => void;
  height?: number;
}) {
  const money = useMoney();
  const option = useMemo<Option>(() => {
    const max = Math.max(1, ...months.map((m) => m.invested));
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
          return tipHtml(monthTitle(m.month), [
            {
              color: m.month === current ? C.accent : C.textMuted,
              value: m.invested > 0 ? money(m.invested) : "Nothing",
              name: "invested",
            },
          ]);
        },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 44,
          barMinHeight: 3,
          data: months.map((m) => ({
            value: m.invested,
            itemStyle: {
              color:
                m.invested <= 0
                  ? alpha(C.text, 0.12)
                  : m.month === current
                    ? C.accent
                    : alpha(C.text, 0.42),
              borderRadius: [8, 8, 0, 0],
            },
            label: {
              show: m.invested > 0,
              position: "top",
              distance: 8,
              formatter: () => compactMoney(m.invested),
              color: m.month === current ? C.text : C.textMuted,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
            },
          })),
          emphasis: { itemStyle: { color: C.accent } },
        },
      ],
    };
  }, [months, current, money]);

  const total = months.reduce((t, m) => t + m.invested, 0);
  return (
    <EChart
      option={option}
      height={height}
      label={`Invested by month: ${money(total)} over ${months.length} months.`}
      onClick={
        onPick
          ? (p) => {
              const m = months[p.dataIndex];
              if (m) onPick(m.month);
            }
          : undefined
      }
    />
  );
}
