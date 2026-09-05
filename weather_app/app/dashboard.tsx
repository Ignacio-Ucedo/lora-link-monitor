import { useEffect, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Droplets, Wind } from "lucide-react-native";
import { useWeather } from "@/hooks/WeatherContext";
import { Reading } from "@/hooks/useWeatherBLE";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Sparkline } from "@/components/Sparkline";
import { Palette, gradientForTemp } from "@/constants/theme";

// Tendencia sobre la última media hora; con menos de 5 min de datos no se afirma nada.
function tempTrend(history: Reading[]): "up" | "down" | null {
  const now = Date.now();
  const windowed = history.filter((r) => r.t != null && now - r.ts < 30 * 60_000);
  if (windowed.length < 2) return null;
  const first = windowed[0];
  const last = windowed[windowed.length - 1];
  if (last.ts - first.ts < 5 * 60_000) return null;
  const delta = (last.t as number) - (first.t as number);
  if (Math.abs(delta) < 0.3) return null;
  return delta > 0 ? "up" : "down";
}

function dayMinMax(history: Reading[]): { min: number; max: number } | null {
  const temps = history.filter((r) => r.t != null).map((r) => r.t as number);
  if (temps.length === 0) return null;
  return { min: Math.min(...temps), max: Math.max(...temps) };
}

export default function DashboardScreen() {
  const { status, data, history, disconnect } = useWeather();
  const router = useRouter();

  useEffect(() => {
    if (status === "idle") {
      router.replace("/");
    }
  }, [status, router]);

  const gradient = gradientForTemp(data?.t ?? null);
  const trend = useMemo(() => tempTrend(history), [history]);
  const minMax = useMemo(() => dayMinMax(history), [history]);

  // Últimas 3 h de temperatura, muestreadas a ~60 puntos para el sparkline.
  const sparkValues = useMemo(() => {
    const now = Date.now();
    const temps = history.filter((r) => r.t != null && now - r.ts <= 3 * 3600_000);
    if (temps.length < 2) return [];
    const N = 60;
    if (temps.length <= N) return temps.map((r) => r.t as number);
    const out: number[] = [];
    for (let i = 0; i < N; i++) {
      const idx = Math.floor((i * (temps.length - 1)) / (N - 1));
      out.push(temps[idx].t as number);
    }
    return out;
  }, [history]);

  const temp = data?.t != null ? data.t.toFixed(1) : "--";
  const hum = data?.h != null ? `${data.h.toFixed(0)}%` : "--";
  const windSpeed = data?.w != null ? `${data.w.toFixed(0)} km/h` : "--";

  const contextParts: string[] = [];
  if (trend === "up") contextParts.push("↑ subiendo");
  if (trend === "down") contextParts.push("↓ bajando");
  if (minMax && minMax.max - minMax.min >= 0.1) {
    contextParts.push(`máx ${minMax.max.toFixed(0)}°`);
    contextParts.push(`mín ${minMax.min.toFixed(0)}°`);
  }

  return (
    <View style={styles.root}>
      <AmbientBackground gradient={gradient} />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.place}>
            <Text style={styles.placeText}>Estación</Text>
            <View style={[styles.liveDot, { backgroundColor: gradient.accent }]} />
            <Text style={styles.placeText}>en vivo</Text>
          </View>

          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <Text style={[styles.heroValue, { color: gradient.accent }]}>{temp}</Text>
              <Text style={[styles.heroDegree, { color: gradient.accent }]}>°</Text>
            </View>
            {contextParts.length > 0 && (
              <Text style={styles.heroContext}>{contextParts.join(" · ")}</Text>
            )}
          </View>

          {sparkValues.length >= 2 && (
            <View style={styles.spark}>
              <Sparkline values={sparkValues} color={gradient.accent} height={64} />
              <Text style={styles.sparkLabel}>Últimas 3 h</Text>
            </View>
          )}

          <View style={styles.belt}>
            <View style={styles.metric}>
              <Droplets size={20} color={gradient.accent} strokeWidth={2} />
              <Text style={styles.metricValue}>{hum}</Text>
              <Text style={styles.metricLabel}>Humedad</Text>
            </View>
            <View style={styles.metric}>
              <Wind size={20} color={gradient.accent} strokeWidth={2} />
              <Text style={styles.metricValue}>{windSpeed}</Text>
              <Text style={styles.metricLabel}>Viento</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.disconnect, pressed && { opacity: 0.6 }]}
            onPress={() => {
              disconnect();
              router.replace("/");
            }}
          >
            <Text style={styles.disconnectText}>Desconectar</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0D1117",
  },
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  place: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placeText: {
    fontSize: 15,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hero: {
    alignItems: "center",
    marginTop: 48,
    marginBottom: 48,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  heroValue: {
    fontSize: 96,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  heroDegree: {
    fontSize: 38,
    fontWeight: "300",
    marginTop: 14,
  },
  heroContext: {
    fontSize: 15,
    fontWeight: "500",
    color: Palette.textSecondary,
    marginTop: 4,
  },
  spark: {
    marginBottom: 32,
    gap: 8,
  },
  sparkLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  belt: {
    flexDirection: "row",
    gap: 12,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "300",
    fontVariant: ["tabular-nums"],
    color: Palette.text,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: Palette.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  disconnect: {
    marginTop: "auto",
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  disconnectText: {
    fontSize: 13,
    fontWeight: "500",
    color: Palette.textSecondary,
  },
});
