import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type TextInputInstance,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "../components/T";
import { Button, Field } from "../components/ui";
import { success, warn } from "../lib/haptics";
import { useSession } from "../lib/session";
import { c } from "../lib/theme";

export default function Login() {
  const { signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.ok) success();
    else {
      warn();
      setError(result.message);
    }
    // On success the navigator swaps to the tabs by itself.
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
          paddingTop: insets.top + 24,
          gap: 28,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <T variant="label" size={20}>
          Money
          <T variant="label" size={20} color={c.accent}>
            .
          </T>
        </T>
        <T variant="title" size={48} accessibilityRole="header">
          Sign in
        </T>
        <View style={{ gap: 16 }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <View style={{ gap: 6 }}>
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              ref={passwordRef}
            />
          </View>
          {error ? (
            <T variant="body" size={16} color={c.danger} accessibilityRole="alert">
              {error}
            </T>
          ) : null}
          <Button
            title={busy ? "Signing in…" : "Sign in"}
            onPress={submit}
            busy={busy}
            disabled={!email.trim() || !password}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
