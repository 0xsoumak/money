import { type MoneyFlow as Flow, stackLinks } from "@money/shared";
import { motion } from "motion/react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { tween } from "../motion";
import { halo, seriesOf, spreadLabels, useWidth } from "./frame";

const H = 380;
const NODE = 14;
const GAP = 16;
const CAT_GAP = 20;

const mix = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`;

interface Node {
  label: string;
  amount: number;
  fill: string;
  tone?: string;
}

/** Stacks nodes top-down with a gap, centered in the chart height. */
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

/** Ribbon between a band on the left and one on the right, with soft horizontal tangents. */
function ribbon(x0: number, a0: number, a1: number, x1: number, b0: number, b1: number) {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0} C${xm},${a0} ${xm},${b0} ${x1},${b0} L${x1},${b1} C${xm},${b1} ${xm},${a1} ${x0},${a1} Z`;
}

/**
 * Where a month's money went: income on the left splits into spent, invested
 * and kept; spent fans out into categories. Widths are to scale throughout.
 */
export function MoneyFlow({ flow, byId }: { flow: Flow; byId: Map<string, Category> }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(1100);
  const narrow = w < 720;

  const left: Node[] = [
    { label: "Income", amount: flow.income, fill: "var(--text)" },
    { label: "From savings", amount: flow.shortfall, fill: "var(--danger)", tone: "var(--danger)" },
  ].filter((n) => n.amount > 0);
  const middle: Node[] = [
    { label: "Spent", amount: flow.spent, fill: "var(--text)" },
    { label: "Invested", amount: flow.invested, fill: "var(--text)" },
    { label: "Kept", amount: flow.kept, fill: "var(--accent)", tone: "var(--accent)" },
  ].filter((n) => n.amount > 0);
  const total = left.reduce((t, n) => t + n.amount, 0);

  if (total === 0) {
    return <p className="border-b border-line py-8 text-muted">Nothing logged this month.</p>;
  }

  const k = (H - GAP * 2) / total;
  const X0 = narrow ? 0 : 140;
  const X2 = w - (narrow ? 130 : 260);
  const X1 = X0 + (X2 - X0) * 0.48;

  const L = stack(left, k, GAP);
  const M = stack(middle, k, GAP);
  const spent = M.find((n) => n.label === "Spent");
  // The category column has a gap between every bar, so at the income scale it can run past
  // the bottom. Shrink it to fit when needed; ribbons taper from the Spent bar to each category.
  const catNodes = flow.spending.map((s) => {
    const series = seriesOf(s.key, byId);
    return { label: series.name, amount: s.amount, fill: series.color };
  });
  const catTotal = catNodes.reduce((t, n) => t + n.amount, 0);
  const catGaps = CAT_GAP * Math.max(catNodes.length - 1, 0);
  const catK = catTotal > 0 ? Math.min(k, (H - catGaps) / catTotal) : k;
  const catHeight = catTotal * catK + catGaps;
  const cats = spent
    ? stack(catNodes, catK, CAT_GAP, Math.max(0, Math.min(spent.y - 10, H - catHeight)))
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
      fill: b.label === "Kept" ? mix("var(--accent)", 26) : mix("var(--text)", 13),
    };
  });
  const catLinks = spent
    ? cats.map((c) => {
        const sy = spent.y + c.from * k;
        const sh = c.amount * k;
        return { d: ribbon(X1 + NODE, sy, sy + sh, X2, c.y, c.y + c.h), fill: mix(c.fill, 45) };
      })
    : [];

  const pctOf = (v: number, of: number) => (of > 0 ? `${Math.round((v / of) * 100)}%` : "");
  const catLabels = spreadLabels(
    cats.map((c) => ({ ...c, y: c.y + c.h / 2 + 5 })),
    20,
    14,
    H,
  );

  const summary = [
    `Income ${money(flow.income)}`,
    flow.shortfall ? `plus ${money(flow.shortfall)} from savings` : "",
    `went to spending ${money(flow.spent)}, investing ${money(flow.invested)}, kept ${money(flow.kept)}.`,
    `Spending: ${cats.map((c) => `${c.label} ${money(c.amount)}`).join(", ")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={H + 8}
        role="img"
        aria-label={summary}
        className="block overflow-visible"
      >
        {[...links, ...catLinks].map((l, i) => (
          <motion.path
            key={l.d}
            d={l.d}
            style={{ fill: l.fill }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...tween.slow, delay: 0.04 * i }}
          />
        ))}
        {[
          ...L.map((n) => ({ ...n, x: X0 })),
          ...M.map((n) => ({ ...n, x: X1 })),
          ...cats.map((n) => ({ ...n, x: X2 })),
        ].map((n) => (
          <rect
            key={`${n.x}-${n.label}`}
            x={n.x}
            y={n.y}
            width={NODE}
            height={Math.max(n.h, 2)}
            rx={2}
            style={{ fill: n.fill }}
          />
        ))}

        {L.map((n) => {
          const cy = n.y + n.h / 2;
          const x = narrow ? X0 + NODE + 10 : X0 - 14;
          const anchor = narrow ? "start" : "end";
          return (
            <g key={n.label} style={halo}>
              <text
                x={x}
                y={cy - 6}
                textAnchor={anchor}
                className="fill-muted text-xs font-bold uppercase tracking-[0.1em]"
              >
                {n.label}
              </text>
              <text
                x={x}
                y={cy + 18}
                textAnchor={anchor}
                className="text-xl font-bold"
                style={{ fill: n.tone ?? "var(--text)" }}
              >
                {money(n.amount)}
              </text>
            </g>
          );
        })}
        {M.map((n) => {
          const cy = n.y + n.h / 2;
          return (
            <g key={n.label} style={halo}>
              <text
                x={X1 + NODE + 10}
                y={cy - 6}
                className="fill-muted text-xs font-bold uppercase tracking-[0.1em]"
              >
                {n.label}
                {flow.income > 0 && ` · ${pctOf(n.amount, flow.income)}`}
              </text>
              <text
                x={X1 + NODE + 10}
                y={cy + 16}
                className="text-lg font-bold"
                style={{ fill: n.tone ?? "var(--text)" }}
              >
                {money(n.amount)}
              </text>
            </g>
          );
        })}
        {catLabels.map((c) => (
          <g key={c.label}>
            <text x={X2 + NODE + 10} y={c.y} className="fill-ink text-sm font-semibold">
              {c.label}
            </text>
            {!narrow && (
              <text x={w} y={c.y} textAnchor="end" className="fill-muted text-sm">
                {money(c.amount)} · {pctOf(c.amount, flow.spent)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
