import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Droplets, Wind, CloudRain, Settings } from "lucide-react-native";
import { useWeather } from "@/hooks/WeatherContext";
import { WindCompass } from "@/components/WindCompass";
import { Reading } from "@/hooks/useWeatherBLE";
import { localDateKey } from "@/storage/dayStats";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Sparkline } from "@/components/Sparkline";
import { Palette, gradientForTemp } from "@/constants/theme";

// Margen sobre el intervalo de muestreo configurado antes de marcar "viejo".
// La estación puede muestrear de 2 s a 1 h, así que la frescura es relativa al
// intervalo, no un umbral fijo.
const STALE_GRACE_MS = 4000;

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

function agoLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.round(m / 60)} h`;
}

export default function HomeScreen() {
  const { status, data, history, lastUpdate, dayStats, config, startDemo } = useWeather();

  // Reloj de 1 s para evaluar frescura del dato.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const intervalMs = config?.intervalMs ?? 2000;
  const staleMs = intervalMs + STALE_GRACE_MS;
  const expiredMs = intervalMs * 3 + 60_000;

  const age = lastUpdate != null ? now - lastUpdate : null;
  // Dato fresco = en vivo, independientemente del estado interno BLE.
  // La conexión es infraestructura invisible; el usuario solo ve si el dato es fresco.
  const fresh = age != null && age <= staleMs;
  const live = fresh;
  const expired = age == null || age > expiredMs;

  const gradient = gradientForTemp(!expired && data?.t != null ? data.t : null);
  const trend = useMemo(() => tempTrend(history), [history]);
  // Mín/máx persistido, solo si es del día de hoy (ignora acumulados viejos
  // hasta que la primera lectura de hoy los reinicie).
  const minMax = dayStats != null && dayStats.date === localDateKey(now) ? dayStats : null;

  // Últimas 3 h de temperatura, muestreadas a ~60 puntos para el sparkline.
  const spark = useMemo(() => {
    const nowMs = Date.now();
    const temps = history.filter((r) => r.t != null && nowMs - r.ts <= 3 * 3600_000);
    if (temps.length < 2) return null;
    const spanMs = temps[temps.length - 1].ts - temps[0].ts;
    if (spanMs < 2 * 60_000) return null;
    const spanMin = Math.round(spanMs / 60_000);
    const label =
      spanMin < 90 ? `últimos ${spanMin} min` : `últimas ${Math.round(spanMin / 60)} h`;
    const N = 60;
    let values: number[];
    if (temps.length <= N) {
      values = temps.map((r) => r.t as number);
    } else {
      values = [];
      for (let i = 0; i < N; i++) {
        const idx = Math.floor((i * (temps.length - 1)) / (N - 1));
        values.push(temps[idx].t as number);
      }
    }
    return { values, label };
  }, [history]);

  const temp = data?.t != null ? data.t.toFixed(1) : "--";
  const hum = data?.h != null ? `${data.h.toFixed(0)}%` : "--";
  const windSpeed = data?.w != null ? `${data.w.toFixed(0)} km/h` : "--";
  const rain = data?.r != null ? `${data.r.toFixed(1)} mm` : "--";

  const contextParts: string[] = [];
  if (trend === "up") contextParts.push("↑ subiendo");
  if (trend === "down") contextParts.push("↓ bajando");
  // Mostrar cuando los valores redondeados difieren (evita el "0.0999… < 0.1"
  // del punto flotante y el ruido de "máx 16.9 · mín 16.9").
  if (minMax && minMax.max.toFixed(1) !== minMax.min.toFixed(1)) {
    contextParts.push(`máx ${minMax.max.toFixed(1)}°`);
    contextParts.push(`mín ${minMax.min.toFixed(1)}°`);
  }

  let livenessText: string;
  let dotColor: string | null;
  if (live) {
    livenessText = "en vivo";
    dotColor = gradient.accent;
  } else if (status === "bluetooth-off") {
    livenessText = "Bluetooth apagado";
    dotColor = null;
  } else if (age != null && !live) {
    livenessText = status === "connected" ? agoLabel(age) : `${agoLabel(age)} · buscando…`;
    dotColor = Palette.stale;
  } else if (status === "connecting") {
    livenessText = "conectando…";
    dotColor = null;
  } else if (status === "no-permission") {
    livenessText = "sin permiso de Bluetooth";
    dotColor = null;
  } else {
    livenessText = age != null ? `${agoLabel(age)} · buscando…` : "buscando…";
    dotColor = age != null ? Palette.stale : null;
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
          <View style={styles.header}>
            <Pressable
              style={styles.place}
              onLongPress={__DEV__ ? startDemo : undefined}
              delayLongPress={600}
            >
              <Text style={styles.placeText}>Estación</Text>
              {dotColor != null && (
                <View style={[styles.liveDot, { backgroundColor: dotColor }]} />
              )}
              <Text style={styles.placeText}>{livenessText}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              hitSlop={12}
              accessibilityLabel="Ajustes"
            >
              <Settings size={22} color={Palette.textSecondary} strokeWidth={2} />
            </Pressable>
          </View>

          {status === "bluetooth-off" && (
            <Text style={styles.notice}>
              Activá el Bluetooth para conectar con la estación.
            </Text>
          )}
          {status === "no-permission" && (
            <Text style={styles.notice}>
              La app necesita permiso de Bluetooth para buscar la estación.
            </Text>
          )}

          <View style={[styles.hero, !live && styles.attenuated]}>
            <View style={styles.heroRow}>
              <Text style={[styles.heroValue, { color: gradient.accent }]}>{temp}</Text>
              {data?.t != null && (
                <Text style={[styles.heroDegree, { color: gradient.accent }]}>°</Text>
              )}
            </View>
            {contextParts.length > 0 && (
              <Text style={styles.heroContext}>{contextParts.join(" · ")}</Text>
            )}
          </View>

          {spark != null && (
            <View style={[styles.spark, !live && styles.attenuated]}>
              <Sparkline values={spark.values} color={gradient.accent} height={64} />
              <Text style={styles.sparkLabel}>{spark.label}</Text>
            </View>
          )}

          {data != null && (
            <View style={[styles.belt, !live && styles.attenuated]}>
              <View style={styles.metric}>
                <View style={styles.metricIcon}>
                  <Droplets size={20} color={gradient.accent} strokeWidth={2} />
                </View>
                <Text style={styles.metricValue}>{hum}</Text>
                <Text style={styles.metricLabel}>Humedad</Text>
              </View>
              {data.w != null && (
                <View style={styles.metric}>
                  <View style={styles.metricIcon}>
                    <Wind size={20} color={gradient.accent} strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{windSpeed}</Text>
                  <Text style={styles.metricLabel}>Viento</Text>
                </View>
              )}
              {data.d != null && (
                <View style={styles.metric}>
                  <View style={styles.metricIcon}>
                    <WindCompass direction={data.d} color={gradient.accent} size={36} />
                  </View>
                  <Text style={styles.metricValue}>{data.d}</Text>
                  <Text style={styles.metricLabel}>Dirección</Text>
                </View>
              )}
              {data.r != null && (
                <View style={styles.metric}>
                  <View style={styles.metricIcon}>
                    <CloudRain size={20} color={gradient.accent} strokeWidth={2} />
                  </View>
                  <Text style={styles.metricValue}>{rain}</Text>
                  <Text style={styles.metricLabel}>Lluvia</Text>
                </View>
              )}
            </View>
          )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  notice: {
    fontSize: 14,
    fontWeight: "500",
    color: Palette.textSecondary,
    marginTop: 12,
  },
  attenuated: {
    opacity: 0.55,
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
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    flex: 1,
    minWidth: 130,
    alignItems: "center",
    gap: 6,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: Palette.surface,
  },
  // Slot de ícono de altura fija: iguala la línea de base del valor/label en
  // todas las tarjetas, sin importar que la brújula sea más alta que un ícono.
  metricIcon: {
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
});
