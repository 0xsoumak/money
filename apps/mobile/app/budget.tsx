import { Feather } from "@expo/vector-icons";
import { parseAmount, toDecimalString } from "@money/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { ModalScreen } from "../components/Screen";
import { Label, T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton } from "../components/ui";
import { success } from "../lib/haptics";
import { useMoney } from "../lib/hooks";
import { useClearBudget, useSetBudget } from "../lib/queries";
import { c } from "../lib/theme";

/** Set, change or remove one monthly limit. Opened from the Budgets tab. */
export default function BudgetModal() {
  const router = useRouter();
  const toast = useToast();
  const money = useMoney();
  const params = useLocalSearchParams<{
    key: string;
    title: string;
    current: string;
    spent: string;
  }>();
  const set = useSetBudget();
  const clear = useClearBudget();

  const current = params.current ? Number(params.current) : null;
  const spent = Number(params.spent ?? 0);
  const title = params.title ?? "Budget";

  const [text, setText] = useState(current ? toDecimalString(current).replace(/\.00$/, "") : "");
  const amount = parseAmount(text);
  const valid = amount !== null && amount > 0;
  const busy = set.isPending || clear.isPending;

  const save = () => {
    if (!valid || amount === null || !params.key) return;
    set.mutate(
      { key: params.key, amount },
      {
        onSuccess: () => {
          success();
          toast.show(`${title} limit set to ${money(amount)}`);
          router.back();
        },
        onError: (err) => toast.show(err.message, { tone: "error" }),
      },
    );
  };

  const remove = () => {
    if (!params.key) return;
    clear.mutate(params.key, {
      onSuccess: () => {
        toast.show(`Removed ${title} limit`);
        router.back();
      },
      onError: (err) => toast.show(err.message, { tone: "error" }),
    });
  };

  return (
    <ModalScreen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View style={{ gap: 4 }}>
            <Label>Monthly limit</Label>
            <T variant="title" size={26} accessibilityRole="header">
              {title}
            </T>
          </View>
          <IconButton label="Close" bordered onPress={() => router.back()}>
            <Feather name="x" size={20} color={c.text} />
          </IconButton>
        </View>

        <View style={{ marginTop: 28, gap: 16 }}>
          <Field
            label="Amount"
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0"
            autoFocus
            style={{ fontSize: 28, fontFamily: "SpaceGrotesk_700Bold", minHeight: 64 }}
          />
          <T variant="small" color={c.textMuted}>
            Applies to every month. Spent so far this month: {money(spent)}.
          </T>
        </View>

        <View style={{ flex: 1 }} />
        <View style={{ gap: 10 }}>
          <Button title="Save limit" onPress={save} disabled={!valid} busy={busy} />
          {current ? (
            <Button title="Remove limit" variant="danger" onPress={remove} disabled={busy} />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </ModalScreen>
  );
}
