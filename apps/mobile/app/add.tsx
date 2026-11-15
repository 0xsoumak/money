import { Feather } from "@expo/vector-icons";
import {
  dayLabel,
  newId,
  parseAmount,
  pressKey,
  TRANSACTION_TYPES,
  type TransactionType,
  TYPE_LABEL,
  toDecimalString,
  today,
} from "@money/shared";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { PressableScale } from "../components/motion";
import { ModalScreen } from "../components/Screen";
import { Label, T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton } from "../components/ui";
import { useBudgetNudge } from "../lib/budgetNudge";
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

/**
 * Cleans whatever the keyboard typed or pasted into a valid amount, using the same
 * rules as the web keypad (one decimal point, two decimals, a sane length).
 * Some locales' keypads type "," for the decimal point.
 */
const cleanAmount = (text: string) => [...text.replace(/,/g, ".")].reduce(pressKey, "");

/** Quick add and edit. Opened from the + button, or by tapping a transaction. */
export default function Add() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const money = useMoney();
  const { id: editId, type: presetType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();
  const nudge = useBudgetNudge();

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
  const [type, setType] = useState<TransactionType>(
    existing?.type ??
      ((TRANSACTION_TYPES as readonly string[]).includes(presetType ?? "")
        ? (presetType as TransactionType)
        : "expense"),
  );
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
    // mutateAsync, not mutate: this screen closes straight away, and mutate's own callbacks
    // are dropped once it unmounts, which would swallow the error toast and the nudge.
    const send = () =>
      save.mutateAsync(vars).then(
        () => nudge(vars, existing),
        (err: Error) => {
          warn();
          toast.show(`Couldn't save: ${err.message}`, {
            tone: "error",
            action: { label: "Retry", onClick: send },
          });
        },
      );
    void send();
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
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 8,
          }}
        >
          <IconButton label="Close" bordered onPress={() => router.back()}>
            <Feather name="x" size={20} color={c.text} />
          </IconButton>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {TRANSACTION_TYPES.map((t) => (
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
                  {TYPE_LABEL[t]}
                </T>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <Label>
              {editing ? "Editing" : "New"} · {type}
            </Label>
            <TextInput
              value={amount}
              onChangeText={(text) => setAmount(cleanAmount(text))}
              placeholder="0"
              placeholderTextColor={c.textFaint}
              keyboardType="decimal-pad"
              inputMode="decimal"
              autoFocus={!editing}
              selectionColor={c.accent}
              accessibilityLabel="Amount"
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={submit}
              style={{
                marginTop: 4,
                paddingVertical: 0,
                color: c.accent,
                fontSize: 56,
                fontFamily: "SpaceGrotesk_700Bold",
                letterSpacing: -2,
                fontVariant: ["tabular-nums"],
              }}
            />
          </View>

          <View style={{ gap: 8 }}>
            <Label>Category</Label>
            <View
              accessibilityRole="radiogroup"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            >
              {usable.map((x) => {
                const selected = x.id === categoryId;
                return (
                  <PressableScale
                    key={x.id}
                    accessibilityRole="radio"
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
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <Field
            placeholder="Add a note"
            value={note}
            onChangeText={setNote}
            maxLength={500}
            returnKeyType="done"
            style={{ minHeight: 48 }}
          />

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
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
        </ScrollView>

        {/* Outside the scroll view, so it rides just above the keyboard. */}
        <Button
          title={canSave && minor ? `Save ${money(minor)}` : "Enter an amount"}
          onPress={submit}
          disabled={!canSave}
          style={{ marginTop: 8 }}
        />
      </KeyboardAvoidingView>
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
