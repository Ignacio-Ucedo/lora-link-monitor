import { StyleSheet } from "react-native";
import { ThemedCard } from "./themed-card";
import { ThemedViewProps } from "./themed-view";

export function DeviceCard({ style, ...props }: ThemedViewProps) {
  return <ThemedCard gap={10} style={[styles.deviceCard, style]} {...props} />;
}

const styles = StyleSheet.create({
  deviceCard: {
    flexDirection: "row",
    alignItems: "center",
  },
});
