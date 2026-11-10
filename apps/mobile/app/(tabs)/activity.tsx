import { Feather } from "@expo/vector-icons";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Screen } from "../../components/Screen";
import { T } from "../../components/T";
import { TransactionList } from "../../components/TransactionList";
import { EmptyState, Field, Skeleton } from "../../components/ui";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { useMonth } from "../../lib/month";
import { categoriesQuery, transactionsQuery } from "../../lib/queries";
import { c, radius } from "../../lib/theme";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

type TypeFilter = "all" | "expense" | "income";
const TYPES: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

export default function Activity() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month } = useMonth();
  const money = useMoney();
  const deleteWithUndo = useDeleteWithUndo();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const [type, setType] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const names = new Map(categories.map((x) => [x.id, x.name.toLowerCase()]));
    return (txs.data ?? []).filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!categoryId || t.categoryId === categoryId) &&
        (!needle ||
          (t.note ?? "").toLowerCase().includes(needle) ||
          (names.get(t.categoryId) ?? "").includes(needle)),
    );
  }, [txs.data, categories, type, categoryId, text]);

  const total = filtered.reduce((sum, t) => sum + (t.type === "expense" ? t.amount : 0), 0);
  const filtering = type !== "all" || categoryId !== null || text !== "";
  const usable = categories.filter((x) => !x.archivedAt);

  return (
    <Screen
      refreshing={txs.isRefetching}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["transactions"] })}
    >
      <MonthSwitcher />

      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {TYPES.map((t) => (
            <Chip
              key={t.value}
              label={t.label}
              selected={type === t.value}
              onPress={() => setType(t.value)}
            />
          ))}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          <Chip
            label="All categories"
            selected={categoryId === null}
            onPress={() => setCategoryId(null)}
          />
          {usable.map((x) => (
            <Chip
              key={x.id}
              label={`${x.emoji} ${x.name}`}
              selected={categoryId === x.id}
              onPress={() => setCategoryId(categoryId === x.id ? null : x.id)}
            />
          ))}
        </ScrollView>

        <View>
          <Field
            placeholder="Search notes and categories"
            value={text}
            onChangeText={setText}
            returnKeyType="search"
          />
          <Feather
            name="search"
            size={16}
            color={c.textMuted}
            style={{ position: "absolute", right: 16, top: 18 }}
          />
        </View>
      </View>

      {filtering && (
        <T variant="small" color={c.textMuted}>
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
          {total > 0 ? ` · ${money(total)} spent` : ""}
        </T>
      )}

      {txs.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton style={{ height: 64 }} />
          <Skeleton style={{ height: 64 }} />
          <Skeleton style={{ height: 64 }} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filtering ? "No matches" : "No transactions this month"}
          hint={filtering ? "Try clearing a filter." : "Tap + to add one."}
        />
      ) : (
        <TransactionList
          transactions={filtered}
          categories={categories}
          onEdit={(tx) => router.push({ pathname: "/add", params: { id: tx.id } })}
          onDelete={deleteWithUndo}
        />
      )}
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        justifyContent: "center",
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? c.text : "rgba(244,244,240,0.25)",
        backgroundColor: selected ? c.text : "transparent",
      }}
    >
      <T variant="label" size={13} color={selected ? c.bg : c.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}
