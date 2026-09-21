import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, Navigation } from "lucide-react-native";
import { useWeather } from "@/hooks/WeatherContext";
import { SAMPLE_RATES } from "@/constants/ble";
import { Colors } from "@/constants/theme";

function rateLabel(ms: number): string {
  const found = SAMPLE_RATES.find((r) => r.ms === ms);
  if (found) return found.label;
  return ms >= 60000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`;
}

export default function SettingsScreen() {
  const { status, data, config, setSampleInterval, calibrateNorth } = useWeather();

  const [busy, setBusy] = useState(false);
  const [rateMsg, setRateMsg] = useState<string | null>(null);
  const [northMsg, setNorthMsg] = useState<string | null>(null);

  const connected = status === "connected";

  const onPickRate = async (ms: number) => {
    if (busy) return;
    setBusy(true);
    setRateMsg(null);
    const ok = await setSampleInterval(ms);
    setBusy(false);
    setRateMsg(ok ? `Frecuencia actualizada a ${rateLabel(ms)}` : "Sin conexión con la estación");
  };

  const onCalibrate = async () => {
    if (busy) return;
    setBusy(true);
    setNorthMsg(null);
    const ok = await calibrateNorth();
    setBusy(false);
    setNorthMsg(
      ok
        ? `Norte fijado${data?.d ? ` — ahora la veleta marca ${data.d}` : ""}`
        : "Sin conexión con la estación",
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      {!connected && (
        <Text style={styles.banner}>
          Conectá la estación para aplicar cambios. Los ajustes se guardan en la estación.
        </Text>
      )}

      {/* Frecuencia de muestreo */}
      <Text style={styles.sectionTitle}>Frecuencia de muestreo</Text>
      <Text style={styles.sectionHint}>
        Cada cuánto la estación toma y envía una lectura.
      </Text>
      <View style={styles.card}>
        {SAMPLE_RATES.map((r, i) => {
          const selected = config?.intervalMs === r.ms;
          return (
            <Pressable
              key={r.ms}
              onPress={() => onPickRate(r.ms)}
              disabled={busy}
              style={[styles.row, i > 0 && styles.rowDivider]}
            >
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                {r.label}
              </Text>
              {selected && <Check size={18} color={Colors.accent} strokeWidth={2.5} />}
            </Pressable>
          );
        })}
      </View>
      {rateMsg && (
        <Text style={[styles.feedback, rateMsg.startsWith("Sin") && styles.feedbackErr]}>
          {rateMsg}
        </Text>
      )}

      {/* Norte de la veleta */}
      <Text style={[styles.sectionTitle, styles.sectionTop]}>Norte de la veleta</Text>
      <Text style={styles.sectionHint}>
        Apuntá físicamente la veleta al Norte y tocá el botón. La estación toma esa
        posición como Norte de referencia.
      </Text>
      <Pressable
        onPress={onCalibrate}
        disabled={busy}
        style={[styles.calibrateBtn, busy && styles.btnBusy]}
      >
        {busy ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <>
            <Navigation size={18} color={Colors.text} strokeWidth={2} />
            <Text style={styles.calibrateText}>Calibrar Norte</Text>
          </>
        )}
      </Pressable>
      {northMsg && (
        <Text style={[styles.feedback, northMsg.startsWith("Sin") && styles.feedbackErr]}>
          {northMsg}
        </Text>
      )}

      {/* Estado actual */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Frecuencia actual: {config ? rateLabel(config.intervalMs) : "—"}
        </Text>
        <Text style={styles.summaryText}>
          Norte (raw ADC): {config ? config.north : "—"}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  banner: {
    fontSize: 14,
    color: Colors.yellow,
    backgroundColor: "rgba(210,153,34,0.12)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 4,
  },
  sectionTop: {
    marginTop: 32,
  },
  sectionHint: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowLabel: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  rowLabelSelected: {
    color: Colors.text,
    fontWeight: "600",
  },
  feedback: {
    fontSize: 13,
    color: Colors.green,
    marginTop: 10,
  },
  feedbackErr: {
    color: Colors.red,
  },
  calibrateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
  },
  btnBusy: {
    opacity: 0.7,
  },
  calibrateText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.text,
  },
  summary: {
    marginTop: 32,
    gap: 4,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
