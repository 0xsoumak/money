import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, EmptyState, IconButton, SectionHeader } from "../components/ui";
import { type Category, categoriesQuery, useUpdateCategory } from "../lib/queries";
import { c, cat } from "../lib/theme";

export default function Categories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const update = useUpdateCategory();
  const { data: categories = [], isPending } = useQuery(categoriesQuery);

  const active = categories.filter((x) => !x.archivedAt);
  const archived = categories.filter((x) => x.archivedAt);

  const setArchived = (x: Category, archive: boolean) =>
    update.mutate(
      { id: x.id, archived: archive },
      {
        onSuccess: () =>
          toast.show(archive ? `Archived ${x.name}` : `Restored ${x.name}`, {
            action: {
              label: "Undo",
              onClick: () => update.mutate({ id: x.id, archived: !archive }),
            },
          }),
        onError: (err) => toast.show(`Couldn't update: ${err.message}`, { tone: "error" }),
      },
    );

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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconButton label="Back" bordered onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={c.text} />
        </IconButton>
      </View>
      <T variant="title" size={44} accessibilityRole="header">
        Categories
      </T>

      {isPending
        ? null
        : (["expense", "income"] as const).map((kind) => {
            const list = active.filter((x) => x.kind === kind);
            return (
              <View key={kind}>
                <SectionHeader
                  title={kind === "expense" ? "Expenses" : "Income"}
                  right={
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => router.push({ pathname: "/category", params: { kind } })}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Feather name="plus" size={16} color={c.accent} />
                      <T variant="label" size={13} color={c.accent}>
                        Add
                      </T>
                    </Pressable>
                  }
                />
                {list.length === 0 ? (
                  <EmptyState title={`No ${kind} categories`} />
                ) : (
                  list.map((x) => (
                    <View
                      key={x.id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: c.border,
                      }}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${x.name}`}
                        onPress={() => router.push({ pathname: "/category", params: { id: x.id } })}
                        style={{
                          flex: 1,
                          minHeight: 64,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: cat(x.color),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <T variant="body" size={20}>
                            {x.emoji}
                          </T>
                        </View>
                        <T variant="body" numberOfLines={1} style={{ flex: 1 }}>
                          {x.name}
                        </T>
                      </Pressable>
                      <Button
                        title="Archive"
                        variant="ghost"
                        height={44}
                        onPress={() => setArchived(x, true)}
                      />
                    </View>
                  ))
                )}
              </View>
            );
          })}

      {archived.length > 0 && (
        <View>
          <SectionHeader title="Archived" />
          <T variant="small" color={c.textMuted} style={{ marginVertical: 8 }}>
            Hidden from pickers. Past transactions keep their category.
          </T>
          {archived.map((x) => (
            <View
              key={x.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                opacity: 0.7,
                borderBottomWidth: 1,
                borderBottomColor: c.border,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: cat(x.color),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T variant="body" size={20}>
                  {x.emoji}
                </T>
              </View>
              <T variant="body" numberOfLines={1} style={{ flex: 1 }}>
                {x.name}
              </T>
              <Button
                title="Restore"
                variant="ghost"
                height={44}
                onPress={() => setArchived(x, false)}
              />
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
