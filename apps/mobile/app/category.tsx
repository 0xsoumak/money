import { Feather } from "@expo/vector-icons";
import { CATEGORY_COLORS, type CategoryColor, type TransactionType } from "@money/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { ModalScreen } from "../components/Screen";
import { Label, T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, Field, IconButton } from "../components/ui";
import { success, tap } from "../lib/haptics";
import { categoriesQuery, useCreateCategory, useUpdateCategory } from "../lib/queries";
import { c, cat, radius } from "../lib/theme";

const EMOJI = [
  "🍜",
  "🛒",
  "🚕",
  "🛍️",
  "💡",
  "🏠",
  "💊",
  "🎬",
  "✈️",
  "📦",
  "☕",
  "🍺",
  "🎁",
  "📚",
  "💻",
  "📱",
  "🐶",
  "👶",
  "🏋️",
  "💇",
  "🔧",
  "🎓",
  "💼",
  "💰",
  "📈",
  "🎮",
  "🚗",
  "⛽",
];

/** Add or edit a category. `?id=` edits one; `?kind=` adds a new expense or income category. */
export default function CategoryModal() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const create = useCreateCategory();
  const update = useUpdateCategory();

  const existing = params.id ? categories.find((x) => x.id === params.id) : undefined;
  const kind: TransactionType = existing?.kind ?? (params.kind === "income" ? "income" : "expense");

  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "📦");
  const [color, setColor] = useState<CategoryColor>((existing?.color as CategoryColor) ?? "slate");

  const busy = create.isPending || update.isPending;
  const valid = name.trim().length > 0 && emoji.trim().length > 0;

  const done = {
    onSuccess: () => {
      success();
      router.back();
    },
    onError: (err: Error) => toast.show(err.message, { tone: "error" }),
  };
  const submit = () => {
    if (!valid) return;
    if (existing) update.mutate({ id: existing.id, name: name.trim(), emoji, color }, done);
    else create.mutate({ name: name.trim(), emoji, color, kind }, done);
  };

  return (
    <ModalScreen>
      <ScrollView
        contentContainerStyle={{ gap: 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Label>{existing ? "Edit category" : `New ${kind} category`}</Label>
          <IconButton label="Close" bordered onPress={() => router.back()}>
            <Feather name="x" size={20} color={c.text} />
          </IconButton>
        </View>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          maxLength={40}
          returnKeyType="done"
        />

        <View style={{ gap: 10 }}>
          <Label>Icon</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {EMOJI.map((e) => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={e}
                accessibilityState={{ selected: emoji === e }}
                onPress={() => {
                  tap();
                  setEmoji(e);
                }}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.lg,
                  backgroundColor: emoji === e ? c.surfaceStrong : "transparent",
                  borderWidth: 2,
                  borderColor: emoji === e ? c.accent : "transparent",
                }}
              >
                <T variant="title" size={22}>
                  {e}
                </T>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Label>Color</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {CATEGORY_COLORS.map((col) => (
              <Pressable
                key={col}
                accessibilityRole="button"
                accessibilityLabel={col}
                accessibilityState={{ selected: color === col }}
                onPress={() => {
                  tap();
                  setColor(col);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: radius.lg,
                  backgroundColor: cat(col),
                  borderWidth: 3,
                  borderColor: color === col ? c.text : "transparent",
                }}
              />
            ))}
          </View>
        </View>

        <View style={{ flex: 1 }} />
        <Button title="Save" onPress={submit} disabled={!valid} busy={busy} />
      </ScrollView>
    </ModalScreen>
  );
}
