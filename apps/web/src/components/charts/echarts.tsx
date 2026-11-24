// ECharts, set up once for the whole app: only the chart types we use (to keep the bundle
// small), the SVG renderer (crisp text), and defaults that follow the bold dark theme.
import { categoryColors, colors } from "@money/shared";
import {
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
} from "echarts/charts";
import {
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

echarts.use([
  BarChart,
  GaugeChart,
  LineChart,
  PieChart,
  SankeyChart,
  ScatterChart,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
]);

export type Option = echarts.EChartsCoreOption;

/** The theme's colours, straight from the shared tokens (the web app is dark only). */
export const C = colors.dark;
export const FONT = '"Space Grotesk Variable", system-ui, sans-serif';

/** A category's colour by its stored name. */
export function catColor(name: string | undefined): string {
  return (categoryColors as Record<string, { dark: string }>)[name ?? "slate"]?.dark ?? "#9A9A94";
}

/** A hex colour at some opacity, for washes and tints. */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Category names and notes come from the user: escape them before they go into tooltip HTML. */
export function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch,
  );
}

export interface TipLine {
  /** Colour of the short key before the value; omit for none. */
  color?: string;
  value: string;
  name: string;
  tone?: "danger" | "success";
}

/**
 * The one tooltip layout, as HTML for ECharts: a muted title, then rows with a short
 * colour key, the value strong and the name after it.
 */
export function tipHtml(title: string, lines: TipLine[]): string {
  const rows = lines
    .map((l) => {
      const key = `<span style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${l.color ?? "transparent"};margin-right:8px;vertical-align:middle"></span>`;
      const tone = l.tone === "danger" ? C.danger : l.tone === "success" ? C.success : C.text;
      return `<div style="white-space:nowrap;line-height:1.6">${key}<b style="color:${tone};font-weight:700">${esc(l.value)}</b> <span style="color:${C.textMuted}">${esc(l.name)}</span></div>`;
    })
    .join("");
  return `<div style="font-size:13px;font-weight:600;color:${C.textMuted};margin-bottom:4px">${esc(title)}</div>${rows}`;
}

/** Defaults every chart starts from. */
const base: Option = {
  backgroundColor: "transparent",
  textStyle: { fontFamily: FONT, color: C.text },
  animationDuration: 700,
  animationEasing: "cubicOut",
  animationDurationUpdate: 400,
};

const tooltipBase = {
  backgroundColor: C.surface,
  borderColor: C.border,
  borderWidth: 1,
  padding: [8, 12],
  textStyle: { fontFamily: FONT, color: C.text, fontSize: 13 },
  extraCssText: "border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,0.55);",
  confine: true,
  transitionDuration: 0.15,
};

/** Shared axis styling: hairline grid, faint labels, no ticks. */
export const axis = {
  value: {
    type: "value",
    splitNumber: 3,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: C.border, width: 1 } },
    axisLabel: { color: C.textFaint, fontSize: 11, fontFamily: FONT },
  },
  category: {
    type: "category",
    axisLine: { lineStyle: { color: alpha(C.borderStrong, 0.25) } },
    axisTick: { show: false },
    axisLabel: { color: C.textMuted, fontSize: 12, fontWeight: 600, fontFamily: FONT },
  },
} as const;

/**
 * One ECharts chart, sized to its container and redrawn on resize. Pass a memoised
 * option so it only redraws when the data changes. `onClick` receives ECharts' click params.
 */
export function EChart({
  option,
  height,
  label,
  onClick,
  className,
}: {
  option: Option;
  height: number;
  /** What a screen reader hears for the chart. */
  label: string;
  onClick?: (params: {
    dataIndex: number;
    name: string;
    seriesName?: string;
    data?: unknown;
  }) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const click = useRef(onClick);
  click.current = onClick;

  useEffect(() => {
    const node = el.current;
    if (!node) return;
    const c = echarts.init(node, undefined, { renderer: "svg" });
    chart.current = c;
    c.on("click", (p) => click.current?.(p as never));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(node);
    return () => {
      ro.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    const o = option as { tooltip?: object };
    chart.current?.setOption(
      { ...base, ...option, tooltip: o.tooltip ? { ...tooltipBase, ...o.tooltip } : undefined },
      { notMerge: true },
    );
  }, [option]);

  return (
    <div
      ref={el}
      role="img"
      aria-label={label}
      className={className}
      style={{ height, width: "100%", cursor: onClick ? "pointer" : undefined }}
    />
  );
}
