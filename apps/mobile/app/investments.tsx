import { Feather } from "@expo/vector-icons";
import { currentMonth, monthTitle } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryDonut } from "../components/analytics/CategoryDonut";
import { ChartSection } from "../components/analytics/frame";
import { InvestJars } from "../components/analytics/InvestJars";
import { Reveal, useCountUp } from "../components/motion";
import { Label, T } from "../components/T";
import { TransactionList } from "../components/TransactionList";
import { Button, EmptyState, IconButton, SectionHeader, Skeleton } from "../components/ui";
import { useMoney } from "../lib/hooks";
import {
  type Category,
  categoriesQuery,
  investmentsQuery,
  transactionsQuery,
} from "../lib/queries";
import { c } from "../lib/theme";
import { useDeleteWithUndo } from "../lib/useDeleteWithUndo";

/**
 * Money put away, without fund-level detail: total so far, per bucket, per
 * year and per month. Tap a month bar to look at that month.
 */
export default function Investments() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const deleteWithUndo = useDeleteWithUndo();
  const [month, setMonth] = useState(currentMonth());

  const { data: categories = [] } = useQuery(categoriesQuery);
  const inv = useQuery({ ...investmentsQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const data = inv.data;
  const thisMonth = (txs.data ?? []).filter((t) => t.type === "investment");
  const monthTotal = thisMonth.reduce((t, x) => t + x.amount, 0);
  const year = Number(month.slice(0, 4));
  const shownTotal = useCountUp(data?.total ?? 0);
  const none = data !== undefined && data.total === 0;
  const byId = new Map<string, Category>(categories.map((x) => [x.id, x]));
  const share = (data?.byCategory ?? [])
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ key: r.categoryId, amount: r.total }));
  const top = share[0];
  // Six jars fit a phone comfortably; twelve get too thin to read.
  const recent = (data?.months ?? []).slice(-6);
  const investedMonths = recent.filter((m) => m.invested > 0).length;
  const log = () => router.push({ pathname: "/add", params: { type: "investment" } });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 40,
        gap: 28,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton label="Back" bordered onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={c.text} />
        </IconButton>
        <Pressable accessibilityRole="button" onPress={log} hitSlop={10}>
          <T variant="label" color={c.accent} size={13}>
            Log investment
          </T>
        </Pressable>
      </View>

      <View style={{ gap: 6 }}>
        <Label>Invested so far</Label>
        {!data ? (
          <Skeleton style={{ height: 64, width: 240 }} />
        ) : (
          <T
            variant="display"
            size={60}
            fit
            accessibilityLabel={`Invested so far ${money(data.total)}`}
          >
            {money(shownTotal)}
          </T>
        )}
        <T variant="caption" color={c.textMuted}>
          Up to the end of {monthTitle(month)}
        </T>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 24, rowGap: 12 }}>
        {[
          { label: monthTitle(month).split(" ")[0] ?? "Month", value: monthTotal },
          { label: `In ${year}`, value: data?.thisYear ?? 0 },
          { label: `In ${year - 1}`, value: data?.lastYear ?? 0 },
        ].map((s) => (
          <View key={s.label}>
            <Label>{s.label}</Label>
            <T variant="title" size={24} style={{ marginTop: 2 }}>
              {money(s.value)}
            </T>
          </View>
        ))}
      </View>

      {none ? (
        <EmptyState
          title="No investments logged yet"
          hint="Log what you put into mutual funds, FDs, PPF and so on. Just the amount and where it went."
          action={<Button title="Log an investment" onPress={log} />}
        />
      ) : (
        <>
          {data && top && (
            <Reveal>
              <ChartSection
                title="Where it's invested"
                headline={`${byId.get(top.key)?.name ?? "One bucket"} holds ${Math.round((top.amount / data.total) * 100)}%`}
              >
                <CategoryDonut share={share} byId={byId} center="Invested" />
              </ChartSection>
            </Reveal>
          )}
          <Reveal>
            {data ? (
              <ChartSection
                title="Last 6 months"
                headline={`Invested in ${investedMonths} of ${recent.length} months`}
                tone={investedMonths >= recent.length * 0.75 ? "good" : "info"}
              >
                <InvestJars
                  jars={recent.map((m) => ({
                    month: m.month,
                    invested: m.invested,
                    rate: null,
                    current: m.month === month,
                  }))}
                  onPick={setMonth}
                />
              </ChartSection>
            ) : (
              <Skeleton style={{ height: 200 }} />
            )}
          </Reveal>
          <Reveal>
            <SectionHeader title={monthTitle(month)} />
            <View style={{ marginTop: 16 }}>
              {thisMonth.length === 0 ? (
                <T variant="body" color={c.textMuted} style={{ paddingVertical: 16 }}>
                  Nothing invested this month.
                </T>
              ) : (
                <TransactionList
                  transactions={thisMonth}
                  categories={categories}
                  onEdit={(tx) => router.push({ pathname: "/add", params: { id: tx.id } })}
                  onDelete={deleteWithUndo}
                />
              )}
            </View>
          </Reveal>
        </>
      )}
    </ScrollView>
  );
}
