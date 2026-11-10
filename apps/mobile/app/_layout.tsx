import "../lib/polyfills";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "../components/Toast";
import { queryClient } from "../lib/api";
import { SessionProvider, useSession } from "../lib/session";
import { c } from "../lib/theme";

// Keep the splash screen up until the fonts and the saved sign-in have loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Navigator ready={fontsLoaded || !!fontError} />
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function Navigator({ ready }: { ready: boolean }) {
  const { isLoading, signedIn } = useSession();
  const loaded = ready && !isLoading;

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: "fade_from_bottom",
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="budget"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="categories" options={{ animation: "slide_from_right" }} />
        <Stack.Screen
          name="category"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
