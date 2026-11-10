import { Feather } from "@expo/vector-icons";
import {
  dayLabel,
  newId,
  parseAmount,
  type TransactionType,
  toDecimalString,
  today,
} from "@money/shared";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { NumberPad } from "../components/NumberPad";
import { ModalScreen } from "../components/Screen";
import { Label, T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton } from "../components/ui";
import { success, tap, warn } from "../lib/haptics";
import { useMoney } from "../lib/hooks";
import { categoriesQuery, type Tx, useDeleteTransaction, useSaveTransaction } from "../lib/queries";
import { storage } from "../lib/storage";
import { c, cat, radius } from "../lib/theme";

const lastKey = (type: TransactionType) => `mt:lastCategory:${type}`;

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return today(d);
}

/** "2026-11-08" to a local Date at noon, so the date picker never slips a day across time zones. */
const toDate = (s: string) => new Date(`${s}T12:00:00`);

/** Quick add and edit. Opened from the + button, or by tapping a transaction. */
export default function Add() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const money = useMoney();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  // For an edit, the transaction is already in the cache from the list the user tapped.
  const existing = useMemo(
    () =>
      editId
        ? qc
            .getQueriesData<Tx[]>({ queryKey: ["transactions"] })
            .flatMap(([, rows]) => rows ?? [])
            .find((t) => t.id === editId)
        : undefined,
    [editId, qc],
  );
  const editing = !!existing;

  const [id] = useState(() => existing?.id ?? newId());
  const [type, setType] = useState<TransactionType>(existing?.type ?? "expense");
  const [amount, setAmount] = useState(
    existing ? toDecimalString(existing.amount).replace(/\.00$/, "") : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [date, setDate] = useState(existing?.date ?? today());
  const [note, setNote] = useState(existing?.note ?? "");
  const [showWebPicker, setShowWebPicker] = useState(false);

  const usable = categories.filter(
    (x) => x.kind === type && (!x.archivedAt || x.id === categoryId),
  );

  // Pick the last-used category for this type (or the first one) whenever none is chosen.
  useEffect(() => {
    if (categoryId || categories.length === 0) return;
    let cancelled = false;
    (async () => {
      const options = categories.filter((x) => x.kind === type && !x.archivedAt);
      const last = await storage.get(lastKey(type));
      if (!cancelled)
        setCategoryId(options.find((x) => x.id === last)?.id ?? options[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId, categories, type]);

  const switchType = (next: TransactionType) => {
    if (next === type) return;
    tap();
    setType(next);
    setCategoryId(null); // re-picked by the effect above
  };

  const minor = parseAmount(amount);
  const canSave = !!minor && minor > 0 && !!categoryId && !!date;

  const submit = () => {
    if (!canSave || !minor || !categoryId) return;
    const vars = {
      id,
      type,
      amount: minor,
      categoryId,
      date,
      note: note.trim() || null,
    };
    const send = () =>
      save.mutate(vars, {
        onError: (err) => {
          warn();
          toast.show(`Couldn't save: ${err.message}`, {
            tone: "error",
            action: { label: "Retry", onClick: send },
          });
        },
      });
    send();
    void storage.set(lastKey(type), categoryId);
    success();
    toast.show(editing ? "Updated" : `Saved ${money(minor)}`, {
      action: editing ? undefined : { label: "Undo", onClick: () => remove.mutate(id) },
    });
    router.back();
  };

  const pickDate = () => {
    tap();
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: toDate(date),
        mode: "date",
        maximumDate: new Date(2100, 0, 1),
        onChange: (_event, picked) => {
          if (picked) setDate(today(picked));
        },
      });
    } else {
      setShowWebPicker((v) => !v);
    }
  };

  const isToday = date === today();
  const isYesterday = date === yesterday();

  return (
    <ModalScreen>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <IconButton label="Close" bordered onPress={() => router.back()}>
            <Feather name="x" size={20} color={c.text} />
          </IconButton>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {(["expense", "income"] as const).map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t }}
                onPress={() => switchType(t)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 16,
                  justifyContent: "center",
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: type === t ? c.text : "rgba(244,244,240,0.25)",
                  backgroundColor: type === t ? c.text : "transparent",
                }}
              >
                <T variant="label" size={13} color={type === t ? c.bg : c.textMuted}>
                  {t}
                </T>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ paddingTop: 4 }}>
          <Label>
            {editing ? "Editing" : "New"} · {type}
          </Label>
          <T
            variant="amount"
            size={72}
            fit
            color={amount ? c.accent : c.textFaint}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`Amount ${amount || "zero"}`}
            style={{ marginTop: 4 }}
          >
            {amount || "0"}
          </T>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 8 }}
          style={{ flexGrow: 0 }}
        >
          {usable.map((x) => {
            const selected = x.id === categoryId;
            return (
              <Pressable
                key={x.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={x.name}
                onPress={() => {
                  tap();
                  setCategoryId(x.id);
                }}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 14,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: selected ? cat(x.color) : "rgba(244,244,240,0.25)",
                  backgroundColor: selected ? cat(x.color) : "transparent",
                }}
              >
                <T variant="body" size={15}>
                  {x.emoji}
                </T>
                <T variant="body" size={15} color={selected ? c.onAccent : c.text}>
                  {x.name}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>

        <Field
          placeholder="Add a note"
          value={note}
          onChangeText={setNote}
          maxLength={500}
          returnKeyType="done"
          style={{ minHeight: 48 }}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <DateChip
            label="Today"
            active={isToday}
            onPress={() => {
              tap();
              setDate(today());
            }}
          />
          <DateChip
            label="Yesterday"
            active={isYesterday}
            onPress={() => {
              tap();
              setDate(yesterday());
            }}
          />
          <DateChip
            label={isToday || isYesterday ? "Pick date" : dayLabel(date)}
            active={!isToday && !isYesterday}
            icon
            onPress={pickDate}
          />
        </View>
        {showWebPicker && Platform.OS !== "android" ? (
          <DateTimePicker
            value={toDate(date)}
            mode="date"
            onChange={(_e, picked) => {
              if (picked) setDate(today(picked));
            }}
          />
        ) : null}

        <View style={{ flex: 1 }} />
        <NumberPad value={amount} onChange={setAmount} />
        <Button
          title={canSave && minor ? `Save ${money(minor)}` : "Enter an amount"}
          onPress={submit}
          disabled={!canSave}
        />
      </ScrollView>
    </ModalScreen>
  );
}

function DateChip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 14,
        borderRadius: radius.lg,
        backgroundColor: active ? c.surfaceStrong : "transparent",
      }}
    >
      {icon ? <Feather name="calendar" size={15} color={active ? c.text : c.textMuted} /> : null}
      <T
        variant="small"
        size={14}
        color={active ? c.text : c.textMuted}
        style={{ fontWeight: "600" }}
      >
        {label}
      </T>
    </Pressable>
  );
}
