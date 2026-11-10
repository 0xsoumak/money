import { budgetProgress } from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { BlockMeter, BudgetRow, BudgetStatus } from "../../components/BlockMeter";
import { MonthSwitcher } from "../../components/MonthSwitcher";
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

  return (
    <Screen
      refreshing={isRefetching}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["summary"] })}
    >
      <MonthSwitcher />
      <T variant="title" size={44} accessibilityRole="header">
        Budgets
      </T>

      <View>
        <SectionHeader title="Overall" />
        {isPending ? (
          <Skeleton style={{ height: 130, marginTop: 16 }} />
        ) : overall && overallProgress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit overall budget, ${money(overall)}`}
            onPress={() => edit("overall", "Overall", overall, spent)}
            style={{
              paddingVertical: 20,
              gap: 8,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Label>{overallProgress.over > 0 ? "Over budget by" : "Left to spend"}</Label>
            <T
              variant="display"
              size={56}
              fit
              color={overallProgress.over > 0 ? c.danger : c.accent}
            >
              {money(overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining)}
            </T>
            <View style={{ marginTop: 8 }}>
              <BlockMeter spent={spent} limit={overall} label="Overall" />
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <T variant="caption" color={c.textMuted}>
                {money(spent)} of {money(overall)} spent
              </T>
              <BudgetStatus spent={spent} limit={overall} size={13} />
            </View>
          </Pressable>
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
        <SectionHeader title="By category" />
        {withLimit.map(({ x, limit, spent: s }) => (
          <BudgetRow
            key={x.id}
            name={`${x.emoji} ${x.name}`}
            spent={s}
            limit={limit}
            onPress={() => edit(x.id, x.name, limit, s)}
          />
        ))}
        {withLimit.length === 0 && !isPending && (
          <View style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}>
            <T variant="body" color={c.textMuted}>
              No category limits yet. Pick a category below to set one.
            </T>
          </View>
        )}

        {withoutLimit.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Label>No limit</Label>
            {withoutLimit.map((x) => {
              const s = spentBy.get(x.id) ?? 0;
              return (
                <View
                  key={x.id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: 1,
                    borderBottomColor: c.border,
                  }}
                >
                  <View style={{ flex: 1, paddingVertical: 12 }}>
                    <T variant="body" size={16} numberOfLines={1}>
                      {x.emoji} {x.name}
                    </T>
                    <T variant="caption" color={c.textMuted}>
                      {money(s)} this month
                    </T>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Set a limit for ${x.name}`}
                    onPress={() => edit(x.id, x.name, null, s)}
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      justifyContent: "center",
                      paddingHorizontal: 8,
                    }}
                  >
                    <T variant="label" size={13} color={c.textMuted}>
                      Set limit
                    </T>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}
