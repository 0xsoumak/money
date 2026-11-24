import { budgetProgress, daysInMonth, lastDayOf, today } from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { BudgetBullets, HalfRing, STATE_COLOR } from "../../components/BudgetRing";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { PressableScale } from "../../components/motion";
import { Screen } from "../../components/Screen";
import { Label, T } from "../../components/T";
import { Button, EmptyState, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney } from "../../lib/hooks";
import { useMonth } from "../../lib/month";
import { categoriesQuery, summaryQuery } from "../../lib/queries";
import { c } from "../../lib/theme";

export default function Budgets() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month } = useMonth();
  const money = useMoney();
  const { width: screenW } = useWindowDimensions();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const {
    data: summary,
    isPending,
    isRefetching,
  } = useQuery({
    ...summaryQuery(month),
    placeholderData: keepPreviousData,
  });

  const edit = (key: string, title: string, current: number | null, spent: number) =>
    router.push({
      pathname: "/budget",
      params: { key, title, current: current ? String(current) : "", spent: String(spent) },
    });

  const spentBy = new Map(
    (summary?.byCategory ?? [])
      .filter((r) => r.type === "expense")
      .map((r) => [r.categoryId, r.total]),
  );
  const overall = summary?.budget.overall ?? null;
  const spent = summary?.spent ?? 0;
  const overallProgress = overall ? budgetProgress(spent, overall) : null;

  const expenseCategories = categories.filter((x) => x.kind === "expense" && !x.archivedAt);
  const withLimit = expenseCategories
    .filter((x) => summary?.budget.categories[x.id])
    .map((x) => {
      const limit = summary?.budget.categories[x.id] ?? 0;
      return { x, limit, spent: spentBy.get(x.id) ?? 0 };
    })
    .sort(
      (a, b) => budgetProgress(b.spent, b.limit).ratio - budgetProgress(a.spent, a.limit).ratio,
    );
  const withoutLimit = expenseCategories.filter((x) => !summary?.budget.categories[x.id]);

  // How far through the month we are, to set against how much of the budget is used.
  const todayDate = today();
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const elapsed = todayDate.startsWith(month)
    ? Number(todayDate.slice(8))
    : todayDate > lastDayOf(month)
      ? days
      : 0;
  const monthPct = Math.round((elapsed / days) * 100);
  const usedPct = overallProgress ? Math.round(overallProgress.ratio * 100) : 0;
  // Ahead of the month's pace reads as a warning (or worse, if already over).
  const paceState =
    !overallProgress || usedPct <= monthPct
      ? "ok"
      : overallProgress.state === "over"
        ? "over"
        : "warning";
  // Where spending would be today if it kept to budget, and days still to come (counting today).
  const pace = elapsed > 0 && elapsed < days ? elapsed / days : null;
  const daysLeft = pace !== null ? days - elapsed + 1 : 0;
  const isOver = (overallProgress?.over ?? 0) > 0;
  const overCount = withLimit.filter(
    (b) => budgetProgress(b.spent, b.limit).state === "over",
  ).length;

  return (
    <Screen
      refreshing={isRefetching}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["summary"] })}
    >
      <MonthSwitcher />
      <T variant="display" size={52} accessibilityRole="header">
        Budgets
      </T>

      <View>
        <SectionHeader title="Overall" />
        {isPending ? (
          <Skeleton style={{ height: 170, marginTop: 16 }} />
        ) : overall && overallProgress ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Edit overall budget, ${money(overall)}. ${usedPct}% used.`}
            onPress={() => edit("overall", "Overall", overall, spent)}
            scaleTo={0.98}
            style={{ marginTop: 20, gap: 24 }}
          >
            <View style={{ alignItems: "center", gap: 10 }}>
              <HalfRing
                spent={spent}
                limit={overall}
                width={Math.min(340, screenW - 32)}
                stroke={28}
                pace={pace}
              >
                <Label>{isOver ? "Over by" : "Left to spend"}</Label>
                <T variant="display" size={40} fit color={isOver ? c.danger : c.accent}>
                  {money(isOver ? overallProgress.over : overallProgress.remaining)}
                </T>
              </HalfRing>
              {pace !== null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{ width: 2.5, height: 14, borderRadius: 2, backgroundColor: c.text }}
                  />
                  <T variant="caption" color={c.textMuted}>
                    Where you should be by today
                  </T>
                </View>
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 22 }}>
              <Fact label="Spent" value={money(spent)} sub={`of ${money(overall)}`} />
              <Fact
                label="Used"
                value={`${usedPct}%`}
                valueColor={STATE_COLOR[overallProgress.state]}
                sub={daysLeft > 0 ? `in ${monthPct}% of the month` : undefined}
                subColor={daysLeft > 0 ? STATE_COLOR[paceState] : undefined}
              />
              {daysLeft > 0 && (
                <Fact
                  label="Days left"
                  value={String(daysLeft)}
                  sub={`Day ${elapsed} of ${days}`}
                />
              )}
              {daysLeft > 0 && (
                <Fact
                  label="Per day from here"
                  value={isOver ? "–" : money(Math.floor(overallProgress.remaining / daysLeft))}
                  valueColor={isOver ? c.danger : undefined}
                  sub={isOver ? "Already over budget" : "to stay within budget"}
                />
              )}
            </View>
          </PressableScale>
        ) : (
          <EmptyState
            title="No overall budget"
            hint="Set one limit for everything you spend in a month. The overview then shows how much is left."
            action={
              <Button
                title="Set monthly budget"
                onPress={() => edit("overall", "Overall", null, spent)}
              />
            }
          />
        )}
      </View>

      <View>
        <SectionHeader
          title="By category"
          right={
            withLimit.length > 0 ? (
              <T variant="caption" color={c.textMuted}>
                {overCount} over · {withLimit.length} set
              </T>
            ) : undefined
          }
        />
        {withLimit.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <BudgetBullets
              rows={withLimit.map(({ x, limit, spent: s }) => ({
                key: x.id,
                name: `${x.emoji} ${x.name}`,
                spent: s,
                limit,
              }))}
              pace={pace}
              onPick={(r) => {
                const name = withLimit.find((b) => b.x.id === r.key)?.x.name ?? "Category";
                edit(r.key, name, r.limit, r.spent);
              }}
            />
          </View>
        ) : (
          !isPending && (
            <View
              style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <T variant="body" color={c.textMuted}>
                No category limits yet. Pick a category below to set one.
              </T>
            </View>
          )
        )}
      </View>

      {withoutLimit.length > 0 && (
        <View>
          <SectionHeader title="No limit" />
          <View style={{ marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {withoutLimit.map((x) => {
              const s = spentBy.get(x.id) ?? 0;
              return (
                <PressableScale
                  key={x.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Set a limit for ${x.name}`}
                  onPress={() => edit(x.id, x.name, null, s)}
                  scaleTo={0.97}
                  style={{
                    flexBasis: "48%",
                    flexGrow: 1,
                    minHeight: 64,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    gap: 2,
                    borderWidth: 2,
                    borderColor: c.border,
                    borderRadius: 12,
                  }}
                >
                  <T variant="body" size={15} numberOfLines={1}>
                    {x.emoji} {x.name}
                  </T>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
                    <T
                      variant="caption"
                      color={c.textMuted}
                      numberOfLines={1}
                      style={{ flexShrink: 1 }}
                    >
                      {money(s)}
                    </T>
                    <T variant="label" size={11} color={c.accent}>
                      + Limit
                    </T>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        </View>
      )}
    </Screen>
  );
}

/** One figure under the overall gauge: small label, big value, a line under it. */
function Fact({
  label,
  value,
  sub,
  valueColor,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  subColor?: string;
}) {
  return (
    <View style={{ width: "50%", paddingRight: 12, gap: 4 }}>
      <Label>{label}</Label>
      <T variant="display" size={28} fit color={valueColor}>
        {value}
      </T>
      {sub && (
        <T variant="caption" color={subColor ?? c.textMuted} style={{ fontWeight: "600" }}>
          {sub}
        </T>
      )}
    </View>
  );
}
