import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AppButton } from "@/components/app-button";
import { ThemedCard } from "@/components/themed-card";
import { ThemedText } from "@/components/themed-text";
import Separator from "@/components/separator";
import { WizardProgress } from "@/components/wizard-progress";
import { IconSymbol } from "@/components/ui/icon-symbol";

import { scanForDevices, connectToDevice } from "@/ble/ble-manager";
import { useCommissioning } from "@/hooks/commissioning-context";
import { useNodeSession } from "@/hooks/node-session-context";
import { useTheme } from "@/hooks/use-theme";
import { useWizardBack } from "@/hooks/use-wizard-back";
import { NodeBleTransport, MockNodeTransport } from "@/lib/transport";

type FoundDevice = { id: string; name: string; rssi: number };

export default function NodeConnectScreen() {
  const theme = useTheme();
  const { goTo, setNode, setNodeType } = useCommissioning();
  const { connectNode } = useNodeSession();
  useWizardBack("gateway_identify", "/wizard/gateway-identify");

  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<Record<string, FoundDevice>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [permDenied, setPermDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanHandle = useRef<{ stop: () => void } | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = () => {
    scanHandle.current?.stop();
    scanHandle.current = null;
    if (scanTimer.current) clearTimeout(scanTimer.current);
    setScanning(false);
  };

  const startScan = () => {
    setFound({});
    setError(null);
    setPermDenied(false);
    setScanning(true);

    scanHandle.current = scanForDevices(
      (device: any) => {
        // Filter: only nodes (LORA-TX-*). Gateways (LORA-RX-*) are excluded.
        if (!device?.name?.toUpperCase().includes("TX")) return;
        setFound((prev) => ({
          ...prev,
          [device.id]: { id: device.id, name: device.name, rssi: device.rssi ?? -100 },
        }));
      },
      (err: any) => {
        const msg: string = err?.message ?? "";
        if (msg.includes("not authorized")) setPermDenied(true);
        else setError("Error al escanear: " + msg);
        stopScan();
      },
    );

    scanTimer.current = setTimeout(stopScan, 10_000);
  };

  useEffect(() => () => stopScan(), []);

  const handleConnect = async (device: FoundDevice) => {
    stopScan();
    setConnecting(device.id);
    setError(null);
    try {
      const connected = await connectToDevice(device.id);
      const transport = new NodeBleTransport(connected);
      await connectNode(transport);
      const info = await transport.getDeviceInfo();
      setNode(device.id, "");
      setNodeType(info.nodeType ?? info.role ?? "node");
      goTo("node_identify");
      router.push("/wizard/node-identify" as any);
    } catch {
      setError(`No se pudo conectar a ${device.name}`);
      setConnecting(null);
    }
  };

  const handleMockConnect = async () => {
    setConnecting("mock");
    const transport = new MockNodeTransport();
    await connectNode(transport);
    setNode("mock", "");
    setNodeType("weather_station");
    goTo("node_identify");
    router.push("/wizard/node-identify" as any);
  };

  const sorted = Object.values(found).sort((a, b) => b.rssi - a.rssi);

  return (
    <SafeAreaView edges={["top"]} style={[styles.screen, { backgroundColor: theme.background }]}>
      <WizardProgress />
      <View style={[styles.titleBar, { borderBottomColor: theme.border, backgroundColor: theme.eventsCard }]}>
        <ThemedText type="title">CONECTAR NODO</ThemedText>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {permDenied ? (
          <ThemedCard gap={10}>
            <IconSymbol size={40} name="dot.radiowaves.left.and.right" color={theme.gray} />
            <ThemedText style={{ color: theme.gray, textAlign: "center", lineHeight: 20, fontSize: 13 }}>
              Permiso BLE denegado. Habilitá "Dispositivos cercanos" en los permisos de la app.
            </ThemedText>
          </ThemedCard>
        ) : (
          <>
            <ThemedCard gap={10}>
              <ThemedText style={{ color: theme.gray, fontSize: 13, lineHeight: 18 }}>
                Buscá el nodo ({'"'}LORA-TX-*{'"'}). Asegurate de que esté encendido y en modo BLE.
              </ThemedText>
              <AppButton onPress={scanning ? stopScan : startScan}>
                <ThemedText style={{ color: theme.blue, fontWeight: "600" }}>
                  {scanning ? "Detener búsqueda" : "Buscar nodo"}
                </ThemedText>
              </AppButton>
              {scanning && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color={theme.blue} />
                  <ThemedText style={{ color: theme.gray, fontSize: 12 }}>Buscando…</ThemedText>
                </View>
              )}
            </ThemedCard>

            {error && (
              <ThemedText style={{ color: theme.red, fontSize: 13, textAlign: "center" }}>
                {error}
              </ThemedText>
            )}

            {sorted.length > 0 && (
              <ThemedCard gap={0}>
                {sorted.map((device, index) => (
                  <View key={device.id}>
                    <View style={styles.deviceRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={{ fontWeight: "600", fontSize: 14 }}>{device.name}</ThemedText>
                        <ThemedText style={{ color: theme.gray, fontSize: 12 }}>{device.rssi} dBm</ThemedText>
                      </View>
                      {connecting === device.id ? (
                        <ActivityIndicator size="small" color={theme.blue} />
                      ) : (
                        <AppButton
                          onPress={connecting === null ? () => handleConnect(device) : undefined}
                          backgroundColor={theme.blue}
                          style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                        >
                          <ThemedText color="#fff" style={{ fontSize: 13 }}>Conectar</ThemedText>
                        </AppButton>
                      )}
                    </View>
                    {index < sorted.length - 1 && <Separator />}
                  </View>
                ))}
              </ThemedCard>
            )}

            <Separator />

            {/* Mock fallback for development */}
            <AppButton
              onPress={connecting === null ? handleMockConnect : undefined}
              style={{ paddingVertical: 10 }}
            >
              {connecting === "mock" ? (
                <ActivityIndicator size="small" color={theme.gray} />
              ) : (
                <ThemedText style={{ color: theme.gray, fontSize: 13 }}>
                  Usar nodo simulado (sin hardware)
                </ThemedText>
              )}
            </AppButton>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBar: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  scroll: { padding: 14, gap: 14 },
  deviceRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12,
  },
});
