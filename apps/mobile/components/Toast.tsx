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
import { Pressable, StyleSheet, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { c, radius } from "../lib/theme";
import { duration, ease, timing } from "./motion";
import { T } from "./T";

interface ToastItem {
  id: number;
  message: string;
  tone: "default" | "warning" | "error";
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

/** How far (px) a toast must be dragged sideways before letting go dismisses it. */
const DISMISS_AT = 80;

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const error = toast.tone === "error";
  const tint = error ? c.danger : toast.tone === "warning" ? c.warning : null;
  const x = useSharedValue(0);

  // Swipe sideways to dismiss. Vertical drags are ignored so they don't fight scrolling.
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      x.value = e.translationX;
    },
    onDeactivate: (e) => {
      if (Math.abs(e.translationX) > DISMISS_AT || Math.abs(e.velocityX) > 800) {
        const dir = Math.sign(e.translationX || e.velocityX);
        x.value = withTiming(dir * 400, timing.base);
        scheduleOnRN(onDismiss);
      } else {
        x.value = withTiming(0, timing.base);
      }
    },
  });

  const drag = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    opacity: 1 - Math.min(1, Math.abs(x.value) / 240),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        entering={FadeInDown.duration(duration.base).easing(ease)}
        exiting={FadeOut.duration(duration.fast)}
        layout={LinearTransition.duration(duration.base).easing(ease)}
        style={[styles.toast, { borderColor: tint ?? c.borderStrong }, drag]}
      >
        <T variant="small" size={15} color={tint ?? c.text} style={{ flex: 1 }}>
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
    </GestureDetector>
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
