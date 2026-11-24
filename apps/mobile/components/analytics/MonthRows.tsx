// Mobile twin of apps/web/src/components/charts/MonthRows.tsx. Keep the two in step.
import { monthTitle, shortMonth } from "@money/shared";
import { View } from "react-native";
import { tap } from "../../lib/haptics";
import { c, fade } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney, useWidth } from "./frame";

export interface MonthRow {
  month: string;
  /** Stacked left to right, e.g. fixed then flexible. */
  parts: { value: number; color: string }[];
  current?: boolean;
  /** A dashed outline past the bar, up to this total: where a running month may end. */
  ghost?: number;
  label: string;
}

const LABEL_W = 40;
const AMOUNT_W = 58;
const BAR_H = 10;

/**
 * Months as horizontal bars, oldest at the top, the amount at the end of each. A shaded
 * strip marks the usual range and a dashed line the budget. Tap a month to open it.
 */
export function MonthRows({
  rows,
  band,
  limit,
  onPick,
}: {
  rows: MonthRow[];
  band?: { low: number; high: number } | null;
  limit?: number | null;
  onPick?: (month: string) => void;
}) {
  const [onLayout, w] = useWidth();
  const total = (r: MonthRow) => r.parts.reduce((t, p) => t + p.value, 0);
  const max = Math.max(
    1,
    ...rows.map((r) => Math.max(total(r), r.ghost ?? 0)),
    band?.high ?? 0,
    limit ?? 0,
  );
  const track = Math.max(0, w - LABEL_W - AMOUNT_W);
  const x = (v: number) => (v / max) * track;

  return (
    <View onLayout={onLayout} style={{ gap: 8 }}>
      {w > 0 && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, bottom: 0, left: LABEL_W }}
        >
          {band && band.high > 0 && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: x(band.low),
                width: Math.max(2, x(band.high) - x(band.low)),
                backgroundColor: fade(c.text, 0.08),
              }}
            />
          )}
          {limit ? (
            <View
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                left: x(limit),
                borderLeftWidth: 1.5,
                borderStyle: "dashed",
                borderColor: c.textMuted,
              }}
            />
          ) : null}
        </View>
      )}
      {rows.map((r) => {
        const sum = total(r);
        const ghost = r.ghost !== undefined && r.ghost > sum ? r.ghost - sum : 0;
        const parts = r.parts.filter((p) => p.value > 0);
        return (
          <PressableScale
            key={r.month}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(r.month)}: ${r.label}`}
            onPress={
              onPick
                ? () => {
                    tap();
                    onPick(r.month);
                  }
                : undefined
            }
            style={{ flexDirection: "row", alignItems: "center", minHeight: 28 }}
          >
            <T
              variant="caption"
              color={r.current ? c.text : c.textMuted}
              style={{ width: LABEL_W, fontWeight: r.current ? "700" : "600" }}
            >
              {shortMonth(r.month)}
            </T>
            <View style={{ flexDirection: "row", alignItems: "center", height: BAR_H }}>
              {parts.map((p, k) => {
                const end = k === parts.length - 1 && ghost === 0;
                return (
                  <View
                    key={`${r.month}${k}`}
                    style={{
                      width: x(p.value),
                      height: BAR_H,
                      backgroundColor: p.color,
                      borderTopRightRadius: end ? 5 : 0,
                      borderBottomRightRadius: end ? 5 : 0,
                      marginLeft: k > 0 ? 1 : 0,
                    }}
                  />
                );
              })}
              {ghost > 0 && (
                <View
                  style={{
                    width: x(ghost),
                    height: BAR_H,
                    borderWidth: 1.5,
                    borderLeftWidth: 0,
                    borderStyle: "dashed",
                    borderColor: c.textFaint,
                    borderTopRightRadius: 5,
                    borderBottomRightRadius: 5,
                  }}
                />
              )}
              <T variant="caption" style={{ marginLeft: 8, fontWeight: "700" }}>
                {r.label}
              </T>
            </View>
          </PressableScale>
        );
      })}
      {(band || limit) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
          {band && band.high > 0 && (
            <Key>
              <View
                style={{
                  width: 14,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: fade(c.text, 0.16),
                }}
              />
              <T variant="caption" color={c.textMuted}>
                Usual {compactMoney(band.low)}–{compactMoney(band.high)}
              </T>
            </Key>
          )}
          {limit ? (
            <Key>
              <View
                style={{
                  width: 0,
                  height: 12,
                  borderLeftWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: c.textMuted,
                }}
              />
              <T variant="caption" color={c.textMuted}>
                Budget {compactMoney(limit)}
              </T>
            </Key>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{children}</View>;
}
