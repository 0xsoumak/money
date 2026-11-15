import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PinPad } from "../components/PinPad";
import { ModalScreen } from "../components/Screen";
import { T } from "../components/T";
import { useToast } from "../components/Toast";
import { IconButton } from "../components/ui";
import { useAppLock } from "../lib/appLock";
import { success, warn } from "../lib/haptics";
import { c } from "../lib/theme";

type Mode = "setup" | "change" | "disable";
type Step = "current" | "new" | "confirm";

const FIRST: Record<Mode, Step> = { setup: "new", change: "current", disable: "current" };

const TITLE: Record<Step, string> = {
  current: "Enter your current PIN",
  new: "Choose a 6-digit PIN",
  confirm: "Enter it again",
};

/** PINs anyone would try first: all one digit, or a straight run up or down. */
function tooEasy(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = [...pin].slice(1).map((d, i) => Number(d) - Number(pin[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

/** Set up, change, or turn off the app PIN. Opened from Settings. */
export default function PinScreen() {
  const router = useRouter();
  const toast = useToast();
  const lock = useAppLock();
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = rawMode === "change" || rawMode === "disable" ? rawMode : "setup";

  const [step, setStep] = useState<Step>(FIRST[mode]);
  const [pin, setPin] = useState("");
  const [chosen, setChosen] = useState("");
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);

  const fail = (text: string) => {
    warn();
    setShake((n) => n + 1);
    setMessage(text);
    setPin("");
  };

  const next = (to: Step) => {
    setStep(to);
    setPin("");
    setMessage("");
  };

  const finish = (text: string) => {
    success();
    toast.show(text);
    router.back();
  };

  const complete = async (entered: string) => {
    if (step === "current") {
      const result = await lock.checkPin(entered);
      if (!result.ok) return fail(result.message);
      if (mode === "disable") {
        await lock.disable();
        return finish("App lock off");
      }
      return next("new");
    }
    if (step === "new") {
      if (tooEasy(entered)) return fail("Too easy to guess. Pick another.");
      setChosen(entered);
      return next("confirm");
    }
    if (entered !== chosen) {
      setChosen("");
      setStep("new");
      return fail("Those didn't match. Start again.");
    }
    await lock.savePin(entered);
    finish(mode === "setup" ? "App lock on" : "PIN changed");
  };

  const waiting = step === "current" && lock.lockedUntil !== null && lock.lockedUntil > Date.now();

  return (
    <ModalScreen>
      <View style={{ flexDirection: "row" }}>
        <IconButton label="Close" bordered onPress={() => router.back()}>
          <Feather name="x" size={20} color={c.text} />
        </IconButton>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly" }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <T variant="title" size={26} accessibilityRole="header">
            {TITLE[step]}
          </T>
          <T
            variant="small"
            color={message ? c.danger : c.textMuted}
            accessibilityLiveRegion="polite"
            style={{ minHeight: 20, textAlign: "center" }}
          >
            {waiting
              ? "Too many tries. Wait a moment."
              : message ||
                (step === "new" ? "You'll use it to open the app." : step === "confirm" ? " " : "")}
          </T>
        </View>
        <PinPad
          value={pin}
          onChange={(v) => {
            setMessage("");
            setPin(v);
          }}
          onComplete={(entered) => void complete(entered)}
          shake={shake}
          disabled={waiting}
        />
      </View>
    </ModalScreen>
  );
}
