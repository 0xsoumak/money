import { Feather } from "@expo/vector-icons";
import {
  addMonths,
  analyticsWindow,
  budgetProgress,
  dailyExpenses,
  monthInsights,
  overviewStats,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { BudgetRing } from "../../components/BudgetRing";
import { StatGrid } from "../../components/Charts";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { PressableScale, Reveal, useCountUp } from "../../components/motion";
import { Screen } from "../../components/Screen";
import { ShareBar } from "../../components/ShareBar";
import { Label, T } from "../../components/T";
import { TransactionList } from "../../components/TransactionList";
import { Button, EmptyState, IconButton, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney } from "../../lib/hooks";
import { useMonth } from "../../lib/month";
import {
  analyticsQuery,
  categoriesQuery,
  summaryQuery,
  transactionsQuery,
  trendQuery,
} from "../../lib/queries";
import { c } from "../../lib/theme";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

const RECENT = 5;

export default function Overview() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month } = useMonth();
  const money = useMoney();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });
  const trend = useQuery({ ...trendQuery(month), placeholderData: keepPreviousData });

  const loading = summary.isPending || txs.isPending;
  const stale = summary.isPlaceholderData || txs.isPlaceholderData;
  const expenses = (summary.data?.byCategory ?? []).filter((r) => r.type === "expense");
  const recent = (txs.data ?? []).slice(0, RECENT);
  const empty = !loading && (txs.data?.length ?? 0) === 0;

  const spent = summary.data?.spent ?? 0;
  const budget = summary.data?.budget;
  const overall = budget?.overall ?? null;
  const overallProgress = overall ? budgetProgress(spent, overall) : null;
  const spentBy = new Map(expenses.map((r) => [r.categoryId, r.total]));
  const categoryBudgets = categories
    .filter((x) => budget?.categories[x.id])
    .map((x) => {
      const limit = budget?.categories[x.id] ?? 0;
      return { x, limit, spent: spentBy.get(x.id) ?? 0 };
    })
    .sort(
      (a, b) => budgetProgress(b.spent, b.limit).ratio - budgetProgress(a.spent, a.limit).ratio,
    );
  const hasBudgets = overall !== null || categoryBudgets.length > 0;

  const todayDate = today();
  const ins = monthInsights({
    month,
    todayDate,
    spent,
    transactions: txs.data ?? [],
    overallBudget: overall,
  });
  const prevSpent = trend.data?.find((t) => t.month === addMonths(month, -1))?.spent ?? 0;
  const stats = overviewStats(ins, { spent, prevSpent, overallBudget: overall, money });
  const shownSpent = useCountUp(spent);

  // Only budgets at 80% or more make the overview; the rest are summed up in words.
  const atRisk = [
    ...(overall !== null ? [{ key: "overall", name: "Overall", spent, limit: overall }] : []),
    ...categoryBudgets.map(({ x, limit, spent: s }) => ({
      key: x.id,
      name: `${x.emoji} ${x.name}`,
      spent: s,
      limit,
    })),
  ].filter((b) => budgetProgress(b.spent, b.limit).state !== "ok");
  const budgetCount = (overall !== null ? 1 : 0) + categoryBudgets.length;
  const onTrack = budgetCount - atRisk.length;

  // One line from the Analytics tab, as a way in.
  const analytics = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const teaser = useMemo(() => {
    if (!analytics.data) return null;
    const { dates } = analyticsWindow(analytics.data.to, 3, todayDate);
    return weekdayHeadline(weekdayAverages(dailyExpenses(analytics.data.rows), dates));
  }, [analytics.data, todayDate]);

  const refreshing = summary.isRefetching || txs.isRefetching;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["summary"] });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
    void qc.invalidateQueries({ queryKey: ["categories"] });
    void qc.invalidateQueries({ queryKey: ["analytics"] });
  };

  const left =
    overallProgress && overallProgress.over === 0 ? overallProgress.remaining : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <MonthSwitcher />
        </View>
        <IconButton label="Settings" bordered onPress={() => router.push("/settings")}>
          <Feather name="settings" size={20} color={c.text} />
        </IconButton>
      </View>
      {/* While another month loads, dim the previous month's numbers so they don't read as this month's. */}
      <View
        accessibilityState={{ busy: stale }}
        pointerEvents={stale ? "none" : "auto"}
        style={{ gap: 28, opacity: stale ? 0.35 : 1 }}
      >
        <View style={{ gap: 20 }}>
          <View style={{ gap: 6 }}>
            <Label>Spent</Label>
            {loading ? (
              <Skeleton style={{ height: 64, width: 240 }} />
            ) : (
              <T variant="display" size={68} fit accessibilityLabel={`Spent ${money(spent)}`}>
                {money(shownSpent)}
              </T>
            )}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 28, rowGap: 14 }}>
            {overallProgress && (
              <Stat
                label={overallProgress.over > 0 ? "Over" : "Left"}
                value={money(
                  overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining,
                )}
                color={overallProgress.over > 0 ? c.danger : c.accent}
              />
            )}
            <Stat label="Income" value={money(summary.data?.income ?? 0)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Invested ${money(summary.data?.invested ?? 0)}. Open investments`}
              onPress={() => router.push("/investments")}
              hitSlop={8}
            >
              <Stat
                label="Invested ›"
                value={money(summary.data?.invested ?? 0)}
                color={c.accent}
              />
            </Pressable>
            <Stat
              label="Net"
              value={money(summary.data?.net ?? 0)}
              color={(summary.data?.net ?? 0) < 0 ? c.danger : undefined}
            />
          </View>
        </View>

        {empty ? (
          <EmptyState
            title="Nothing logged this month"
            hint="Tap the + button to add your first expense."
            action={<Button title="Add expense" onPress={() => router.push("/add")} />}
          />
        ) : (
          <>
            <Reveal>
              <StatGrid stats={stats} />
            </Reveal>

            <Reveal>
              <ShareBar items={expenses} categories={categories} left={left} />
            </Reveal>

            {!loading && (
              <View>
                <SectionHeader
                  title="Needs attention"
                  right={
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.navigate("/budgets")}
                      hitSlop={10}
                    >
                      <T variant="label" color={c.accent} size={13}>
                        {hasBudgets ? "Manage" : "Set up"}
                      </T>
                    </Pressable>
                  }
                />
                {!hasBudgets || atRisk.length === 0 ? (
                  <View
                    style={{
                      paddingVertical: 20,
                      borderBottomWidth: 1,
                      borderBottomColor: c.border,
                    }}
                  >
                    <T variant="body" color={c.textMuted}>
                      {!hasBudgets
                        ? "Set a monthly budget to see how much you have left to spend."
                        : budgetCount === 1
                          ? "Your budget is on track."
                          : `All ${budgetCount} budgets on track.`}
                    </T>
                  </View>
                ) : (
                  <View style={{ marginTop: 16, gap: 8 }}>
                    {atRisk.map((b) => (
                      <BudgetRing
                        key={b.key}
                        name={b.name}
                        spent={b.spent}
                        limit={b.limit}
                        onPress={() => router.navigate("/budgets")}
                      />
                    ))}
                    {onTrack > 0 && (
                      <T variant="caption" color={c.textMuted} style={{ marginTop: 4 }}>
                        {onTrack} other {onTrack === 1 ? "budget" : "budgets"} on track
                      </T>
                    )}
                  </View>
                )}
              </View>
            )}

            <View>
              <SectionHeader
                title="Recent"
                right={
                  (txs.data?.length ?? 0) > RECENT ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.navigate("/activity")}
                      hitSlop={10}
                    >
                      <T variant="label" color={c.accent} size={13}>
                        All {txs.data?.length}
                      </T>
                    </Pressable>
                  ) : undefined
                }
              />
              <View style={{ marginTop: 16 }}>
                <TransactionList
                  transactions={recent}
                  categories={categories}
                  onEdit={(tx) => router.push({ pathname: "/add", params: { id: tx.id } })}
                  onDelete={deleteWithUndo}
                />
              </View>
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${teaser ?? "See where your money really goes."} Open analytics`}
              onPress={() => router.navigate("/analytics")}
              scaleTo={0.98}
              style={{
                padding: 18,
                gap: 14,
                borderWidth: 2,
                borderColor: c.borderStrong,
                borderRadius: 16,
              }}
            >
              <View style={{ gap: 6 }}>
                <Label>From your analytics</Label>
                <T variant="title" size={22}>
                  {teaser ?? "See where your money really goes."}
                </T>
              </View>
              <View
                style={{
                  alignSelf: "flex-start",
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: c.accent,
                }}
              >
                <T variant="label" size={13} color={c.onAccent}>
                  Open analytics →
                </T>
              </View>
            </PressableScale>
          </>
        )}
      </View>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View>
      <Label>{label}</Label>
      <T variant="title" size={28} color={color} style={{ marginTop: 2 }}>
        {value}
      </T>
    </View>
  );
}
