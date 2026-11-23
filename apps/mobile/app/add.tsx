import { Feather } from "@expo/vector-icons";
import {
  dayLabel,
  ENTRY_TEXT_MAX,
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  type TextInputInstance,
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
import {
  categoriesQuery,
  type Tx,
  useAiEntry,
  useDeleteTransaction,
  useSaveTransaction,
} from "../lib/queries";
import { storage } from "../lib/storage";
import { c, catTint, radius } from "../lib/theme";

const lastKey = (type: TransactionType) => `mt:lastCategory:${type}`;

// Manual entry or "describe it" with AI. The last one picked sticks for the next new entry.
type Mode = "manual" | "ai";
const MODE_KEY = "mt:entryMode";
const AI_EXAMPLES = ["450 groceries", "1200 dinner yesterday", "Salary 75000", "5000 into SIP"];

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
  const ai = useAiEntry();
  const [describe, setDescribe] = useState("");
  const describeRef = useRef<TextInputInstance>(null);
  const [mode, setModeState] = useState<Mode>("manual");

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
  // Editing is always manual; the AI box only makes new entries.
  const aiMode = mode === "ai" && !editing;

  useEffect(() => {
    if (editing) return;
    let cancelled = false;
    void storage.get(MODE_KEY).then((m) => {
      if (!cancelled && m === "ai") setModeState("ai");
    });
    return () => {
      cancelled = true;
    };
  }, [editing]);

  const setMode = (m: Mode) => {
    if (m === mode) return;
    tap();
    setModeState(m);
    void storage.set(MODE_KEY, m);
  };

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

  /** "spent 500 on dinner yesterday": the server asks the model and saves it; we offer Undo. */
  const submitDescribe = () => {
    const text = describe.trim();
    if (!text || ai.isPending) return;
    tap();
    ai.mutateAsync({ id, text, today: today() }).then(
      ({ transaction: tx }) => {
        const category = categories.find((x) => x.id === tx.categoryId);
        const where = category ? ` · ${category.emoji} ${category.name}` : "";
        success();
        toast.show(`Added ${money(tx.amount)}${where} · ${dayLabel(tx.date)}`, {
          action: { label: "Undo", onClick: () => remove.mutate(tx.id) },
        });
        void nudge(tx, undefined);
        router.back();
      },
      (err: Error) => {
        warn();
        toast.show(err.message, { tone: "error" });
      },
    );
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
          {/* First choice: type it in yourself, or describe it and let the AI fill it in. */}
          {!editing && (
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: "row",
                gap: 4,
                padding: 4,
                borderRadius: radius.lg + 4,
                backgroundColor: c.surface,
              }}
            >
              {(["manual", "ai"] as const).map((m) => {
                const on = mode === m;
                const bg = on ? (m === "ai" ? c.accent : c.text) : "transparent";
                const fg = on ? (m === "ai" ? c.onAccent : c.bg) : c.textMuted;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => setMode(m)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 18,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderRadius: radius.lg,
                      backgroundColor: bg,
                    }}
                  >
                    {m === "ai" ? <Feather name="zap" size={14} color={fg} /> : null}
                    <T variant="label" size={13} color={fg}>
                      {m === "ai" ? "AI" : "Manual"}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Then the type. In AI mode the model works it out from the sentence. */}
        {!aiMode && (
          <View style={{ flexDirection: "row", gap: 6, paddingTop: 8, paddingBottom: 8 }}>
            {TRANSACTION_TYPES.map((t) => (
              <Pressable
                key={t}
                accessibilityRole="button"
                accessibilityState={{ selected: type === t }}
                onPress={() => switchType(t)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
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
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 16, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {aiMode ? (
            <View style={{ gap: 10 }}>
              <Label>What happened?</Label>
              <TextInput
                ref={describeRef}
                value={describe}
                onChangeText={setDescribe}
                placeholder="Spent 500 on dinner yesterday"
                placeholderTextColor={c.textFaint}
                selectionColor={c.accent}
                accessibilityLabel="Describe it"
                maxLength={ENTRY_TEXT_MAX}
                editable={!ai.isPending}
                autoFocus
                multiline
                // Return sends rather than adding a line.
                submitBehavior="submit"
                returnKeyType="send"
                onSubmitEditing={submitDescribe}
                style={{
                  minHeight: 120,
                  padding: 16,
                  borderRadius: radius.lg,
                  borderWidth: 2,
                  borderColor: describe ? c.accent : "rgba(244,244,240,0.25)",
                  color: c.text,
                  fontSize: 22,
                  lineHeight: 30,
                  fontFamily: "SpaceGrotesk_600SemiBold",
                  textAlignVertical: "top",
                  opacity: ai.isPending ? 0.6 : 1,
                }}
              />
              <T variant="small" color={c.textFaint}>
                Say the amount, what it was for and when. The category, type and date are worked out
                for you, and you can undo it.
              </T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                {AI_EXAMPLES.map((ex) => (
                  <Pressable
                    key={ex}
                    accessibilityRole="button"
                    accessibilityLabel={`Use example: ${ex}`}
                    onPress={() => {
                      tap();
                      setDescribe(ex);
                      describeRef.current?.focus();
                    }}
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      borderRadius: radius.lg,
                      borderWidth: 2,
                      borderColor: "rgba(244,244,240,0.25)",
                    }}
                  >
                    <T variant="small" size={14} color={c.textMuted}>
                      {ex}
                    </T>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
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
                          ...(selected
                            ? catTint(x.color)
                            : {
                                borderColor: "rgba(244,244,240,0.25)",
                                backgroundColor: "transparent",
                              }),
                        }}
                      >
                        <T variant="body" size={15}>
                          {x.emoji}
                        </T>
                        <T variant="body" size={15} color={c.text}>
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

              <View
                style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}
              >
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
            </>
          )}
        </ScrollView>

        {/* Outside the scroll view, so it rides just above the keyboard. */}
        {aiMode ? (
          <Button
            title={ai.isPending ? "Adding" : describe.trim() ? "Add it" : "Describe it first"}
            onPress={submitDescribe}
            busy={ai.isPending}
            disabled={!describe.trim()}
            style={{ marginTop: 8 }}
          />
        ) : (
          <Button
            title={canSave && minor ? `Save ${money(minor)}` : "Enter an amount"}
            onPress={submit}
            disabled={!canSave}
            style={{ marginTop: 8 }}
          />
        )}
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
