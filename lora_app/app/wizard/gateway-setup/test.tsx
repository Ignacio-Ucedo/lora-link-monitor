import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "@/components/app-button";
import Separator from "@/components/separator";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";

import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import { MetricsEngine } from "@/lib/metrics-engine";
import type { Packet, SessionStatistics } from "@/lib/models";

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: "30 s", value: 30 },
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "5 min", value: 300 },
] as const;

type Phase = "idle" | "running" | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtElapsed(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function computeStats(startTime: number, pkts: Packet[]): SessionStatistics {
  const engine = new MetricsEngine();
  pkts
    .filter((p) => p.timestamp >= startTime)
    .sort((a, b) => a.seq - b.seq)
    .forEach((p) => engine.addPacket(p));
  return engine.getStatistics();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statRow}>
      <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 13, fontWeight: "500", color: color ?? theme.text }}>
        {value}
      </ThemedText>
    </View>
  );
}

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.buttonBackground }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

// ─── Idle phase ───────────────────────────────────────────────────────────────

function IdleView({
  duration,
  onSelectDuration,
  onStart,
}: {
  duration: number;
  onSelectDuration: (v: number) => void;
  onStart: () => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedCard gap={12}>
        <ThemedText type="cardTitle">DURACIÓN</ThemedText>
        <Separator />
        <View style={styles.optionGroup}>
          {DURATION_OPTIONS.map((opt) => {
            const active = opt.value === duration;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => onSelectDuration(opt.value)}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor: active ? theme.blue : theme.buttonBackground,
                    borderColor: active ? theme.blue : theme.border,
                  },
                ]}
              >
                <ThemedText color={active ? "#fff" : theme.text} style={{ fontSize: 13 }}>
                  {opt.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
      </ThemedCard>

      <ThemedCard gap={8}>
        <ThemedText style={{ color: theme.gray, fontSize: 12, lineHeight: 18 }}>
          El test mide la calidad del enlace durante el tiempo seleccionado usando los
          paquetes recibidos de la sesión activa. Iniciá el test con ambos ESP32 encendidos.
        </ThemedText>
      </ThemedCard>

      <AppButton onPress={onStart} backgroundColor={theme.blue} style={styles.mainBtn}>
        <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 1, fontSize: 15 }}>
          INICIAR TEST
        </ThemedText>
      </AppButton>
    </ScrollView>
  );
}

// ─── Running phase ────────────────────────────────────────────────────────────

const NO_PACKET_WARN_S = 12;
const AMBER = "#d3b64f";

function RunningView({
  elapsed,
  duration,
  liveStats,
  lastTestPacketTs,
  onStop,
}: {
  elapsed: number;
  duration: number;
  liveStats: SessionStatistics;
  lastTestPacketTs: number | null;
  onStop: () => void;
}) {
  const theme = useTheme();
  const progress = elapsed / duration;
  const pdrColor =
    liveStats.pdr >= 95 ? theme.green : liveStats.pdr >= 85 ? AMBER : theme.red;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sinceLastS = lastTestPacketTs !== null
    ? Math.floor((now - lastTestPacketTs) / 1000)
    : elapsed; // no packet at all yet → use elapsed as gap
  const showGapWarning = sinceLastS >= NO_PACKET_WARN_S;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedCard gap={12}>
        <View style={styles.timerRow}>
          <ThemedText style={{ fontSize: 32, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
            {fmtElapsed(elapsed)}
          </ThemedText>
          <ThemedText style={{ color: theme.gray, fontSize: 14 }}>
            / {fmtElapsed(duration)}
          </ThemedText>
        </View>
        <ProgressBar progress={progress} color={theme.blue} />
      </ThemedCard>

      <ThemedCard gap={10}>
        <ThemedText type="cardTitle">EN TIEMPO REAL</ThemedText>
        <Separator />
        <StatRow label="Paquetes RX" value={liveStats.rxCount === 0 ? "—" : String(liveStats.rxCount)} />
        <StatRow
          label="PDR"
          value={liveStats.rxCount === 0 ? "—" : `${liveStats.pdr.toFixed(1)}%`}
          color={liveStats.rxCount > 0 ? pdrColor : undefined}
        />
        <StatRow
          label="RSSI promedio"
          value={liveStats.metrics ? `${liveStats.metrics.rssiAvg.toFixed(1)} dBm` : "—"}
        />
        <StatRow
          label="SNR promedio"
          value={liveStats.metrics ? `${liveStats.metrics.snrAvg.toFixed(1)} dB` : "—"}
        />
      </ThemedCard>

      {showGapWarning && (
        <ThemedCard gap={6} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
          <ThemedText style={{ color: AMBER, fontWeight: "600", fontSize: 13 }}>
            Sin paquetes hace {sinceLastS} s
          </ThemedText>
          <ThemedText style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
            Verificá que el nodo esté encendido y que el gateway siga conectado por BLE.
          </ThemedText>
        </ThemedCard>
      )}

      <AppButton onPress={onStop} backgroundColor={theme.red} style={styles.mainBtn}>
        <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 1 }}>
          DETENER
        </ThemedText>
      </AppButton>
    </ScrollView>
  );
}

// ─── Done phase ───────────────────────────────────────────────────────────────

function DoneView({
  result,
  actualDuration,
  onReset,
}: {
  result: SessionStatistics;
  actualDuration: number;
  onReset: () => void;
}) {
  const theme = useTheme();
  const pdr = result.rxCount > 0 ? result.pdr : 0;
  const pdrColor = pdr >= 95 ? theme.green : pdr >= 85 ? "#d3b64f" : theme.red;
  const m = result.metrics;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedCard gap={10}>
        <ThemedText type="cardTitle">RESUMEN</ThemedText>
        <Separator />
        <StatRow label="Duración real" value={fmtElapsed(actualDuration)} />
        <StatRow label="TX estimados" value={String(result.txCount)} />
        <StatRow label="RX recibidos" value={String(result.rxCount)} />
        <StatRow label="Perdidos" value={String(result.lostCount)} />
        <StatRow
          label="PDR"
          value={result.rxCount > 0 ? `${pdr.toFixed(2)}%` : "—"}
          color={result.rxCount > 0 ? pdrColor : undefined}
        />
      </ThemedCard>

      {m && (
        <>
          <ThemedCard gap={10}>
            <ThemedText type="cardTitle">RSSI (dBm)</ThemedText>
            <Separator />
            <StatRow label="Promedio" value={m.rssiAvg.toFixed(1)} />
            <StatRow label="Mínimo" value={m.rssiMin.toFixed(1)} />
            <StatRow label="Máximo" value={m.rssiMax.toFixed(1)} />
            <StatRow label="Último" value={m.rssiCurrent.toFixed(1)} />
          </ThemedCard>

          <ThemedCard gap={10}>
            <ThemedText type="cardTitle">SNR (dB)</ThemedText>
            <Separator />
            <StatRow label="Promedio" value={m.snrAvg.toFixed(1)} />
            <StatRow label="Mínimo" value={m.snrMin.toFixed(1)} />
            <StatRow label="Máximo" value={m.snrMax.toFixed(1)} />
            <StatRow label="Último" value={m.snrCurrent.toFixed(1)} />
          </ThemedCard>
        </>
      )}

      {result.rxCount === 0 && (
        <ThemedCard gap={8}>
          <ThemedText style={{ color: theme.red, fontSize: 13, textAlign: "center" }}>
            Sin paquetes recibidos durante el test. Verificá que el TX esté encendido y en
            rango.
          </ThemedText>
        </ThemedCard>
      )}

      <AppButton onPress={onReset} backgroundColor={theme.blue} style={styles.mainBtn}>
        <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 1 }}>
          NUEVO TEST
        </ThemedText>
      </AppButton>
    </ScrollView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LinkTestScreen() {
  const theme = useTheme();
  const { packets } = useSession();

  const [phase, setPhase] = useState<Phase>("idle");
  const [duration, setDuration] = useState(60);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ stats: SessionStatistics; duration: number } | null>(null);

  // Stable ref so the interval always sees the latest packets without being a dep
  const packetsRef = useRef(packets);
  useEffect(() => { packetsRef.current = packets; }, [packets]);

  // Most recent packet timestamp within the current test window
  const lastTestPacketTs = useMemo<number | null>(() => {
    if (phase !== "running" || startTime === null) return null;
    return packets.find((p) => p.timestamp >= startTime)?.timestamp ?? null;
  }, [phase, startTime, packets]);

  // Live stats derived from session packets during the test window
  const liveStats = useMemo<SessionStatistics>(() => {
    if (phase !== "running" || startTime === null) return emptyStats;
    return computeStats(startTime, packets);
  }, [phase, startTime, packets]);

  // Tick: update elapsed, auto-end when done
  useEffect(() => {
    if (phase !== "running" || startTime === null) return;
    const id = setInterval(() => {
      const e = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(e);
      if (e >= duration) {
        const stats = computeStats(startTime, packetsRef.current);
        setResult({ stats, duration });
        setPhase("done");
      }
    }, 500);
    return () => clearInterval(id);
  }, [phase, startTime, duration]);

  const startTest = useCallback(() => {
    const now = Date.now();
    setStartTime(now);
    setElapsed(0);
    setResult(null);
    setPhase("running");
  }, []);

  const stopTest = useCallback(() => {
    if (startTime === null) return;
    const actual = Math.floor((Date.now() - startTime) / 1000);
    const stats = computeStats(startTime, packetsRef.current);
    setResult({ stats, duration: actual });
    setPhase("done");
  }, [startTime]);

  const reset = useCallback(() => {
    setPhase("idle");
    setStartTime(null);
    setElapsed(0);
    setResult(null);
  }, []);

  const titleLabel =
    phase === "running" ? "TEST EN CURSO" : phase === "done" ? "RESULTADO" : "LINK TEST";

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">{titleLabel}</ThemedText>
      </View>

      {phase === "idle" && (
        <IdleView duration={duration} onSelectDuration={setDuration} onStart={startTest} />
      )}
      {phase === "running" && (
        <RunningView
          elapsed={elapsed}
          duration={duration}
          liveStats={liveStats}
          lastTestPacketTs={lastTestPacketTs}
          onStop={stopTest}
        />
      )}
      {phase === "done" && result && (
        <DoneView result={result.stats} actualDuration={result.duration} onReset={reset} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const emptyStats: SessionStatistics = {
  txCount: 0, rxCount: 0, lostCount: 0, pdr: 0,
  lastPacketTs: null, avgIntervalMs: null, metrics: null,
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scroll: { padding: 14, gap: 14 },
  optionGroup: { flexDirection: "row", gap: 10 },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  mainBtn: { paddingVertical: 16 },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
});
