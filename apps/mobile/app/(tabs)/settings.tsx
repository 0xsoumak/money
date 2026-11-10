import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Label, T } from "../../components/T";
import { useToast } from "../../components/Toast";
import { Button, SectionHeader } from "../../components/ui";
import { API_URL } from "../../lib/config";
import { tap } from "../../lib/haptics";
import { useSettings, useUpdateSettings } from "../../lib/queries";
import { useSession } from "../../lib/session";
import { c, radius } from "../../lib/theme";

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "AED"];
const LOCALES = [
  { value: "en-IN", label: "1,23,456 (India)" },
  { value: "en-US", label: "123,456 (US)" },
  { value: "en-GB", label: "123,456 (UK)" },
  { value: "de-DE", label: "123.456 (German)" },
  { value: "fr-FR", label: "123 456 (French)" },
];

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const settings = useSettings();
  const update = useUpdateSettings();
  const { signOut } = useSession();

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
        <Label>Number format</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {LOCALES.map((l) => (
            <Choice
              key={l.value}
              label={l.label}
              selected={settings.locale === l.value}
              onPress={() => save({ locale: l.value })}
            />
          ))}
        </View>
        <T variant="small" color={c.textMuted}>
          Changing the currency only changes how amounts are shown. It does not convert anything.
        </T>
      </View>

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
