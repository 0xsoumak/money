import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { c, radius } from "../lib/theme";
import { T } from "./T";

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "error";
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (
    message: string,
    opts?: { action?: ToastItem["action"]; tone?: ToastItem["tone"] },
  ) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let nextId = 1;

/** Height of the tab bar, so toasts sit above it. */
const TAB_BAR = 64;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, opts = {}) => {
      const id = nextId++;
      setToasts((list) => [
        ...list.slice(-2),
        { id, message, tone: opts.tone ?? "default", action: opts.action },
      ]);
      setTimeout(() => dismiss(id), opts.action ? 6000 : 4000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { bottom: insets.bottom + TAB_BAR + 12 }]}
        accessibilityLiveRegion="polite"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [opacity]);

  const error = toast.tone === "error";
  return (
    <Animated.View
      style={[styles.toast, { opacity, borderColor: error ? c.danger : c.borderStrong }]}
    >
      <T variant="small" size={15} color={error ? c.danger : c.text} style={{ flex: 1 }}>
        {toast.message}
      </T>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          style={styles.action}
        >
          <T variant="label" color={c.accent} size={13}>
            {toast.action.label}
          </T>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 16, right: 16, gap: 8, alignItems: "center" },
  toast: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surface,
    borderWidth: 2,
    borderRadius: radius.lg,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 52,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
});
