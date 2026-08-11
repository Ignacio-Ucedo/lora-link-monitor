import { useMemo } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";

import { useSession } from "@/hooks/session-context";
import { useTheme } from "@/hooks/use-theme";
import type { Packet } from "@/lib/models";

type LogEntry =
  | { kind: "packet"; packet: Packet }
  | { kind: "lost"; seqs: number[] };

function buildLog(packets: Packet[]): LogEntry[] {
  const sorted = [...packets].sort((a, b) => b.seq - a.seq);
  const entries: LogEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    entries.push({ kind: "packet", packet: curr });
    if (next && curr.seq - next.seq > 1) {
      const lost: number[] = [];
      for (let s = curr.seq - 1; s > next.seq; s--) lost.push(s);
      entries.push({ kind: "lost", seqs: lost });
    }
  }
  return entries;
}

function ts(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function PacketRow({ packet }: { packet: Packet }) {
  const theme = useTheme();
  return (
    <View style={[styles.packetRow, { borderLeftColor: theme.brightBlue }]}>
      <View style={styles.packetHeader}>
        <ThemedText style={{ fontSize: 13, fontWeight: "bold", color: theme.brightBlue }}>
          #{packet.seq}
        </ThemedText>
        <ThemedText style={{ fontSize: 11, color: theme.gray }}>{ts(packet.timestamp)}</ThemedText>
      </View>
      <View style={styles.packetBody}>
        <ThemedText style={{ fontSize: 12, color: theme.blue }}>
          {packet.rssi.toFixed(1)} dBm
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.turquoise }}>
          {packet.snr.toFixed(1)} dB
        </ThemedText>
        <ThemedText style={{ fontSize: 12 }}>{packet.temp.toFixed(1)}°C</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>{packet.hum.toFixed(1)}%</ThemedText>
        <ThemedText style={{ fontSize: 12 }}>{packet.bat.toFixed(2)}V</ThemedText>
      </View>
    </View>
  );
}

function LostRow({ seqs }: { seqs: number[] }) {
  const theme = useTheme();
  const label =
    seqs.length === 1
      ? `#${seqs[0]}`
      : `#${seqs[seqs.length - 1]}–#${seqs[0]}`;
  return (
    <View style={[styles.lostRow, { borderLeftColor: theme.red }]}>
      <ThemedText style={{ fontSize: 12, color: theme.red }}>
        PERDIDO {label} ({seqs.length} paquete{seqs.length > 1 ? "s" : ""})
      </ThemedText>
    </View>
  );
}

export default function LogScreen() {
  const theme = useTheme();
  const { packets, stats } = useSession();

  const entries = useMemo(() => buildLog(packets.slice(0, 200)), [packets]);

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">LOG DE PAQUETES</ThemedText>
        <View style={styles.headerStats}>
          <ThemedText style={{ color: theme.gray, fontSize: 12 }}>
            RX {stats.rxCount}  Perdidos {stats.lostCount}  PDR {stats.rxCount > 0 ? `${stats.pdr.toFixed(1)}%` : "—"}
          </ThemedText>
        </View>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={{ color: theme.gray }}>Sin paquetes todavía…</ThemedText>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <Separator />}
          renderItem={({ item }) =>
            item.kind === "packet" ? (
              <PacketRow packet={item.packet} />
            ) : (
              <LostRow seqs={item.seqs} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerStats: {},
  list: { paddingHorizontal: 14, paddingVertical: 10 },
  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  packetRow: {
    paddingVertical: 8,
    paddingLeft: 10,
    borderLeftWidth: 3,
    gap: 4,
  },
  packetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  packetBody: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  lostRow: {
    paddingVertical: 6,
    paddingLeft: 10,
    borderLeftWidth: 3,
  },
});
