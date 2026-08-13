import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useCommissioning } from "@/hooks/commissioning-context";
import type { CommissioningStep } from "@/lib/models";

const STEP_ROUTES: Record<CommissioningStep, string> = {
  idle:              "/wizard/home",
  gateway_setup:     "/wizard/gateway-setup",
  gateway_identify:  "/wizard/gateway-identify",
  node_connect:      "/wizard/node-connect",
  node_identify:     "/wizard/node-identify",
  node_config:       "/wizard/node-setup/config",
  verify_link:       "/wizard/node-setup/verify",
  gps:               "/wizard/gps",
  complete:          "/wizard/summary",
};

export default function Index() {
  const { state, loaded } = useCommissioning();

  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={STEP_ROUTES[state.step] as any} />;
}
