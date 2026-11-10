import { budgetProgress } from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { BudgetRow } from "../../components/BlockMeter";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Screen } from "../../components/Screen";
import { ShareBar } from "../../components/ShareBar";
import { Label, T } from "../../components/T";
import { TransactionList } from "../../components/TransactionList";
import { Button, EmptyState, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney } from "../../lib/hooks";
import { useMonth } from "../../lib/month";
import { categoriesQuery, summaryQuery, transactionsQuery } from "../../lib/queries";
import { c } from "../../lib/theme";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

const RECENT = 6;

export default function Overview() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month } = useMonth();
  const money = useMoney();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const loading = summary.isPending || txs.isPending;
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

  const refreshing = summary.isRefetching || txs.isRefetching;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["summary"] });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
    void qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const left =
    overallProgress && overallProgress.over === 0 ? overallProgress.remaining : undefined;

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <MonthSwitcher />

      <View style={{ gap: 20 }}>
        <View style={{ gap: 6 }}>
          <Label>Spent</Label>
          {loading ? (
            <Skeleton style={{ height: 64, width: 240 }} />
          ) : (
            <T variant="display" size={68} fit accessibilityLabel={`Spent ${money(spent)}`}>
              {money(spent)}
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
          <ShareBar items={expenses} categories={categories} left={left} />

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
        </>
      )}

      {!loading && (
        <View>
          <SectionHeader
            title="Budgets"
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
          {hasBudgets ? (
            <>
              {overall !== null && <BudgetRow name="Overall" spent={spent} limit={overall} />}
              {categoryBudgets.map(({ x, limit, spent: s }) => (
                <BudgetRow key={x.id} name={`${x.emoji} ${x.name}`} spent={s} limit={limit} />
              ))}
            </>
          ) : (
            <View
              style={{ paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <T variant="body" color={c.textMuted}>
                Set a monthly budget to see how much you have left to spend.
              </T>
            </View>
          )}
        </View>
      )}
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
