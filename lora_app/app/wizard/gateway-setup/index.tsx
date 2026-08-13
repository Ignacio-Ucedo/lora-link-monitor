import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LinkStatusBadge } from "@/components/link-status-badge";
import { SignalChart } from "@/components/signal-chart";
import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import NearDevicesScreen from "@/ble/near-devices-screen";
import { connectToDevice } from "@/ble/ble-manager";
import { getKnownDevice, clearKnownDevice } from "@/ble/device-storage";

import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import { GatewayBleTransport } from "@/lib/transport";

const AMBER = "#d3b64f";
const NO_LINK_DIAG_DELAY_MS = 30_000;

function fmt1(n: number) { return n.toFixed(1); }

function timeSince(ts: number | null): string {
  if (ts === null) return "—";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${(s / 60).toFixed(1)}min`;
}

function pdrColor(pdr: number, green: string, red: string) {
  if (pdr >= 98) return green;
  if (pdr >= 85) return AMBER;
  return red;
}
function rssiColor(rssi: number, green: string, red: string) {
  if (rssi >= -70) return green;
  if (rssi >= -90) return AMBER;
  return red;
}
function snrColor(snr: number, green: string, red: string) {
  if (snr >= 7) return green;
  if (snr >= 0) return AMBER;
  return red;
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.statRow}>
      <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{label}</ThemedText>
      <ThemedText color={valueColor} style={{ fontSize: 13, fontWeight: "500" }}>{value}</ThemedText>
    </View>
  );
}

function NoLinkDiagnostic() {
  const theme = useTheme();
  return (
    <ThemedCard gap={10} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
      <ThemedText style={{ color: AMBER, fontWeight: "600", fontSize: 13 }}>
        Sin enlace — posibles causas
      </ThemedText>
      <Separator />
      {[
        "¿El nodo está encendido?",
        "¿Frecuencia, SF, BW y CR del nodo coinciden con el gateway?",
        "¿Hay obstrucción física entre nodo y gateway?",
        "¿La antena del nodo está orientada correctamente?",
      ].map((item) => (
        <ThemedText key={item} style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
          · {item}
        </ThemedText>
      ))}
    </ThemedCard>
  );
}

export default function GatewayMonitorScreen() {
  const theme = useTheme();
  const { mode, packets, stats, linkQuality, reset, switchToMock, switchToBle } = useSession();
  const [showConnect, setShowConnect] = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const cancelled = useRef(false);
  const noLinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    cancelled.current = false;
    async function tryAutoConnect() {
      const saved = await getKnownDevice();
      if (!saved || cancelled.current) return;
      setAutoConnecting(true);
      try {
        const device = await connectToDevice(saved.id);
        if (!cancelled.current) switchToBle(new GatewayBleTransport(device));
      } catch {
        await clearKnownDevice();
      } finally {
        if (!cancelled.current) setAutoConnecting(false);
      }
    }
    if (mode === "mock") tryAutoConnect();
    return () => { cancelled.current = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NO_LINK diagnostic: show after 30s of NO_LINK
  useEffect(() => {
    if (linkQuality === "NO_LINK") {
      noLinkTimer.current = setTimeout(() => setShowDiag(true), NO_LINK_DIAG_DELAY_MS);
    } else {
      if (noLinkTimer.current) clearTimeout(noLinkTimer.current);
      setShowDiag(false);
    }
    return () => {
      if (noLinkTimer.current) clearTimeout(noLinkTimer.current);
    };
  }, [linkQuality]);

  const rssiData = useMemo(
    () => packets.slice(0, 30).reverse().map((p) => p.rssi),
    [packets],
  );
  const snrData = useMemo(
    () => packets.slice(0, 30).reverse().map((p) => p.snr),
    [packets],
  );
  const m = stats.metrics;

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />

      <View style={[styles.header, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <View style={styles.headerLeft}>
          {autoConnecting
            ? <ActivityIndicator size="small" color={theme.blue} style={{ marginRight: 2 }} />
            : <View style={[styles.dot, { backgroundColor: mode === "mock" ? theme.gray : theme.green }]} />
          }
          <ThemedText style={{ fontSize: 12, color: autoConnecting ? theme.blue : theme.gray }}>
            {autoConnecting ? "RECONECTANDO…" : mode === "mock" ? "MODO SIMULADO" : "GATEWAY CONECTADO"}
          </ThemedText>
        </View>

        {mode === "mock" ? (
          <AppButton
            onPress={autoConnecting ? undefined : () => setShowConnect(true)}
            padding={0}
            style={styles.headerBtn}
          >
            <ThemedText style={{ fontSize: 11, color: autoConnecting ? theme.gray : theme.blue, paddingHorizontal: 10, paddingVertical: 4 }}>
              CONECTAR
            </ThemedText>
          </AppButton>
        ) : (
          <View style={styles.headerRight}>
            <AppButton onPress={reset} padding={0} style={styles.headerBtn}>
              <ThemedText style={{ fontSize: 11, color: theme.gray, paddingHorizontal: 8, paddingVertical: 4 }}>
                REINICIAR
              </ThemedText>
            </AppButton>
            <AppButton onPress={switchToMock} padding={0} style={styles.headerBtn}>
              <ThemedText style={{ fontSize: 11, color: theme.red, paddingHorizontal: 8, paddingVertical: 4 }}>
                DESCONECTAR
              </ThemedText>
            </AppButton>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle" style={{ textAlign: "center" }}>ESTADO DEL ENLACE</ThemedText>
          <LinkStatusBadge quality={linkQuality} large />
          {m && (
            <Text style={{ color: theme.gray, fontSize: 12, textAlign: "center" }}>
              PDR{" "}
              <Text style={{ color: pdrColor(stats.pdr, theme.green, theme.red) }}>
                {fmt1(stats.pdr)}%
              </Text>
              {"  ·  "}RSSI{" "}
              <Text style={{ color: rssiColor(m.rssiCurrent, theme.green, theme.red) }}>
                {fmt1(m.rssiCurrent)} dBm
              </Text>
              {"  ·  "}SNR{" "}
              <Text style={{ color: snrColor(m.snrCurrent, theme.green, theme.red) }}>
                {fmt1(m.snrCurrent)} dB
              </Text>
            </Text>
          )}
        </ThemedCard>

        {showDiag && <NoLinkDiagnostic />}

        <View style={styles.row}>
          <ThemedCard gap={6} style={styles.halfCard}>
            <ThemedText type="cardTitle">PAQUETES</ThemedText>
            <Separator />
            <StatRow label="TX" value={stats.txCount.toString()} />
            <StatRow label="RX" value={stats.rxCount.toString()} />
            <StatRow
              label="Perdidos"
              value={stats.lostCount.toString()}
              valueColor={stats.lostCount > 0 ? (stats.pdr >= 85 ? AMBER : theme.red) : undefined}
            />
            <StatRow
              label="PDR"
              value={stats.rxCount > 0 ? `${fmt1(stats.pdr)}%` : "—"}
              valueColor={stats.rxCount > 0 ? pdrColor(stats.pdr, theme.green, theme.red) : undefined}
            />
          </ThemedCard>

          <View style={styles.halfCard}>
            <ThemedCard gap={6} style={{ flex: 1 }}>
              <ThemedText type="cardTitle">RSSI</ThemedText>
              <Separator />
              <StatRow label="actual" value={m ? `${fmt1(m.rssiCurrent)} dBm` : "—"}
                valueColor={m ? rssiColor(m.rssiCurrent, theme.green, theme.red) : undefined} />
              <StatRow label="prom." value={m ? `${fmt1(m.rssiAvg)} dBm` : "—"}
                valueColor={m ? rssiColor(m.rssiAvg, theme.green, theme.red) : undefined} />
              <StatRow label="mín." value={m ? `${fmt1(m.rssiMin)} dBm` : "—"} />
              <StatRow label="máx." value={m ? `${fmt1(m.rssiMax)} dBm` : "—"} />
            </ThemedCard>
            <ThemedCard gap={6} style={{ flex: 1 }}>
              <ThemedText type="cardTitle">SNR</ThemedText>
              <Separator />
              <StatRow label="actual" value={m ? `${fmt1(m.snrCurrent)} dB` : "—"}
                valueColor={m ? snrColor(m.snrCurrent, theme.green, theme.red) : undefined} />
              <StatRow label="prom." value={m ? `${fmt1(m.snrAvg)} dB` : "—"}
                valueColor={m ? snrColor(m.snrAvg, theme.green, theme.red) : undefined} />
              <StatRow label="mín." value={m ? `${fmt1(m.snrMin)} dB` : "—"} />
              <StatRow label="máx." value={m ? `${fmt1(m.snrMax)} dB` : "—"} />
            </ThemedCard>
          </View>
        </View>

        <ThemedCard gap={12}>
          <SignalChart data={rssiData} color={theme.brightBlue} label="RSSI" unit="dBm" yMin={-110} yMax={-40} />
          <SignalChart data={snrData} color={theme.turquoise} label="SNR" unit="dB" yMin={-10} yMax={15} />
        </ThemedCard>

        <ThemedCard gap={6}>
          <ThemedText type="cardTitle">TIEMPOS</ThemedText>
          <Separator />
          <StatRow label="Último paquete" value={timeSince(stats.lastPacketTs)} />
          <StatRow
            label="Intervalo prom."
            value={stats.avgIntervalMs ? `${(stats.avgIntervalMs / 1000).toFixed(2)}s` : "—"}
          />
        </ThemedCard>
      </ScrollView>

      <Modal
        visible={showConnect}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowConnect(false)}
      >
        <SafeAreaView style={[styles.modalScreen, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
            <ThemedText type="title">Conectar gateway</ThemedText>
            <TouchableOpacity onPress={() => setShowConnect(false)} hitSlop={12}>
              <ThemedText style={{ color: theme.gray, fontSize: 22 }}>✕</ThemedText>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <NearDevicesScreen onConnected={() => setShowConnect(false)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerRight: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerBtn: { borderRadius: 6 },
  scroll: { padding: 14, gap: 12 },
  row: { flexDirection: "row", gap: 12 },
  halfCard: { flex: 1, gap: 12 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  modalScroll: { padding: 14 },
});
