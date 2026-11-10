import type { ComponentProps, ReactNode, Ref } from "react";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { tap } from "../lib/haptics";
import { c, radius, TARGET } from "../lib/theme";
import { T } from "./T";

type Variant = "primary" | "outline" | "ghost" | "danger";

const PALETTE: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
  outline: { bg: "transparent", fg: c.text, border: "rgba(244,244,240,0.3)" },
  ghost: { bg: "transparent", fg: c.textMuted, border: "transparent" },
  danger: { bg: "transparent", fg: c.danger, border: "rgba(255,107,91,0.5)" },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  busy,
  style,
  height = 56,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  height?: number;
}) {
  const p = PALETTE[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          backgroundColor: p.bg,
          borderColor: p.border,
          opacity: off ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <T variant="label" color={p.fg} size={15}>
          {title}
        </T>
      )}
    </Pressable>
  );
}

/** A 44×44 tap target for an icon. `label` is read by screen readers. */
export function IconButton({
  label,
  onPress,
  children,
  bordered,
  style,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.iconButton,
        bordered && styles.bordered,
        { opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="label" size={14}>
        {title}
      </T>
      {right}
    </View>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <T variant="title" size={22}>
        {title}
      </T>
      {hint ? (
        <T variant="body" color={c.textMuted} style={{ fontWeight: "400" }}>
          {hint}
        </T>
      ) : null}
      {action}
    </View>
  );
}

export function Field(props: TextInputProps & { label?: string; ref?: Ref<TextInputInstance> }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T variant="label" color={c.textMuted} size={13}>
          {label}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={c.textFaint}
        selectionColor={c.accent}
        accessibilityLabel={label ?? props.placeholder}
        {...rest}
        style={[styles.field, style]}
      />
    </View>
  );
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[{ backgroundColor: c.surfaceStrong, borderRadius: radius.md, opacity: 0.6 }, style]}
    />
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }} />;
}

/** Re-export so screens can type props that wrap a Pressable without importing RN twice. */
export type PressableProps = ComponentProps<typeof Pressable>;

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.lg,
    borderWidth: 2,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: TARGET,
    height: TARGET,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  bordered: { borderWidth: 2, borderColor: "rgba(244,244,240,0.25)" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: c.borderStrong,
    paddingBottom: 8,
  },
  empty: { gap: 12, paddingVertical: 36, alignItems: "flex-start" },
  field: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: "rgba(244,244,240,0.25)",
    paddingHorizontal: 14,
    color: c.text,
    fontSize: 17,
    fontFamily: "SpaceGrotesk_500Medium",
  },
});
