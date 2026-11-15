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
import { useSession } from "../../lib/session";
import { c, radius } from "../../lib/theme";

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { signOut } = useSession();
  const lock = useAppLock();
  const [bioBusy, setBioBusy] = useState(false);

  const toggleBiometrics = async (on: boolean) => {
    setBioBusy(true);
    const result = await lock.setBiometricsEnabled(on);
    setBioBusy(false);
    if (result.ok) toast.show(on ? "Fingerprint unlock on" : "Fingerprint unlock off");
  };

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
                Ask for a 6-digit PIN to open the app.
              </T>
            </View>
            <Toggle
              label="App lock"
              value={lock.enabled}
              // Both directions go through the PIN screen: choose one, or prove you know it.
              onChange={(on) =>
                router.push({ pathname: "/pin", params: { mode: on ? "setup" : "disable" } })
              }
            />
          </View>
          {lock.enabled ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/pin", params: { mode: "change" } })}
                style={({ pressed }) => ({
                  minHeight: 56,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <T variant="body">Change PIN</T>
                <Feather name="chevron-right" size={22} color={c.textMuted} />
              </Pressable>
              {lock.biometricsAvailable ? (
                <View
                  style={{
                    minHeight: 56,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <T variant="body" style={{ flex: 1 }}>
                    Unlock with fingerprint
                  </T>
                  <Toggle
                    label="Unlock with fingerprint"
                    value={lock.biometricsEnabled}
                    disabled={bioBusy}
                    onChange={(on) => void toggleBiometrics(on)}
                  />
                </View>
              ) : null}
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

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      disabled={disabled}
      onValueChange={onChange}
      trackColor={{ false: c.surfaceStrong, true: c.accent }}
      thumbColor={value ? c.onAccent : c.textMuted}
    />
  );
}
