import { router } from "expo-router";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Tabs } from "expo-router";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useCommissioning } from "@/hooks/commissioning-context";
import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import { useWizardBack } from "@/hooks/use-wizard-back";

export default function GatewaySetupLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "dark";
  const theme = useTheme();
  const { goTo, setGatewayConfig } = useCommissioning();
  const { radioConfig } = useSession();
  useWizardBack("idle", "/wizard/home");

  const handleDone = () => {
    setGatewayConfig(radioConfig);
    goTo("gateway_identify");
    router.push("/wizard/gateway-identify" as any);
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[scheme].tint,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: { backgroundColor: Colors[scheme].navBakground },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Monitor",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="waveform" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="config"
          options={{
            title: "Config",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="gearshape.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="test"
          options={{
            title: "Test",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="antenna.radiowaves.left.and.right" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: "Log",
            tabBarIcon: ({ color }) => (
              <IconSymbol size={26} name="list.bullet" color={color} />
            ),
          }}
        />
      </Tabs>

      {/* FAB: avanza al siguiente paso del wizard */}
      <TouchableOpacity
        onPress={handleDone}
        style={[styles.fab, { backgroundColor: theme.green }]}
        activeOpacity={0.85}
      >
        <IconSymbol name="checkmark" size={14} color="#fff" />
        <ThemedText color="#fff" style={{ fontSize: 12, fontWeight: "700" }}>
          Listo
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 72, // above the tab bar
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
