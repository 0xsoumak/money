import type { ReactNode } from "react";
import { RefreshControl, ScrollView, type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { c } from "../lib/theme";

/** A scrolling dark screen that respects the status bar and leaves room for the tab bar and add button. */
export function Screen({
  children,
  refreshing,
  onRefresh,
  contentStyle,
  bottomSpace = 32,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  bottomSpace?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[
        { paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: bottomSpace, gap: 28 },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
            progressBackgroundColor={c.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** Full-height dark container for modal screens. */
export function ModalScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.bg,
        paddingTop: Math.max(insets.top, 12),
        paddingBottom: Math.max(insets.bottom, 12),
        paddingHorizontal: 16,
      }}
    >
      {children}
    </View>
  );
}
