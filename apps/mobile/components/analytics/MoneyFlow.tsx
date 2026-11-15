import { type MoneyFlow as Flow, stackLinks } from "@money/shared";
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { T } from "../T";
import { compactMoney, fade, Label, seriesOf, spreadLabels, useWidth } from "./frame";

const H = 320;
const NODE = 12;
const GAP = 14;
const CAT_GAP = 18;

interface Node {
  label: string;
  amount: number;
  fill: string;
  tone?: string;
}

function stack(nodes: Node[], k: number, gap: number, top?: number) {
  const height = nodes.reduce((t, n) => t + n.amount * k, 0) + gap * (nodes.length - 1);
  let y = top ?? (H - height) / 2;
  let acc = 0;
  return nodes.map((n) => {
    const out = { ...n, y, h: n.amount * k, from: acc };
    y += n.amount * k + gap;
    acc += n.amount;
    return out;
  });
}

function ribbon(x0: number, a0: number, a1: number, x1: number, b0: number, b1: number) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0} C${xm},${a0} ${xm},${b0} ${x1},${b0} L${x1},${b1} C${xm},${b1} ${xm},${a1} ${x0},${a1} Z`;
}

/** Income → spent / invested / kept → spending by category, ribbons to scale. */
export function MoneyFlow({ flow, byId }: { flow: Flow; byId: Map<string, Category> }) {
  const money = useMoney();
  const [onLayout, w] = useWidth();

  const left: Node[] = [
    { label: "Income", amount: flow.income, fill: c.text },
    { label: "From savings", amount: flow.shortfall, fill: c.danger, tone: c.danger },
  ].filter((n) => n.amount > 0);
  const middle: Node[] = [
    { label: "Spent", amount: flow.spent, fill: c.text },
    { label: "Invested", amount: flow.invested, fill: c.text },
    { label: "Kept", amount: flow.kept, fill: c.accent, tone: c.accent },
  ].filter((n) => n.amount > 0);
  const total = left.reduce((t, n) => t + n.amount, 0);

  if (total === 0) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        Nothing logged this month.
      </T>
    );
  }

  const k = (H - GAP * 2) / total;
  const X0 = 0;
  const X2 = Math.max(160, w - 104);
  const X1 = X0 + (X2 - X0) * 0.46;
  const L = stack(left, k, GAP);
  const M = stack(middle, k, GAP);
  const spent = M.find((n) => n.label === "Spent");
  const cats = spent
    ? stack(
        flow.spending.map((s) => {
          const series = seriesOf(s.key, byId);
          return { label: series.name, amount: s.amount, fill: series.color };
        }),
        k,
        CAT_GAP,
        Math.max(0, spent.y - 8),
      )
    : [];

  const links = stackLinks(
    L.map((n) => n.amount),
    M.map((n) => n.amount),
  ).map((l) => {
    const a = L[l.from] as (typeof L)[number];
    const b = M[l.to] as (typeof M)[number];
    const ay = a.y + (l.start - a.from) * k;
    const by = b.y + (l.start - b.from) * k;
    const h = (l.end - l.start) * k;
    return {
      d: ribbon(X0 + NODE, ay, ay + h, X1, by, by + h),
      fill: b.label === "Kept" ? fade(c.accent, 0.26) : fade(c.text, 0.13),
    };
  });
  const catLinks = spent
    ? cats.map((x) => {
        const sy = spent.y + x.from * k;
        return { d: ribbon(X1 + NODE, sy, sy + x.h, X2, x.y, x.y + x.h), fill: fade(x.fill, 0.45) };
      })
    : [];
  const catLabels = spreadLabels(
    cats.map((x) => ({ ...x, y: x.y + x.h / 2 - 1 })),
    28,
    10,
    H - 14,
  );
  const pct = (v: number) => (flow.income > 0 ? ` · ${Math.round((v / flow.income) * 100)}%` : "");

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Income ${money(flow.income)} went to spending ${money(flow.spent)}, investing ${money(flow.invested)}, kept ${money(flow.kept)}. ${cats.map((x) => `${x.label} ${money(x.amount)}`).join(", ")}.`}
    >
      {w > 0 && (
        <Svg width={w} height={H + 8}>
          {[...links, ...catLinks].map((l) => (
            <Path key={l.d} d={l.d} fill={l.fill} />
          ))}
          {[
            ...L.map((n) => ({ ...n, x: X0 })),
            ...M.map((n) => ({ ...n, x: X1 })),
            ...cats.map((n) => ({ ...n, x: X2 })),
          ].map((n) => (
            <Rect
              key={`${n.x}-${n.label}`}
              x={n.x}
              y={n.y}
              width={NODE}
              height={Math.max(n.h, 2)}
              rx={2}
              fill={n.fill}
            />
          ))}
          {L.map((n) => (
            <Label key={n.label} x={X0 + NODE + 8} y={n.y + 14} size={10} weight={700} halo>
              {n.label.toUpperCase()}
            </Label>
          ))}
          {L.map((n) => (
            <Label
              key={`${n.label}-v`}
              x={X0 + NODE + 8}
              y={n.y + 32}
              size={15}
              weight={700}
              fill={n.tone ?? c.text}
              halo
            >
              {compactMoney(n.amount)}
            </Label>
          ))}
          {M.map((n) => {
            const cy = n.y + n.h / 2;
            return (
              <G key={n.label}>
                <Label x={X1 + NODE + 6} y={cy - 4} size={10} weight={700} halo>
                  {`${n.label.toUpperCase()}${pct(n.amount)}`}
                </Label>
                <Label
                  x={X1 + NODE + 6}
                  y={cy + 13}
                  size={14}
                  weight={700}
                  fill={n.tone ?? c.text}
                  halo
                >
                  {compactMoney(n.amount)}
                </Label>
              </G>
            );
          })}
          {catLabels.map((x) => (
            <G key={x.label}>
              <Label x={X2 + NODE + 8} y={x.y} size={12} weight={600} fill={c.text}>
                {x.label.length > 11 ? `${x.label.slice(0, 10)}…` : x.label}
              </Label>
              <Label x={X2 + NODE + 8} y={x.y + 13} size={11}>
                {compactMoney(x.amount)}
              </Label>
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}
