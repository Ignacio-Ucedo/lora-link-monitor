import { Stack } from "expo-router";

export default function WizardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="gateway-setup" />
      <Stack.Screen name="gateway-identify" />
      <Stack.Screen name="node-connect" />
      <Stack.Screen name="node-identify" />
      <Stack.Screen name="node-setup" />
      <Stack.Screen name="gps" />
      <Stack.Screen name="summary" />
    </Stack>
  );
}
