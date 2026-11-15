import { Feather } from "@expo/vector-icons";
import { moveItem, TRANSACTION_TYPES, TYPE_PLURAL } from "@money/shared";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { duration, ease } from "../components/motion";
import { T } from "../components/T";
import { useToast } from "../components/Toast";
import { Button, EmptyState, IconButton, SectionHeader } from "../components/ui";
import { tap } from "../lib/haptics";
import {
  type Category,
  categoriesQuery,
  useReorderCategories,
  useUpdateCategory,
} from "../lib/queries";
import { c, cat } from "../lib/theme";

export default function Categories() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const update = useUpdateCategory();
  const reorder = useReorderCategories();
  const { data: categories = [], isPending } = useQuery(categoriesQuery);
  const [reordering, setReordering] = useState(false);

  /** Moves a category one step within its kind and saves the new order straight away. */
  const move = (list: Category[], x: Category, by: -1 | 1) => {
    tap();
    const ids = list.map((y) => y.id);
    reorder.mutate(moveItem(ids, x.id, by), {
      onError: (err) => toast.show(`Couldn't save the order: ${err.message}`, { tone: "error" }),
    });
  };

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
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton label="Back" bordered onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={c.text} />
        </IconButton>
        <Button
          title={reordering ? "Done" : "Reorder"}
          variant={reordering ? "primary" : "outline"}
          height={44}
          onPress={() => setReordering((v) => !v)}
        />
      </View>
      <T variant="title" size={44} accessibilityRole="header">
        Categories
      </T>

      {isPending
        ? null
        : TRANSACTION_TYPES.map((kind) => {
            const list = active.filter((x) => x.kind === kind);
            return (
              <View key={kind}>
                <SectionHeader
                  title={TYPE_PLURAL[kind]}
                  right={
                    reordering ? undefined : (
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
                    )
                  }
                />
                {list.length === 0 ? (
                  <EmptyState title={`No ${kind} categories`} />
                ) : (
                  list.map((x, i) => (
                    <Animated.View
                      key={x.id}
                      layout={LinearTransition.duration(duration.base).easing(ease)}
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
                        disabled={reordering}
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
                      {reordering ? (
                        <View style={{ flexDirection: "row" }}>
                          <MoveButton
                            label={`Move ${x.name} up`}
                            icon="arrow-up"
                            disabled={i === 0}
                            onPress={() => move(list, x, -1)}
                          />
                          <MoveButton
                            label={`Move ${x.name} down`}
                            icon="arrow-down"
                            disabled={i === list.length - 1}
                            onPress={() => move(list, x, 1)}
                          />
                        </View>
                      ) : (
                        <Button
                          title="Archive"
                          variant="ghost"
                          height={44}
                          onPress={() => setArchived(x, true)}
                        />
                      )}
                    </Animated.View>
                  ))
                )}
              </View>
            );
          })}

      {archived.length > 0 && !reordering && (
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

function MoveButton({
  label,
  icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: "arrow-up" | "arrow-down";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View style={{ opacity: disabled ? 0.25 : 1 }} pointerEvents={disabled ? "none" : "auto"}>
      <IconButton label={label} onPress={onPress}>
        <Feather name={icon} size={20} color={c.text} />
      </IconButton>
    </View>
  );
}
