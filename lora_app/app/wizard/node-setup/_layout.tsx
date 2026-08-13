import { Tabs } from "expo-router";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useWizardBack } from "@/hooks/use-wizard-back";

export default function NodeSetupLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme ?? "dark";
  useWizardBack("node_connect", "/wizard/node-connect");

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[scheme].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: { backgroundColor: Colors[scheme].navBakground },
      }}
    >
      <Tabs.Screen
        name="config"
        options={{
          title: "Config nodo",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="gearshape.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="verify"
        options={{
          title: "Enlace",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="waveform" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
