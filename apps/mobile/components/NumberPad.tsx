import { Feather } from "@expo/vector-icons";
import { pressKey } from "@money/shared";
import { Pressable, View } from "react-native";
import { tap } from "../lib/haptics";
import { c } from "../lib/theme";
import { T } from "./T";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "Backspace"] as const;

/** The on-screen keypad. Calls `onChange` with the new amount string after each press. */
export function NumberPad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          accessibilityRole="button"
          accessibilityLabel={k === "Backspace" ? "Delete" : k === "." ? "Decimal point" : k}
          onPress={() => {
            tap();
            onChange(pressKey(value, k));
          }}
          style={({ pressed }) => ({
            width: "32.2%",
            height: 56,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? c.surfaceStrong : c.surface,
          })}
        >
          {k === "Backspace" ? (
            <Feather name="delete" size={24} color={c.text} />
          ) : (
            <T variant="title" size={26}>
              {k}
            </T>
          )}
        </Pressable>
      ))}
    </View>
  );
}
