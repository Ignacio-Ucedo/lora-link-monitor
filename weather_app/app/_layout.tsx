import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";
import { WeatherProvider } from "@/hooks/WeatherContext";

export default function RootLayout() {
  return (
    <WeatherProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: "WeatherStation", headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ title: "Estación meteorológica" }} />
      </Stack>
    </WeatherProvider>
  );
}
