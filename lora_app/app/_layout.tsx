import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { CommissioningProvider } from "@/hooks/commissioning-context";
import { SessionProvider } from "@/hooks/session-context";
import { NodeSessionProvider } from "@/hooks/node-session-context";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <CommissioningProvider>
        <SessionProvider>
          <NodeSessionProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="wizard" />
            </Stack>
            <StatusBar style="auto" />
          </NodeSessionProvider>
        </SessionProvider>
      </CommissioningProvider>
    </ThemeProvider>
  );
}
