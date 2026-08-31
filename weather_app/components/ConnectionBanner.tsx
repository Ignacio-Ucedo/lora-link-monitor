import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";
import { BLEStatus } from "@/hooks/useWeatherBLE";

type Props = { status: BLEStatus };

export function ConnectionBanner({ status }: Props) {
  const connected = status === "connected";
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: connected ? Colors.green : Colors.red }]} />
      <Text style={styles.text}>
        {connected ? "Conectado" : "Sin conexión"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: "500",
  },
});
