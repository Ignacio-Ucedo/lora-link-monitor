import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import { LinkStatusBadge } from "@/components/link-status-badge";

import { useNodeSession } from "@/hooks/node-session-context";
import { useCommissioning } from "@/hooks/commissioning-context";
import { useTheme } from "@/hooks/use-theme";
import type { LinkQuality } from "@/lib/models";

const AMBER = "#d3b64f";
const NO_ACK_DIAG_MS = 30_000;

const INTERVAL_OPTIONS = [
  { label: "1 s",  value: 1000 },
  { label: "2 s",  value: 2000 },
  { label: "5 s",  value: 5000 },
  { label: "10 s", value: 10000 },
] as const;

function ackLinkQuality(rssiGw: number, snrGw: number): LinkQuality {
  if (rssiGw >= -70 && snrGw >= 7) return "EXCELLENT";
  if (rssiGw >= -80 && snrGw >= 4) return "GOOD";
  if (rssiGw >= -90 && snrGw >= 0) return "ACCEPTABLE";
  return "POOR";
}

function timeSince(ts: number | null, now: number): string {
  if (ts === null) return "—";
  const s = (now - ts) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  return `${(s / 60).toFixed(1)} min`;
}

function NoAckDiagnostic() {
  const theme = useTheme();
  return (
    <ThemedCard gap={10} style={{ borderLeftWidth: 3, borderLeftColor: AMBER }}>
      <ThemedText style={{ color: AMBER, fontWeight: "600", fontSize: 13 }}>
        Sin confirmaciones del gateway
      </ThemedText>
      <Separator />
      {[
        "¿El gateway está encendido y en rango?",
        "¿La config del nodo coincide con el gateway (freq, SF, BW, CR)?",
        "¿Hay obstrucción física entre nodo y gateway?",
        "¿La antena del nodo está orientada o montada correctamente?",
      ].map((item) => (
        <ThemedText key={item} style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
          · {item}
        </ThemedText>
      ))}
    </ThemedCard>
  );
}

export default function VerifyLinkScreen() {
  const theme = useTheme();
  const {
    lastAck, lastAckTs, mode, reconnecting,
    txRunning, txIntervalMs,
    pauseTx, resumeTx, sendOne, setTxInterval,
  } = useNodeSession();
  const { goTo } = useCommissioning();

  const [now, setNow] = useState(Date.now());
  const [showDiag, setShowDiag] = useState(false);
  const noAckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (lastAckTs !== null) {
      if (noAckTimer.current) clearTimeout(noAckTimer.current);
      setShowDiag(false);
    } else {
      noAckTimer.current = setTimeout(() => setShowDiag(true), NO_ACK_DIAG_MS);
    }
    return () => { if (noAckTimer.current) clearTimeout(noAckTimer.current); };
  }, [lastAckTs]);

  const quality: LinkQuality = lastAck
    ? ackLinkQuality(lastAck.rssiGw, lastAck.snrGw)
    : "NO_LINK";

  const sinceLastAckS = lastAckTs ? (now - lastAckTs) / 1000 : null;
  const isVerified =
    lastAck !== null &&
    (quality === "EXCELLENT" || quality === "GOOD" || quality === "ACCEPTABLE");

  const handleNext = () => {
    goTo("gps");
    router.push("/wizard/gps");
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">VERIFICAR ENLACE</ThemedText>
        <ThemedText style={{
          color: reconnecting ? AMBER : mode === "mock" ? theme.gray : theme.green,
          fontSize: 11,
        }}>
          {reconnecting ? "RECONECTANDO…" : mode === "mock" ? "MODO SIMULADO" : "NODO CONECTADO"}
        </ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Reconnecting banner */}
        {reconnecting && (
          <ThemedCard gap={10} style={{ borderLeftWidth: 3, borderLeftColor: AMBER, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1, gap: 4 }}>
              <ThemedText style={{ color: AMBER, fontWeight: "600", fontSize: 13 }}>
                Conexión BLE perdida
              </ThemedText>
              <ThemedText style={{ color: theme.text, fontSize: 12 }}>
                Intentando reconectar al nodo automáticamente…
              </ThemedText>
            </View>
            <ActivityIndicator size="small" color={AMBER} />
          </ThemedCard>
        )}

        {/* Link quality badge */}
        <ThemedCard gap={10}>
          <ThemedText type="cardTitle" style={{ textAlign: "center" }}>
            CALIDAD VISTA DESDE EL GATEWAY
          </ThemedText>
          <LinkStatusBadge quality={quality} large />
          {lastAck && (
            <ThemedText style={{ color: theme.gray, fontSize: 12, textAlign: "center" }}>
              Último paquete entregado hace {timeSince(lastAckTs, now)}
            </ThemedText>
          )}
        </ThemedCard>

        {/* Last ACK detail */}
        {lastAck ? (
          <ThemedCard gap={8}>
            <ThemedText type="cardTitle">ÚLTIMO ACK DEL GATEWAY</ThemedText>
            <Separator />
            <View style={styles.row}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Seq</ThemedText>
              <ThemedText style={{ fontSize: 13, fontWeight: "500" }}>#{lastAck.seqAck}</ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>RSSI (gateway)</ThemedText>
              <ThemedText style={{
                fontSize: 13, fontWeight: "500",
                color: lastAck.rssiGw >= -80 ? theme.green : lastAck.rssiGw >= -90 ? AMBER : theme.red,
              }}>
                {lastAck.rssiGw.toFixed(1)} dBm
              </ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText style={{ color: theme.gray, fontSize: 12 }}>SNR (gateway)</ThemedText>
              <ThemedText style={{
                fontSize: 13, fontWeight: "500",
                color: lastAck.snrGw >= 4 ? theme.green : lastAck.snrGw >= 0 ? AMBER : theme.red,
              }}>
                {lastAck.snrGw.toFixed(1)} dB
              </ThemedText>
            </View>
            {sinceLastAckS !== null && sinceLastAckS > txIntervalMs / 1000 + 4 && (
              <ThemedText style={{ color: AMBER, fontSize: 12 }}>
                Sin ACK desde hace {sinceLastAckS.toFixed(0)} s
              </ThemedText>
            )}
          </ThemedCard>
        ) : (
          <ThemedCard gap={8}>
            <ThemedText style={{ color: theme.gray, fontSize: 13, textAlign: "center" }}>
              Esperando confirmaciones del gateway…{"\n"}
              El nodo transmite cada {txIntervalMs / 1000} s.
            </ThemedText>
          </ThemedCard>
        )}

        {showDiag && <NoAckDiagnostic />}

        {/* TX control */}
        <ThemedCard gap={12} style={{ opacity: reconnecting ? 0.4 : 1 }}>
          <View style={styles.txHeader}>
            <ThemedText type="cardTitle">CONTROL TX</ThemedText>
            <View style={styles.txStatus}>
              <View style={[styles.txDot, { backgroundColor: txRunning ? theme.green : theme.gray }]} />
              <ThemedText style={{ fontSize: 12, color: txRunning ? theme.green : theme.gray }}>
                {txRunning ? `TX activo · cada ${txIntervalMs / 1000} s` : "TX pausado"}
              </ThemedText>
            </View>
          </View>

          <View style={styles.txButtons}>
            <AppButton
              onPress={txRunning ? pauseTx : resumeTx}
              style={[styles.txBtn, { borderColor: theme.border, borderWidth: 1 }]}
            >
              <ThemedText style={{ color: txRunning ? theme.red : theme.green, fontWeight: "600", fontSize: 13 }}>
                {txRunning ? "Pausar" : "Reanudar"}
              </ThemedText>
            </AppButton>
            <AppButton
              onPress={sendOne}
              style={[styles.txBtn, { borderColor: theme.border, borderWidth: 1 }]}
            >
              <ThemedText style={{ color: theme.blue, fontWeight: "600", fontSize: 13 }}>
                Enviar uno
              </ThemedText>
            </AppButton>
          </View>

          <Separator />

          <ThemedText type="cardTitle" style={{ fontSize: 11 }}>INTERVALO</ThemedText>
          <View style={styles.intervalRow}>
            {INTERVAL_OPTIONS.map((opt) => {
              const active = opt.value === txIntervalMs;
              return (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setTxInterval(opt.value)}
                  style={[
                    styles.intervalBtn,
                    {
                      backgroundColor: active ? theme.blue : theme.buttonBackground,
                      borderColor: active ? theme.blue : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    color={active ? "#fff" : theme.text}
                    style={{ fontSize: 12 }}
                  >
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </ThemedCard>

        {/* Weak link hint */}
        {!isVerified && lastAck && quality === "POOR" && (
          <ThemedCard gap={6} style={{ borderLeftWidth: 3, borderLeftColor: theme.red }}>
            <ThemedText style={{ color: theme.red, fontSize: 12, fontWeight: "600" }}>
              Enlace débil
            </ThemedText>
            <ThemedText style={{ color: theme.text, fontSize: 12, lineHeight: 18 }}>
              Reubicá, elevá o reorientá la antena del nodo y esperá nuevos paquetes.
            </ThemedText>
          </ThemedCard>
        )}

        {/* Continue */}
        {isVerified && (
          <AppButton onPress={handleNext} backgroundColor={theme.green} style={styles.nextBtn}>
            <ThemedText color="#fff" style={{ fontWeight: "bold", letterSpacing: 0.5 }}>
              ENLACE VERIFICADO — SIGUIENTE
            </ThemedText>
          </AppButton>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 2 },
  scroll: { padding: 14, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  txHeader: { gap: 6 },
  txStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  txDot: { width: 7, height: 7, borderRadius: 3.5 },
  txButtons: { flexDirection: "row", gap: 10 },
  txBtn: { flex: 1, paddingVertical: 10, borderRadius: 8 },
  intervalRow: { flexDirection: "row", gap: 8 },
  intervalBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  nextBtn: { paddingVertical: 16 },
});
