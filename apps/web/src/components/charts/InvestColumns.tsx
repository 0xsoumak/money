import { monthTitle } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import { alpha, axis, C, EChart, FONT, type Option, type TipLine, tipHtml } from "./echarts";
import { compactMoney, shortMonth } from "./kit";

export interface InvestMonth {
  month: string;
  invested: number;
  /** Share of income invested; null without income. */
  rate: number | null;
  current: boolean;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Invested per month as bold columns: this month in lime, earlier months a dimmer lime,
 * a month with nothing invested a short grey stub so the gap still reads. The amount sits
 * on top; under each month, the share of income. Click a column to open that month.
 */
export function InvestColumns({
  months,
  onPick,
  height = 240,
}: {
  months: InvestMonth[];
  onPick?: (month: string) => void;
  height?: number;
}) {
  const money = useMoney();

  const option = useMemo<Option>(() => {
    const max = Math.max(1, ...months.map((m) => m.invested));
    // Without income there is no share to show: drop the line rather than print dashes.
    const rates = months.some((m) => m.rate !== null);
    // Twelve columns are narrow: print amounts only on this month and the biggest one.
    const dense = months.length > 6;
    const stub = max * 0.025;

    return {
      grid: { left: 0, right: 0, top: 28, bottom: 0, containLabel: true },
      xAxis: {
        ...axis.category,
        data: months.map((m) => m.month),
        axisLabel: {
          ...axis.category.axisLabel,
          interval: 0,
          lineHeight: 17,
          formatter: (month: string) => {
            const m = months.find((x) => x.month === month);
            const name = `{${m?.current ? "cur" : "m"}|${shortMonth(month)}}`;
            return rates && m ? `${name}\n{r|${m.rate !== null ? pct(m.rate) : "–"}}` : name;
          },
          rich: {
            m: { color: C.textMuted, fontWeight: 600, fontSize: 12, fontFamily: FONT },
            cur: { color: C.text, fontWeight: 700, fontSize: 12, fontFamily: FONT },
            r: { color: C.textFaint, fontSize: 11, fontFamily: FONT },
          },
        },
      },
      yAxis: { ...axis.value, show: false, max: max * 1.1 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: alpha(C.text, 0.05) } },
        formatter: (ps: { dataIndex: number }[]) => {
          const m = months[ps[0]?.dataIndex ?? 0];
          if (!m) return "";
          const lines: TipLine[] = [
            { value: m.invested > 0 ? money(m.invested) : "Nothing", name: "invested" },
            ...(m.rate !== null ? [{ value: pct(m.rate), name: "of income" }] : []),
          ];
          return tipHtml(monthTitle(m.month), lines);
        },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 56,
          barCategoryGap: "28%",
          emphasis: { disabled: true },
          data: months.map((m) => {
            const empty = m.invested <= 0;
            return {
              value: empty ? stub : m.invested,
              itemStyle: {
                color: empty ? alpha(C.text, 0.12) : m.current ? C.accent : alpha(C.accent, 0.55),
                borderRadius: empty ? 4 : [10, 10, 4, 4],
              },
              label: {
                show: !empty && (!dense || m.current || m.invested === max),
                position: "top",
                distance: 8,
                formatter: () => compactMoney(m.invested),
                color: m.current ? C.text : C.textMuted,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
              },
            };
          }),
        },
      ],
    };
  }, [months, money]);

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
