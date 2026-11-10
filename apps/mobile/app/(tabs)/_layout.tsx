import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { type ColorValue, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tap } from "../../lib/haptics";
import { MonthProvider } from "../../lib/month";
import { c } from "../../lib/theme";

const TAB_BAR = 64;

type IconName = React.ComponentProps<typeof Feather>["name"];
const icon =
  (name: IconName) =>
  ({ color }: { color: ColorValue }) => <Feather name={name} size={22} color={color as string} />;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <MonthProvider>
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: c.bg },
            tabBarActiveTintColor: c.accent,
            tabBarInactiveTintColor: c.textMuted,
            tabBarStyle: {
              backgroundColor: c.bg,
              borderTopColor: c.borderStrong,
              borderTopWidth: 2,
              height: TAB_BAR + insets.bottom,
              paddingBottom: insets.bottom + 6,
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontFamily: "SpaceGrotesk_700Bold",
              fontSize: 10.5,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            },
          }}
        >
          <Tabs.Screen name="index" options={{ title: "Overview", tabBarIcon: icon("home") }} />
          <Tabs.Screen name="activity" options={{ title: "Activity", tabBarIcon: icon("list") }} />
          <Tabs.Screen
            name="new"
            options={{
              title: "Add",
              tabBarButton: () => (
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add transaction"
                    onPress={() => {
                      tap();
                      router.push("/add");
                    }}
                    style={({ pressed }) => ({
                      width: 58,
                      height: 58,
                      marginTop: -14,
                      borderRadius: 18,
                      backgroundColor: c.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <Feather name="plus" size={30} color={c.onAccent} />
                  </Pressable>
                </View>
              ),
            }}
          />
          <Tabs.Screen
            name="budgets"
            options={{ title: "Budgets", tabBarIcon: icon("bar-chart-2") }}
          />
          <Tabs.Screen
            name="settings"
            options={{ title: "Settings", tabBarIcon: icon("sliders") }}
          />
        </Tabs>
      </View>
    </MonthProvider>
  );
}
