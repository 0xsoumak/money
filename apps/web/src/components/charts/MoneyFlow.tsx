import { type MoneyFlow as Flow, OTHER } from "@money/shared";
import { useMemo } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { alpha, C, catColor, EChart, esc, FONT, type Option, tipHtml } from "./echarts";

const pct = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "";

/**
 * Where the month's money went: income on the left splits into spent, invested and kept;
 * spending splits again into categories. If more went out than came in, the difference
 * flows in from savings, in red. Hover a band to follow it end to end.
 */
export function MoneyFlow({ flow, byId }: { flow: Flow; byId: Map<string, Category> }) {
  const money = useMoney();

  const option = useMemo<Option>(() => {
    const fromSavings = flow.shortfall;
    const savedToSpent = Math.min(fromSavings, flow.spent);
    const savedToInvested = fromSavings - savedToSpent;
    const whole = flow.income + fromSavings;

    type Node = {
      name: string;
      color: string;
      value: number;
      label?: string;
      side: "left" | "right";
    };
    const nodes: Node[] = [];
    const links: { source: string; target: string; value: number }[] = [];
    const add = (n: Node) => n.value > 0 && nodes.push(n);
    const link = (source: string, target: string, value: number) =>
      value > 0 && links.push({ source, target, value });

    add({ name: "Income", color: C.text, value: flow.income, side: "left" });
    add({ name: "From savings", color: C.danger, value: fromSavings, side: "left" });
    add({ name: "Spent", color: alpha(C.text, 0.55), value: flow.spent, side: "right" });
    add({ name: "Invested", color: C.accent, value: flow.invested, side: "right" });
    add({ name: "Kept", color: C.success, value: flow.kept, side: "right" });
    link("Income", "Spent", flow.spent - savedToSpent);
    link("Income", "Invested", flow.invested - savedToInvested);
    link("Income", "Kept", flow.kept);
    link("From savings", "Spent", savedToSpent);
    link("From savings", "Invested", savedToInvested);

    // Category nodes are keyed by id so two categories with the same name never merge.
    const catName = new Map<string, string>();
    for (const s of flow.spending) {
      const c = byId.get(s.key);
      const id = `cat:${s.key}`;
      const name =
        s.key === OTHER ? "The rest" : `${c?.emoji ?? ""} ${c?.name ?? "Unknown"}`.trim();
      catName.set(id, name);
      add({
        name: id,
        label: name,
        color: catColor(s.key === OTHER ? "slate" : c?.color),
        value: s.amount,
        side: "right",
      });
      link("Spent", id, s.amount);
    }
    const colorOf = new Map(nodes.map((n) => [n.name, n.color]));
    const nameOf = (id: string) => catName.get(id) ?? id;

    return {
      tooltip: {
        trigger: "item",
        formatter: (p: {
          dataType: string;
          data: { name?: string; source?: string; target?: string; value: number };
        }) => {
          const d = p.data;
          if (p.dataType === "edge")
            return tipHtml(`${nameOf(d.source ?? "")} → ${nameOf(d.target ?? "")}`, [
              {
                color: colorOf.get(d.target ?? ""),
                value: money(d.value),
                name: pct(d.value, whole),
              },
            ]);
          return tipHtml(nameOf(d.name ?? ""), [
            {
              color: colorOf.get(d.name ?? ""),
              value: money(d.value),
              name: whole ? `${pct(d.value, whole)} of what came in` : "",
            },
          ]);
        },
      },
      series: [
        {
          type: "sankey",
          left: 110,
          right: 190,
          top: 12,
          bottom: 12,
          nodeWidth: 10,
          nodeGap: 14,
          nodeAlign: "left",
          layoutIterations: 0,
          draggable: false,
          emphasis: { focus: "adjacency" },
          blur: { lineStyle: { opacity: 0.08 }, itemStyle: { opacity: 0.3 } },
          lineStyle: { curveness: 0.5, opacity: 0.3 },
          label: {
            color: C.text,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            distance: 10,
            textBorderColor: C.bg,
            textBorderWidth: 3,
            formatter: (p: { name: string; value: number }) =>
              `{n|${esc(nameOf(p.name))}}\n{v|${money(p.value)}}  {p|${pct(p.value, whole)}}`,
            rich: {
              n: { color: C.text, fontWeight: 700, fontSize: 13, fontFamily: FONT, lineHeight: 18 },
              v: { color: C.text, fontSize: 12, fontFamily: FONT },
              p: { color: C.textMuted, fontSize: 12, fontFamily: FONT },
            },
          },
          data: nodes.map((n) => ({
            name: n.name,
            value: n.value,
            itemStyle: { color: n.color, borderWidth: 0, borderRadius: 3 },
            label: n.side === "left" ? { position: "left", align: "right" } : undefined,
          })),
          links: links.map((l) => ({
            ...l,
            lineStyle: { color: colorOf.get(l.target) ?? C.textMuted },
          })),
        },
      ],
    };
  }, [flow, byId, money]);

  const label = `Income ${money(flow.income)}: spent ${money(flow.spent)}, invested ${money(flow.invested)}, kept ${money(flow.kept)}${flow.shortfall ? `, ${money(flow.shortfall)} from savings` : ""}.`;
  const height = Math.max(320, 120 + flow.spending.length * 42);
  return <EChart option={option} height={height} label={label} />;
}
