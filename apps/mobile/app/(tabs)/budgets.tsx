import { budgetProgress, daysInMonth, lastDayOf, today } from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { BudgetBullets, Ring, STATE_COLOR } from "../../components/BudgetRing";
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
            style={{
              marginTop: 16,
              padding: 18,
              gap: 16,
              borderWidth: 2,
              borderColor: c.border,
              borderRadius: 18,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              <Ring spent={spent} limit={overall} size={116} stroke={13} fontSize={26} />
              <View style={{ flex: 1, gap: 2 }}>
                <Label>{overallProgress.over > 0 ? "Over by" : "Left to spend"}</Label>
                <T
                  variant="display"
                  size={40}
                  fit
                  color={overallProgress.over > 0 ? c.danger : c.accent}
                >
                  {money(
                    overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining,
                  )}
                </T>
                <T variant="caption" color={c.textMuted}>
                  {money(spent)} of {money(overall)} spent
                </T>
              </View>
            </View>
            {elapsed > 0 && elapsed < days && (
              <T variant="small" color={c.textMuted}>
                Day {elapsed} of {days}:{" "}
                <T
                  variant="small"
                  color={STATE_COLOR[paceState]}
                  style={{ fontFamily: "SpaceGrotesk_700Bold" }}
                >
                  {usedPct}% of budget used
                </T>{" "}
                in {monthPct}% of the month
              </T>
            )}
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
              pace={elapsed > 0 && elapsed < days ? elapsed / days : null}
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
