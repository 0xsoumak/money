import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Label, T } from "../../components/T";
import { useToast } from "../../components/Toast";
import { Button, SectionHeader } from "../../components/ui";
import { LOCK_DELAYS, useAppLock } from "../../lib/appLock";
import { API_URL } from "../../lib/config";
import { tap } from "../../lib/haptics";
import { useSettings, useUpdateSettings } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { c, radius } from "../../lib/theme";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"];

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const update = useUpdateSettings();
  const { signOut } = useSession();
  const lock = useAppLock();
  const [lockBusy, setLockBusy] = useState(false);

  const toggleLock = async (on: boolean) => {
    setLockBusy(true);
    const result = await lock.setEnabled(on);
    setLockBusy(false);
    if (result.ok) toast.show(on ? "App lock on" : "App lock off");
    else if (result.message !== "Cancelled.") toast.show(result.message, { tone: "error" });
  };

  const save = (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, {
      onSuccess: () => toast.show("Saved"),
      onError: (err) => toast.show(`Couldn't save: ${err.message}`, { tone: "error" }),
    });

  return (
    <Screen>
      <T variant="title" size={44} accessibilityRole="header">
        Settings
      </T>

      <View style={{ gap: 14 }}>
        <SectionHeader title="Categories" />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/categories")}
          style={({ pressed }) => ({
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <T variant="body">Manage categories</T>
          <Feather name="chevron-right" size={22} color={c.textMuted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/investments")}
          style={({ pressed }) => ({
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <T variant="body">Investments</T>
          <Feather name="chevron-right" size={22} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={{ gap: 14 }}>
        <SectionHeader title="Money" />
        <Label>Currency</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CURRENCIES.map((cur) => (
            <Choice
              key={cur}
              label={cur}
              selected={settings.currency === cur}
              onPress={() => save({ currency: cur })}
            />
          ))}
        </View>
        <T variant="small" color={c.textMuted}>
          Changing the currency only changes how amounts are shown. It does not convert anything.
        </T>
      </View>

      {lock.supported ? (
        <View style={{ gap: 14 }}>
          <SectionHeader title="Security" />
          <View
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <T variant="body">App lock</T>
              <T variant="small" color={c.textMuted}>
                Ask for your fingerprint or phone PIN to open the app.
              </T>
            </View>
            <Switch
              accessibilityLabel="App lock"
              value={lock.enabled}
              disabled={lockBusy}
              onValueChange={(on) => void toggleLock(on)}
              trackColor={{ false: c.surfaceStrong, true: c.accent }}
              thumbColor={lock.enabled ? c.onAccent : c.textMuted}
            />
          </View>
          {lock.enabled ? (
            <>
              <Label>Lock again</Label>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {LOCK_DELAYS.map((d) => (
                  <Choice
                    key={d.ms}
                    label={d.label}
                    selected={lock.delayMs === d.ms}
                    onPress={() => void lock.setDelay(d.ms)}
                  />
                ))}
              </View>
              <T variant="small" color={c.textMuted}>
                How long the app can sit in the background before it locks.
              </T>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: 14 }}>
        <SectionHeader title="Account" />
        <Button title="Sign out" variant="outline" onPress={() => void signOut()} />
        <T variant="caption" color={c.textFaint}>
          Money {Constants.expoConfig?.version ?? ""} · {API_URL.replace(/^https?:\/\//, "")}
        </T>
      </View>
    </Screen>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        minHeight: 44,
        paddingHorizontal: 14,
        justifyContent: "center",
        borderRadius: radius.lg,
        borderWidth: 2,
        borderColor: selected ? c.accent : "rgba(244,244,240,0.25)",
        backgroundColor: selected ? c.accent : "transparent",
      }}
    >
      <T variant="label" size={13} color={selected ? c.onAccent : c.textMuted}>
        {label}
      </T>
    </Pressable>
  );
}
