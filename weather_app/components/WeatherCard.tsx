import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/theme";

type Props = {
  label: string;
  value: string;
  unit: string;
  icon: string;
  accent?: string;
};

export function WeatherCard({ label, value, unit, icon, accent = Colors.accent }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    flex: 1,
    gap: 4,
  },
  icon: {
    fontSize: 28,
    marginBottom: 4,
  },
  value: {
    fontSize: 38,
    fontWeight: "700",
    letterSpacing: -1,
  },
  unit: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
