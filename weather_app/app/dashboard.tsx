import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useWeather } from "@/hooks/WeatherContext";
import { WeatherCard } from "@/components/WeatherCard";
import { WindGauge } from "@/components/WindGauge";
import { ConnectionBanner } from "@/components/ConnectionBanner";
import { Colors } from "@/constants/theme";

const DIR_TO_DEG: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315,
};

export default function DashboardScreen() {
  const { status, data, disconnect } = useWeather();
  const router = useRouter();
  const windDir = data?.d ?? null;
  const windDeg = windDir != null ? (DIR_TO_DEG[windDir] ?? 0) : 0;

  useEffect(() => {
    if (status === "idle") {
      router.replace("/");
    }
  }, [status, router]);

  const temp = data?.t != null ? `${data.t.toFixed(1)}` : "--";
  const hum = data?.h != null ? `${data.h.toFixed(0)}` : "--";
  const windSpeed = data?.w != null ? data.w.toFixed(1) : "--";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Estación meteorológica</Text>
        <ConnectionBanner status={status} />
      </View>

      <View style={styles.row}>
        <WeatherCard label="Temperatura" value={temp} unit="°C" icon="🌡️" accent={Colors.accent} />
        <WeatherCard label="Humedad" value={hum} unit="%" icon="💧" accent="#79C0FF" />
      </View>

      <View style={styles.row}>
        <WeatherCard
          label="Viento"
          value={windSpeed}
          unit="km/h"
          icon="💨"
          accent={Colors.green}
        />
        <View style={[styles.card]}>
          <Text style={styles.cardIcon}>🧭</Text>
          <WindGauge directionDeg={windDeg} speedKmh={data?.w ?? 0} />
          <Text style={styles.dirLabel}>{windDir ?? "--"}</Text>
          <Text style={styles.cardUnit}>Dirección</Text>
        </View>
      </View>

      <View style={styles.row}>
        <WeatherCard label="Lluvia" value="0" unit="mm" icon="🌧️" accent={Colors.textMuted} />
        <View style={[styles.card, styles.cardPlaceholder]}>
          <Text style={styles.cardIcon}>📡</Text>
          <Text style={styles.placeholderText}>Sin datos</Text>
          <Text style={styles.cardUnit}>Sin sensor</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.disconnectButton, pressed && { opacity: 0.7 }]}
        onPress={() => {
          disconnect();
          router.replace("/");
        }}
      >
        <Text style={styles.disconnectText}>Desconectar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    height: 160,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    flex: 1,
    gap: 4,
  },
  cardPlaceholder: {
    opacity: 0.5,
  },
  cardIcon: {
    fontSize: 24,
  },
  cardUnit: {
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dirLabel: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.accent,
    marginTop: 2,
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  disconnectButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  disconnectText: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: "500",
  },
});
